// Small, dependency-free password strength estimate used for the meter on /join and /reset-password.
// The hard rule (enforced by Zod and by Supabase Auth) is a minimum of 12 characters.

export const MIN_PASSWORD_LENGTH = 12;

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: "Too short" | "Weak" | "Fair" | "Good" | "Strong" };

const COMMON = ["password", "123456", "qwerty", "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon"];

export function passwordStrength(pw: string): Strength {
  if (pw.length < MIN_PASSWORD_LENGTH) return { score: 0, label: "Too short" };
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c)) || /^(.)\1+$/.test(pw)) return { score: 1, label: "Weak" };

  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/[0-9]/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  const unique = new Set(pw).size;

  let score = 1;
  if (classes >= 2 && unique >= 6) score = 2;
  if ((classes >= 3 && pw.length >= 14) || (classes >= 2 && pw.length >= 18)) score = 3;
  if ((classes >= 3 && pw.length >= 18) || (classes === 4 && pw.length >= 16)) score = 4;
  if (unique < 5) score = Math.min(score, 1);

  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;
  return { score: score as Strength["score"], label: labels[score] };
}
