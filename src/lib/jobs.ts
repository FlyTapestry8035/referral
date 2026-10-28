import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { digestEmail, nudgeEmail } from "@/lib/email/messages";
import { claimEmailSlot, finishEmailSlot, todayUtc } from "@/lib/email/log";
import { feedbackLink, oneClickUnsubscribeLink, unsubscribeLink } from "@/lib/links";
import { isDigestDue, localDate, nudgeReason } from "@/lib/schedule";
import type { Database } from "@/lib/supabase/database.types";

type Program = Database["public"]["Tables"]["programs"]["Row"];
export type JobSummary = { programs: number; considered: number; sent: number; stubbed: number; skipped: number; failed: number; errors: string[] };

const emptySummary = (): JobSummary => ({ programs: 0, considered: 0, sent: 0, stubbed: 0, skipped: 0, failed: 0, errors: [] });

// Resend's default limit is a few requests per second; stay well under it.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEND_GAP_MS = 250;

async function loadProgramData(programId: string) {
  const admin = createAdminClient();
  const [{ data: testers }, { data: missions }] = await Promise.all([
    admin
      .from("testers")
      .select("id, name, email, stage, created_at, last_active_at")
      .eq("program_id", programId)
      .not("user_id", "is", null)
      .is("unsubscribed_at", null)
      .is("access_revoked_at", null),
    admin.from("missions").select("id, title, description, position").eq("program_id", programId).order("position").order("created_at"),
  ]);
  const testerIds = (testers ?? []).map((t) => t.id);
  const { data: progress } = testerIds.length
    ? await admin.from("tester_missions").select("tester_id, mission_id, status, started_at").in("tester_id", testerIds)
    : { data: [] };
  return { testers: testers ?? [], missions: missions ?? [], progress: progress ?? [] };
}

async function lastEmailAt(programId: string, kind: "digest" | "nudge", sinceDays: number) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data } = await createAdminClient()
    .from("email_log")
    .select("tester_id, sent_at")
    .eq("program_id", programId)
    .eq("kind", kind)
    .in("status", ["sent", "stubbed"])
    .gte("sent_at", since);
  const map = new Map<string, Date>();
  for (const r of data ?? []) {
    const d = new Date(r.sent_at);
    if (!map.has(r.tester_id) || map.get(r.tester_id)! < d) map.set(r.tester_id, d);
  }
  return map;
}

function nextMission(missions: { id: string; title: string; description: string }[], progress: { tester_id: string; mission_id: string; status: string }[], testerId: string) {
  const done = new Set(progress.filter((p) => p.tester_id === testerId && p.status === "done").map((p) => p.mission_id));
  return missions.find((m) => !done.has(m.id)) ?? null;
}

export function buildDigest(program: Program, tester: { id: string; name: string; email: string }, mission: { title: string; description: string } | null) {
  return digestEmail(
    tester.email,
    program.digest_subject,
    {
      testerName: tester.name.split(" ")[0] || tester.name,
      programName: program.product_name || program.name,
      intro: program.digest_intro,
      nextMission: mission ? { title: mission.title, description: mission.description } : null,
      bugUrl: feedbackLink(tester.id, "bug"),
      tipUrl: feedbackLink(tester.id, "tip"),
      unsubscribeUrl: unsubscribeLink(tester.id),
    },
    oneClickUnsubscribeLink(tester.id),
  );
}

/**
 * Sends digests to every tester who is due. Idempotent: each send first claims the
 * (program, tester, "digest", local day) row in email_log, so a second run the same day,
 * or two overlapping runs, cannot email anyone twice.
 */
export async function runDigest(now = new Date()): Promise<JobSummary> {
  const summary = emptySummary();
  const mode = env().DIGEST_CRON_MODE;
  const admin = createAdminClient();
  const { data: programs } = await admin.from("programs").select("*").eq("digest_enabled", true);

  for (const program of programs ?? []) {
    summary.programs++;
    try {
      const { testers, missions, progress } = await loadProgramData(program.id);
      const last = await lastEmailAt(program.id, "digest", program.digest_interval_days + 2);
      const sendDate = localDate(now, program.digest_timezone);
      for (const tester of testers) {
        summary.considered++;
        const due = isDigestDue({
          now,
          timeZone: program.digest_timezone,
          intervalDays: program.digest_interval_days,
          sendHour: program.digest_send_hour,
          cronMode: mode,
          lastDigestAt: last.get(tester.id) ?? null,
        });
        if (!due) {
          summary.skipped++;
          continue;
        }
        const slot = await claimEmailSlot(admin, { programId: program.id, testerId: tester.id, kind: "digest", sendDate });
        if (!slot) {
          summary.skipped++;
          continue;
        }
        const result = await sendEmail(buildDigest(program, tester, nextMission(missions, progress, tester.id)));
        await finishEmailSlot(admin, slot, result);
        if (result.status === "failed") {
          summary.failed++;
          summary.errors.push(`${tester.id}: ${result.error}`);
        } else summary[result.status]++;
        await pause(SEND_GAP_MS);
      }
    } catch (e) {
      summary.errors.push(`${program.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return summary;
}

/** Inactive (N days) or stuck on one mission (M days) testers get a nudge, at most once a week. */
export async function runNudges(now = new Date()): Promise<JobSummary> {
  const summary = emptySummary();
  const admin = createAdminClient();
  const { data: programs } = await admin.from("programs").select("*").eq("nudges_enabled", true);

  for (const program of programs ?? []) {
    summary.programs++;
    try {
      const { testers, missions, progress } = await loadProgramData(program.id);
      const lastNudge = await lastEmailAt(program.id, "nudge", 8);
      for (const tester of testers) {
        if (tester.stage === "completed") continue;
        summary.considered++;
        const doing = progress.filter((p) => p.tester_id === tester.id && p.status === "doing" && p.started_at);
        const reason = nudgeReason({
          now,
          lastActiveAt: tester.last_active_at ? new Date(tester.last_active_at) : null,
          createdAt: new Date(tester.created_at),
          inactiveDays: program.nudge_inactive_days,
          stuckDays: program.nudge_stuck_days,
          doingSince: doing.map((p) => new Date(p.started_at!)),
          lastNudgeAt: lastNudge.get(tester.id) ?? null,
        });
        if (!reason) {
          summary.skipped++;
          continue;
        }
        const slot = await claimEmailSlot(admin, { programId: program.id, testerId: tester.id, kind: "nudge", sendDate: todayUtc(now) });
        if (!slot) {
          summary.skipped++;
          continue;
        }
        const stuckOn = reason === "stuck" ? missions.find((m) => m.id === doing.sort((a, b) => a.started_at!.localeCompare(b.started_at!))[0]?.mission_id) : undefined;
        const result = await sendEmail(
          nudgeEmail(tester.email, {
            name: tester.name.split(" ")[0] || tester.name,
            programName: program.product_name || program.name,
            reason,
            missionTitle: stuckOn?.title,
            appUrl: appUrl("/app"),
            bugUrl: feedbackLink(tester.id, "bug"),
            unsubscribeUrl: unsubscribeLink(tester.id),
            oneClickUrl: oneClickUnsubscribeLink(tester.id),
          }),
        );
        await finishEmailSlot(admin, slot, result);
        if (result.status === "failed") {
          summary.failed++;
          summary.errors.push(`${tester.id}: ${result.error}`);
        } else summary[result.status]++;
        await pause(SEND_GAP_MS);
      }
    } catch (e) {
      summary.errors.push(`${program.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return summary;
}
