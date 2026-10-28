"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, rewardSchema, uuid, webhookSchema } from "@/lib/validation";
import { inviteTester } from "@/lib/invites";
import { isBlockedWebhookUrl, signatureHeader } from "@/lib/webhook-signing";
import type { ActionResult } from "@/app/dashboard/actions";

const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const refresh = () => revalidatePath("/dashboard", "layout");

async function programOf(table: "rewards" | "nominations" | "webhooks", id: string) {
  if (!uuid.safeParse(id).success) throw new Error("Not found");
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("program_id").eq("id", id).maybeSingle();
  if (!data) throw new Error("Not found");
  return data.program_id;
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------
export async function createRewardAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = rewardSchema.safeParse({
    programId: formData.get("programId"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    badge: formData.get("badge") || "🏅",
    metric: formData.get("metric"),
    threshold: formData.get("threshold"),
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (["helpfulness", "progress"].includes(parsed.data.metric) && parsed.data.threshold > 100) {
    return { ok: false, error: "That metric goes up to 100.", fields: { threshold: "Max 100" } };
  }
  try {
    const { supabase } = await requireEditor(parsed.data.programId);
    const { error } = await supabase.from("rewards").insert({
      program_id: parsed.data.programId,
      name: parsed.data.name,
      description: parsed.data.description,
      badge: parsed.data.badge,
      metric: parsed.data.metric,
      threshold: parsed.data.threshold,
    });
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, message: "Reward created. Testers who already qualify have earned it." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRewardAction(rewardId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(await programOf("rewards", rewardId));
    const { error } = await supabase.from("rewards").delete().eq("id", rewardId);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Nominations
// ---------------------------------------------------------------------------
export async function decideNominationAction(nominationId: string, approve: boolean): Promise<ActionResult> {
  try {
    const { supabase, program, user } = await requireEditor(await programOf("nominations", nominationId));
    const { data: nom } = await supabase
      .from("nominations")
      .select("id, name, email, status, testers(name)")
      .eq("id", nominationId)
      .single();
    if (!nom || nom.status !== "pending") return { ok: false, error: "This nomination was already decided." };

    let message = `Rejected ${nom.name}.`;
    if (approve) {
      const result = await inviteTester(supabase, {
        programId: program.id,
        programName: program.name,
        name: nom.name,
        email: nom.email,
        createdBy: user.id,
        invitedBy: nom.testers?.name,
      });
      if (!result.ok) return { ok: false, error: result.error };
      message =
        result.email === "stubbed"
          ? `Approved. Invite with ${result.code} printed to the server console (no RESEND_API_KEY).`
          : result.email === "failed"
            ? `Approved and created ${result.code}, but the email failed. Use "Resend invite" on the tester.`
            : `Approved. Invite sent to ${nom.email}.`;
    }
    const { error } = await supabase
      .from("nominations")
      .update({ status: approve ? "approved" : "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
      .eq("id", nominationId);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, message };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
export async function createWebhookAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = webhookSchema.safeParse({
    programId: formData.get("programId"),
    url: formData.get("url"),
    events: formData.getAll("events"),
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (isBlockedWebhookUrl(parsed.data.url, process.env.NODE_ENV !== "production")) {
    return { ok: false, error: "That URL points to a private or local address.", fields: { url: "Not allowed" } };
  }
  try {
    const { supabase } = await requireEditor(parsed.data.programId);
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const { error } = await supabase.from("webhooks").insert({ program_id: parsed.data.programId, url: parsed.data.url, events: parsed.data.events, secret });
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, message: "Webhook added. Copy its signing secret from the list below." };
  } catch (e) {
    return fail(e);
  }
}

export async function setWebhookActiveAction(webhookId: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(await programOf("webhooks", webhookId));
    const { error } = await supabase.from("webhooks").update({ active }).eq("id", webhookId);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWebhookAction(webhookId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(await programOf("webhooks", webhookId));
    const { error } = await supabase.from("webhooks").delete().eq("id", webhookId);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Sends a signed "ping" right away (not queued, not retried) so you can check your receiver. */
export async function pingWebhookAction(webhookId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(await programOf("webhooks", webhookId));
    const { data: hook } = await supabase.from("webhooks").select("id, url, secret, program_id").eq("id", webhookId).single();
    if (!hook) return { ok: false, error: "Not found" };
    if (isBlockedWebhookUrl(hook.url, process.env.NODE_ENV !== "production")) return { ok: false, error: "URL points to a private or local address" };
    const body = JSON.stringify({ id: crypto.randomUUID(), event: "ping", created_at: new Date().toISOString(), program_id: hook.program_id, data: {} });
    const res = await fetch(hook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "content-type": "application/json",
        "user-agent": "Referral-Webhooks/1.0",
        "referral-event": "ping",
        "referral-signature": signatureHeader(hook.secret, Math.floor(Date.now() / 1000), body),
      },
      body,
    });
    return res.ok ? { ok: true, message: `Ping delivered (HTTP ${res.status}).` } : { ok: false, error: `Receiver answered HTTP ${res.status}` };
  } catch (e) {
    return fail(e);
  }
}
