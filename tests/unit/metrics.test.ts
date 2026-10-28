import { describe, expect, it } from "vitest";
import { computeOverview, selectionStats, takeaway, type MetricTester } from "@/lib/metrics";
import { csvCell, toCsv } from "@/lib/csv";

const t = (stage: MetricTester["stage"], progress = 0, helpfulness = 0, bugs = 0, tips = 0): MetricTester => ({
  stage,
  progress,
  helpfulness,
  bugs_count: bugs,
  tips_count: tips,
});

describe("computeOverview", () => {
  const testers = [t("invited"), t("onboarded", 0, 0), t("testing", 40, 30, 2, 1), t("feedback_sent", 80, 60, 1, 3), t("completed", 100, 90, 4, 2)];
  const o = computeOverview(testers);

  it("counts and sums", () => {
    expect(o.total).toBe(5);
    expect(o.joined).toBe(4);
    expect(o.completed).toBe(1);
    expect(o.bugs).toBe(7);
    expect(o.tips).toBe(6);
  });
  it("averages over joined testers", () => {
    expect(o.avgProgress).toBe(Math.round((0 + 40 + 80 + 100) / 4));
    expect(o.avgHelpfulness).toBe(Math.round((0 + 30 + 60 + 90) / 4));
  });
  it("builds a cumulative funnel", () => {
    expect(o.funnel.map((f) => f.count)).toEqual([5, 4, 3, 2, 1]);
    expect(o.funnel.map((f) => f.pct)).toEqual([100, 80, 60, 40, 20]);
    expect(o.funnel[3].label).toBe("Feedback sent");
  });
  it("writes the one-sentence takeaway", () => {
    expect(takeaway(o)).toBe("1 of 5 testers have finished testing, average helpfulness is 45 out of 100.");
    expect(takeaway(computeOverview([]))).toMatch(/No testers yet/);
  });
  it("handles an empty program", () => {
    const empty = computeOverview([]);
    expect(empty.avgHelpfulness).toBe(0);
    expect(empty.funnel.every((f) => f.count === 0 && f.pct === 0)).toBe(true);
  });
});

describe("selectionStats", () => {
  it("sums and averages numbers only", () => {
    expect(selectionStats([10, "Ada", 20, null, 30])).toEqual({ count: 5, numeric: 3, sum: 60, avg: 20 });
    expect(selectionStats(["a", "b"]).avg).toBeNull();
  });
});

describe("csv", () => {
  it("quotes and escapes", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell(-5)).toBe("-5");
  });
  it("builds a document", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x\r\n");
  });
});
