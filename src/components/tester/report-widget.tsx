"use client";

import { useCallback, useState } from "react";
import { MessageSquareWarningIcon } from "lucide-react";
import { toBlob } from "html-to-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeedbackForm } from "./feedback-form";
import { submitFeedbackAction } from "@/app/app/actions";

/**
 * Floating "Report" button. Before the dialog opens it captures a screenshot of the page and the
 * context (URL, browser, viewport), so the tester only has to describe the problem.
 */
export function ReportWidget({ testerId }: { testerId: string }) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [include, setInclude] = useState(true);
  const [context, setContext] = useState<Record<string, string>>({});

  const start = async () => {
    setCapturing(true);
    setContext({ url: window.location.href, userAgent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}` });
    try {
      const blob = await toBlob(document.body, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        width: window.innerWidth,
        height: window.innerHeight,
        style: { transform: `translateY(-${window.scrollY}px)` },
        filter: (node) => !(node instanceof HTMLElement && node.dataset.referralWidget === "true"),
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });
      if (blob && blob.size < 5 * 1024 * 1024) setShot({ blob, url: URL.createObjectURL(blob) });
      else setShot(null);
    } catch {
      setShot(null); // capture is best-effort; the report still works without it
    }
    setCapturing(false);
    setInclude(true);
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setShot((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }, []);

  return (
    <>
      <Button data-referral-widget="true" onClick={start} disabled={capturing} className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg" aria-haspopup="dialog">
        <MessageSquareWarningIcon /> {capturing ? "Capturing…" : "Report"}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent data-referral-widget="true">
          <DialogHeader>
            <DialogTitle>Report a problem or share an idea</DialogTitle>
            <DialogDescription>We attach the page address, your browser and window size automatically.</DialogDescription>
          </DialogHeader>
          {shot ? (
            <div className="grid gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={shot.url} alt="Screenshot of the page that will be attached" className="max-h-40 w-full rounded-md border object-cover object-top" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary size-4" checked={include} onChange={(e) => setInclude(e.target.checked)} />
                Attach this screenshot
              </label>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Couldn&apos;t capture a screenshot of this page; the report will be sent without one.</p>
          )}
          <FeedbackForm
            idPrefix="widget"
            action={submitFeedbackAction}
            hidden={{ testerId, source: "widget" }}
            screenshot={include ? shot?.blob : null}
            context={context}
            onDone={() => setTimeout(close, 1200)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
