import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { fixNoticeEmail } from "@/lib/email/messages";
import { claimEmailSlot, finishEmailSlot, todayUtc } from "@/lib/email/log";
import { unsubscribeLink } from "@/lib/links";

/** "Close the loop": thank the author when their feedback is marked fixed. */
export async function sendFixNotice(feedbackId: string) {
  const admin = createAdminClient();
  const { data: fb } = await admin
    .from("feedback")
    .select("id, title, program_id, testers(id, name, email, user_id, unsubscribed_at, access_revoked_at), programs(name)")
    .eq("id", feedbackId)
    .single();
  const tester = fb?.testers;
  if (!fb || !tester || !tester.user_id || tester.unsubscribed_at || tester.access_revoked_at) return { status: "skipped" as const };

  const slot = await claimEmailSlot(admin, { programId: fb.program_id, testerId: tester.id, kind: "fix_notice", sendDate: todayUtc() });
  if (!slot) return { status: "skipped" as const }; // one thank-you per tester per day (see DECISIONS.md)

  const result = await sendEmail(
    fixNoticeEmail(tester.email, {
      name: tester.name.split(" ")[0] || tester.name,
      programName: fb.programs?.name ?? "the beta",
      feedbackTitle: fb.title,
      unsubscribeUrl: unsubscribeLink(tester.id),
    }),
  );
  await finishEmailSlot(admin, slot, result);
  return result;
}
