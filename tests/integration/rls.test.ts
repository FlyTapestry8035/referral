import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, addTester, admin, anon, cleanup, createCode, createCompany, createUser, hasSupabase, signIn, type Client } from "./helpers";

// Fixture: company A (owner, viewer, two testers) and company B (owner, one tester).
let A: Awaited<ReturnType<typeof createCompany>>;
let B: Awaited<ReturnType<typeof createCompany>>;
let ownerA: Client, viewerA: Client, tester1: Client, tester2: Client, ownerB: Client;
let t1: { id: string }, t2: { id: string }, tB: { id: string };
let missionA: string;
let feedbackT2: string;
const users: string[] = [];

describe.skipIf(!hasSupabase)("row level security", () => {
  beforeAll(async () => {
    A = await createCompany("Company A");
    B = await createCompany("Company B");
    const [uOwnerA, uViewerA, uT1, uT2, uOwnerB, uTB] = await Promise.all([
      createUser("owner-a"),
      createUser("viewer-a"),
      createUser("tester-1"),
      createUser("tester-2"),
      createUser("owner-b"),
      createUser("tester-b"),
    ]);
    users.push(uOwnerA.id, uViewerA.id, uT1.id, uT2.id, uOwnerB.id, uTB.id);
    await addMember(A.company.id, uOwnerA.id, "owner");
    await addMember(A.company.id, uViewerA.id, "viewer");
    await addMember(B.company.id, uOwnerB.id, "owner");
    t1 = await addTester(A.program.id, uT1, "Tester One");
    t2 = await addTester(A.program.id, uT2, "Tester Two");
    tB = await addTester(B.program.id, uTB, "Tester B");

    const db = admin();
    const { data: m } = await db.from("missions").insert({ program_id: A.program.id, title: "Sign in", position: 1 }).select().single();
    missionA = m!.id;
    const { data: f } = await db
      .from("feedback")
      .insert({ program_id: A.program.id, tester_id: t2.id, kind: "bug", title: "T2 private bug", severity: "high" })
      .select()
      .single();
    feedbackT2 = f!.id;
    await db.from("feedback").insert({ program_id: B.program.id, tester_id: tB.id, kind: "tip", title: "B tip" });
    await createCode(A.program.id);
    await createCode(B.program.id);
    await db.from("webhooks").insert({ program_id: A.program.id, url: "https://example.com/hook", secret: "0123456789abcdef0123", events: ["feedback.created"] });

    [ownerA, viewerA, tester1, tester2, ownerB] = await Promise.all([
      signIn(uOwnerA.email),
      signIn(uViewerA.email),
      signIn(uT1.email),
      signIn(uT2.email),
      signIn(uOwnerB.email),
    ]);
  });

  afterAll(async () => {
    await cleanup([A?.company.id, B?.company.id].filter(Boolean) as string[], users);
  });

  describe("a tester", () => {
    it("can read their own tester row but not another tester's", async () => {
      const { data } = await tester1.from("testers").select("id");
      expect(data?.map((r) => r.id)).toEqual([t1.id]);
      const { data: other } = await tester1.from("testers").select("id").eq("id", t2.id);
      expect(other).toEqual([]);
    });

    it("cannot read another tester's feedback", async () => {
      const { data } = await tester1.from("feedback").select("id").eq("id", feedbackT2);
      expect(data).toEqual([]);
      const { data: own } = await tester2.from("feedback").select("id");
      expect(own?.map((r) => r.id)).toEqual([feedbackT2]);
    });

    it("can submit feedback for themselves only", async () => {
      const ok = await tester1.from("feedback").insert({ program_id: A.program.id, tester_id: t1.id, kind: "tip", title: "Mine" });
      expect(ok.error).toBeNull();
      const spoof = await tester1.from("feedback").insert({ program_id: A.program.id, tester_id: t2.id, kind: "tip", title: "Not mine" });
      expect(spoof.error).not.toBeNull();
    });

    it("cannot rate or triage their own feedback", async () => {
      const rated = await tester1
        .from("feedback")
        .insert({ program_id: A.program.id, tester_id: t1.id, kind: "bug", title: "Self-rated", team_rating: 5 });
      expect(rated.error).not.toBeNull();
      const { data } = await tester2.from("feedback").update({ status: "fixed" }).eq("id", feedbackT2).select();
      expect(data ?? []).toEqual([]);
    });

    it("cannot change their own stats", async () => {
      const res = await tester1.from("testers").update({ helpfulness: 100 } as never).eq("id", t1.id);
      expect(res.error).not.toBeNull();
      const { data } = await admin().from("testers").select("helpfulness").eq("id", t1.id).single();
      expect(data?.helpfulness).not.toBe(100);
    });

    it("ticks their own missions but not someone else's", async () => {
      const ok = await tester1.from("tester_missions").insert({ tester_id: t1.id, mission_id: missionA, status: "doing" });
      expect(ok.error).toBeNull();
      const bad = await tester1.from("tester_missions").insert({ tester_id: t2.id, mission_id: missionA, status: "done" });
      expect(bad.error).not.toBeNull();
    });

    it("cannot see referral codes, email log, webhooks or the audit log", async () => {
      for (const table of ["referral_codes", "email_log", "webhooks", "audit_log"] as const) {
        const { data } = await tester1.from(table).select("id");
        expect(data, table).toEqual([]);
      }
    });

    it("cannot redeem codes directly through the API", async () => {
      const { error } = await tester1.rpc("redeem_referral_code", { p_code: "REF-AAAA-AAAA" });
      expect(error).not.toBeNull();
    });
  });

  describe("a viewer", () => {
    it("can read the program's testers and feedback", async () => {
      const { data: testers } = await viewerA.from("testers").select("id").eq("program_id", A.program.id);
      expect(testers?.length).toBe(2);
      const { data: fb } = await viewerA.from("feedback").select("id").eq("program_id", A.program.id);
      expect(fb?.length).toBeGreaterThanOrEqual(1);
    });

    it("cannot write anything", async () => {
      const upd = await viewerA.from("testers").update({ notes: "viewer was here" }).eq("id", t1.id).select();
      expect(upd.data ?? []).toEqual([]);
      const code = await viewerA.from("referral_codes").insert({ program_id: A.program.id, code: "REF-VVVV-VVVV" });
      expect(code.error).not.toBeNull();
      const mission = await viewerA.from("missions").insert({ program_id: A.program.id, title: "nope" });
      expect(mission.error).not.toBeNull();
      const prog = await viewerA.from("programs").update({ name: "hijacked" }).eq("id", A.program.id).select();
      expect(prog.data ?? []).toEqual([]);
      const triage = await viewerA.from("feedback").update({ status: "fixed" }).eq("id", feedbackT2).select();
      expect(triage.data ?? []).toEqual([]);
      const member = await viewerA.from("company_members").insert({ company_id: A.company.id, user_id: users[0], role: "admin" });
      expect(member.error).not.toBeNull();

      const { data } = await admin().from("testers").select("notes").eq("id", t1.id).single();
      expect(data?.notes).toBe("");
    });

    it("cannot see webhook secrets", async () => {
      const { data } = await viewerA.from("webhooks").select("id, secret");
      expect(data).toEqual([]);
    });
  });

  describe("an owner", () => {
    it("can write in their own program", async () => {
      const upd = await ownerA.from("testers").update({ notes: "great tester" }).eq("id", t1.id).select();
      expect(upd.data?.[0]?.notes).toBe("great tester");
      const triage = await ownerA.from("feedback").update({ team_rating: 4, status: "acknowledged" }).eq("id", feedbackT2).select();
      expect(triage.data?.[0]?.team_rating).toBe(4);
      const { data: wh } = await ownerA.from("webhooks").select("id");
      expect(wh?.length).toBe(1);
    });

    it("cannot tamper with code usage counts", async () => {
      const { data: code } = await ownerA.from("referral_codes").select("id").limit(1).single();
      const res = await ownerA.from("referral_codes").update({ uses: 999 } as never).eq("id", code!.id);
      expect(res.error).not.toBeNull();
    });
  });

  describe("company isolation", () => {
    it("company A cannot see company B (and vice versa)", async () => {
      for (const [client, other] of [
        [ownerA, B],
        [ownerB, A],
      ] as const) {
        const { data: companies } = await client.from("companies").select("id").eq("id", other.company.id);
        expect(companies).toEqual([]);
        const { data: programs } = await client.from("programs").select("id").eq("id", other.program.id);
        expect(programs).toEqual([]);
        for (const table of ["testers", "feedback", "referral_codes", "missions", "audit_log"] as const) {
          const { data } = await client.from(table).select("id").eq("program_id", other.program.id);
          expect(data, table).toEqual([]);
        }
      }
    });

    it("company A cannot write into company B", async () => {
      const res = await ownerA.from("missions").insert({ program_id: B.program.id, title: "cross-company" });
      expect(res.error).not.toBeNull();
      const upd = await ownerA.from("testers").update({ notes: "x" }).eq("id", tB.id).select();
      expect(upd.data ?? []).toEqual([]);
    });
  });

  describe("anonymous visitors", () => {
    it("cannot sign up directly with Supabase Auth (public sign-ups are disabled)", async () => {
      const { data, error } = await anon().auth.signUp({ email: "walk-in@example.com", password: "a-very-long-password-1" });
      expect(error).not.toBeNull();
      expect(data.user).toBeNull();
    });

    it("cannot read any table", async () => {
      const client = anon();
      for (const table of ["companies", "programs", "testers", "feedback", "referral_codes"] as const) {
        const { data } = await client.from(table).select("id");
        expect(data ?? [], table).toEqual([]);
      }
    });
  });
});
