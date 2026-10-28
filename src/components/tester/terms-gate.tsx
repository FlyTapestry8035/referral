"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { acceptTermsAction } from "@/app/app/actions";

export function TermsGate({ testerId, programName, termsText, version }: { testerId: string; programName: string; termsText: string; version: number }) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="bg-card mx-auto grid max-w-xl gap-4 rounded-xl border p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">The {programName} terms have changed</h1>
        <p className="text-muted-foreground mt-1 text-sm">Please read and accept version {version} to keep testing.</p>
      </div>
      <div className="bg-muted/50 max-h-72 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap" tabIndex={0}>
        {termsText || "This program has no additional terms."}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="accent-primary mt-0.5 size-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        I have read and accept the updated terms.
      </label>
      <div>
        <Button
          disabled={!checked || pending}
          onClick={() =>
            start(async () => {
              const r = await acceptTermsAction(testerId);
              if (!r.ok) setError(r.error);
              else router.refresh();
            })
          }
        >
          Accept and continue
        </Button>
      </div>
    </div>
  );
}
