"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PROGRAM_COOKIE, getMemberships, getSessionUser, requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrors, memberSchema, programCreateSchema, programSettingsSchema, uuid } from "@/lib/validation";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { memberInviteEmail } from "@/lib/email/messages";
import DigestEmail from "@/emails/digest";
import type { ActionResult } from "@/app/dashboard/actions";

export async function updateProgramSettingsAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = programSettingsSchema.safeParse({
    programId: formData.get("programId"),
    name: formData.get("name"),
    productName: formData.get("productName") ?? "",
    digestEnabled: formData.get("digestEnabled") === "on",
    digestIntervalDays: formData.get("digestIntervalDays"),
    digestSendHour: formData.get("digestSendHour"),
    digestTimezone: formData.get("digestTimezone"),
    digestSubject: formData.get("digestSubject"),
    digestIntro: formData.get("digestIntro") ?? "",
    nudgesEnabled: formData.get("nudgesEnabled") === "on",
    nudgeInactiveDays: formData.get("nudgeInactiveDays"),
    nudgeStuckDays: formData.get("nudgeStuckDays"),
    nominationMinHelpfulness: formData.get("nominationMinHelpfulness"),
    nominationsPerTester: formData.get("nominationsPerTester"),
    termsText: formData.get("termsText") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const { supabase } = await requireEditor(v.programId);
    const { data: before } = await supabase.from("programs").select("terms_text").eq("id", v.programId).single();
    const { error } = await supabase
      .from("programs")
      .update({
        name: v.name,
        product_name: v.productName,
        digest_enabled: v.digestEnabled,
        digest_interval_days: v.digestIntervalDays,
        digest_send_hour: v.digestSendHour,
        digest_timezone: v.digestTimezone,
        digest_subject: v.digestSubject,
        digest_intro: v.digestIntro,
        nudges_enabled: v.nudgesEnabled,
        nudge_inactive_days: v.nudgeInactiveDays,
        nudge_stuck_days: v.nudgeStuckDays,
        nomination_min_helpfulness: v.nominationMinHelpfulness,
        nominations_per_tester: v.nominationsPerTester,
        terms_text: v.termsText,
      })
      .eq("id", v.programId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    const termsChanged = before?.terms_text !== v.termsText;
    return { ok: true, message: termsChanged ? "Saved. Terms changed, so testers will be asked to accept them again." : "Saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not allowed" };
  }
}

/** Sends the digest as it would look, to the signed-in member. Links point to a harmless preview page. */
export async function sendTestDigestAction(programId: string): Promise<ActionResult> {
  if (!uuid.safeParse(programId).success) return { ok: false, error: "Unknown program" };
  const user = await getSessionUser();
  if (!user?.email) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("*").eq("id", programId).maybeSingle();
  if (!program) return { ok: false, error: "Unknown program" };
  const { data: mission } = await supabase.from("missions").select("title, description").eq("program_id", programId).order("position").limit(1).maybeSingle();

  const preview = appUrl("/f/test");
  const result = await sendEmail({
    to: user.email,
    subject: `[Test] ${program.digest_subject}`,
    react: DigestEmail({
      testerName: "there",
      programName: program.product_name || program.name,
      intro: program.digest_intro,
      nextMission: mission ?? null,
      bugUrl: preview,
      tipUrl: preview,
      unsubscribeUrl: preview,
    }),
  });
  if (result.status === "failed") return { ok: false, error: `Email failed: ${result.error}` };
  return {
    ok: true,
    message: result.status === "stubbed" ? `RESEND_API_KEY is not set, so the email was printed to the server console instead of sent to ${user.email}.` : `Test email sent to ${user.email}.`,
  };
}

export async function createProgramAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = programCreateSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    productName: formData.get("productName") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const memberships = await getMemberships();
  const m = memberships.find((x) => x.companyId === parsed.data.companyId);
  if (!m || m.role === "viewer") return { ok: false, error: "You need the admin or owner role to create programs." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({ company_id: parsed.data.companyId, name: parsed.data.name, product_name: parsed.data.productName })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the program" };
  (await cookies()).set(PROGRAM_COOKIE, data.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Created ${parsed.data.name}. You're now viewing it.` };
}

export async function addMemberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = memberSchema.safeParse({ companyId: formData.get("companyId"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const { companyId, email, role } = parsed.data;
  const memberships = await getMemberships();
  const me = memberships.find((x) => x.companyId === companyId);
  if (!me || me.role === "viewer") return { ok: false, error: "You need the admin or owner role to add people." };
  if (role === "owner" && me.role !== "owner") return { ok: false, error: "Only owners can add owners." };

  const admin = createAdminClient();
  // New person: create an invited (unconfirmed) user and email a set-password link.
  // Existing account: just add the membership.
  let userId: string | null = null;
  let inviteUrl: string | null = null;
  const invite = await admin.auth.admin.generateLink({ type: "invite", email });
  if (invite.data?.user && invite.data.properties?.hashed_token) {
    userId = invite.data.user.id;
    inviteUrl = appUrl(`/auth/confirm?token_hash=${encodeURIComponent(invite.data.properties.hashed_token)}&type=invite&next=/reset-password`);
  } else {
    const existing = await admin.auth.admin.generateLink({ type: "magiclink", email });
    userId = existing.data?.user?.id ?? null;
  }
  if (!userId) return { ok: false, error: "Could not find or create that user." };

  // Insert with the member's own session so RLS decides (e.g. admins can't create owners).
  const supabase = await createClient();
  const { error } = await supabase.from("company_members").insert({ company_id: companyId, user_id: userId, role });
  if (error) return { ok: false, error: error.code === "23505" ? "That person is already a member." : error.message };

  const result = await sendEmail(memberInviteEmail(email, me.companyName, role, inviteUrl ?? appUrl("/login")));
  revalidatePath("/dashboard/settings");
  return { ok: true, message: result.status === "stubbed" ? `Added ${email}. Email printed to the server console (no RESEND_API_KEY).` : `Added ${email} as ${role}.` };
}

export async function updateMemberAction(companyId: string, userId: string, role: "owner" | "admin" | "viewer" | "remove"): Promise<ActionResult> {
  if (!uuid.safeParse(companyId).success || !uuid.safeParse(userId).success) return { ok: false, error: "Unknown member" };
  const me = await getSessionUser();
  if (me?.id === userId) return { ok: false, error: "You can't change your own role." };
  const supabase = await createClient();
  const query =
    role === "remove"
      ? supabase.from("company_members").delete().eq("company_id", companyId).eq("user_id", userId).select()
      : supabase.from("company_members").update({ role }).eq("company_id", companyId).eq("user_id", userId).select();
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not allowed. Only owners can change roles." };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
