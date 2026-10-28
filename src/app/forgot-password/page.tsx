"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/login/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  return (
    <AuthShell
      title="Forgot your password?"
      description="We'll email you a link to choose a new one."
      footer={<Link href="/login" className="underline">Back to log in</Link>}
    >
      <form action={action} className="grid gap-4">
        <FormMessage>{state?.error}</FormMessage>
        <FormMessage kind="success">{state?.success}</FormMessage>
        <Field label="Email" htmlFor="email" error={state?.fields?.email}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      </form>
    </AuthShell>
  );
}
