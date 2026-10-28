import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateReferralCode } from "@/lib/codes";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { testerInviteEmail } from "@/lib/email/messages";
import { claimEmailSlot, finishEmailSlot, todayUtc } from "@/lib/email/log";

type Db = SupabaseClient<Database>;

/** Inserts a code, retrying on the (very unlikely) collision of a random code. */
export async function insertCode(
  db: Db,
  values: { program_id: string; label?: string | null; max_uses?: number | null; expires_at?: string | null; created_by?: string | null },
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("referral_codes")
      .insert({ ...values, code: generateReferralCode() })
      .select()
      .single();
    if (data) return data;
    if (error?.code !== "23505") throw new Error(error?.message ?? "Could not create code");
  }
  throw new Error("Could not generate a unique code");
}

export type InviteResult = { ok: true; code: string; email: SendResult["status"] } | { ok: false; error: string };

/**
 * "Invite by email": a tester row in stage invited, a fresh single-use code, and an email with a
 * /join link. Re-inviting someone who has not joined yet replaces their code.
 */
export async function inviteTester(
  db: Db,
  opts: { programId: string; programName: string; name: string; email: string; createdBy: string | null; invitedBy?: string },
): Promise<InviteResult> {
  const { data: existing } = await db
    .from("testers")
    .select("id, user_id, referral_code_id")
    .eq("program_id", opts.programId)
    .eq("email", opts.email)
    .maybeSingle();
  if (existing?.user_id) return { ok: false, error: "That person is already a tester in this program." };

  const code = await insertCode(db, {
    program_id: opts.programId,
    label: `Invite: ${opts.email}`.slice(0, 200),
    max_uses: 1,
    created_by: opts.createdBy,
  });

  let testerId = existing?.id;
  if (existing?.referral_code_id) {
    // Their previous personal code (single-use, unused) should not stay valid next to the new one.
    await db
      .from("referral_codes")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", existing.referral_code_id)
      .eq("max_uses", 1)
      .eq("uses", 0)
      .is("revoked_at", null);
  }
  if (existing) {
    const { error } = await db.from("testers").update({ name: opts.name }).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    // referral_code_id is not client-writable; link the new code with the service role.
    await createAdminClient().from("testers").update({ referral_code_id: code.id }).eq("id", existing.id);
  } else {
    const { data, error } = await db
      .from("testers")
      .insert({ program_id: opts.programId, name: opts.name, email: opts.email, referral_code_id: code.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not create tester" };
    testerId = data.id;
  }

  const result = await sendInviteEmail({ ...opts, testerId: testerId!, code: code.code });
  return { ok: true, code: code.code, email: result.status };
}

export async function sendInviteEmail(opts: {
  programId: string;
  programName: string;
  testerId: string;
  name: string;
  email: string;
  code: string;
  invitedBy?: string;
}): Promise<SendResult> {
  const admin = createAdminClient();
  const url = appUrl(`/join?code=${encodeURIComponent(opts.code)}`);
  const result = await sendEmail(testerInviteEmail(opts.email, opts.name, opts.programName, opts.code, url, opts.invitedBy));
  // Invites are logged for visibility; a second invite on the same day reuses the day's row.
  const slot = await claimEmailSlot(admin, { programId: opts.programId, testerId: opts.testerId, kind: "invite", sendDate: todayUtc() });
  if (slot) await finishEmailSlot(admin, slot, result);
  else
    await admin
      .from("email_log")
      .update(result.status === "failed" ? { status: "failed", error: result.error } : { status: result.status, provider_id: result.id, sent_at: new Date().toISOString() })
      .eq("program_id", opts.programId)
      .eq("tester_id", opts.testerId)
      .eq("kind", "invite")
      .eq("send_date", todayUtc());
  return result;
}
