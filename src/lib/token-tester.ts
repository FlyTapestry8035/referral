import "server-only";
import { env } from "@/lib/env";
import { verifySignedToken, type TokenPurpose } from "@/lib/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

/** Resolves a signed email token to an active tester (and their program), or null. */
export async function testerFromToken(token: string, purpose: TokenPurpose) {
  // Plain-text mail clients sometimes glue sentence punctuation onto a link; a token never ends with it.
  const clean = decodeURIComponent(token).replace(/[.,;:!?)\]]+$/, "");
  const result = verifySignedToken(env().TOKEN_SECRET, clean, purpose);
  if (!result.ok) return { tester: null, reason: result.reason } as const;
  const { data } = await createAdminClient()
    .from("testers")
    .select("id, name, email, program_id, user_id, access_revoked_at, unsubscribed_at, programs(name, product_name)")
    .eq("id", result.payload.t)
    .maybeSingle();
  if (!data || !data.user_id || data.access_revoked_at) return { tester: null, reason: "inactive" } as const;
  return { tester: data, reason: null } as const;
}
