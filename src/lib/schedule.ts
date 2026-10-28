// Pure scheduling rules for digest and nudge emails. Unit tested in tests/unit/schedule.test.ts.

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hour (0-23) of an instant in a time zone. */
export function localHour(instant: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(instant);
  return Number(h) % 24;
}

/** Whole calendar days between two YYYY-MM-DD dates. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const a = Date.UTC(+fromIsoDate.slice(0, 4), +fromIsoDate.slice(5, 7) - 1, +fromIsoDate.slice(8, 10));
  const b = Date.UTC(+toIsoDate.slice(0, 4), +toIsoDate.slice(5, 7) - 1, +toIsoDate.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type DigestDueInput = {
  now: Date;
  timeZone: string;
  intervalDays: number;
  sendHour: number;
  cronMode: "daily" | "hourly";
  lastDigestAt: Date | null;
};

/**
 * A tester is due when at least `intervalDays` calendar days (in the program's time zone) have
 * passed since their last digest. Calendar days, not 24h blocks, because Vercel's daily cron can
 * fire anywhere inside an hour: 9:40 yesterday and 9:10 today is still "one day later".
 * With an hourly cron we additionally wait for the program's send hour; with a daily cron the
 * send hour is ignored (the cron only runs once).
 */
export function isDigestDue(input: DigestDueInput): boolean {
  if (input.cronMode === "hourly" && localHour(input.now, input.timeZone) !== input.sendHour) return false;
  if (!input.lastDigestAt) return true;
  const elapsed = daysBetween(localDate(input.lastDigestAt, input.timeZone), localDate(input.now, input.timeZone));
  return elapsed >= input.intervalDays;
}

export type NudgeInput = {
  now: Date;
  lastActiveAt: Date | null;
  createdAt: Date;
  inactiveDays: number;
  stuckDays: number;
  /** started_at of missions still in "doing" */
  doingSince: Date[];
  lastNudgeAt: Date | null;
};

export type NudgeReason = "inactive" | "stuck" | null;

const DAY = 86_400_000;

export function nudgeReason(input: NudgeInput): NudgeReason {
  if (input.lastNudgeAt && input.now.getTime() - input.lastNudgeAt.getTime() < 7 * DAY) return null;
  const lastActive = input.lastActiveAt ?? input.createdAt;
  if (input.now.getTime() - lastActive.getTime() >= input.inactiveDays * DAY) return "inactive";
  if (input.doingSince.some((d) => input.now.getTime() - d.getTime() >= input.stuckDays * DAY)) return "stuck";
  return null;
}
