// Creates a company, its first program and an owner account.
// Usage: npm run create-owner -- --email you@company.com --company "Acme" --program "Acme beta" [--password "..."]
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./load-env";
import type { Database } from "../src/lib/supabase/database.types";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    company: { type: "string" },
    program: { type: "string" },
    password: { type: "string" },
  },
});

if (!values.email || !values.company) {
  console.error('Usage: npm run create-owner -- --email you@company.com --company "Acme" [--program "Acme beta"] [--password "..."]');
  process.exit(1);
}

const db = createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const email = values.email!.trim().toLowerCase();
  const password = values.password ?? randomBytes(12).toString("base64url");
  if (password.length < 12) throw new Error("Password must be at least 12 characters");

  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) throw error ?? new Error("Could not create user");

  const { data: company, error: cErr } = await db.from("companies").insert({ name: values.company! }).select().single();
  if (cErr) throw cErr;
  await db.from("company_members").insert({ company_id: company.id, user_id: created.user.id, role: "owner" });
  const { data: program, error: pErr } = await db
    .from("programs")
    .insert({ company_id: company.id, name: values.program ?? `${values.company} beta` })
    .select()
    .single();
  if (pErr) throw pErr;

  console.log(`Created company "${company.name}" with program "${program.name}".`);
  console.log(`Owner login: ${email}`);
  if (!values.password) console.log(`Temporary password: ${password}  (change it with "Forgot password" after logging in)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
