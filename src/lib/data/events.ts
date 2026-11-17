import "server-only";
import { z } from "zod";
import type { AuthedContext } from "@/lib/auth";
import type { ContactOverviewRow, EventRow, InteractionRow } from "@/lib/types/database";

export type EventWithCounts = EventRow & { contact_count: number; interaction_count: number };

export async function listEvents({ supabase }: AuthedContext): Promise<EventWithCounts[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*, contacts:contacts!contacts_first_event_id_user_id_fkey(count), interactions:interactions!interactions_event_id_user_id_fkey(count)")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to load events: ${error.message}`);
  return (data ?? []).map((e) => {
    const row = e as EventRow & {
      contacts: { count: number }[];
      interactions: { count: number }[];
    };
    const { contacts, interactions, ...rest } = row;
    return {
      ...rest,
      contact_count: contacts?.[0]?.count ?? 0,
      interaction_count: interactions?.[0]?.count ?? 0,
    };
  });
}

/** Lightweight list for pickers. */
export async function listEventOptions({
  supabase,
}: AuthedContext): Promise<Pick<EventRow, "id" | "name" | "event_date" | "location">[]> {
  const { data } = await supabase
    .from("events")
    .select("id, name, event_date, location")
    .order("event_date", { ascending: false })
    .limit(200);
  return data ?? [];
}

export type EventDetail = {
  event: EventRow;
  contacts: ContactOverviewRow[];
  interactions: (InteractionRow & { contact: { id: string; name: string } | null })[];
};

export async function getEventDetail(
  { supabase }: AuthedContext,
  id: string,
): Promise<EventDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [eventRes, contactsRes, interactionsRes] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("contact_overview")
      .select("*")
      .eq("first_event_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("interactions")
      .select("*, contact:contacts!interactions_contact_id_user_id_fkey(id, name)")
      .eq("event_id", id)
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);
  if (eventRes.error) throw new Error(eventRes.error.message);
  if (!eventRes.data) return null;
  return {
    event: eventRes.data,
    contacts: (contactsRes.data ?? []) as ContactOverviewRow[],
    interactions: (interactionsRes.data ?? []) as EventDetail["interactions"],
  };
}
