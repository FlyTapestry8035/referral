import "server-only";
import { env, appUrl } from "@/lib/env";
import { createSignedToken, FEEDBACK_TOKEN_TTL_SECONDS, UNSUBSCRIBE_TOKEN_TTL_SECONDS } from "@/lib/tokens";

/** Tester-specific, HMAC-signed link to the no-login feedback form. Valid for 7 days. */
export function feedbackLink(testerId: string, kind: "bug" | "tip" | "response" = "bug"): string {
  const token = createSignedToken(env().TOKEN_SECRET, "feedback", testerId, FEEDBACK_TOKEN_TTL_SECONDS);
  return appUrl(`/f/${token}?kind=${kind}`);
}

export function unsubscribeLink(testerId: string): string {
  const token = createSignedToken(env().TOKEN_SECRET, "unsubscribe", testerId, UNSUBSCRIBE_TOKEN_TTL_SECONDS);
  return appUrl(`/unsubscribe/${token}`);
}
