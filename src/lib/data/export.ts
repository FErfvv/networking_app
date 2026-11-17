import "server-only";
import type { AuthedContext } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import {
  INTERACTION_LABELS,
  STRENGTH_LABELS,
} from "@/lib/constants";
import type {
  CategoryRow,
  ContactOverviewRow,
  EventRow,
  InteractionRow,
  TagRow,
} from "@/lib/types/database";

const PAGE = 1000;

/** Page through a table so exports aren't capped by PostgREST's max rows. */
async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error("Export query failed");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadExportData({ supabase }: AuthedContext) {
  const [contacts, interactions, events, tags, categories] = await Promise.all([
    fetchAll<ContactOverviewRow>((a, b) =>
      supabase.from("contact_overview").select("*").order("created_at").range(a, b) as never,
    ),
    fetchAll<InteractionRow>((a, b) =>
      supabase.from("interactions").select("*").order("occurred_at").range(a, b),
    ),
    fetchAll<EventRow>((a, b) =>
      supabase.from("events").select("*").order("event_date").range(a, b),
    ),
    fetchAll<TagRow>((a, b) => supabase.from("tags").select("*").order("name").range(a, b)),
    fetchAll<CategoryRow>((a, b) =>
      supabase.from("categories").select("*").order("name").range(a, b),
    ),
  ]);
  return { contacts, interactions, events, tags, categories };
}

export type ExportData = Awaited<ReturnType<typeof loadExportData>>;

export function contactsCsv({ contacts, events }: ExportData): string {
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  const rows = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    job_title: c.job_title,
    email: c.email,
    phone: c.phone,
    other_contact: c.other_contact,
    linkedin_url: c.linkedin_url,
    categories: c.categories.map((cat) => cat.name),
    relationship_strength: STRENGTH_LABELS[c.relationship_strength],
    tags: c.tag_names,
    where_met: c.where_met,
    first_event: c.first_event_id ? (eventName.get(c.first_event_id) ?? "") : "",
    first_met_at: c.first_met_at,
    last_interaction_at: c.last_interaction_at,
    next_follow_up_on: c.next_follow_up_on,
    next_action: c.next_action,
    general_notes: c.general_notes,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
  return toCsv(rows, [
    { key: "name", header: "Name" },
    { key: "company", header: "Company" },
    { key: "job_title", header: "Job title" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "other_contact", header: "Other contact info" },
    { key: "linkedin_url", header: "LinkedIn" },
    { key: "categories", header: "Categories" },
    { key: "relationship_strength", header: "Strength" },
    { key: "tags", header: "Tags" },
    { key: "where_met", header: "Where met" },
    { key: "first_event", header: "First event" },
    { key: "first_met_at", header: "First met (UTC)" },
    { key: "last_interaction_at", header: "Last interaction (UTC)" },
    { key: "next_follow_up_on", header: "Next follow-up" },
    { key: "next_action", header: "Next action" },
    { key: "general_notes", header: "General notes" },
    { key: "created_at", header: "Created (UTC)" },
    { key: "updated_at", header: "Updated (UTC)" },
    { key: "id", header: "Contact ID" },
  ]);
}

export function interactionsCsv({ contacts, interactions, events }: ExportData): string {
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const contactCompany = new Map(contacts.map((c) => [c.id, c.company]));
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  const rows = interactions.map((i) => ({
    id: i.id,
    contact_id: i.contact_id,
    contact_name: contactName.get(i.contact_id) ?? "",
    contact_company: contactCompany.get(i.contact_id) ?? "",
    occurred_at: i.occurred_at,
    type: INTERACTION_LABELS[i.interaction_type],
    event: i.event_id ? (eventName.get(i.event_id) ?? "") : "",
    location: i.location,
    notes: i.notes,
  }));
  return toCsv(rows, [
    { key: "occurred_at", header: "Date (UTC)" },
    { key: "contact_name", header: "Contact" },
    { key: "contact_company", header: "Company" },
    { key: "type", header: "Type" },
    { key: "event", header: "Event" },
    { key: "location", header: "Location" },
    { key: "notes", header: "Notes" },
    { key: "contact_id", header: "Contact ID" },
    { key: "id", header: "Interaction ID" },
  ]);
}

/** Self-describing, nested JSON backup preserving full history. */
export function backupJson(data: ExportData, exportedAt = new Date()): string {
  const byContact = new Map<string, InteractionRow[]>();
  for (const i of data.interactions) {
    const list = byContact.get(i.contact_id) ?? [];
    list.push(i);
    byContact.set(i.contact_id, list);
  }
  const strip = <T extends { user_id?: string }>(row: T) => {
    const { user_id: _omit, ...rest } = row;
    void _omit;
    return rest;
  };
  return JSON.stringify(
    {
      format: "networking-crm-backup",
      version: 1,
      exported_at: exportedAt.toISOString(),
      events: data.events.map(strip),
      tags: data.tags.map((t) => t.name),
      categories: data.categories.map(({ id, name, color }) => ({ id, name, color })),
      contacts: data.contacts.map((c) => ({
        ...strip(c),
        interactions: (byContact.get(c.id) ?? []).map(strip),
      })),
    },
    null,
    2,
  );
}
