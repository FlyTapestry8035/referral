import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { backoffSeconds, isBlockedWebhookUrl, MAX_ATTEMPTS, signatureHeader, signWebhook } from "@/lib/webhook-signing";

describe("webhook signing", () => {
  it("signs timestamp.body with HMAC-SHA256", () => {
    const body = JSON.stringify({ event: "feedback.created" });
    const expected = createHmac("sha256", "whsec_test").update(`1700000000.${body}`).digest("hex");
    expect(signWebhook("whsec_test", 1700000000, body)).toBe(expected);
    expect(signatureHeader("whsec_test", 1700000000, body)).toBe(`t=1700000000,v1=${expected}`);
  });
  it("changes when the body changes", () => {
    expect(signWebhook("s", 1, "a")).not.toBe(signWebhook("s", 1, "b"));
  });
});

describe("backoff", () => {
  it("retries with growing delays, then gives up", () => {
    expect(backoffSeconds(1)).toBe(60);
    expect(backoffSeconds(2)).toBe(300);
    expect(backoffSeconds(5)).toBe(12 * 3600);
    expect(backoffSeconds(MAX_ATTEMPTS)).toBeNull();
  });
});

describe("SSRF guard", () => {
  it("blocks private and local targets", () => {
    for (const u of [
      "http://localhost:3000/x",
      "http://127.0.0.1/x",
      "http://10.1.2.3/",
      "http://172.20.0.1/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://metadata.google.internal/",
      "ftp://example.com/",
      "not a url",
    ]) {
      expect(isBlockedWebhookUrl(u), u).toBe(true);
    }
  });
  it("allows public targets", () => {
    expect(isBlockedWebhookUrl("https://hooks.example.com/referral")).toBe(false);
    expect(isBlockedWebhookUrl("https://8.8.8.8/x")).toBe(false);
  });
  it("can allow local targets in development", () => {
    expect(isBlockedWebhookUrl("http://localhost:4000/hook", true)).toBe(false);
  });
});
