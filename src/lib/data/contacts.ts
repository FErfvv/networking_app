import "server-only";
import { z } from "zod";
import { CONTACT_SORTS, NO_CATEGORY, type ContactSort } from "@/lib/constants";
import type { Category } from "@/lib/services/categories";
import type {
  ContactOverviewRow,
  ContactRow,
  EventRow,
  InteractionRow,
} from "@/lib/types/database";
import type { AuthedContext } from "@/lib/auth";

export const DIRECTORY_LIMIT = 1000;

export type DirectoryParams = {
  q: string;
  sort: ContactSort;
  /** A category id, NO_CATEGORY for uncategorized, or null for all. */
  category: string | null;
  company: string | null;
};

/** Parse untrusted URL search params into a safe, typed query. */
export function parseDirectoryParams(
  sp: Record<string, string | string[] | undefined>,
): DirectoryParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const sort = z.enum(CONTACT_SORTS).catch("recent").parse(one(sp.sort) || "recent");
  const category = z
    .union([z.uuid(), z.literal(NO_CATEGORY)])
    .nullable()
    .catch(null)
    .parse(one(sp.category) || null);
  const company = one(sp.company).trim().slice(0, 200) || null;
  const q = one(sp.q).trim().slice(0, 200);
  return { q, sort, category, company };
}

function escapeIlike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listContacts(
  { supabase }: AuthedContext,
  params: DirectoryParams,
): Promise<ContactOverviewRow[]> {
  let query = params.q
    ? supabase.rpc("search_contacts", { q: params.q }).select("*")
    : supabase.from("contact_overview").select("*");

  if (params.category === NO_CATEGORY) query = query.is("category_id", null);
  else if (params.category) query = query.eq("category_id", params.category);
  if (params.company) query = query.ilike("company", escapeIlike(params.company));

  switch (params.sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "contacted":
      query = query
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
    case "recent":
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(DIRECTORY_LIMIT);
  if (error) throw new Error(`Failed to load contacts: ${error.message}`);
  return (data ?? []) as ContactOverviewRow[];
}

/** Names, emails and phones of every saved contact, for import duplicate flags. */
export async function listContactKeys({ supabase }: AuthedContext) {
  const keys = { emails: [] as string[], phones: [] as string[], names: [] as string[] };
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("contacts")
      .select("name, email, phone")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load contacts: ${error.message}`);
    for (const c of data ?? []) {
      keys.names.push(c.name);
      if (c.email) keys.emails.push(c.email);
      if (c.phone) keys.phones.push(c.phone);
    }
    if (!data || data.length < PAGE) break;
  }
  return keys;
}

/** Distinct company names for the filter dropdown. */
export async function listCompanies({ supabase }: AuthedContext): Promise<string[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("company")
    .not("company", "is", null)
    .limit(5000);
  if (error) return [];
  const seen = new Map<string, string>();
  for (const { company } of data ?? []) {
    if (company && !seen.has(company.toLowerCase())) seen.set(company.toLowerCase(), company);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export type InteractionWithEvent = InteractionRow & {
  event: Pick<EventRow, "id" | "name"> | null;
};

export type ContactDetail = {
  contact: ContactOverviewRow;
  firstEvent: Pick<EventRow, "id" | "name" | "event_date"> | null;
  interactions: InteractionWithEvent[];
};

export async function getContactDetail(
  { supabase }: AuthedContext,
  id: string,
): Promise<ContactDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const [contactRes, interactionsRes] = await Promise.all([
    supabase.from("contact_overview").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("interactions")
      .select("*, event:events!interactions_event_id_user_id_fkey(id, name)")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);

  if (contactRes.error) throw new Error(contactRes.error.message);
  if (!contactRes.data) return null;
  if (interactionsRes.error) throw new Error(interactionsRes.error.message);

  const contact = contactRes.data as ContactOverviewRow;
  let firstEvent: ContactDetail["firstEvent"] = null;
  if (contact.first_event_id) {
    const { data } = await supabase
      .from("events")
      .select("id, name, event_date")
      .eq("id", contact.first_event_id)
      .maybeSingle();
    firstEvent = data ?? null;
  }

  return {
    contact,
    firstEvent,
    interactions: (interactionsRes.data ?? []) as InteractionWithEvent[],
  };
}

export async function getContact(
  { supabase }: AuthedContext,
  id: string,
): Promise<(ContactRow & { tag_names: string[] }) | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await supabase
    .from("contact_overview")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContactOverviewRow | null) ?? null;
}

export async function listTagNames({ supabase }: AuthedContext): Promise<string[]> {
  const { data } = await supabase.from("tags").select("name").order("name").limit(500);
  return (data ?? []).map((t) => t.name);
}

/** The user's categories, alphabetically. */
export async function listCategories({ supabase }: AuthedContext): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color")
    .order("name")
    .limit(500);
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data ?? [];
}
