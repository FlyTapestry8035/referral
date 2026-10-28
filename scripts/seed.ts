// DEMO DATA ONLY. Creates one fake company, program, 5 missions, 3 codes and 24 fake testers
// (all @example.com) spread across every stage. Safe to re-run: it deletes the previous demo first.
//
//   npm run seed
//
// Logins it creates (password printed at the end):
//   owner@example.com   company owner  -> /dashboard
//   viewer@example.com  read-only role -> /dashboard
//   any tester email    tester         -> /app
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./load-env";
import type { Database } from "../src/lib/supabase/database.types";

const DEMO_COMPANY = "Acme Robotics (demo)";
const DEMO_PASSWORD = process.env.SEED_PASSWORD || "demo-password-1234";

const db = createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number, hours = 0) => new Date(now - d * DAY - hours * 3_600_000).toISOString();

// Deterministic pseudo-random numbers so every seed looks the same.
let seed = 20261028;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

type Stage = Database["public"]["Enums"]["tester_stage"];

// [name, stage, missions done, mission in progress, bugs, tips, responses, ratings, last activity days ago]
type Plan = [string, Stage, number, boolean, number, number, number, number[], number];
const TESTERS: Plan[] = [
  ["Avery Demo", "invited", 0, false, 0, 0, 0, [], 0],
  ["Blake Sample", "invited", 0, false, 0, 0, 0, [], 0],
  ["Casey Placeholder", "invited", 0, false, 0, 0, 0, [], 0],
  ["Devon Testcase", "invited", 0, false, 0, 0, 0, [], 0],
  ["Emery Fictional", "onboarded", 0, false, 0, 0, 0, [], 9],
  ["Finley Mockwell", "onboarded", 0, false, 0, 0, 0, [], 3],
  ["Gray Fakeson", "onboarded", 0, false, 0, 0, 0, [], 12],
  ["Harper Dummy", "onboarded", 0, false, 0, 0, 0, [], 1],
  ["Indigo Stubbs", "testing", 1, true, 1, 0, 1, [3], 2],
  ["Jules Pretend", "testing", 0, true, 0, 1, 0, [], 6],
  ["Kai Sandbox", "testing", 2, true, 2, 1, 2, [4, 3], 1],
  ["Logan Notreal", "testing", 1, false, 0, 0, 2, [], 8],
  ["Morgan Example", "testing", 3, true, 3, 2, 1, [5, 4], 0],
  ["Noel Imaginary", "testing", 2, true, 1, 2, 3, [2], 5],
  ["Oakley Invented", "feedback_sent", 4, true, 2, 1, 3, [4], 1],
  ["Parker Madeup", "feedback_sent", 4, false, 4, 2, 2, [5, 4, 4], 0],
  ["Quinn Synthetic", "feedback_sent", 4, true, 1, 3, 4, [3, 3], 2],
  ["Reese Fauxman", "feedback_sent", 4, false, 3, 0, 1, [2, 3], 4],
  ["Sage Demoington", "feedback_sent", 4, true, 5, 4, 2, [5, 5], 0],
  ["Taylor Mockup", "completed", 5, false, 6, 3, 5, [5, 4, 5], 0],
  ["Umber Testerly", "completed", 5, false, 2, 2, 5, [3], 3],
  ["Val Fixture", "completed", 5, false, 4, 5, 3, [4, 4, 5, 3], 1],
  ["Wren Scaffold", "completed", 5, false, 1, 1, 5, [], 7],
  ["Xen Prototype", "completed", 5, false, 7, 2, 4, [5, 5, 4], 2],
];

const MISSIONS = [
  ["Create your first project", "Sign in, create a project and give it a name."],
  ["Invite a teammate", "Send an invite from Settings → Team and check that it arrives."],
  ["Connect a device", "Pair a robot (or the simulator) and run the calibration wizard."],
  ["Run a scheduled job", "Schedule a cleaning job for tomorrow and confirm it shows on the calendar."],
  ["Export a report", "Export last week's activity as PDF and CSV. Do the numbers match?"],
];

const BUG_TITLES = [
  "Calibration wizard freezes at 80%",
  "Invite email shows the wrong company name",
  "Calendar shows jobs one day late",
  "PDF export cuts off the last column",
  "Settings page flickers in dark mode",
  "Can't remove a paired device",
  "Error toast never disappears",
  "Search ignores accents",
];
const TIP_TITLES = [
  "Add keyboard shortcuts to the calendar",
  "Let me duplicate a scheduled job",
  "Show battery level on the device list",
  "Remember my last export format",
  "Bigger tap targets on mobile",
];
const RESPONSE_TITLES = ["Weekly check-in", "Setup was smooth", "First impressions", "Answer to survey", "Re: how is it going?"];

const email = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;

async function removePreviousDemo() {
  const { data: companies } = await db.from("companies").select("id").eq("name", DEMO_COMPANY);
  if (companies?.length) await db.from("companies").delete().in("id", companies.map((c) => c.id));
  // Delete demo auth users (they carry user_metadata.demo = true).
  for (let page = 1; page < 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) if (u.user_metadata?.demo === true) await db.auth.admin.deleteUser(u.id);
    if (users.length < 200) break;
  }
}

async function createUser(address: string, name: string) {
  const { data, error } = await db.auth.admin.createUser({
    email: address,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name, demo: true },
  });
  if (error || !data.user) throw new Error(`createUser ${address}: ${error?.message}`);
  return data.user.id;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data == null) throw new Error(`${what}: ${error?.message ?? "no data"}`);
  return data as NonNullable<T>;
}

async function main() {
  console.log("Removing previous demo data…");
  await removePreviousDemo();

  console.log("Creating demo company, program, missions and codes…");
  const company = await must(db.from("companies").insert({ name: DEMO_COMPANY }).select().single(), "company");
  const ownerId = await createUser("owner@example.com", "Olivia Owner (demo)");
  const viewerId = await createUser("viewer@example.com", "Victor Viewer (demo)");
  await must(
    db
      .from("company_members")
      .insert([
        { company_id: company.id, user_id: ownerId, role: "owner" },
        { company_id: company.id, user_id: viewerId, role: "viewer" },
      ])
      .select(),
    "members",
  );

  const program = await must(
    db
      .from("programs")
      .insert({
        company_id: company.id,
        name: "Acme Home beta",
        product_name: "Acme Home",
        digest_subject: "Your Acme Home beta check-in",
        digest_intro: "Thanks for testing Acme Home! Found something broken or have an idea? It takes 30 seconds.",
        digest_timezone: "America/New_York",
        terms_text:
          "DEMO TERMS. Acme Home is pre-release software. Please keep what you see confidential, don't share screenshots publicly, and expect bugs. You can leave the beta at any time.",
      })
      .select()
      .single(),
    "program",
  );

  const missions = await must(
    db
      .from("missions")
      .insert(MISSIONS.map(([title, description], i) => ({ program_id: program.id, title, description, position: i + 1 })))
      .select(),
    "missions",
  );
  missions.sort((a, b) => a.position - b.position);

  const codes = await must(
    db
      .from("referral_codes")
      .insert([
        { program_id: program.id, code: "REF-BETA-2345", label: "Launch waitlist (demo)", created_by: ownerId },
        { program_id: program.id, code: "REF-PART-NERS", label: "Partner cohort, 30 uses (demo)", max_uses: 30, expires_at: daysAgo(-30), created_by: ownerId },
        { program_id: program.id, code: "REF-STAR-7777", label: "VIP single-use (demo)", max_uses: 1, created_by: ownerId },
      ])
      .select(),
    "codes",
  );
  const [waitlist, partners] = codes;

  console.log("Creating 24 demo testers…");
  let partnerUses = 0;
  let waitlistUses = 0;
  for (const [index, [name, stage, done, doing, bugs, tips, responses, ratings, lastDays]] of TESTERS.entries()) {
    const address = email(name);
    const joinedDaysAgo = 14 + Math.floor(rand() * 10);
    const code = index % 3 === 0 ? partners : waitlist;
    const hasAccount = stage !== "invited";
    const userId = hasAccount ? await createUser(address, name) : null;
    if (hasAccount) code === partners ? partnerUses++ : waitlistUses++;

    const tester = await must(
      db
        .from("testers")
        .insert({
          program_id: program.id,
          user_id: userId,
          referral_code_id: code.id,
          name,
          email: address,
          terms_accepted_at: hasAccount ? daysAgo(joinedDaysAgo) : null,
          terms_version_accepted: hasAccount ? 1 : null,
          created_at: daysAgo(joinedDaysAgo + 1),
          // Onboarded testers have no activity rows, so give them a realistic last-seen date.
          last_active_at: stage === "onboarded" ? daysAgo(lastDays, 3) : null,
          notes: index === 12 ? "Very thorough. Consider for the case study." : "",
        })
        .select()
        .single(),
      `tester ${name}`,
    );
    if (hasAccount) await db.from("terms_acceptances").insert({ tester_id: tester.id, terms_version: 1, accepted_at: daysAgo(joinedDaysAgo) });

    // Missions: the first `done` are done, the next one is in progress if `doing`.
    const missionRows: Database["public"]["Tables"]["tester_missions"]["Insert"][] = [];
    for (let m = 0; m < done; m++) {
      const at = daysAgo(lastDays + (done - m) * 1.5, 2);
      missionRows.push({ tester_id: tester.id, mission_id: missions[m].id, status: "done", started_at: at, completed_at: at, updated_at: at });
    }
    if (doing && done < missions.length) {
      const at = daysAgo(lastDays + 0.2);
      missionRows.push({ tester_id: tester.id, mission_id: missions[done].id, status: "doing", started_at: daysAgo(lastDays + 1), updated_at: at });
    }
    if (missionRows.length) await must(db.from("tester_missions").insert(missionRows, { defaultToNull: false }).select(), "tester_missions");

    // Feedback, spread over the tester's active period; the newest one is `lastDays` ago.
    const items: Database["public"]["Tables"]["feedback"]["Insert"][] = [];
    const total = bugs + tips + responses;
    let k = 0;
    const when = () => daysAgo(lastDays + (total - ++k) * 1.3, 1);
    for (let b = 0; b < bugs; b++)
      items.push({
        program_id: program.id,
        tester_id: tester.id,
        kind: "bug",
        title: pick(BUG_TITLES),
        body: "Steps: open the page, click the button, wait. Expected it to work; it didn't. (demo)",
        severity: pick(["low", "medium", "medium", "high"] as const),
        status: pick(["new", "new", "acknowledged", "fixed"] as const),
        context: { url: "https://app.acme.example/projects", userAgent: "Mozilla/5.0 (demo)", viewport: pick(["1440x900", "390x844", "1280x720"]) },
        created_at: when(),
      });
    for (let t = 0; t < tips; t++)
      items.push({ program_id: program.id, tester_id: tester.id, kind: "tip", title: pick(TIP_TITLES), body: "Would save me a few clicks every day. (demo)", status: pick(["new", "acknowledged"] as const), created_at: when() });
    for (let r = 0; r < responses; r++)
      items.push({ program_id: program.id, tester_id: tester.id, kind: "response", title: pick(RESPONSE_TITLES), body: "Going well so far, a couple of rough edges. (demo)", created_at: when() });
    // Ratings go on the oldest items first.
    ratings.forEach((r, i) => {
      if (items[i]) items[i].team_rating = r;
    });
    if (items.length) await must(db.from("feedback").insert(items, { defaultToNull: false }).select("id"), "feedback");
  }

  // Code usage counts match the accounts created above.
  await db.from("referral_codes").update({ uses: waitlistUses }).eq("id", waitlist.id);
  await db.from("referral_codes").update({ uses: partnerUses }).eq("id", partners.id);

  await db.from("rewards").insert([
    { program_id: program.id, name: "Bug hunter", description: "Reported 5 or more bugs", badge: "🐞", metric: "bugs_count", threshold: 5 },
    { program_id: program.id, name: "Super helpful", description: "Helpfulness of 80 or more", badge: "⭐", metric: "helpfulness", threshold: 80 },
    { program_id: program.id, name: "Finisher", description: "Completed every mission", badge: "🏁", metric: "progress", threshold: 100 },
  ]);

  const { data: summary } = await db.from("testers").select("stage").eq("program_id", program.id);
  const byStage = (summary ?? []).reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.stage]: (acc[t.stage] ?? 0) + 1 }), {});

  console.log("\nDemo data ready (all of it is fake, every email is @example.com).");
  console.log(`  Company: ${DEMO_COMPANY}   Program: ${program.name}`);
  console.log(`  Testers by stage: ${JSON.stringify(byStage)}`);
  console.log(`  Codes: ${codes.map((c) => c.code).join(", ")}`);
  console.log(`\n  Log in at /login with password "${DEMO_PASSWORD}":`);
  console.log("    owner@example.com    (owner, sees /dashboard)");
  console.log("    viewer@example.com   (viewer, read-only dashboard)");
  console.log(`    ${email("Morgan Example")}   (a tester, sees /app)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
