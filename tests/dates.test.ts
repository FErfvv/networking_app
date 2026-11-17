import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  applyPreset,
  daysBetween,
  describeDue,
  followUpBucket,
  formatDateOnly,
  todayInZone,
} from "@/lib/dates";

describe("todayInZone", () => {
  // 2026-11-08 03:30 UTC is still Nov 7 in Los Angeles, already Nov 8 in Berlin.
  const instant = new Date("2026-11-08T03:30:00Z");

  it("computes the calendar day in the user's zone", () => {
    expect(todayInZone("America/Los_Angeles", instant)).toBe("2026-11-07");
    expect(todayInZone("Europe/Berlin", instant)).toBe("2026-11-08");
  });

  it("falls back to UTC for missing or invalid zones", () => {
    expect(todayInZone(undefined, instant)).toBe("2026-11-08");
    expect(todayInZone("Not/AZone", instant)).toBe("2026-11-08");
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month/year boundaries and DST changes", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08"); // US DST start
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("clamps month addition to the last day of the month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });

  it("computes day differences", () => {
    expect(daysBetween("2026-11-07", "2026-11-14")).toBe(7);
    expect(daysBetween("2026-11-07", "2026-11-01")).toBe(-6);
  });

  it("rejects malformed dates", () => {
    expect(() => addDays("11/07/2026", 1)).toThrow();
  });
});

describe("followUpBucket", () => {
  const today = "2026-11-07";
  it.each([
    [null, null],
    ["2026-11-06", "overdue"],
    ["2025-01-01", "overdue"],
    ["2026-11-07", "today"],
    ["2026-11-08", "upcoming"],
    ["2026-11-21", "upcoming"], // exactly 14 days
    ["2026-11-22", "later"],
  ] as const)("%s -> %s", (due, expected) => {
    expect(followUpBucket(due, today)).toBe(expected);
  });
});

describe("reschedule presets", () => {
  const today = "2026-11-07";
  it("computes preset dates from the user's today", () => {
    expect(applyPreset(today, "1d")).toBe("2026-11-08");
    expect(applyPreset(today, "3d")).toBe("2026-11-10");
    expect(applyPreset(today, "1w")).toBe("2026-11-14");
    expect(applyPreset(today, "2w")).toBe("2026-11-21");
    expect(applyPreset(today, "1m")).toBe("2026-12-07");
  });
});

describe("display helpers", () => {
  it("describes due dates relative to today", () => {
    expect(describeDue("2026-11-07", "2026-11-07")).toBe("Today");
    expect(describeDue("2026-11-08", "2026-11-07")).toBe("Tomorrow");
    expect(describeDue("2026-11-04", "2026-11-07")).toBe("3 days overdue");
    expect(describeDue("2026-11-12", "2026-11-07")).toBe("In 5 days");
  });

  it("formats date-only values without shifting the day", () => {
    expect(formatDateOnly("2026-01-01")).toBe("Jan 1, 2026");
  });
});
