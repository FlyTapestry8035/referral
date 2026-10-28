"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedbackSubmitSchema, fieldErrors } from "@/lib/validation";
import { parseContext, storeScreenshot } from "@/lib/feedback";
import { rateLimit } from "@/lib/ratelimit";
import { testerFromToken } from "@/lib/token-tester";
import { deliverPendingWebhooks } from "@/lib/webhooks";
import type { FeedbackFormState } from "@/components/tester/feedback-form";

// Feedback from an emailed link, without logging in. The signed token is the credential:
// it names one tester and expires after 7 days. Re-verified on every submit.
export async function submitTokenFeedbackAction(_prev: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const token = String(formData.get("token") ?? "").slice(0, 1000);
  const limit = await rateLimit("feedbackToken");
  if (!limit.success) return { ok: false, error: "Too many submissions. Please wait a few minutes." };

  const { tester } = await testerFromToken(token, "feedback");
  if (!tester) return { ok: false, error: "This link has expired. Use the button in your latest email, or log in." };

  const parsed = feedbackSubmitSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    severity: formData.get("severity") ?? "",
    context: parseContext(formData.get("context")),
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };

  const shot = await storeScreenshot(formData.get("screenshot"), tester.program_id, tester.id);
  if (!shot.ok) return { ok: false, error: shot.error, fields: { screenshot: shot.error } };

  const { error } = await createAdminClient().from("feedback").insert({
    program_id: tester.program_id,
    tester_id: tester.id,
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body,
    severity: parsed.data.severity,
    context: parsed.data.context,
    screenshot_path: shot.path,
    source: "email_link",
  });
  if (error) return { ok: false, error: "Could not send your feedback. Please try again." };
  after(() => deliverPendingWebhooks({ programId: tester.program_id }));
  return { ok: true, message: "Got it, thank you! You can send another one or close this page." };
}
