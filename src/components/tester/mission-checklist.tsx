"use client";

import { useOptimistic, useTransition } from "react";
import { CheckCircle2Icon, CircleDashedIcon, CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setMissionStatusAction } from "@/app/app/actions";
import { cn } from "@/lib/utils";

type Status = "todo" | "doing" | "done";
export type ChecklistMission = { id: string; title: string; description: string; status: Status };

export function MissionChecklist({ testerId, missions }: { testerId: string; missions: ChecklistMission[] }) {
  const [optimistic, setOptimistic] = useOptimistic(missions, (list, change: { id: string; status: Status }) =>
    list.map((m) => (m.id === change.id ? { ...m, status: change.status } : m)),
  );
  const [pending, start] = useTransition();

  const set = (id: string, status: Status) =>
    start(async () => {
      setOptimistic({ id, status });
      await setMissionStatusAction(testerId, id, status);
    });

  if (missions.length === 0) return <p className="text-muted-foreground text-sm">No missions yet. The team will add some soon.</p>;

  return (
    <ol className="grid gap-2">
      {optimistic.map((m, i) => (
        <li key={m.id} className={cn("flex gap-3 rounded-lg border p-3", m.status === "done" && "bg-muted/40")}>
          <button
            type="button"
            onClick={() => set(m.id, m.status === "done" ? "todo" : "done")}
            disabled={pending}
            aria-label={m.status === "done" ? `Mark "${m.title}" as not done` : `Mark "${m.title}" as done`}
            className="mt-0.5 shrink-0"
          >
            {m.status === "done" ? (
              <CheckCircle2Icon className="size-5 text-emerald-500" />
            ) : m.status === "doing" ? (
              <CircleDashedIcon className="size-5 text-sky-500" />
            ) : (
              <CircleIcon className="text-muted-foreground size-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className={cn("font-medium", m.status === "done" && "text-muted-foreground line-through")}>
              <span className="text-muted-foreground mr-1 tabular-nums">{i + 1}.</span>
              {m.title}
            </p>
            {m.description ? <p className="text-muted-foreground mt-0.5 text-sm whitespace-pre-wrap">{m.description}</p> : null}
          </div>
          {m.status === "todo" ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => set(m.id, "doing")}>
              Start
            </Button>
          ) : m.status === "doing" ? (
            <Button size="sm" disabled={pending} onClick={() => set(m.id, "done")}>
              Done
            </Button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
