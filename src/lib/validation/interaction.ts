import { z } from "zod";
import { INTERACTION_TYPES } from "@/lib/constants";
import { occurredAt, optionalText, optionalUuid } from "./fields";

export const interactionSchema = z.object({
  /** Client-generated for idempotent retries. */
  id: z.uuid(),
  contactId: z.uuid(),
  interactionType: z.enum(INTERACTION_TYPES).default("in_person"),
  notes: optionalText(20000),
  location: optionalText(200),
  eventId: optionalUuid,
  occurredAt,
});
export type InteractionInput = z.input<typeof interactionSchema>;

export const interactionUpdateSchema = interactionSchema.omit({ contactId: true });
export type InteractionUpdateInput = z.input<typeof interactionUpdateSchema>;
