import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf } from "@/lib/validation/fields";
import { completeFollowUpSchema, rescheduleSchema } from "@/lib/validation/follow-up";
import type { ServiceCtx } from "./types";

/** Mark the pending follow-up done: clears the date and next action. */
export async function completeFollowUp(
  ctx: ServiceCtx,
  input: { contactId: string },
): Promise<ActionResult<undefined>> {
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid contact id");

  const { data, error } = await ctx.supabase
    .from("contacts")
    .update({ next_follow_up_on: null, next_action: null })
    .eq("id", parsed.data.contactId)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();
  if (error) return fail("Could not complete follow-up.");
  if (!data) return fail("Contact not found.");
  return ok(undefined);
}

export async function rescheduleFollowUp(
  ctx: ServiceCtx,
  input: { contactId: string; date: string; nextAction?: string },
): Promise<ActionResult<{ date: string }>> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) {
    const fe = fieldErrorsOf(parsed.error);
    return fail(Object.values(fe)[0] ?? "Invalid input", fe);
  }
  const { contactId, date, nextAction } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("contacts")
    .update({
      next_follow_up_on: date,
      ...(nextAction !== undefined ? { next_action: nextAction } : {}),
    })
    .eq("id", contactId)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();
  if (error) return fail("Could not reschedule follow-up.");
  if (!data) return fail("Contact not found.");
  return ok({ date });
}
