"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RatingControl } from "@/components/dashboard/rating";
import { screenshotUrlAction, triageFeedbackAction } from "./actions";

export type TriageItem = {
  id: string;
  kind: "bug" | "tip" | "response";
  status: "new" | "acknowledged" | "fixed" | "wontfix";
  severity: "low" | "medium" | "high" | null;
  team_rating: number | null;
  tags: string[];
  duplicate_of: string | null;
  screenshot_path: string | null;
};

export function TriageControls({ item, canEdit, mergeTargets }: { item: TriageItem; canEdit: boolean; mergeTargets: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState(item.tags.join(", "));

  const save = (patch: Parameters<typeof triageFeedbackAction>[0]) =>
    start(async () => {
      setError(null);
      const r = await triageFeedbackAction(patch);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Status</span>
          <NativeSelect
            aria-label="Status"
            wrapperClassName="w-40"
            disabled={!canEdit || pending}
            value={item.status}
            onChange={(e) => save({ feedbackId: item.id, status: e.target.value })}
          >
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="fixed">Fixed (emails the tester)</option>
            <option value="wontfix">Won&apos;t fix</option>
          </NativeSelect>
        </label>
        {item.kind === "bug" ? (
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Severity</span>
            <NativeSelect
              aria-label="Severity"
              wrapperClassName="w-32"
              disabled={!canEdit || pending}
              value={item.severity ?? ""}
              onChange={(e) => save({ feedbackId: item.id, severity: e.target.value || null })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </NativeSelect>
          </label>
        ) : null}
        <div className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Team rating</span>
          <RatingControl label="Team rating" value={item.team_rating} disabled={!canEdit || pending} onChange={(v) => save({ feedbackId: item.id, teamRating: v })} />
        </div>
        {item.screenshot_path ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const url = await screenshotUrlAction(item.id);
                if (url) window.open(url, "_blank", "noopener,noreferrer");
                else setError("Screenshot not available");
              })
            }
          >
            <ImageIcon /> Screenshot
          </Button>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ feedbackId: item.id, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
            }}
          >
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Tags (comma separated)</span>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="h-8 w-56" maxLength={800} aria-label="Tags" />
            </label>
            <Button size="sm" variant="secondary" type="submit" disabled={pending}>
              Save tags
            </Button>
          </form>
          {item.duplicate_of ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => save({ feedbackId: item.id, duplicateOf: null })}>
              Unmerge
            </Button>
          ) : mergeTargets.length ? (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Merge as duplicate of</span>
              <NativeSelect
                aria-label="Merge as duplicate of"
                wrapperClassName="w-64"
                disabled={pending}
                value=""
                onChange={(e) => e.target.value && save({ feedbackId: item.id, duplicateOf: e.target.value })}
              >
                <option value="">Choose an item…</option>
                {mergeTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title.slice(0, 80)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
