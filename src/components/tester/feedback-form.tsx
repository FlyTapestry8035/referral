"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage } from "@/components/ui/field";

export type FeedbackFormState = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> } | undefined;
type Kind = "bug" | "tip" | "response";

/**
 * Shared by the in-app form, the floating widget, the embed popup and the emailed /f link.
 * `screenshot` (a Blob captured by the widget) and `context` are attached on submit.
 */
export function FeedbackForm({
  action,
  hidden,
  defaultKind = "bug",
  allowUpload = false,
  screenshot,
  context,
  onDone,
  idPrefix = "fb",
}: {
  action: (prev: FeedbackFormState, formData: FormData) => Promise<FeedbackFormState>;
  hidden: Record<string, string>;
  defaultKind?: Kind;
  allowUpload?: boolean;
  screenshot?: Blob | null;
  context?: Record<string, string>;
  onDone?: () => void;
  idPrefix?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [, startTransition] = useTransition();
  const [kind, setKind] = useState<Kind>(defaultKind);
  const formRef = useRef<HTMLFormElement>(null);
  const f = state && !state.ok ? (state.fields ?? {}) : {};

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <form
      ref={formRef}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
        fd.set("context", JSON.stringify(context ?? { url: window.location.href, userAgent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}` }));
        if (screenshot) fd.set("screenshot", new File([screenshot], "screenshot.png", { type: screenshot.type || "image/png" }));
        startTransition(() => dispatch(fd));
      }}
    >
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor={id("kind")}>
          <NativeSelect id={id("kind")} name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="bug">Bug</option>
            <option value="tip">Tip or idea</option>
            <option value="response">General feedback</option>
          </NativeSelect>
        </Field>
        {kind === "bug" ? (
          <Field label="How bad is it?" htmlFor={id("severity")}>
            <NativeSelect id={id("severity")} name="severity" defaultValue="medium">
              <option value="low">Low: cosmetic</option>
              <option value="medium">Medium: annoying</option>
              <option value="high">High: blocks me</option>
            </NativeSelect>
          </Field>
        ) : null}
      </div>
      <Field label="Title" htmlFor={id("title")} error={f.title}>
        <Input id={id("title")} name="title" required maxLength={200} placeholder={kind === "bug" ? "What went wrong?" : "Your idea in a sentence"} />
      </Field>
      <Field label="Details" htmlFor={id("body")} error={f.body} hint={kind === "bug" ? "What did you do, what did you expect, what happened?" : undefined}>
        <Textarea id={id("body")} name="body" maxLength={10000} rows={4} />
      </Field>
      {allowUpload ? (
        <Field label="Screenshot (optional)" htmlFor={id("screenshot")} error={f.screenshot} hint="PNG, JPEG or WebP, up to 5 MB.">
          <Input id={id("screenshot")} name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" />
        </Field>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : kind === "bug" ? "Report bug" : "Send"}
        </Button>
      </div>
    </form>
  );
}
