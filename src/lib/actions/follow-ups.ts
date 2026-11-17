"use server";

import * as followUps from "@/lib/services/follow-ups";
import { withAuth } from "./with-auth";

export async function completeFollowUpAction(contactId: string) {
  return withAuth((ctx) => followUps.completeFollowUp(ctx, { contactId }));
}

export async function rescheduleFollowUpAction(
  contactId: string,
  date: string,
  nextAction?: string,
) {
  return withAuth((ctx) => followUps.rescheduleFollowUp(ctx, { contactId, date, nextAction }));
}
