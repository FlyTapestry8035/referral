"use client";

import { useActionState } from "react";
import { createRewardAction } from "@/app/dashboard/manage-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage } from "@/components/ui/field";

export function RewardForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(createRewardAction, undefined);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="programId" value={programId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="grid grid-cols-[4rem_1fr] gap-3">
        <Field label="Badge" htmlFor="r-badge" error={f.badge}>
          <Input id="r-badge" name="badge" defaultValue="🏅" maxLength={16} className="text-center" />
        </Field>
        <Field label="Name" htmlFor="r-name" error={f.name}>
          <Input id="r-name" name="name" required maxLength={100} placeholder="e.g. Bug hunter" />
        </Field>
      </div>
      <Field label="Description" htmlFor="r-desc" error={f.description}>
        <Input id="r-desc" name="description" maxLength={1000} placeholder="Shown to the tester" />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] items-end gap-3">
        <Field label="When" htmlFor="r-metric">
          <NativeSelect id="r-metric" name="metric" defaultValue="bugs_count">
            <option value="helpfulness">Helpfulness is at least</option>
            <option value="bugs_count">Bugs found is at least</option>
            <option value="tips_count">Tips shared is at least</option>
            <option value="responses_count">Responses is at least</option>
            <option value="progress">Progress (%) is at least</option>
          </NativeSelect>
        </Field>
        <Field label="Value" htmlFor="r-threshold" error={f.threshold}>
          <Input id="r-threshold" name="threshold" type="number" min={0} max={100000} defaultValue={5} required />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add reward"}
        </Button>
      </div>
    </form>
  );
}
