import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "@/lib/env";

// Service role client. Bypasses RLS. Server code only: the "server-only" import above makes
// any attempt to bundle this into the browser a build error.
export function createAdminClient() {
  const e = env();
  return createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
