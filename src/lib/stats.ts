// TypeScript mirror of the SQL function public.recompute_tester_stats.
// The SQL version is the source of truth; integration tests check that both agree.

export type Stage = "invited" | "onboarded" | "testing" | "feedback_sent" | "completed";
export const STAGES: Stage[] = ["invited", "onboarded", "testing", "feedback_sent", "completed"];
export const STAGE_LABELS: Record<Stage, string> = {
  invited: "Invited",
  onboarded: "Onboarded",
  testing: "Testing",
  feedback_sent: "Feedback sent",
  completed: "Completed",
};

export type StatsInput = {
  hasAccount: boolean;
  termsAccepted: boolean;
  totalMissions: number;
  doneMissions: number;
  /** at least one mission is "doing" or "done" */
  missionStarted: boolean;
  bugs: number;
  tips: number;
  responses: number;
  /** team ratings (0-5) of this tester's rated feedback */
  ratings: number[];
};

export type Stats = {
  progress: number;
  bugs_count: number;
  tips_count: number;
  responses_count: number;
  helpfulness: number;
  stage: Stage;
};

// Postgres round(numeric) rounds half away from zero; all values here are >= 0, so Math.round matches.
export function computeProgress(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done * 100) / total);
}

export function computeBaseline(responses: number, bugs: number, tips: number): number {
  return Math.min(60, responses * 4 + bugs * 5 + tips * 3);
}

export function computeHelpfulness(baseline: number, ratings: number[]): number {
  if (ratings.length === 0) return baseline;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return Math.round(0.4 * baseline + 0.6 * (avg * 20));
}

export function computeStage(input: {
  hasAccount: boolean;
  termsAccepted: boolean;
  progress: number;
  feedbackCount: number;
  missionStarted: boolean;
}): Stage {
  if (!input.hasAccount) return "invited";
  if (input.progress === 100) return "completed";
  if (input.feedbackCount >= 1 && input.progress >= 75) return "feedback_sent";
  if (input.missionStarted || input.feedbackCount >= 1) return "testing";
  if (input.termsAccepted) return "onboarded";
  return "invited";
}

export function computeTesterStats(input: StatsInput): Stats {
  const progress = computeProgress(input.doneMissions, input.totalMissions);
  const baseline = computeBaseline(input.responses, input.bugs, input.tips);
  return {
    progress,
    bugs_count: input.bugs,
    tips_count: input.tips,
    responses_count: input.responses,
    helpfulness: computeHelpfulness(baseline, input.ratings),
    stage: computeStage({
      hasAccount: input.hasAccount,
      termsAccepted: input.termsAccepted,
      progress,
      feedbackCount: input.bugs + input.tips + input.responses,
      missionStarted: input.missionStarted,
    }),
  };
}
