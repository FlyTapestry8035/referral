import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Role = Database["public"]["Enums"]["member_role"];
export type Program = Database["public"]["Tables"]["programs"]["Row"];
export type Tester = Database["public"]["Tables"]["testers"]["Row"];

export const PROGRAM_COOKIE = "referral_program";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
});

export const getMemberships = cache(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("company_id, role, companies(id, name)")
    .eq("user_id", user.id);
  return (data ?? []).map((m) => ({ companyId: m.company_id, role: m.role, companyName: m.companies?.name ?? "" }));
});

export const getMyTesters = cache(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("testers")
    .select("*, programs(*)")
    .eq("user_id", user.id)
    .is("access_revoked_at", null)
    .order("created_at");
  return data ?? [];
});

/** Where a signed-in user belongs: company members go to the dashboard, testers to /app. */
export async function homeFor(): Promise<string> {
  const memberships = await getMemberships();
  if (memberships.length > 0) return "/dashboard";
  return "/app";
}

export type DashboardContext = {
  user: { id: string; email: string };
  program: Program;
  programs: Program[];
  role: Role;
  companyId: string;
  companyName: string;
  canEdit: boolean;
};

/**
 * Resolves the signed-in member and the program they are looking at (from a cookie, defaulting
 * to their first program). Redirects testers and signed-out users away.
 */
export const requireDashboard = cache(async (): Promise<DashboardContext> => {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/app");

  const supabase = await createClient();
  const { data: programs } = await supabase.from("programs").select("*").order("created_at");
  const memberPrograms = (programs ?? []).filter((p) => memberships.some((m) => m.companyId === p.company_id));
  if (memberPrograms.length === 0) redirect("/setup");

  const wanted = (await cookies()).get(PROGRAM_COOKIE)?.value;
  const program = memberPrograms.find((p) => p.id === wanted) ?? memberPrograms[0];
  const membership = memberships.find((m) => m.companyId === program.company_id)!;
  return {
    user,
    program,
    programs: memberPrograms,
    role: membership.role,
    companyId: membership.companyId,
    companyName: membership.companyName,
    canEdit: membership.role === "owner" || membership.role === "admin",
  };
});

/** Server actions call this before writing; RLS enforces the same rule in the database. */
export async function requireEditor(programId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, company_id, name").eq("id", programId).maybeSingle();
  if (!program) throw new Error("Program not found");
  const memberships = await getMemberships();
  const m = memberships.find((x) => x.companyId === program.company_id);
  if (!m || (m.role !== "owner" && m.role !== "admin")) throw new Error("You need the admin or owner role to do that");
  return { user, program, role: m.role, supabase };
}
