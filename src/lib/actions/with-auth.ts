import "server-only";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import type { ServiceCtx } from "@/lib/services/types";

export const SESSION_EXPIRED = "Your session expired. Please sign in again.";

/**
 * Runs a service with a verified, user-scoped context. Every Server Action
 * goes through here, so none can run unauthenticated. On success the whole
 * app tree is revalidated so lists, dashboards and profiles stay in sync.
 */
export async function withAuth<T>(
  fn: (ctx: ServiceCtx) => Promise<ActionResult<T>>,
  opts: { revalidate?: boolean } = { revalidate: true },
): Promise<ActionResult<T>> {
  const ctx = await getAuthedContext();
  if (!ctx) return fail(SESSION_EXPIRED);
  try {
    const result = await fn({ supabase: ctx.supabase, userId: ctx.userId });
    if (result.ok && opts.revalidate !== false) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    console.error("[action] unexpected error", err);
    return fail("Something went wrong. Please try again.");
  }
}
