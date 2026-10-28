import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { getMemberships, getMyTesters, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedbackForm } from "@/components/tester/feedback-form";
import { ReportWidget } from "@/components/tester/report-widget";
import { MissionChecklist } from "@/components/tester/mission-checklist";
import { TermsGate } from "@/components/tester/terms-gate";
import { NominateForm } from "@/components/tester/nominate-form";
import { StageDot } from "@/components/dashboard/stage-dot";
import { submitFeedbackAction } from "./actions";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Your missions · Referral" };

export default async function TesterApp({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app");
  const [testers, memberships] = await Promise.all([getMyTesters(), getMemberships()]);
  const { p } = await searchParams;

  if (testers.length === 0) {
    return (
      <main className="mx-auto grid max-w-xl gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">No active beta programs</h1>
        <p className="text-muted-foreground">
          {memberships.length > 0 ? "You're a company member." : "Your access may have been removed, or you haven't joined a program yet."}
        </p>
        <div className="flex justify-center gap-2">
          {memberships.length > 0 ? (
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/join">Join with a referral code</Link>
            </Button>
          )}
        </div>
      </main>
    );
  }

  const tester = testers.find((t) => t.program_id === p) ?? testers[0];
  const program = tester.programs!;

  if ((tester.terms_version_accepted ?? 0) < program.terms_version) {
    return (
      <main className="px-4 py-12">
        <TermsGate testerId={tester.id} programName={program.name} termsText={program.terms_text} version={program.terms_version} />
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: missions }, { data: progress }, { data: feedback }, { data: earned }, { count: nominationsUsed }] = await Promise.all([
    supabase.from("missions").select("id, title, description, position").eq("program_id", program.id).order("position").order("created_at"),
    supabase.from("tester_missions").select("mission_id, status").eq("tester_id", tester.id),
    supabase.from("feedback").select("id, kind, title, status, created_at, duplicate_of").eq("tester_id", tester.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("tester_rewards").select("earned_at, rewards(name, badge, description)").eq("tester_id", tester.id),
    supabase.from("nominations").select("id", { count: "exact", head: true }).eq("nominated_by_tester_id", tester.id),
  ]);
  const statusOf = new Map((progress ?? []).map((r) => [r.mission_id, r.status]));
  const checklist = (missions ?? []).map((m) => ({ id: m.id, title: m.title, description: m.description, status: statusOf.get(m.id) ?? ("todo" as const) }));
  const canNominate = tester.helpfulness >= program.nomination_min_helpfulness && program.nominations_per_tester > 0;
  const remainingNominations = Math.max(0, program.nominations_per_tester - (nominationsUsed ?? 0));

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs">R</span>
            {program.product_name || program.name}
          </span>
          {testers.length > 1 ? (
            <nav aria-label="Your programs" className="flex gap-2 text-sm">
              {testers.map((t) => (
                <Link key={t.id} href={`/app?p=${t.program_id}`} aria-current={t.id === tester.id ? "page" : undefined} className={t.id === tester.id ? "font-medium underline" : "text-muted-foreground"}>
                  {t.programs?.name}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {memberships.length > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : null}
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="icon" aria-label="Sign out" type="submit">
                <LogOutIcon />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8 pb-24">
        <section className="grid gap-3">
          <h1 className="text-2xl font-semibold">Hi {tester.name.split(" ")[0]}!</h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <StageDot stage={tester.stage} />
            <span>{tester.progress}% of missions done</span>
            <span>Helpfulness {tester.helpfulness}/100</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={tester.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Mission progress">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${tester.progress}%` }} />
          </div>
          {earned?.length ? (
            <div className="flex flex-wrap gap-2" aria-label="Your badges">
              {earned.map((e) => (
                <Badge key={e.rewards?.name} variant="secondary" title={e.rewards?.description}>
                  {e.rewards?.badge} {e.rewards?.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Missions</CardTitle>
            <CardDescription>Work through these in order. Tick them off as you go.</CardDescription>
          </CardHeader>
          <CardContent>
            <MissionChecklist testerId={tester.id} missions={checklist} />
          </CardContent>
        </Card>

        <Card id="feedback">
          <CardHeader>
            <CardTitle>Send feedback</CardTitle>
            <CardDescription>Bugs, ideas, anything. You can also use the Report button in the corner to attach a screenshot.</CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackForm action={submitFeedbackAction} hidden={{ testerId: tester.id, source: "app" }} allowUpload />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {feedback?.length ? (
              <ul className="divide-y">
                {feedback.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground capitalize">{f.kind}:</span> {f.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={f.status === "fixed" ? "default" : "outline"} className="capitalize">
                        {f.duplicate_of ? "merged" : f.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{relativeTime(f.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing yet. Your first bug report is the hardest one!</p>
            )}
          </CardContent>
        </Card>

        {canNominate ? (
          <Card>
            <CardHeader>
              <CardTitle>Invite someone great</CardTitle>
              <CardDescription>You&apos;ve been really helpful, so you can nominate people for the beta. The team approves each one.</CardDescription>
            </CardHeader>
            <CardContent>
              <NominateForm testerId={tester.id} remaining={remainingNominations} />
            </CardContent>
          </Card>
        ) : null}
      </main>

      <ReportWidget testerId={tester.id} />
    </div>
  );
}
