"use client";

import { useActionState } from "react";
import { createWebhookAction } from "@/app/dashboard/manage-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";

export function WebhookForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(createWebhookAction, undefined);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="programId" value={programId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <Field label="Endpoint URL" htmlFor="wh-url" error={f.url}>
        <Input id="wh-url" name="url" type="url" required placeholder="https://example.com/hooks/referral" maxLength={2000} />
      </Field>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">Events</legend>
        {WEBHOOK_EVENTS.map((e) => (
          <label key={e} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="events" value={e} defaultChecked className="accent-primary size-4" />
            <code className="text-xs">{e}</code>
          </label>
        ))}
        {f.events ? <p className="text-destructive text-sm">{f.events}</p> : null}
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add webhook"}
        </Button>
      </div>
    </form>
  );
}
