import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { FeedbackForm } from "@/components/tester/feedback-form";
import { testerFromToken } from "@/lib/token-tester";
import { submitTokenFeedbackAction } from "./actions";

export const metadata: Metadata = { title: "Send feedback · Referral", robots: { index: false } };

export default async function TokenFeedbackPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { token } = await params;
  const { kind } = await searchParams;

  if (token === "test") {
    return (
      <AuthShell title="This came from a test email">
        <p className="text-sm">Buttons in a “send me a test email” preview don&apos;t belong to a real tester, so there is no form here. In real digests they open a feedback form for that tester.</p>
      </AuthShell>
    );
  }

  const { tester } = await testerFromToken(token, "feedback");
  if (!tester) {
    return (
      <AuthShell title="This link has expired" description="Feedback links in emails work for 7 days.">
        <p className="text-sm">
          Use the buttons in your most recent email, or <a className="underline" href="/login?next=/app">log in</a> to send feedback.
        </p>
      </AuthShell>
    );
  }

  const defaultKind = kind === "tip" ? "tip" : kind === "response" ? "response" : "bug";
  const product = tester.programs?.product_name || tester.programs?.name || "the beta";
  return (
    <AuthShell title={defaultKind === "bug" ? "Report a bug" : "Share a tip"} description={`Hi ${tester.name.split(" ")[0]}, thanks for helping with ${product}. No login needed.`}>
      <FeedbackForm action={submitTokenFeedbackAction} hidden={{ token }} defaultKind={defaultKind} allowUpload idPrefix="tok" />
    </AuthShell>
  );
}
