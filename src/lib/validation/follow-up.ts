import { z } from "zod";
import { requiredDate } from "./fields";

export const rescheduleSchema = z.object({
  contactId: z.uuid(),
  date: requiredDate,
  nextAction: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim() || null)),
});

export const completeFollowUpSchema = z.object({
  contactId: z.uuid(),
});
