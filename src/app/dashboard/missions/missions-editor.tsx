"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { createMissionAction, deleteMissionAction, moveMissionAction, updateMissionAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage } from "@/components/ui/field";

export type MissionItem = { id: string; title: string; description: string; done: number; doing: number };

export function MissionList({ missions, canEdit, testerCount }: { missions: MissionItem[]; canEdit: boolean; testerCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{ id: string; title: string; description: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong");
      router.refresh();
    });

  if (missions.length === 0) return <p className="text-muted-foreground text-sm">No missions yet. Testers&apos; progress is based on missions, so add a few.</p>;

  return (
    <div className="grid gap-3">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ol className="grid gap-2">
        {missions.map((m, i) => (
          <li key={m.id} className="bg-card flex gap-3 rounded-lg border p-3">
            <span className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums">{i + 1}</span>
            {editing?.id === m.id ? (
              <form
                className="grid flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await updateMissionAction({ missionId: m.id, title: editing.title, description: editing.description });
                    if (r.ok) setEditing(null);
                    return r;
                  });
                }}
              >
                <Input aria-label="Mission title" value={editing.title} maxLength={200} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                <Textarea aria-label="Mission description" value={editing.description} maxLength={5000} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={pending}>Save</Button>
                  <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.title}</p>
                {m.description ? <p className="text-muted-foreground mt-0.5 text-sm whitespace-pre-wrap">{m.description}</p> : null}
                <p className="text-muted-foreground mt-1 text-xs">
                  {m.done} of {testerCount} done · {m.doing} in progress
                </p>
              </div>
            )}
            {canEdit && editing?.id !== m.id ? (
              <div className="flex shrink-0 items-start gap-0.5">
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Move ${m.title} up`} disabled={pending || i === 0} onClick={() => run(() => moveMissionAction(m.id, "up"))}>
                  <ArrowUpIcon />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Move ${m.title} down`} disabled={pending || i === missions.length - 1} onClick={() => run(() => moveMissionAction(m.id, "down"))}>
                  <ArrowDownIcon />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${m.title}`} onClick={() => setEditing({ id: m.id, title: m.title, description: m.description })}>
                  <PencilIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Delete ${m.title}`}
                  disabled={pending}
                  onClick={() => window.confirm(`Delete "${m.title}"? Testers' progress will be recalculated.`) && run(() => deleteMissionAction(m.id))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NewMissionForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(createMissionAction, undefined);
  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="programId" value={programId} />
      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label="Title" htmlFor="m-title" error={fields.title}>
        <Input id="m-title" name="title" required maxLength={200} placeholder="e.g. Connect a device" />
      </Field>
      <Field label="What should the tester do?" htmlFor="m-desc" error={fields.description}>
        <Textarea id="m-desc" name="description" maxLength={5000} />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add mission"}</Button>
      </div>
    </form>
  );
}
