"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage } from "@/components/ui/field";
import { addMemberAction, createProgramAction, sendTestDigestAction, updateProgramSettingsAction } from "./actions";
import type { Program } from "@/lib/auth";

const COMMON_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Europe/Paris", "Africa/Lagos", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

function zones(current: string): string[] {
  let all: string[] = COMMON_ZONES;
  try {
    all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? COMMON_ZONES;
  } catch {}
  return all.includes(current) ? all : [current, ...all];
}

export function ProgramSettingsForm({ program, canEdit, cronMode }: { program: Program; canEdit: boolean; cronMode: "daily" | "hourly" }) {
  const [state, action, pending] = useActionState(updateProgramSettingsAction, undefined);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  const [testState, setTestState] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, startTest] = useTransition();
  const tzList = zones(program.digest_timezone);

  return (
    <form action={action} className="grid gap-8">
      <input type="hidden" name="programId" value={program.id} />
      <fieldset disabled={!canEdit} className="grid gap-8">
        {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}

        <section className="grid gap-4">
          <h2 className="font-semibold">Program</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Program name" htmlFor="name" error={f.name}>
              <Input id="name" name="name" defaultValue={program.name} required maxLength={200} />
            </Field>
            <Field label="Product name" htmlFor="productName" error={f.productName} hint="Shown to testers and in emails.">
              <Input id="productName" name="productName" defaultValue={program.product_name} maxLength={200} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4" aria-labelledby="digest-h">
          <div>
            <h2 id="digest-h" className="font-semibold">Scheduled check-in email</h2>
            <p className="text-muted-foreground text-sm">Asks each tester for bugs and tips, with their next mission and two buttons.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="digestEnabled" defaultChecked={program.digest_enabled} className="accent-primary size-4" />
            Send check-in emails
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Every … days" htmlFor="digestIntervalDays" error={f.digestIntervalDays} hint="1 = daily, 7 = weekly, any number works.">
              <Input id="digestIntervalDays" name="digestIntervalDays" type="number" min={1} max={365} defaultValue={program.digest_interval_days} required />
            </Field>
            <Field
              label="Send hour"
              htmlFor="digestSendHour"
              error={f.digestSendHour}
              hint={
                cronMode === "daily"
                  ? "Ignored right now: the cron runs once a day (Vercel Hobby), so emails go out when it runs (09:00 UTC by default). Switch the cron to hourly on a Pro plan to use this."
                  : "Emails go out during this hour in the program's time zone."
              }
            >
              <NativeSelect id="digestSendHour" name="digestSendHour" defaultValue={String(program.digest_send_hour)}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Time zone" htmlFor="digestTimezone" error={f.digestTimezone} hint="Also decides what counts as “a day”.">
              <NativeSelect id="digestTimezone" name="digestTimezone" defaultValue={program.digest_timezone}>
                {tzList.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Subject" htmlFor="digestSubject" error={f.digestSubject}>
            <Input id="digestSubject" name="digestSubject" defaultValue={program.digest_subject} required maxLength={200} />
          </Field>
          <Field label="Intro text" htmlFor="digestIntro" error={f.digestIntro}>
            <Textarea id="digestIntro" name="digestIntro" defaultValue={program.digest_intro} maxLength={2000} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={() =>
                startTest(async () => {
                  const r = await sendTestDigestAction(program.id);
                  setTestState(r.ok ? { ok: true, text: r.message ?? "Sent" } : { ok: false, text: r.error });
                })
              }
            >
              {testing ? "Sending…" : "Send me a test email"}
            </Button>
            <span className="text-muted-foreground text-xs">Uses the saved settings. Save first if you changed something.</span>
          </div>
          {testState ? <FormMessage kind={testState.ok ? "success" : "error"}>{testState.text}</FormMessage> : null}
        </section>

        <section className="grid gap-4" aria-labelledby="nudge-h">
          <div>
            <h2 id="nudge-h" className="font-semibold">Smart nudges</h2>
            <p className="text-muted-foreground text-sm">A friendly reminder to testers who went quiet or got stuck. At most one per tester per week.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="nudgesEnabled" defaultChecked={program.nudges_enabled} className="accent-primary size-4" />
            Send nudges
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inactive for … days" htmlFor="nudgeInactiveDays" error={f.nudgeInactiveDays}>
              <Input id="nudgeInactiveDays" name="nudgeInactiveDays" type="number" min={1} max={365} defaultValue={program.nudge_inactive_days} />
            </Field>
            <Field label="Stuck on one mission for … days" htmlFor="nudgeStuckDays" error={f.nudgeStuckDays}>
              <Input id="nudgeStuckDays" name="nudgeStuckDays" type="number" min={1} max={365} defaultValue={program.nudge_stuck_days} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4" aria-labelledby="nom-h">
          <div>
            <h2 id="nom-h" className="font-semibold">Tester nominations</h2>
            <p className="text-muted-foreground text-sm">Helpful testers can nominate people. You approve each nomination before an invite goes out.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum helpfulness to nominate" htmlFor="nominationMinHelpfulness" error={f.nominationMinHelpfulness}>
              <Input id="nominationMinHelpfulness" name="nominationMinHelpfulness" type="number" min={0} max={100} defaultValue={program.nomination_min_helpfulness} />
            </Field>
            <Field label="Nominations per tester" htmlFor="nominationsPerTester" error={f.nominationsPerTester}>
              <Input id="nominationsPerTester" name="nominationsPerTester" type="number" min={0} max={50} defaultValue={program.nominations_per_tester} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4" aria-labelledby="terms-h">
          <div>
            <h2 id="terms-h" className="font-semibold">Terms / NDA</h2>
            <p className="text-muted-foreground text-sm">
              Testers accept these when they join. Changing the text creates version {program.terms_version + 1} and every tester has to accept it again before they can continue.
            </p>
          </div>
          <Field label={`Terms text (current: version ${program.terms_version})`} htmlFor="termsText" error={f.termsText}>
            <Textarea id="termsText" name="termsText" defaultValue={program.terms_text} rows={8} maxLength={50000} />
          </Field>
        </section>

        {canEdit ? (
          <div className="bg-background/95 sticky bottom-0 border-t py-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">You have view-only access.</p>
        )}
      </fieldset>
    </form>
  );
}

export function NewProgramForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createProgramAction, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh(); // picks up the new program (and leaves /setup)
  }, [state, router]);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Program name" htmlFor="np-name" error={f.name}>
          <Input id="np-name" name="name" required maxLength={200} placeholder="e.g. Mobile app beta" />
        </Field>
        <Field label="Product name" htmlFor="np-product" error={f.productName}>
          <Input id="np-product" name="productName" maxLength={200} />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creating…" : "Create program"}
        </Button>
      </div>
    </form>
  );
}

export function AddMemberForm({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const [state, action, pending] = useActionState(addMemberAction, undefined);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state ? <FormMessage kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field label="Email" htmlFor="mem-email" error={f.email}>
          <Input id="mem-email" name="email" type="email" required maxLength={320} />
        </Field>
        <Field label="Role" htmlFor="mem-role">
          <NativeSelect id="mem-role" name="role" defaultValue="viewer">
            <option value="viewer">Viewer (read-only)</option>
            <option value="admin">Admin</option>
            {isOwner ? <option value="owner">Owner</option> : null}
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
