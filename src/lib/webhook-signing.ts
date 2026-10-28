import { createHmac } from "node:crypto";

import { WEBHOOK_EVENTS } from "./webhook-events";

export { WEBHOOK_EVENTS };
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Retry schedule after a failed attempt n (1-based). After the last entry the delivery is marked failed. */
export const BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60];
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;

export function backoffSeconds(attempts: number): number | null {
  return attempts >= MAX_ATTEMPTS ? null : BACKOFF_SECONDS[Math.max(0, attempts - 1)];
}

/**
 * Stripe-style signature: HMAC-SHA256 over "<unix seconds>.<raw body>", sent as
 * `Referral-Signature: t=<unix seconds>,v1=<hex digest>`. Receivers recompute it with their
 * secret and reject old timestamps to stop replays.
 */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function signatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signWebhook(secret, timestamp, body)}`;
}

/**
 * Basic SSRF guard: refuses literal private, loopback and link-local addresses and localhost.
 * (DNS names that resolve to private addresses are not caught; see DECISIONS.md.)
 */
export function isBlockedWebhookUrl(raw: string, allowLocal = false): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return true;
  if (allowLocal) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host === "0.0.0.0") return true;
  if (host.includes(":")) {
    // IPv6 literal: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10), IPv4-mapped.
    return host === "::1" || host === "::" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith("::ffff:");
  }
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}
