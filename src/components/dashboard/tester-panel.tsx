"use client";

import { useEffect, useState, useTransition } from "react";
import { BugIcon, LightbulbIcon, MessageSquareIcon, ImageIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { dateTime, relativeTime, shortDate } from "@/lib/format";
import { StageDot } from "./stage-dot";
import { RatingControl } from "./rating";
import { resendInviteAction, setTesterAccessAction } from "@/app/dashboard/actions";
import { screenshotUrlAction, triageFeedbackAction } from "@/app/dashboard/feedback/actions";
import type { Database } from "@/lib/supabase/database.types";
import type { SheetRow } from "./tester-sheet";

type Feedback = Pick<
  Database["public"]["Tables"]["feedback"]["Row"],
  "id" | "kind" | "title" | "body" | "severity" | "status" | "team_rating" | "created_at" | "screenshot_path" | "duplicate_of"
>;

export type PanelTester = SheetRow & {
  user_id: string | null;
  created_at: string;
  terms_accepted_at: string | null;
  terms_version_accepted: number | null;
  unsubscribed_at: string | null;
};

const KIND_ICON = { bug: BugIcon, tip: LightbulbIcon, response: MessageSquareIcon };

export function TesterPanel({
  tester,
  open,
  onOpenChange,
  canEdit,
  onSaveNotes,
  feedbackVersion,
}: {
  tester: PanelTester | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onSaveNotes: (id: string, notes: string) => void;
  /** bumps when realtime sees feedback changes, to refetch the timeline */
  feedbackVersion: number;
}) {
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [notes, setNotes] = useState({ testerId: "", value: "" });
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const testerId = tester?.id;

  // Reset the notes draft when a different tester is opened (render-time state sync).
  if (tester && notes.testerId !== tester.id) setNotes({ testerId: tester.id, value: tester.notes });

  useEffect(() => {
    if (!testerId || !open) return;
    let cancelled = false;
    createClient()
      .from("feedback")
      .select("id, kind, title, body, severity, status, team_rating, created_at, screenshot_path, duplicate_of")
      .eq("tester_id", testerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setFeedback(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [testerId, open, feedbackVersion]);

  if (!tester) return null;

  const rate = (id: string, rating: number | null) => {
    setFeedback((list) => list?.map((f) => (f.id === id ? { ...f, team_rating: rating } : f)) ?? null);
    start(async () => {
      const r = await triageFeedbackAction({ feedbackId: id, teamRating: rating });
      if (!r.ok) setMessage({ kind: "error", text: r.error });
    });
  };

  const openScreenshot = (id: string) =>
    start(async () => {
      const url = await screenshotUrlAction(id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setMessage({ kind: "error", text: "Screenshot not available" });
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 pr-8">
            {tester.name}
            {tester.badges.map((b) => (
              <span key={b.name} title={b.name}>
                {b.badge}
              </span>
            ))}
          </SheetTitle>
          <SheetDescription>{tester.email}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-4 pb-8">
          {message ? <FormMessage kind={message.kind}>{message.text}</FormMessage> : null}

          <section aria-label="Profile" className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="Stage">
              <StageDot stage={tester.stage} />
            </Info>
            <Info label="Code">{tester.code ? <span className="font-mono text-xs">{tester.code}</span> : "—"}</Info>
            <Info label="Progress">{tester.progress}%</Info>
            <Info label="Helpfulness">{tester.helpfulness} / 100</Info>
            <Info label="Bugs · Tips · Responses">
              {tester.bugs_count} · {tester.tips_count} · {tester.responses_count}
            </Info>
            <Info label="Last activity">{relativeTime(tester.last_active_at)}</Info>
            <Info label="Account">{tester.user_id ? `Joined ${shortDate(tester.created_at)}` : "Not joined yet"}</Info>
            <Info label="Terms">
              {tester.terms_accepted_at ? `v${tester.terms_version_accepted} on ${shortDate(tester.terms_accepted_at)}` : "Not accepted"}
            </Info>
            <Info label="Emails">{tester.unsubscribed_at ? "Unsubscribed" : "Subscribed"}</Info>
            <Info label="Access">{tester.revoked ? <span className="text-destructive">Revoked</span> : "Active"}</Info>
          </section>

          {canEdit ? (
            <section aria-label="Actions" className="flex flex-wrap gap-2">
              {!tester.user_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await resendInviteAction(tester.id);
                      setMessage(r.ok ? { kind: "success", text: r.message ?? "Invite sent" } : { kind: "error", text: r.error });
                    })
                  }
                >
                  Resend invite
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={tester.revoked ? "outline" : "destructive"}
                disabled={pending}
                onClick={() => {
                  if (!tester.revoked && !window.confirm(`Revoke ${tester.name}'s access? They will no longer see missions or send feedback.`)) return;
                  start(async () => {
                    const r = await setTesterAccessAction(tester.id, !tester.revoked);
                    setMessage(r.ok ? { kind: "success", text: r.message ?? "Saved" } : { kind: "error", text: r.error });
                  });
                }}
              >
                {tester.revoked ? "Restore access" : "Revoke access"}
              </Button>
            </section>
          ) : null}

          <section aria-labelledby="notes-heading" className="grid gap-2">
            <h3 id="notes-heading" className="text-sm font-medium">
              Notes
            </h3>
            <Textarea
              value={notes.value}
              onChange={(e) => setNotes({ testerId: tester.id, value: e.target.value })}
              readOnly={!canEdit}
              maxLength={10000}
              placeholder={canEdit ? "Private notes about this tester" : "No notes"}
              aria-labelledby="notes-heading"
            />
            {canEdit ? (
              <div>
                <Button size="sm" variant="secondary" disabled={notes.value === tester.notes} onClick={() => onSaveNotes(tester.id, notes.value)}>
                  Save notes
                </Button>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="timeline-heading" className="grid gap-3">
            <h3 id="timeline-heading" className="text-sm font-medium">
              Feedback timeline
            </h3>
            {feedback === null ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
            {feedback?.length === 0 ? <p className="text-muted-foreground text-sm">No feedback yet.</p> : null}
            <ol className="grid gap-3">
              {feedback?.map((f) => {
                const Icon = KIND_ICON[f.kind];
                return (
                  <li key={f.id} className="rounded-md border p-3">
                    <div className="flex items-start gap-2">
                      <Icon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">{f.title}</p>
                        <p className="text-muted-foreground text-xs">
                          <span className="capitalize">{f.kind}</span>
                          {f.severity ? ` · ${f.severity}` : ""} · {dateTime(f.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {f.duplicate_of ? "duplicate" : f.status}
                      </Badge>
                    </div>
                    {f.body ? <p className="mt-2 text-sm break-words whitespace-pre-wrap">{f.body}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <RatingControl label={`Team rating for ${f.title}`} value={f.team_rating} disabled={!canEdit || pending} onChange={(v) => rate(f.id, v)} />
                      {f.screenshot_path ? (
                        <Button size="sm" variant="ghost" onClick={() => openScreenshot(f.id)}>
                          <ImageIcon /> Screenshot
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
