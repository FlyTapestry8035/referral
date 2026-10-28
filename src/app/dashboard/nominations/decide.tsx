"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { decideNominationAction } from "@/app/dashboard/manage-actions";

export function DecideButtons({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await decideNominationAction(id, approve);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Done" } : { ok: false, text: r.error });
      router.refresh();
    });
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide(true)} aria-label={`Approve ${name}`}>
          Approve and invite
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(false)} aria-label={`Reject ${name}`}>
          Reject
        </Button>
      </div>
      {msg ? <FormMessage kind={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}
    </div>
  );
}
