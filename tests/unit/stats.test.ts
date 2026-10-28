import { describe, expect, it } from "vitest";
import { computeBaseline, computeHelpfulness, computeProgress, computeStage, computeTesterStats, type StatsInput } from "@/lib/stats";

const base: StatsInput = {
  hasAccount: true,
  termsAccepted: true,
  totalMissions: 5,
  doneMissions: 0,
  missionStarted: false,
  bugs: 0,
  tips: 0,
  responses: 0,
  ratings: [],
};

describe("progress", () => {
  it("is 0 when there are no missions", () => {
    expect(computeProgress(0, 0)).toBe(0);
    expect(computeProgress(3, 0)).toBe(0);
  });
  it("is done / total * 100, rounded", () => {
    expect(computeProgress(1, 5)).toBe(20);
    expect(computeProgress(1, 3)).toBe(33);
    expect(computeProgress(2, 3)).toBe(67);
    expect(computeProgress(5, 5)).toBe(100);
  });
});

describe("helpfulness", () => {
  it("baseline is responses*4 + bugs*5 + tips*3, capped at 60", () => {
    expect(computeBaseline(0, 0, 0)).toBe(0);
    expect(computeBaseline(1, 1, 1)).toBe(12);
    expect(computeBaseline(2, 3, 4)).toBe(8 + 15 + 12);
    expect(computeBaseline(10, 10, 10)).toBe(60);
  });
  it("is the baseline when nothing is rated", () => {
    expect(computeHelpfulness(35, [])).toBe(35);
  });
  it("blends 40% baseline with 60% of the average rating scaled to 100", () => {
    // 0.4*30 + 0.6*(4*20) = 12 + 48 = 60
    expect(computeHelpfulness(30, [4])).toBe(60);
    // avg 4.5 -> 90 -> 0.4*60 + 54 = 78
    expect(computeHelpfulness(60, [5, 4])).toBe(78);
    // all fives and full baseline -> 24 + 60 = 84
    expect(computeHelpfulness(60, [5, 5, 5])).toBe(84);
    // a 0 rating counts as rated
    expect(computeHelpfulness(10, [0])).toBe(4);
  });
  it("rounds like Postgres (half away from zero)", () => {
    // 0.4*1 + 0.6*(1*20) = 12.4 -> 12 ; 0.4*7 + 0.6*(1/2*20)... use avg 2.5: 0.4*5 + 30 = 32
    expect(computeHelpfulness(1, [1])).toBe(12);
    // 0.4*0 + 0.6*(avg(1,2)=1.5*20=30) = 18
    expect(computeHelpfulness(0, [1, 2])).toBe(18);
    // 0.4*12 + 0.6*(20*... ) produce .5: baseline 5, rating 0 -> 2 exactly; baseline 15, ratings [] n/a
    // baseline 25, rating avg 0 -> 10 ; baseline 3 -> 1.2 -> 1 ; baseline 4, rating 0 -> 1.6 -> 2
    expect(computeHelpfulness(4, [0])).toBe(2);
  });
});

describe("stage", () => {
  it("is invited without an account", () => {
    expect(computeTesterStats({ ...base, hasAccount: false, bugs: 3 }).stage).toBe("invited");
  });
  it("is onboarded with an account and accepted terms", () => {
    expect(computeTesterStats(base).stage).toBe("onboarded");
  });
  it("is testing once a mission is started", () => {
    expect(computeTesterStats({ ...base, missionStarted: true }).stage).toBe("testing");
  });
  it("is testing once feedback is sent, even with no mission started", () => {
    expect(computeTesterStats({ ...base, tips: 1 }).stage).toBe("testing");
  });
  it("is feedback_sent with feedback and progress >= 75", () => {
    expect(computeTesterStats({ ...base, doneMissions: 4, missionStarted: true, bugs: 1 }).stage).toBe("feedback_sent");
    expect(computeStage({ hasAccount: true, termsAccepted: true, progress: 75, feedbackCount: 1, missionStarted: true })).toBe("feedback_sent");
  });
  it("stays testing at progress >= 75 without feedback", () => {
    expect(computeTesterStats({ ...base, doneMissions: 4, missionStarted: true }).stage).toBe("testing");
  });
  it("is completed at 100% progress, with or without feedback", () => {
    expect(computeTesterStats({ ...base, doneMissions: 5, missionStarted: true }).stage).toBe("completed");
    expect(computeTesterStats({ ...base, doneMissions: 5, missionStarted: true, bugs: 2 }).stage).toBe("completed");
  });
  it("never completes when the program has no missions", () => {
    expect(computeTesterStats({ ...base, totalMissions: 0, responses: 2 }).stage).toBe("testing");
  });
});

describe("computeTesterStats", () => {
  it("returns counts and derived fields together", () => {
    expect(
      computeTesterStats({ ...base, doneMissions: 2, missionStarted: true, bugs: 2, tips: 1, responses: 3, ratings: [3, 5] }),
    ).toEqual({
      progress: 40,
      bugs_count: 2,
      tips_count: 1,
      responses_count: 3,
      // baseline 12+10+3 = 25; 0.4*25 + 0.6*80 = 10 + 48 = 58
      helpfulness: 58,
      stage: "testing",
    });
  });
});
