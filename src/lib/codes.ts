import { randomInt } from "node:crypto";
import { CODE_ALPHABET } from "./codes-shared";

export { CODE_ALPHABET, CODE_PATTERN, normalizeReferralCode } from "./codes-shared";

function block(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    // randomInt is a CSPRNG and rejection-samples, so every character is equally likely.
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

// REF-XXXX-XXXX from an alphabet without look-alike characters (no 0, O, 1, I, L).
export function generateReferralCode(): string {
  return `REF-${block(4)}-${block(4)}`;
}
