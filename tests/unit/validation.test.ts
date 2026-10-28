import { describe, expect, it } from "vitest";
import { joinSchema, feedbackSubmitSchema, programSettingsSchema, webhookSchema } from "@/lib/validation";
import { passwordStrength } from "@/lib/password";
import { safeNext } from "@/lib/safe-redirect";

const join = { code: " ref-abcd-efgh ", name: "Ada", email: "ADA@Example.com ", password: "correct horse battery", acceptTerms: "on" };

describe("join validation", () => {
  it("normalizes code and email", () => {
    const r = joinSchema.parse(join);
    expect(r.code).toBe("REF-ABCD-EFGH");
    expect(r.email).toBe("ada@example.com");
  });
  it("requires 12+ character passwords", () => {
    expect(joinSchema.safeParse({ ...join, password: "short-pass1" }).success).toBe(false);
  });
  it("requires accepting the terms", () => {
    expect(joinSchema.safeParse({ ...join, acceptTerms: "" }).success).toBe(false);
  });
  it("rejects malformed codes", () => {
    expect(joinSchema.safeParse({ ...join, code: "REF-0000-1111" }).success).toBe(false);
  });
});

describe("feedback validation", () => {
  it("defaults bug severity to medium and drops severity for tips", () => {
    expect(feedbackSubmitSchema.parse({ kind: "bug", title: "Crash", body: "", severity: "", context: {} }).severity).toBe("medium");
    expect(feedbackSubmitSchema.parse({ kind: "tip", title: "Idea", body: "", severity: "high", context: {} }).severity).toBe(null);
  });
  it("requires a title", () => {
    expect(feedbackSubmitSchema.safeParse({ kind: "tip", title: "  ", body: "" }).success).toBe(false);
  });
});

describe("program settings validation", () => {
  const ok = {
    programId: "6f1c2b9e-1111-4222-8333-944455556666",
    name: "Beta",
    productName: "",
    digestEnabled: true,
    digestIntervalDays: "2",
    digestSendHour: "9",
    digestTimezone: "Europe/London",
    digestSubject: "Hi",
    digestIntro: "",
    nudgesEnabled: true,
    nudgeInactiveDays: 7,
    nudgeStuckDays: 5,
    nominationMinHelpfulness: 70,
    nominationsPerTester: 3,
    termsText: "",
  };
  it("accepts any interval of days and valid time zones", () => {
    expect(programSettingsSchema.parse(ok).digestIntervalDays).toBe(2);
    expect(programSettingsSchema.safeParse({ ...ok, digestIntervalDays: "45" }).success).toBe(true);
  });
  it("rejects unknown time zones and bad hours", () => {
    expect(programSettingsSchema.safeParse({ ...ok, digestTimezone: "Mars/Olympus" }).success).toBe(false);
    expect(programSettingsSchema.safeParse({ ...ok, digestSendHour: "24" }).success).toBe(false);
    expect(programSettingsSchema.safeParse({ ...ok, digestIntervalDays: "0" }).success).toBe(false);
  });
});

describe("webhook validation", () => {
  it("needs a URL and at least one known event", () => {
    const id = "6f1c2b9e-1111-4222-8333-944455556666";
    expect(webhookSchema.safeParse({ programId: id, url: "https://example.com/hook", events: ["feedback.created"] }).success).toBe(true);
    expect(webhookSchema.safeParse({ programId: id, url: "ftp://example.com", events: ["feedback.created"] }).success).toBe(false);
    expect(webhookSchema.safeParse({ programId: id, url: "https://example.com", events: [] }).success).toBe(false);
    expect(webhookSchema.safeParse({ programId: id, url: "https://example.com", events: ["tester.deleted"] }).success).toBe(false);
  });
});

describe("password strength", () => {
  it("flags short and common passwords", () => {
    expect(passwordStrength("abc").label).toBe("Too short");
    expect(passwordStrength("password1234").label).toBe("Weak");
    expect(passwordStrength("aaaaaaaaaaaaaaaa").label).toBe("Weak");
  });
  it("rewards length and variety", () => {
    expect(passwordStrength("Tr0ub4dor&3-horse-staple").score).toBe(4);
    expect(passwordStrength("blue-kettle-rain").score).toBeGreaterThanOrEqual(2);
  });
});

describe("safeNext", () => {
  it("only allows relative paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("//evil.com", "/")).toBe("/");
    expect(safeNext("/\\evil.com", "/")).toBe("/");
    expect(safeNext("https://evil.com", "/app")).toBe("/app");
    expect(safeNext(undefined, "/app")).toBe("/app");
  });
});
