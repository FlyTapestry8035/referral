"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/login/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <AuthShell title="Choose a new password" description="At least 12 characters. A short sentence works well.">
      <form action={action} className="grid gap-4">
        <FormMessage>{state?.error}</FormMessage>
        <Field label="New password" htmlFor="password" error={state?.fields?.password}>
          <PasswordInput id="password" name="password" invalid={Boolean(state?.fields?.password)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={state?.fields?.confirm}>
          <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
      </form>
    </AuthShell>
  );
}
