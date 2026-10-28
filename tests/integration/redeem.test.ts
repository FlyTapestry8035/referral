import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createCode, createCompany, hasSupabase } from "./helpers";

let A: Awaited<ReturnType<typeof createCompany>>;

describe.skipIf(!hasSupabase)("redeem_referral_code", () => {
  beforeAll(async () => {
    A = await createCompany("Redeem Co");
  });
  afterAll(async () => {
    await cleanup([A.company.id], []);
  });

  async function redeem(code: string) {
    return admin().rpc("redeem_referral_code", { p_code: code });
  }

  it("redeems a valid code and increments uses", async () => {
    const code = await createCode(A.program.id, { maxUses: 3 });
    const { data, error } = await redeem(code.code.toLowerCase());
    expect(error).toBeNull();
    expect(data?.[0]).toEqual({ code_id: code.id, program_id: A.program.id });
    const { data: after } = await admin().from("referral_codes").select("uses").eq("id", code.id).single();
    expect(after?.uses).toBe(1);
  });

  it("returns the same error for unknown, revoked, expired and used-up codes", async () => {
    const revoked = await createCode(A.program.id, { revokedAt: new Date().toISOString() });
    const expired = await createCode(A.program.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    const used = await createCode(A.program.id, { maxUses: 1 });
    await redeem(used.code);

    const messages = new Set<string>();
    for (const c of ["REF-ZZZZ-ZZZZ", revoked.code, expired.code, used.code]) {
      const { error } = await redeem(c);
      expect(error).not.toBeNull();
      messages.add(error!.message);
    }
    expect([...messages]).toEqual(["invalid_referral_code"]);
  });

  it("never lets a single-use code through twice, even under concurrency", async () => {
    const code = await createCode(A.program.id, { maxUses: 1 });
    const results = await Promise.all(Array.from({ length: 12 }, () => redeem(code.code)));
    expect(results.filter((r) => !r.error).length).toBe(1);
    const { data } = await admin().from("referral_codes").select("uses").eq("id", code.id).single();
    expect(data?.uses).toBe(1);
  });

  it("respects usage caps under concurrency", async () => {
    const code = await createCode(A.program.id, { maxUses: 5 });
    const results = await Promise.all(Array.from({ length: 15 }, () => redeem(code.code)));
    expect(results.filter((r) => !r.error).length).toBe(5);
  });

  it("allows unlimited codes", async () => {
    const code = await createCode(A.program.id, { maxUses: null });
    for (let i = 0; i < 4; i++) expect((await redeem(code.code)).error).toBeNull();
  });

  it("gives a use back with release_referral_code", async () => {
    const code = await createCode(A.program.id, { maxUses: 1 });
    await redeem(code.code);
    await admin().rpc("release_referral_code", { p_code_id: code.id });
    expect((await redeem(code.code)).error).toBeNull();
  });
});
