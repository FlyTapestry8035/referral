import { describe, expect, it } from "vitest";
import { daysBetween, isDigestDue, localDate, localHour, nudgeReason } from "@/lib/schedule";

const at = (iso: string) => new Date(iso);

describe("time zone helpers", () => {
  it("gives the local calendar date and hour", () => {
    expect(localDate(at("2026-03-10T02:30:00Z"), "UTC")).toBe("2026-03-10");
    expect(localDate(at("2026-03-10T02:30:00Z"), "America/New_York")).toBe("2026-03-09");
    expect(localHour(at("2026-03-10T14:05:00Z"), "Europe/Berlin")).toBe(15);
    expect(localHour(at("2026-03-10T00:05:00Z"), "UTC")).toBe(0);
  });
  it("counts calendar days", () => {
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });
});

describe("isDigestDue", () => {
  const base = { timeZone: "UTC", intervalDays: 1, sendHour: 9, cronMode: "daily" as const };

  it("is due when the tester never got a digest", () => {
    expect(isDigestDue({ ...base, now: at("2026-05-01T09:00:00Z"), lastDigestAt: null })).toBe(true);
  });
  it("is not due twice on the same day", () => {
    expect(isDigestDue({ ...base, now: at("2026-05-01T20:00:00Z"), lastDigestAt: at("2026-05-01T09:00:00Z") })).toBe(false);
  });
  it("is due the next day even if the cron fires a bit earlier than yesterday", () => {
    expect(isDigestDue({ ...base, now: at("2026-05-02T09:05:00Z"), lastDigestAt: at("2026-05-01T09:50:00Z") })).toBe(true);
  });
  it("respects longer intervals", () => {
    const b = { ...base, intervalDays: 3, lastDigestAt: at("2026-05-01T09:00:00Z") };
    expect(isDigestDue({ ...b, now: at("2026-05-03T09:00:00Z") })).toBe(false);
    expect(isDigestDue({ ...b, now: at("2026-05-04T09:00:00Z") })).toBe(true);
  });
  it("ignores the send hour with a daily cron", () => {
    expect(isDigestDue({ ...base, now: at("2026-05-01T23:00:00Z"), lastDigestAt: null })).toBe(true);
  });
  it("only sends during the send hour with an hourly cron", () => {
    const b = { ...base, cronMode: "hourly" as const, timeZone: "America/Los_Angeles", lastDigestAt: null };
    expect(isDigestDue({ ...b, now: at("2026-05-01T16:10:00Z") })).toBe(true); // 09:10 PDT
    expect(isDigestDue({ ...b, now: at("2026-05-01T17:10:00Z") })).toBe(false); // 10:10 PDT
  });
  it("uses the program time zone for calendar days", () => {
    // 23:30 and 00:30 next day in UTC are the same local day in New York.
    expect(
      isDigestDue({ ...base, timeZone: "America/New_York", now: at("2026-05-02T00:30:00Z"), lastDigestAt: at("2026-05-01T14:00:00Z") }),
    ).toBe(false);
  });
});

describe("nudgeReason", () => {
  const now = at("2026-05-20T12:00:00Z");
  const base = { now, createdAt: at("2026-04-01T00:00:00Z"), inactiveDays: 7, stuckDays: 5, doingSince: [] as Date[], lastNudgeAt: null };

  it("nudges inactive testers", () => {
    expect(nudgeReason({ ...base, lastActiveAt: at("2026-05-12T12:00:00Z") })).toBe("inactive");
  });
  it("leaves recently active testers alone", () => {
    expect(nudgeReason({ ...base, lastActiveAt: at("2026-05-18T12:00:00Z") })).toBe(null);
  });
  it("nudges testers stuck on a mission", () => {
    expect(nudgeReason({ ...base, lastActiveAt: at("2026-05-19T12:00:00Z"), doingSince: [at("2026-05-14T12:00:00Z")] })).toBe("stuck");
  });
  it("sends at most one nudge per week", () => {
    expect(nudgeReason({ ...base, lastActiveAt: null, lastNudgeAt: at("2026-05-15T12:00:00Z") })).toBe(null);
    expect(nudgeReason({ ...base, lastActiveAt: null, lastNudgeAt: at("2026-05-13T11:00:00Z") })).toBe("inactive");
  });
  it("falls back to the sign-up date when there was never any activity", () => {
    expect(nudgeReason({ ...base, lastActiveAt: null, createdAt: at("2026-05-18T00:00:00Z") })).toBe(null);
  });
});
