"use server";

import * as events from "@/lib/services/events";
import type { EventInput } from "@/lib/validation/event";
import { withAuth } from "./with-auth";

export async function createEventAction(input: EventInput) {
  return withAuth((ctx) => events.createEvent(ctx, input));
}

export async function updateEventAction(eventId: string, input: EventInput) {
  return withAuth((ctx) => events.updateEvent(ctx, eventId, input));
}

export async function deleteEventAction(eventId: string) {
  return withAuth((ctx) => events.deleteEvent(ctx, eventId));
}
