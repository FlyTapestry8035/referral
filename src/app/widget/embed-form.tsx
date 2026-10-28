"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/tester/feedback-form";
import { Button } from "@/components/ui/button";
import { submitFeedbackAction } from "@/app/app/actions";

export function EmbedForm({ testerId, pageUrl, viewport }: { testerId: string; pageUrl: string; viewport: string }) {
  const [sent, setSent] = useState(false);
  // The popup runs in the tester's own browser, so its user agent is the one that matters.
  const [context] = useState(() => ({
    url: pageUrl,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    viewport,
  }));
  return (
    <div className="grid gap-4">
      <FeedbackForm action={submitFeedbackAction} hidden={{ testerId, source: "embed" }} context={context} allowUpload onDone={() => setSent(true)} idPrefix="embed" />
      {sent ? (
        <Button variant="outline" onClick={() => window.close()}>
          Close this window
        </Button>
      ) : null}
    </div>
  );
}
