import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateReferralCode } from "@/lib/codes";

export type Client = SupabaseClient<Database>;

export const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function admin(): Client {
  return createClient<Database>(url(), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anon(): Client {
  return createClient<Database>(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

const run = Math.random().toString(36).slice(2, 8);
export const PASSWORD = "integration-test-password-123";

export function testEmail(label: string) {
  return `it-${run}-${label}@example.com`;
}

export async function createUser(label: string): Promise<{ id: string; email: string }> {
  const email = testEmail(label);
  const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  return { id: data.user.id, email };
}

export async function signIn(email: string): Promise<Client> {
  const client = anon();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

export async function createCompany(name: string) {
  const db = admin();
  const { data: company, error } = await db.from("companies").insert({ name: `${name} ${run}` }).select().single();
  if (error) throw error;
  const { data: program, error: pErr } = await db
    .from("programs")
    .insert({ company_id: company.id, name: `${name} beta`, terms_text: "Be nice." })
    .select()
    .single();
  if (pErr) throw pErr;
  return { company, program };
}

export async function addMember(companyId: string, userId: string, role: "owner" | "admin" | "viewer") {
  const { error } = await admin().from("company_members").insert({ company_id: companyId, user_id: userId, role });
  if (error) throw error;
}

export async function addTester(programId: string, user: { id: string; email: string } | null, name: string, email?: string) {
  const { data, error } = await admin()
    .from("testers")
    .insert({
      program_id: programId,
      user_id: user?.id ?? null,
      name,
      email: user?.email ?? email ?? testEmail(name),
      terms_accepted_at: user ? new Date().toISOString() : null,
      terms_version_accepted: user ? 1 : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createCode(programId: string, opts: { maxUses?: number | null; expiresAt?: string | null; revokedAt?: string | null } = {}) {
  const { data, error } = await admin()
    .from("referral_codes")
    .insert({
      program_id: programId,
      code: generateReferralCode(),
      max_uses: opts.maxUses ?? null,
      expires_at: opts.expiresAt ?? null,
      revoked_at: opts.revokedAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cleanup(companyIds: string[], userIds: string[]) {
  const db = admin();
  if (companyIds.length) await db.from("companies").delete().in("id", companyIds);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
}
