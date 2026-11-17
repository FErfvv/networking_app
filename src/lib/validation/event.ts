import { z } from "zod";
import { optionalText, requiredDate } from "./fields";

export const eventSchema = z.object({
  name: z.string().trim().min(1, "Event name is required").max(200),
  eventDate: requiredDate,
  location: optionalText(200),
  description: optionalText(5000),
});
export type EventInput = z.input<typeof eventSchema>;
