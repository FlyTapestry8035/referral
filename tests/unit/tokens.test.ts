import { describe, expect, it } from "vitest";
import { createSignedToken, verifySignedToken, safeEqual, FEEDBACK_TOKEN_TTL_SECONDS } from "@/lib/tokens";

const SECRET = "test-secret-test-secret-test-secret-123";
const TESTER = "6f1c2b9e-1111-4222-8333-944455556666";

describe("signed tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSignedToken(SECRET, "feedback", TESTER, FEEDBACK_TOKEN_TTL_SECONDS);
    const result = verifySignedToken(SECRET, token, "feedback");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.t).toBe(TESTER);
  });

  it("expires after 7 days", () => {
    const now = Date.UTC(2026, 0, 1);
    const token = createSignedToken(SECRET, "feedback", TESTER, FEEDBACK_TOKEN_TTL_SECONDS, now);
    expect(verifySignedToken(SECRET, token, "feedback", now + 6.9 * 86400_000).ok).toBe(true);
    expect(verifySignedToken(SECRET, token, "feedback", now + 7 * 86400_000)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a different secret", () => {
    const token = createSignedToken(SECRET, "feedback", TESTER, 60);
    expect(verifySignedToken(`${SECRET}x`, token, "feedback")).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a tampered payload (e.g. another tester id)", () => {
    const token = createSignedToken(SECRET, "feedback", TESTER, 60);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ p: "feedback", t: "someone-else", e: 9999999999 })).toString("base64url");
    expect(verifySignedToken(SECRET, `${forged}.${sig}`, "feedback").ok).toBe(false);
  });

  it("rejects a token minted for another purpose", () => {
    const token = createSignedToken(SECRET, "unsubscribe", TESTER, 60);
    expect(verifySignedToken(SECRET, token, "feedback")).toEqual({ ok: false, reason: "purpose" });
  });

  it("rejects garbage", () => {
    for (const t of ["", "abc", "a.b.c", ".", "x.", ".y", "%%%.%%%"]) {
      expect(verifySignedToken(SECRET, t, "feedback").ok).toBe(false);
    }
  });

  it("compares secrets safely", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true);
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false);
    expect(safeEqual("Bearer abc", "Bearer abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
