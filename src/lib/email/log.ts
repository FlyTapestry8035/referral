import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SendResult } from "./send";

type Admin = SupabaseClient<Database>;
type Kind = Database["public"]["Enums"]["email_kind"];

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Claims the (program, tester, kind, day) slot before sending. Returns the log id when this
 * caller owns the send, or null when an email of this kind already went out today. A previous
 * failed attempt can be re-claimed. Safe under concurrent cron runs: the unique constraint decides.
 */
export async function claimEmailSlot(
  admin: Admin,
  slot: { programId: string; testerId: string; kind: Kind; sendDate: string },
): Promise<string | null> {
  const { data, error } = await admin
    .from("email_log")
    .insert({ program_id: slot.programId, tester_id: slot.testerId, kind: slot.kind, send_date: slot.sendDate, status: "pending" })
    .select("id")
    .maybeSingle();
  if (data) return data.id;
  if (error && error.code !== "23505") throw error;

  // Already claimed today. Take it over only if that attempt failed.
  const { data: retried } = await admin
    .from("email_log")
    .update({ status: "pending", error: null, sent_at: new Date().toISOString() })
    .eq("program_id", slot.programId)
    .eq("tester_id", slot.testerId)
    .eq("kind", slot.kind)
    .eq("send_date", slot.sendDate)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  return retried?.id ?? null;
}

export async function finishEmailSlot(admin: Admin, id: string, result: SendResult) {
  await admin
    .from("email_log")
    .update(
      result.status === "failed"
        ? { status: "failed", error: result.error.slice(0, 1000) }
        : { status: result.status, provider_id: result.id, sent_at: new Date().toISOString() },
    )
    .eq("id", id);
}
