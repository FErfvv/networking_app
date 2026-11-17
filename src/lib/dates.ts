import { UPCOMING_WINDOW_DAYS } from "@/lib/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) for `now` in the given IANA zone (UTC fallback). */
export function todayInZone(tz?: string | null, now: Date = new Date()): string {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Pure calendar arithmetic on YYYY-MM-DD strings (no DST surprises). */
export function addDays(date: string, days: number): string {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "later";

export function followUpBucket(
  dueOn: string | null | undefined,
  today: string,
  windowDays: number = UPCOMING_WINDOW_DAYS,
): FollowUpBucket | null {
  if (!dueOn) return null;
  const diff = daysBetween(today, dueOn);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= windowDays) return "upcoming";
  return "later";
}

export const RESCHEDULE_PRESETS = [
  { label: "Tomorrow", key: "1d" },
  { label: "In 3 days", key: "3d" },
  { label: "Next week", key: "1w" },
  { label: "In 2 weeks", key: "2w" },
  { label: "Next month", key: "1m" },
] as const;
export type ReschedulePreset = (typeof RESCHEDULE_PRESETS)[number]["key"];

export function applyPreset(today: string, preset: ReschedulePreset): string {
  switch (preset) {
    case "1d":
      return addDays(today, 1);
    case "3d":
      return addDays(today, 3);
    case "1w":
      return addDays(today, 7);
    case "2w":
      return addDays(today, 14);
    case "1m":
      return addMonths(today, 1);
  }
}

/** "Today", "Tomorrow", "3 days overdue", "in 5 days", or a short date. */
export function describeDue(dueOn: string, today: string): string {
  const diff = daysBetween(today, dueOn);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff <= 14) return `In ${diff} days`;
  return formatDateOnly(dueOn);
}

/** Format a YYYY-MM-DD calendar date without timezone shifting. */
export function formatDateOnly(date: string, opts?: { withYear?: boolean }): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: opts?.withYear === false ? undefined : "numeric",
    timeZone: "UTC",
  });
}

/** Format an ISO timestamp in the given zone. */
export function formatTimestamp(
  iso: string,
  tz?: string | null,
  opts: { time?: boolean } = {},
): string {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(opts.time ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: zone,
  });
}

/** Relative "3d ago" style label for timestamps. */
export function relativeFromNow(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/** Value for <input type="datetime-local"> in the browser's local zone. */
export function toDateTimeLocalValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
