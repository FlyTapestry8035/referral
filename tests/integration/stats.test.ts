import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addTester, admin, cleanup, createCompany, createUser, hasSupabase } from "./helpers";
import { computeTesterStats } from "@/lib/stats";

let A: Awaited<ReturnType<typeof createCompany>>;
const users: string[] = [];
let missions: string[] = [];

// Small deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

describe.skipIf(!hasSupabase)("recompute_tester_stats (SQL) matches the TypeScript rules", () => {
  beforeAll(async () => {
    A = await createCompany("Stats Co");
    const { data } = await admin()
      .from("missions")
      .insert([1, 2, 3, 4].map((i) => ({ program_id: A.program.id, title: `Mission ${i}`, position: i })))
      .select("id");
    missions = data!.map((m) => m.id);
  });
  afterAll(async () => {
    await cleanup([A.company.id], users);
  });

  it("invited testers without an account stay invited", async () => {
    const t = await addTester(A.program.id, null, "No account");
    const { data } = await admin().from("testers").select("stage, progress, helpfulness").eq("id", t.id).single();
    expect(data).toEqual({ stage: "invited", progress: 0, helpfulness: 0 });
  });

  it("agrees with computeTesterStats across 20 random scenarios", async () => {
    const rand = rng(42);
    const db = admin();
    for (let i = 0; i < 20; i++) {
      const user = await createUser(`stats-${i}`);
      users.push(user.id);
      const tester = await addTester(A.program.id, user, `Stats ${i}`);

      const statuses = missions.map(() => (["none", "todo", "doing", "done"] as const)[Math.floor(rand() * 4)]);
      const rows = statuses
        .map((s, idx) => ({ s, idx }))
        .filter((x) => x.s !== "none")
        .map((x) => ({ tester_id: tester.id, mission_id: missions[x.idx], status: x.s as "todo" | "doing" | "done" }));
      if (rows.length) await db.from("tester_missions").insert(rows);

      const counts = { bug: Math.floor(rand() * 5), tip: Math.floor(rand() * 5), response: Math.floor(rand() * 6) };
      const feedback = (Object.keys(counts) as (keyof typeof counts)[]).flatMap((kind) =>
        Array.from({ length: counts[kind] }, (_, n) => ({
          program_id: A.program.id,
          tester_id: tester.id,
          kind,
          title: `${kind} ${n}`,
          severity: kind === "bug" ? ("medium" as const) : null,
        })),
      );
      const ratings: number[] = [];
      if (feedback.length) {
        const { data: inserted } = await db.from("feedback").insert(feedback).select("id");
        for (const f of inserted ?? []) {
          if (rand() < 0.4) {
            const r = Math.floor(rand() * 6);
            ratings.push(r);
            await db.from("feedback").update({ team_rating: r }).eq("id", f.id);
          }
        }
      }

      const expected = computeTesterStats({
        hasAccount: true,
        termsAccepted: true,
        totalMissions: missions.length,
        doneMissions: statuses.filter((s) => s === "done").length,
        missionStarted: statuses.some((s) => s === "doing" || s === "done"),
        bugs: counts.bug,
        tips: counts.tip,
        responses: counts.response,
        ratings,
      });
      const { data: actual } = await db
        .from("testers")
        .select("progress, bugs_count, tips_count, responses_count, helpfulness, stage")
        .eq("id", tester.id)
        .single();
      expect(actual, `scenario ${i}`).toEqual(expected);
    }
  });

  it("recomputes when feedback is deleted and when missions are added", async () => {
    const db = admin();
    const user = await createUser("stats-recalc");
    users.push(user.id);
    const tester = await addTester(A.program.id, user, "Recalc");
    await db.from("tester_missions").insert(missions.map((m) => ({ tester_id: tester.id, mission_id: m, status: "done" as const })));
    let { data } = await db.from("testers").select("progress, stage, last_active_at").eq("id", tester.id).single();
    expect(data?.progress).toBe(100);
    expect(data?.stage).toBe("completed");
    expect(data?.last_active_at).not.toBeNull();

    // A new mission drops everyone's progress.
    const { data: extra } = await db.from("missions").insert({ program_id: A.program.id, title: "Extra", position: 9 }).select().single();
    ({ data } = await db.from("testers").select("progress, stage, last_active_at").eq("id", tester.id).single());
    expect(data?.progress).toBe(80);
    expect(data?.stage).toBe("testing");

    const { data: fb } = await db
      .from("feedback")
      .insert({ program_id: A.program.id, tester_id: tester.id, kind: "tip", title: "tip" })
      .select()
      .single();
    ({ data } = await db.from("testers").select("progress, stage, last_active_at").eq("id", tester.id).single());
    expect(data?.stage).toBe("feedback_sent");

    await db.from("feedback").delete().eq("id", fb!.id);
    ({ data } = await db.from("testers").select("progress, stage, last_active_at").eq("id", tester.id).single());
    expect(data?.stage).toBe("testing");

    await db.from("missions").delete().eq("id", extra!.id);
    ({ data } = await db.from("testers").select("progress, stage, last_active_at").eq("id", tester.id).single());
    expect(data?.progress).toBe(100);
  });

  it("awards rewards once a threshold is crossed, and bumps terms versions", async () => {
    const db = admin();
    const user = await createUser("stats-reward");
    users.push(user.id);
    const tester = await addTester(A.program.id, user, "Rewarded");
    const { data: reward } = await db
      .from("rewards")
      .insert({ program_id: A.program.id, name: "Bug hunter", metric: "bugs_count", threshold: 2 })
      .select()
      .single();
    await db.from("feedback").insert({ program_id: A.program.id, tester_id: tester.id, kind: "bug", title: "b1", severity: "low" });
    let { data: earned } = await db.from("tester_rewards").select("reward_id").eq("tester_id", tester.id);
    expect(earned).toEqual([]);
    await db.from("feedback").insert({ program_id: A.program.id, tester_id: tester.id, kind: "bug", title: "b2", severity: "low" });
    ({ data: earned } = await db.from("tester_rewards").select("reward_id").eq("tester_id", tester.id));
    expect(earned).toEqual([{ reward_id: reward!.id }]);

    const { data: before } = await db.from("programs").select("terms_version").eq("id", A.program.id).single();
    await db.from("programs").update({ terms_text: "New terms" }).eq("id", A.program.id);
    const { data: after } = await db.from("programs").select("terms_version").eq("id", A.program.id).single();
    expect(after!.terms_version).toBe(before!.terms_version + 1);
    await db.from("programs").update({ digest_subject: "unrelated change" }).eq("id", A.program.id);
    const { data: same } = await db.from("programs").select("terms_version").eq("id", A.program.id).single();
    expect(same!.terms_version).toBe(after!.terms_version);
  });

  it("queues webhook deliveries and writes the audit log", async () => {
    const db = admin();
    await db.from("webhooks").insert({
      program_id: A.program.id,
      url: "https://example.com/hook",
      secret: "0123456789abcdef0123",
      events: ["feedback.created", "tester.stage_changed"],
    });
    const user = await createUser("stats-hooks");
    users.push(user.id);
    const tester = await addTester(A.program.id, user, "Hooked");
    await db.from("feedback").insert({ program_id: A.program.id, tester_id: tester.id, kind: "tip", title: "hello" });
    const { data: deliveries } = await db
      .from("webhook_deliveries")
      .select("event, payload")
      .eq("program_id", A.program.id)
      .order("created_at");
    const events = deliveries!.map((d) => d.event);
    expect(events).toContain("feedback.created");
    expect(events).toContain("tester.stage_changed");

    const { data: audit } = await db.from("audit_log").select("action, entity").eq("program_id", A.program.id);
    expect(audit!.some((a) => a.entity === "feedback" && a.action === "insert")).toBe(true);
    const { data: hookAudit } = await db.from("audit_log").select("meta").eq("entity", "webhooks").eq("program_id", A.program.id);
    expect(JSON.stringify(hookAudit)).not.toContain("0123456789abcdef0123");
  });
});
