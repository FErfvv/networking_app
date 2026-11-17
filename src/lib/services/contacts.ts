import { z } from "zod";
import { fail, ok, PG_UNIQUE_VIOLATION, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf } from "@/lib/validation/fields";
import {
  contactUpdateSchema,
  importContactsSchema,
  quickAddSchema,
  toContactColumns,
  type ContactUpdateInput,
  type ImportContactInput,
  type QuickAddInput,
} from "@/lib/validation/contact";
import type { ServiceCtx } from "./types";

export type QuickAddResult = { contactId: string; created: boolean };

/**
 * Create a contact plus its first in-person interaction atomically (RPC).
 * Idempotent on the client-generated contact id: re-submitting the same
 * payload returns { created: false } instead of creating a duplicate.
 */
export async function quickAddContact(
  ctx: ServiceCtx,
  input: QuickAddInput,
): Promise<ActionResult<QuickAddResult>> {
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return fail(Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
  }
  const d = parsed.data;

  const { data, error } = await ctx.supabase.rpc("quick_add_contact", {
    p_contact_id: d.contactId,
    p_interaction_id: d.interactionId,
    p_name: d.name,
    p_company: d.company,
    p_job_title: d.jobTitle,
    p_email: d.email,
    p_linkedin_url: d.linkedinUrl,
    p_where_met: d.whereMet,
    p_notes: d.notes,
    p_event_id: d.eventId,
    p_occurred_at: d.occurredAt,
    p_phone: d.phone,
    p_other_contact: d.otherContact,
  });

  if (error) {
    if (error.code === "23503") {
      // FK violation: the selected event no longer exists (or isn't yours).
      return fail("The selected event no longer exists. Clear it and try again.");
    }
    if (error.code === PG_UNIQUE_VIOLATION) {
      return fail("Could not save this contact (id conflict). Please try again.");
    }
    return fail("Could not save contact. Please try again.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return ok({ contactId: row?.contact_id ?? d.contactId, created: Boolean(row?.created) });
}

export type SimilarContact = {
  id: string;
  name: string;
  company: string | null;
  job_title: string | null;
};

export async function findSimilarContacts(
  ctx: ServiceCtx,
  q: string,
): Promise<ActionResult<SimilarContact[]>> {
  const query = q.trim();
  if (query.length < 2) return ok([]);
  if (query.length > 200) return ok([]);
  const { data, error } = await ctx.supabase.rpc("find_similar_contacts", { q: query });
  if (error) return fail("Could not check for similar contacts.");
  return ok(
    (data ?? []).map(({ id, name, company, job_title }) => ({ id, name, company, job_title })),
  );
}

export async function updateContact(
  ctx: ServiceCtx,
  contactId: string,
  input: ContactUpdateInput,
): Promise<ActionResult<{ contactId: string }>> {
  if (!z.uuid().safeParse(contactId).success) return fail("Invalid contact id");
  const parsed = contactUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return fail(Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
  }

  const { data, error } = await ctx.supabase
    .from("contacts")
    .update(toContactColumns(parsed.data))
    .eq("id", contactId)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();

  if (error) return fail("Could not update contact.");
  if (!data) return fail("Contact not found.");

  const categoryResult = await setContactCategories(ctx, contactId, parsed.data.categoryIds);
  if (!categoryResult.ok) return categoryResult;

  const tagResult = await setContactTags(ctx, contactId, parsed.data.tags);
  if (!tagResult.ok) return tagResult;

  return ok({ contactId });
}

/**
 * Make a contact's categories exactly `categoryIds`: unlink the ones no longer
 * chosen, then link new ones (existing links are left alone, so a failure
 * part-way never strips categories the user kept).
 */
export async function setContactCategories(
  ctx: ServiceCtx,
  contactId: string,
  categoryIds: string[],
): Promise<ActionResult<undefined>> {
  const { supabase, userId } = ctx;

  let del = supabase
    .from("contact_categories")
    .delete()
    .eq("contact_id", contactId)
    .eq("user_id", userId);
  if (categoryIds.length) del = del.not("category_id", "in", `(${categoryIds.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) return fail("Could not update categories.");

  if (categoryIds.length) {
    const { error: insErr } = await supabase
      .from("contact_categories")
      .upsert(
        categoryIds.map((category_id) => ({ contact_id: contactId, category_id, user_id: userId })),
        { onConflict: "contact_id,category_id", ignoreDuplicates: true },
      );
    if (insErr) {
      // FK violation: a chosen category was deleted meanwhile (or isn't yours).
      if (insErr.code === "23503") return fail("One of those categories no longer exists. Refresh and try again.");
      return fail("Could not update categories.");
    }
  }
  return ok(undefined);
}

/** Replace a contact's tags, creating any missing tags (case-insensitive). */
export async function setContactTags(
  ctx: ServiceCtx,
  contactId: string,
  tagNames: string[],
): Promise<ActionResult<undefined>> {
  const { supabase, userId } = ctx;

  let tagIds: string[] = [];
  if (tagNames.length) {
    const { data: existing, error: selErr } = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId);
    if (selErr) return fail("Could not load tags.");

    const byLower = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t.id]));
    const missing = tagNames.filter((n) => !byLower.has(n.toLowerCase()));

    if (missing.length) {
      const { data: created, error: insErr } = await supabase
        .from("tags")
        .insert(missing.map((name) => ({ name, user_id: userId })))
        .select("id, name");
      if (insErr && insErr.code !== PG_UNIQUE_VIOLATION) return fail("Could not create tags.");
      if (insErr) {
        // A concurrent request created one of them; re-read.
        const { data: again } = await supabase
          .from("tags")
          .select("id, name")
          .eq("user_id", userId);
        (again ?? []).forEach((t) => byLower.set(t.name.toLowerCase(), t.id));
      } else {
        (created ?? []).forEach((t) => byLower.set(t.name.toLowerCase(), t.id));
      }
    }
    tagIds = tagNames
      .map((n) => byLower.get(n.toLowerCase()))
      .filter((id): id is string => Boolean(id));
  }

  const { error: delErr } = await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", contactId)
    .eq("user_id", userId);
  if (delErr) return fail("Could not update tags.");

  if (tagIds.length) {
    const { error: linkErr } = await supabase
      .from("contact_tags")
      .insert(tagIds.map((tag_id) => ({ contact_id: contactId, tag_id, user_id: userId })));
    if (linkErr) return fail("Could not update tags.");
  }

  return ok(undefined);
}

export async function deleteContact(
  ctx: ServiceCtx,
  contactId: string,
): Promise<ActionResult<undefined>> {
  if (!z.uuid().safeParse(contactId).success) return fail("Invalid contact id");
  const { data, error } = await ctx.supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("user_id", ctx.userId)
    .select("id");
  if (error) return fail("Could not delete contact.");
  if (!data?.length) return fail("Contact not found.");
  return ok(undefined);
}

export type ImportResult = { inserted: number };

/**
 * Bulk-create contacts from the import screen (no interaction is logged).
 * Idempotent on the client-generated ids: re-sending a chunk after a timeout
 * skips rows that already exist instead of duplicating them.
 */
export async function importContacts(
  ctx: ServiceCtx,
  input: ImportContactInput[],
): Promise<ActionResult<ImportResult>> {
  const parsed = importContactsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row = typeof issue?.path[0] === "number" ? input[issue.path[0]] : undefined;
    const who = row && typeof row.name === "string" && row.name ? `${row.name}: ` : "";
    return fail(`${who}${issue?.message ?? "Invalid input"}`);
  }

  const rows = parsed.data.map((d) => ({
    id: d.id,
    user_id: ctx.userId,
    name: d.name,
    company: d.company,
    job_title: d.jobTitle,
    email: d.email,
    phone: d.phone,
    other_contact: d.otherContact,
    linkedin_url: d.linkedinUrl,
    general_notes: d.generalNotes,
    // Unknown: the import day is almost never when you actually met.
    first_met_at: null,
  }));

  const { data, error } = await ctx.supabase
    .from("contacts")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (error) return fail("Could not import contacts. Please try again.");
  return ok({ inserted: data?.length ?? 0 });
}
