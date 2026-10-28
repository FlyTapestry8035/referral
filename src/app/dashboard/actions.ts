"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROGRAM_COOKIE, getMemberships, requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCodeSchema, inviteSchema, missionSchema, testerPatchSchema, uuid, fieldErrors } from "@/lib/validation";
import { insertCode, inviteTester, sendInviteEmail } from "@/lib/invites";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

function fail(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

function refresh() {
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------------------
// Program switcher
// ---------------------------------------------------------------------------
export async function selectProgramAction(programId: string): Promise<ActionResult> {
  const id = uuid.safeParse(programId);
  if (!id.success) return { ok: false, error: "Unknown program" };
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, company_id").eq("id", id.data).maybeSingle();
  const memberships = await getMemberships();
  if (!program || !memberships.some((m) => m.companyId === program.company_id)) return { ok: false, error: "Unknown program" };
  (await cookies()).set(PROGRAM_COOKIE, program.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Testers
// ---------------------------------------------------------------------------
async function testerProgram(testerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("testers").select("id, program_id, name, email, user_id, referral_code_id").eq("id", testerId).maybeSingle();
  if (!data) throw new Error("Tester not found");
  return data;
}

export async function updateTesterFieldAction(input: { testerId: string; field: "name" | "notes"; value: string }): Promise<ActionResult> {
  const parsed = testerPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid value" };
  try {
    const tester = await testerProgram(parsed.data.testerId);
    const { supabase } = await requireEditor(tester.program_id);
    const value = parsed.data.field === "name" ? parsed.data.value.trim() : parsed.data.value;
    const { data, error } = await supabase
      .from("testers")
      .update(parsed.data.field === "name" ? { name: value } : { notes: value })
      .eq("id", tester.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Not allowed" };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setTesterAccessAction(testerId: string, revoke: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(testerId).success) return { ok: false, error: "Unknown tester" };
  try {
    const tester = await testerProgram(testerId);
    const { supabase } = await requireEditor(tester.program_id);
    const { error } = await supabase
      .from("testers")
      .update({ access_revoked_at: revoke ? new Date().toISOString() : null })
      .eq("id", tester.id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, message: revoke ? "Access revoked" : "Access restored" };
  } catch (e) {
    return fail(e);
  }
}

export async function resendInviteAction(testerId: string): Promise<ActionResult> {
  if (!uuid.safeParse(testerId).success) return { ok: false, error: "Unknown tester" };
  try {
    const tester = await testerProgram(testerId);
    const { supabase, program, user } = await requireEditor(tester.program_id);
    if (tester.user_id) return { ok: false, error: "This tester already has an account." };

    // Reuse their code if it can still be redeemed, otherwise issue a new single-use code.
    let code: string | null = null;
    if (tester.referral_code_id) {
      const { data: c } = await supabase.from("referral_codes").select("*").eq("id", tester.referral_code_id).maybeSingle();
      if (c && !c.revoked_at && (!c.expires_at || new Date(c.expires_at) > new Date()) && (c.max_uses === null || c.uses < c.max_uses)) {
        code = c.code;
      }
    }
    if (!code) {
      const fresh = await insertCode(supabase, { program_id: program.id, label: `Invite: ${tester.email}`, max_uses: 1, created_by: user.id });
      await createAdminClient().from("testers").update({ referral_code_id: fresh.id }).eq("id", tester.id);
      code = fresh.code;
    }
    const result = await sendInviteEmail({ programId: program.id, programName: program.name, testerId: tester.id, name: tester.name, email: tester.email, code });
    if (result.status === "failed") return { ok: false, error: `Email failed: ${result.error}` };
    refresh();
    return { ok: true, message: result.status === "stubbed" ? "Invite logged to the server console (no RESEND_API_KEY)" : "Invite sent" };
  } catch (e) {
    return fail(e);
  }
}

export async function inviteByEmailAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse({ programId: formData.get("programId"), name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  try {
    const { supabase, program, user } = await requireEditor(parsed.data.programId);
    const result = await inviteTester(supabase, {
      programId: program.id,
      programName: program.name,
      name: parsed.data.name,
      email: parsed.data.email,
      createdBy: user.id,
    });
    if (!result.ok) return { ok: false, error: result.error };
    refresh();
    return {
      ok: true,
      message:
        result.email === "stubbed"
          ? `Invited with ${result.code}. Email printed to the server console (RESEND_API_KEY not set).`
          : result.email === "failed"
            ? `Created ${result.code}, but the email failed to send. Use "Resend invite".`
            : `Invite sent with code ${result.code}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------
export async function createCodeAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const kind = formData.get("kind");
  const parsed = createCodeSchema.safeParse({
    programId: formData.get("programId"),
    label: formData.get("label") ?? "",
    maxUses: kind === "single" ? 1 : kind === "unlimited" ? "" : formData.get("maxUses"),
    expiresAt: formData.get("expiresAt") ? new Date(`${formData.get("expiresAt")}T23:59:59`).toISOString() : "",
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (kind === "limited" && !parsed.data.maxUses) return { ok: false, error: "Enter how many times the code can be used.", fields: { maxUses: "Required" } };
  try {
    const { supabase, user } = await requireEditor(parsed.data.programId);
    const code = await insertCode(supabase, {
      program_id: parsed.data.programId,
      label: parsed.data.label || null,
      max_uses: parsed.data.maxUses,
      expires_at: parsed.data.expiresAt,
      created_by: user.id,
    });
    refresh();
    return { ok: true, message: `Created ${code.code}` };
  } catch (e) {
    return fail(e);
  }
}

export async function setCodeRevokedAction(codeId: string, revoked: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(codeId).success) return { ok: false, error: "Unknown code" };
  const supabase = await createClient();
  const { data: code } = await supabase.from("referral_codes").select("id, program_id").eq("id", codeId).maybeSingle();
  if (!code) return { ok: false, error: "Unknown code" };
  try {
    await requireEditor(code.program_id);
    const { error } = await supabase.from("referral_codes").update({ revoked_at: revoked ? new Date().toISOString() : null }).eq("id", code.id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------
export async function createMissionAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = missionSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  try {
    const { supabase } = await requireEditor(parsed.data.programId);
    const { data: last } = await supabase
      .from("missions")
      .select("position")
      .eq("program_id", parsed.data.programId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("missions").insert({
      program_id: parsed.data.programId,
      title: parsed.data.title,
      description: parsed.data.description,
      position: (last?.position ?? 0) + 1,
    });
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, message: "Mission added" };
  } catch (e) {
    return fail(e);
  }
}

const missionUpdateSchema = z.object({
  missionId: uuid,
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(5000),
});

export async function updateMissionAction(input: { missionId: string; title: string; description: string }): Promise<ActionResult> {
  const parsed = missionUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid mission" };
  const supabase = await createClient();
  const { data: mission } = await supabase.from("missions").select("id, program_id").eq("id", parsed.data.missionId).maybeSingle();
  if (!mission) return { ok: false, error: "Unknown mission" };
  try {
    await requireEditor(mission.program_id);
    const { error } = await supabase.from("missions").update({ title: parsed.data.title, description: parsed.data.description }).eq("id", mission.id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMissionAction(missionId: string): Promise<ActionResult> {
  if (!uuid.safeParse(missionId).success) return { ok: false, error: "Unknown mission" };
  const supabase = await createClient();
  const { data: mission } = await supabase.from("missions").select("id, program_id").eq("id", missionId).maybeSingle();
  if (!mission) return { ok: false, error: "Unknown mission" };
  try {
    await requireEditor(mission.program_id);
    const { error } = await supabase.from("missions").delete().eq("id", mission.id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Moves a mission one step up or down by swapping positions with its neighbour. */
export async function moveMissionAction(missionId: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!uuid.safeParse(missionId).success) return { ok: false, error: "Unknown mission" };
  const supabase = await createClient();
  const { data: mission } = await supabase.from("missions").select("id, program_id").eq("id", missionId).maybeSingle();
  if (!mission) return { ok: false, error: "Unknown mission" };
  try {
    await requireEditor(mission.program_id);
    const { data: all } = await supabase.from("missions").select("id, position").eq("program_id", mission.program_id).order("position").order("created_at");
    const list = all ?? [];
    const i = list.findIndex((m) => m.id === mission.id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    // Renumber 1..n so positions stay unique and gap-free.
    for (const [index, m] of list.entries()) {
      if (m.position !== index + 1) await supabase.from("missions").update({ position: index + 1 }).eq("id", m.id);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
