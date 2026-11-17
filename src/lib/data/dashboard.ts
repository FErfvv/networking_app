import "server-only";
import type { AuthedContext } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { UPCOMING_WINDOW_DAYS } from "@/lib/constants";
import type { ContactOverviewRow } from "@/lib/types/database";

export type Dashboard = {
  overdue: ContactOverviewRow[];
  dueToday: ContactOverviewRow[];
  upcoming: ContactOverviewRow[];
  recentlyAdded: ContactOverviewRow[];
  recentlyContacted: ContactOverviewRow[];
};

/** `today` is the user's local calendar date (YYYY-MM-DD). */
export async function getDashboard(
  { supabase }: AuthedContext,
  today: string,
): Promise<Dashboard> {
  const horizon = addDays(today, UPCOMING_WINDOW_DAYS);
  const base = () => supabase.from("contact_overview").select("*");

  const [followUps, recentlyAdded, recentlyContacted] = await Promise.all([
    base()
      .not("next_follow_up_on", "is", null)
      .lte("next_follow_up_on", horizon)
      .order("next_follow_up_on", { ascending: true })
      .order("name", { ascending: true })
      .limit(300),
    base().order("created_at", { ascending: false }).limit(8),
    base()
      .not("last_interaction_at", "is", null)
      .order("last_interaction_at", { ascending: false })
      .limit(8),
  ]);

  for (const r of [followUps, recentlyAdded, recentlyContacted]) {
    if (r.error) throw new Error(`Failed to load dashboard: ${r.error.message}`);
  }

  const rows = (followUps.data ?? []) as ContactOverviewRow[];
  return {
    overdue: rows.filter((c) => c.next_follow_up_on! < today),
    dueToday: rows.filter((c) => c.next_follow_up_on === today),
    upcoming: rows.filter((c) => c.next_follow_up_on! > today),
    recentlyAdded: (recentlyAdded.data ?? []) as ContactOverviewRow[],
    recentlyContacted: (recentlyContacted.data ?? []) as ContactOverviewRow[],
  };
}
