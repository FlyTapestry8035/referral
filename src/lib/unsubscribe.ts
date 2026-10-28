import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { testerFromToken } from "@/lib/token-tester";

export async function unsubscribeWithToken(token: string): Promise<boolean> {
  const { tester } = await testerFromToken(token, "unsubscribe");
  if (!tester) return false;
  if (!tester.unsubscribed_at) {
    await createAdminClient().from("testers").update({ unsubscribed_at: new Date().toISOString() }).eq("id", tester.id);
  }
  return true;
}
