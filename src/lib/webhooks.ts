import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { backoffSeconds, isBlockedWebhookUrl, signatureHeader } from "@/lib/webhook-signing";

/**
 * Sends queued webhook deliveries that are due. Called right after changes (via `after()`), and
 * by the webhooks cron for retries. Each delivery is claimed with a compare-and-set on
 * next_attempt_at so two workers never send the same attempt.
 */
export async function deliverPendingWebhooks(opts: { programId?: string; limit?: number } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("webhook_deliveries")
    .select("id, event, payload, attempts, next_attempt_at, webhooks(url, secret, active)")
    .is("delivered_at", null)
    .is("failed_at", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(opts.limit ?? 50);
  if (opts.programId) query = query.eq("program_id", opts.programId);
  const { data: due, error } = await query;
  if (error) {
    console.error("[webhooks] load failed", error.message);
    return { attempted: 0, delivered: 0 };
  }

  let delivered = 0;
  let attempted = 0;
  for (const d of due ?? []) {
    const hook = d.webhooks;
    if (!hook || !hook.active) {
      await admin.from("webhook_deliveries").update({ failed_at: new Date().toISOString(), last_error: "Webhook disabled or deleted" }).eq("id", d.id);
      continue;
    }
    // Claim: push next_attempt_at forward only if nobody else has.
    const { data: claimed } = await admin
      .from("webhook_deliveries")
      .update({ next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq("id", d.id)
      .eq("next_attempt_at", d.next_attempt_at)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    attempted++;

    const attempts = d.attempts + 1;
    let status: number | null = null;
    let errorText: string | null = null;
    if (isBlockedWebhookUrl(hook.url, process.env.NODE_ENV !== "production")) {
      errorText = "URL points to a private or local address";
    } else {
      const body = JSON.stringify(d.payload);
      const timestamp = Math.floor(Date.now() / 1000);
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "content-type": "application/json",
            "user-agent": "Referral-Webhooks/1.0",
            "referral-event": d.event,
            "referral-delivery": d.id,
            "referral-signature": signatureHeader(hook.secret, timestamp, body),
          },
          body,
        });
        status = res.status;
        if (!res.ok) errorText = `HTTP ${res.status}`;
      } catch (e) {
        errorText = e instanceof Error ? e.message : String(e);
      }
    }

    if (!errorText) {
      delivered++;
      await admin
        .from("webhook_deliveries")
        .update({ attempts, last_status: status, last_error: null, delivered_at: new Date().toISOString() })
        .eq("id", d.id);
    } else {
      const wait = backoffSeconds(attempts);
      await admin
        .from("webhook_deliveries")
        .update({
          attempts,
          last_status: status,
          last_error: errorText.slice(0, 500),
          ...(wait === null
            ? { failed_at: new Date().toISOString() }
            : { next_attempt_at: new Date(Date.now() + wait * 1000).toISOString() }),
        })
        .eq("id", d.id);
    }
  }
  return { attempted, delivered };
}
