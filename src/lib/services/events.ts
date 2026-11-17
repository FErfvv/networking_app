import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf } from "@/lib/validation/fields";
import { eventSchema, type EventInput } from "@/lib/validation/event";
import type { EventRow } from "@/lib/types/database";
import type { ServiceCtx } from "./types";

export async function createEvent(
  ctx: ServiceCtx,
  input: EventInput,
): Promise<ActionResult<EventRow>> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    const fe = fieldErrorsOf(parsed.error);
    return fail(Object.values(fe)[0] ?? "Invalid input", fe);
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("events")
    .insert({
      user_id: ctx.userId,
      name: d.name,
      event_date: d.eventDate,
      location: d.location,
      description: d.description,
    })
    .select("*")
    .single();
  if (error || !data) return fail("Could not create event.");
  return ok(data);
}

export async function updateEvent(
  ctx: ServiceCtx,
  eventId: string,
  input: EventInput,
): Promise<ActionResult<EventRow>> {
  if (!z.uuid().safeParse(eventId).success) return fail("Invalid event id");
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    const fe = fieldErrorsOf(parsed.error);
    return fail(Object.values(fe)[0] ?? "Invalid input", fe);
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("events")
    .update({
      name: d.name,
      event_date: d.eventDate,
      location: d.location,
      description: d.description,
    })
    .eq("id", eventId)
    .eq("user_id", ctx.userId)
    .select("*")
    .maybeSingle();
  if (error) return fail("Could not update event.");
  if (!data) return fail("Event not found.");
  return ok(data);
}

/** Deleting an event keeps contacts/interactions; their event link is cleared. */
export async function deleteEvent(
  ctx: ServiceCtx,
  eventId: string,
): Promise<ActionResult<undefined>> {
  if (!z.uuid().safeParse(eventId).success) return fail("Invalid event id");
  const { data, error } = await ctx.supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", ctx.userId)
    .select("id");
  if (error) return fail("Could not delete event.");
  if (!data?.length) return fail("Event not found.");
  return ok(undefined);
}
