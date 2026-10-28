import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addTester, admin, cleanup, createCompany, createUser, hasSupabase, signIn, testEmail, type Client } from "./helpers";

let A: Awaited<ReturnType<typeof createCompany>>;
let star: { id: string }, newbie: { id: string };
let starClient: Client, newbieClient: Client;
const users: string[] = [];

describe.skipIf(!hasSupabase)("tester nominations", () => {
  beforeAll(async () => {
    A = await createCompany("Nominations Co");
    await admin().from("programs").update({ nomination_min_helpfulness: 30, nominations_per_tester: 3 }).eq("id", A.program.id);
    const [u1, u2] = await Promise.all([createUser("nom-star"), createUser("nom-newbie")]);
    users.push(u1.id, u2.id);
    star = await addTester(A.program.id, u1, "Star");
    newbie = await addTester(A.program.id, u2, "Newbie");
    // Seven responses -> baseline 28; one bug -> 33 helpfulness, above the threshold of 30.
    await admin()
      .from("feedback")
      .insert([
        ...Array.from({ length: 7 }, (_, i) => ({ program_id: A.program.id, tester_id: star.id, kind: "response" as const, title: `r${i}` })),
        { program_id: A.program.id, tester_id: star.id, kind: "bug" as const, title: "b", severity: "low" as const },
      ]);
    [starClient, newbieClient] = await Promise.all([signIn(u1.email), signIn(u2.email)]);
  });
  afterAll(async () => {
    await cleanup([A.company.id], users);
  });

  const nominate = (client: Client, testerId: string, label: string) =>
    client.from("nominations").insert({ program_id: A.program.id, nominated_by_tester_id: testerId, name: label, email: testEmail(label) });

  it("is allowed above the helpfulness threshold, up to the per-tester limit", async () => {
    const { data } = await admin().from("testers").select("helpfulness").eq("id", star.id).single();
    expect(data!.helpfulness).toBeGreaterThanOrEqual(30);
    for (const n of ["n1", "n2", "n3"]) expect((await nominate(starClient, star.id, n)).error).toBeNull();
    expect((await nominate(starClient, star.id, "n4")).error).not.toBeNull();
  });

  it("is refused below the threshold", async () => {
    expect((await nominate(newbieClient, newbie.id, "low")).error).not.toBeNull();
  });

  it("cannot be made on someone else's behalf or pre-approved", async () => {
    expect((await nominate(newbieClient, star.id, "spoof")).error).not.toBeNull();
    const approved = await starClient
      .from("nominations")
      .insert({ program_id: A.program.id, nominated_by_tester_id: star.id, name: "x", email: testEmail("x"), status: "approved" });
    expect(approved.error).not.toBeNull();
  });

  it("testers see only their own nominations and cannot approve them", async () => {
    const { data: own } = await starClient.from("nominations").select("id, status");
    expect(own!.length).toBe(3);
    const { data: other } = await newbieClient.from("nominations").select("id");
    expect(other).toEqual([]);
    const { data: upd } = await starClient.from("nominations").update({ status: "approved" }).eq("nominated_by_tester_id", star.id).select();
    expect(upd ?? []).toEqual([]);
  });
});
