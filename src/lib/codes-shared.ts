// Code helpers that are safe to import in the browser (no node:crypto).
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_PATTERN = /^REF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

// Accepts user input like " ref-abcd-efgh " and returns the canonical form.
export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
