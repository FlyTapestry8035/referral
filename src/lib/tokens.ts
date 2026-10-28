import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenPurpose = "feedback" | "unsubscribe";

export type TokenPayload = {
  /** purpose */
  p: TokenPurpose;
  /** tester id */
  t: string;
  /** expiry, unix seconds */
  e: number;
};

export const FEEDBACK_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(`referral.v1.${body}`).digest();
}

export function createSignedToken(
  secret: string,
  purpose: TokenPurpose,
  testerId: string,
  ttlSeconds: number,
  now: number = Date.now(),
): string {
  const payload: TokenPayload = { p: purpose, t: testerId, e: Math.floor(now / 1000) + ttlSeconds };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(sign(secret, body))}`;
}

export type VerifyResult = { ok: true; payload: TokenPayload } | { ok: false; reason: "malformed" | "signature" | "expired" | "purpose" };

export function verifySignedToken(
  secret: string,
  token: string,
  expectedPurpose: TokenPurpose,
  now: number = Date.now(),
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;

  const expected = sign(secret, body);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  // timingSafeEqual requires equal lengths; a length mismatch is already a failure.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload?.t !== "string" || typeof payload?.e !== "number" || typeof payload?.p !== "string") {
    return { ok: false, reason: "malformed" };
  }
  if (payload.p !== expectedPurpose) return { ok: false, reason: "purpose" };
  if (payload.e * 1000 <= now) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

// Constant-time comparison for shared secrets such as the cron bearer token. Hashing first gives
// equal-length buffers, so the comparison time does not depend on where the strings differ.
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "compare").update(a).digest();
  const hb = createHmac("sha256", "compare").update(b).digest();
  return timingSafeEqual(ha, hb);
}
