import "server-only";
import { cookies } from "next/headers";
import { TZ_COOKIE } from "@/lib/constants";
import { isValidTimeZone, todayInZone } from "@/lib/dates";

/** The viewer's IANA time zone (written by <TimezoneCookie/>), UTC fallback. */
export async function getUserTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return isValidTimeZone(tz) ? tz : "UTC";
}

export async function getUserToday(): Promise<{ tz: string; today: string }> {
  const tz = await getUserTimeZone();
  return { tz, today: todayInZone(tz) };
}
