"use client";

import { useActionState, useEffect, useState } from "react";
import { joinAction, lookupTerms, type TermsLookup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { CODE_PATTERN, normalizeReferralCode } from "@/lib/codes-shared";

export function JoinForm({ initialCode }: { initialCode: string }) {
  const [state, action, pending] = useActionState(joinAction, undefined);
  const [code, setCode] = useState(initialCode);
  const [lookup, setLookup] = useState<{ code: string; terms: TermsLookup } | null>(null);
  const normalized = normalizeReferralCode(code);
  const wellFormed = CODE_PATTERN.test(normalized);
  const terms = wellFormed && lookup?.code === normalized ? lookup.terms : null;
  const checking = wellFormed && lookup?.code !== normalized;

  useEffect(() => {
    if (!wellFormed) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await lookupTerms(normalized);
      if (!cancelled) setLookup({ code: normalized, terms: result });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalized, wellFormed]);

  const f = state?.fields ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage>{state?.error}</FormMessage>
      <Field label="Referral code" htmlFor="code" error={f.code} hint="Looks like REF-XXXX-XXXX">
        <Input
          id="code"
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="REF-XXXX-XXXX"
          className="font-mono uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={Boolean(f.code) || undefined}
        />
      </Field>
      <Field label="Your name" htmlFor="name" error={f.name}>
        <Input id="name" name="name" required autoComplete="name" aria-invalid={Boolean(f.name) || undefined} />
      </Field>
      <Field label="Email" htmlFor="email" error={f.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" aria-invalid={Boolean(f.email) || undefined} />
      </Field>
      <Field label="Password" htmlFor="password" error={f.password}>
        <PasswordInput id="password" name="password" invalid={Boolean(f.password)} />
      </Field>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Program terms</p>
        {terms ? (
          <div className="bg-muted/50 max-h-40 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap" tabIndex={0} aria-label={`Terms for ${terms.programName}`}>
            <p className="mb-2 font-medium">{terms.programName}</p>
            {terms.termsText || "This program has no additional terms."}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{checking ? "Loading terms…" : "Enter your referral code to see the terms for this beta."}</p>
        )}
        <input type="hidden" name="termsVersion" value={terms?.termsVersion ?? 0} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptTerms" required className="accent-primary mt-0.5 size-4" disabled={!terms} aria-invalid={Boolean(f.acceptTerms) || undefined} />
          <span>I have read and accept the program terms{terms ? ` for ${terms.programName}` : ""}.</span>
        </label>
        {f.acceptTerms ? <p className="text-destructive text-sm">{f.acceptTerms}</p> : null}
      </div>

      <Button type="submit" disabled={pending || !terms}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
