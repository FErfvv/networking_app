import { z } from "zod";
import { fail, ok, PG_UNIQUE_VIOLATION, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf } from "@/lib/validation/fields";
import {
  interactionSchema,
  interactionUpdateSchema,
  type InteractionInput,
  type InteractionUpdateInput,
} from "@/lib/validation/interaction";
import type { ServiceCtx } from "./types";

/**
 * Append a new interaction to a contact's history. Never modifies earlier
 * interactions. Idempotent on the client-generated id.
 */
export async function addInteraction(
  ctx: ServiceCtx,
  input: InteractionInput,
): Promise<ActionResult<{ id: string; contactId: string; created: boolean }>> {
  const parsed = interactionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return fail(Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
  }
  const d = parsed.data;

  const { error } = await ctx.supabase.from("interactions").insert({
    id: d.id,
    user_id: ctx.userId,
    contact_id: d.contactId,
    interaction_type: d.interactionType,
    notes: d.notes,
    location: d.location,
    event_id: d.eventId,
    occurred_at: d.occurredAt,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      // Same id already saved (double submit / retry) — treat as success.
      return ok({ id: d.id, contactId: d.contactId, created: false });
    }
    if (error.code === "23503") {
      // Composite FK: contact or event missing or owned by someone else.
      return fail("That contact or event could not be found.");
    }
    return fail("Could not save interaction.");
  }

  return ok({ id: d.id, contactId: d.contactId, created: true });
}

export async function updateInteraction(
  ctx: ServiceCtx,
  input: InteractionUpdateInput,
): Promise<ActionResult<{ contactId: string }>> {
  const parsed = interactionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return fail(Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("interactions")
    .update({
      interaction_type: d.interactionType,
      notes: d.notes,
      location: d.location,
      event_id: d.eventId,
      occurred_at: d.occurredAt,
    })
    .eq("id", d.id)
    .eq("user_id", ctx.userId)
    .select("contact_id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503") return fail("That event could not be found.");
    return fail("Could not update interaction.");
  }
  if (!data) return fail("Interaction not found.");
  return ok({ contactId: data.contact_id });
}

export async function deleteInteraction(
  ctx: ServiceCtx,
  id: string,
): Promise<ActionResult<{ contactId: string }>> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid interaction id");
  const { data, error } = await ctx.supabase
    .from("interactions")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("contact_id")
    .maybeSingle();
  if (error) return fail("Could not delete interaction.");
  if (!data) return fail("Interaction not found.");
  return ok({ contactId: data.contact_id });
}
