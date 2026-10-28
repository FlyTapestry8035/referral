import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/dashboard/action-button";
import { deleteRewardAction } from "@/app/dashboard/manage-actions";
import { relativeTime } from "@/lib/format";
import { RewardForm } from "./reward-form";

const METRIC_LABEL: Record<string, string> = {
  helpfulness: "helpfulness ≥",
  bugs_count: "bugs found ≥",
  tips_count: "tips shared ≥",
  responses_count: "responses ≥",
  progress: "progress (%) ≥",
};

export default async function RewardsPage() {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const { data: rewards } = await supabase.from("rewards").select("*").eq("program_id", ctx.program.id).order("created_at");
  const ids = (rewards ?? []).map((r) => r.id);
  const { data: earned } = ids.length
    ? await supabase.from("tester_rewards").select("reward_id, earned_at, testers(name)").in("reward_id", ids).order("earned_at", { ascending: false })
    : { data: [] };
  const count = (id: string) => (earned ?? []).filter((e) => e.reward_id === id).length;
  const byId = new Map((rewards ?? []).map((r) => [r.id, r]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-xl font-semibold">Rewards and recognition</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            When a tester crosses a threshold they earn the badge. It shows next to their name in the dashboard and in their app. No payments are made; this only records who earned what.
          </p>
        </div>
        <Card className="py-0">
          <ul className="divide-y">
            {(rewards ?? []).length === 0 ? <li className="text-muted-foreground p-4 text-sm">No reward rules yet.</li> : null}
            {(rewards ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-4">
                <span className="text-2xl" aria-hidden>
                  {r.badge}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {METRIC_LABEL[r.metric]} {r.threshold}
                    {r.description ? ` · ${r.description}` : ""}
                  </p>
                </div>
                <span className="text-sm tabular-nums">{count(r.id)} earned</span>
                {ctx.canEdit ? (
                  <ActionButton variant="ghost" confirm={`Delete "${r.name}"? Testers lose this badge.`} action={deleteRewardAction.bind(null, r.id)}>
                    Delete
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recently earned</CardTitle>
          </CardHeader>
          <CardContent>
            {(earned ?? []).length === 0 ? <p className="text-muted-foreground text-sm">Nobody has earned a reward yet.</p> : null}
            <ul className="grid gap-1 text-sm">
              {(earned ?? []).slice(0, 30).map((e) => (
                <li key={`${e.reward_id}-${e.testers?.name}`} className="flex justify-between gap-2">
                  <span>
                    {byId.get(e.reward_id)?.badge} <strong>{e.testers?.name}</strong> earned {byId.get(e.reward_id)?.name}
                  </span>
                  <span className="text-muted-foreground">{relativeTime(e.earned_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      {ctx.canEdit ? (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New reward</CardTitle>
            <CardDescription>Testers who already qualify earn it immediately.</CardDescription>
          </CardHeader>
          <CardContent>
            <RewardForm programId={ctx.program.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
