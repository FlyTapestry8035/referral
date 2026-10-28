import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_PATTERN, generateReferralCode, normalizeReferralCode } from "@/lib/codes";

describe("referral codes", () => {
  it("never uses look-alike characters", () => {
    for (const c of ["0", "O", "1", "I", "L"]) expect(CODE_ALPHABET).not.toContain(c);
  });

  it("generates REF-XXXX-XXXX codes from the safe alphabet", () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateReferralCode();
      expect(code).toMatch(CODE_PATTERN);
      expect(code).not.toMatch(/[01OIL]/.source.replace("REF", ""));
    }
  });

  it("produces distinct codes", () => {
    const set = new Set(Array.from({ length: 5000 }, generateReferralCode));
    expect(set.size).toBe(5000);
  });

  it("uses every alphabet character (roughly uniform)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      for (const ch of generateReferralCode().slice(4).replace("-", "")) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(counts.size).toBe(CODE_ALPHABET.length);
    const expected = (4000 * 8) / CODE_ALPHABET.length;
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(expected * 0.75);
      expect(n).toBeLessThan(expected * 1.25);
    }
  });

  it("normalizes user input", () => {
    expect(normalizeReferralCode("  ref-abcd-efgh ")).toBe("REF-ABCD-EFGH");
    expect(CODE_PATTERN.test(normalizeReferralCode("ref-abcd-2345"))).toBe(true);
    expect(CODE_PATTERN.test("REF-ABC0-2345")).toBe(false);
    expect(CODE_PATTERN.test("REF-ABCD-2345-X")).toBe(false);
  });
});
