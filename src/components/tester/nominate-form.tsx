"use client";

import { useActionState } from "react";
import { nominateAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";

export function NominateForm({ testerId, remaining }: { testerId: string; remaining: number }) {
  const [state, action, pending] = useActionState(nominateAction, undefined);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="testerId" value={testerId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Their name" htmlFor="nom-name" error={f.name}>
          <Input id="nom-name" name="name" required maxLength={200} />
        </Field>
        <Field label="Their email" htmlFor="nom-email" error={f.email}>
          <Input id="nom-email" name="email" type="email" required maxLength={320} />
        </Field>
      </div>
      <Field label="Why would they be a good tester? (optional)" htmlFor="nom-reason">
        <Input id="nom-reason" name="reason" maxLength={1000} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || remaining <= 0}>
          {pending ? "Sending…" : "Nominate"}
        </Button>
        <span className="text-muted-foreground text-xs">{remaining} nomination{remaining === 1 ? "" : "s"} left</span>
      </div>
    </form>
  );
}
