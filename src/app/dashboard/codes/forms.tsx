"use client";

import { useActionState, useState } from "react";
import { createCodeAction, inviteByEmailAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage } from "@/components/ui/field";

export function CreateCodeForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(createCodeAction, undefined);
  const [kind, setKind] = useState("single");
  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="programId" value={programId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <Field label="Label (optional)" htmlFor="label" error={fields.label} hint="Only you see this, e.g. “Product Hunt launch”.">
        <Input id="label" name="label" maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Uses" htmlFor="kind">
          <NativeSelect id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="single">Single-use</option>
            <option value="limited">Limited uses</option>
            <option value="unlimited">Unlimited</option>
          </NativeSelect>
        </Field>
        {kind === "limited" ? (
          <Field label="Usage cap" htmlFor="maxUses" error={fields.maxUses}>
            <Input id="maxUses" name="maxUses" type="number" min={1} max={100000} defaultValue={10} required />
          </Field>
        ) : null}
        <Field label="Expires (optional)" htmlFor="expiresAt" error={fields.expiresAt} hint="Valid until the end of that day.">
          <Input id="expiresAt" name="expiresAt" type="date" />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create code"}
        </Button>
      </div>
    </form>
  );
}

export function InviteForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(inviteByEmailAction, undefined);
  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="programId" value={programId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="invite-name" error={fields.name}>
          <Input id="invite-name" name="name" required maxLength={200} />
        </Field>
        <Field label="Email" htmlFor="invite-email" error={fields.email}>
          <Input id="invite-email" name="email" type="email" required maxLength={320} />
        </Field>
      </div>
      <p className="text-muted-foreground text-xs">Creates the tester (stage “Invited”), a single-use code, and emails them a join link.</p>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
