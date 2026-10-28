import { STAGES, STAGE_LABELS, type Stage } from "./stats";

export type MetricTester = {
  stage: Stage;
  progress: number;
  helpfulness: number;
  bugs_count: number;
  tips_count: number;
};

export type Overview = {
  total: number;
  joined: number;
  completed: number;
  avgProgress: number;
  avgHelpfulness: number;
  bugs: number;
  tips: number;
  funnel: { stage: Stage; label: string; count: number; pct: number }[];
};

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/**
 * Dashboard numbers. Averages are over testers who have joined (stage past "invited"), so a
 * batch of fresh invites does not drag them down. The funnel is cumulative: a completed tester
 * also counts as having reached every earlier stage.
 */
export function computeOverview(testers: MetricTester[]): Overview {
  const joined = testers.filter((t) => t.stage !== "invited");
  const rank = (s: Stage) => STAGES.indexOf(s);
  const funnel = STAGES.map((stage) => {
    const count = testers.filter((t) => rank(t.stage) >= rank(stage)).length;
    return { stage, label: STAGE_LABELS[stage], count, pct: testers.length ? Math.round((count / testers.length) * 100) : 0 };
  });
  return {
    total: testers.length,
    joined: joined.length,
    completed: testers.filter((t) => t.stage === "completed").length,
    avgProgress: mean(joined.map((t) => t.progress)),
    avgHelpfulness: mean(joined.map((t) => t.helpfulness)),
    bugs: testers.reduce((a, t) => a + t.bugs_count, 0),
    tips: testers.reduce((a, t) => a + t.tips_count, 0),
    funnel,
  };
}

export function takeaway(o: Overview): string {
  if (o.total === 0) return "No testers yet. Create a referral code or invite someone by email to get started.";
  const noun = o.total === 1 ? "tester has" : "testers have";
  return `${o.completed} of ${o.total} ${noun} finished testing, average helpfulness is ${o.avgHelpfulness} out of 100.`;
}

/** Sum and average of the numeric values in a selection; non-numbers are counted but ignored. */
export function selectionStats(values: unknown[]): { count: number; numeric: number; sum: number; avg: number | null } {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const sum = nums.reduce((a, b) => a + b, 0);
  return { count: values.length, numeric: nums.length, sum, avg: nums.length ? sum / nums.length : null };
}
