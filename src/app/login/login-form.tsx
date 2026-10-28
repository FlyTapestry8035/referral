"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage kind="success">{notice}</FormMessage>
      <FormMessage>{state?.error}</FormMessage>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email" error={state?.fields?.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fields?.password}>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <Link href="/forgot-password" className="text-muted-foreground text-sm underline">
          Forgot password?
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Log in"}
        </Button>
      </div>
    </form>
  );
}
