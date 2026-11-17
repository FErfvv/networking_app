import { z } from "zod";
import { fail, ok, PG_UNIQUE_VIOLATION, type ActionResult } from "@/lib/action-result";
import { MAX_CATEGORIES } from "@/lib/constants";
import type { CategoryRow } from "@/lib/types/database";
import { categorySchema, type CategoryInput } from "@/lib/validation/category";
import { fieldErrorsOf } from "@/lib/validation/fields";
import type { ServiceCtx } from "./types";

export type Category = Pick<CategoryRow, "id" | "name" | "color">;

const DUPLICATE = "You already have a category with that name.";

function parse(input: CategoryInput) {
  const parsed = categorySchema.safeParse(input);
  if (parsed.success) return { data: parsed.data } as const;
  const fieldErrors = fieldErrorsOf(parsed.error);
  return { error: fail(Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors) } as const;
}

export async function createCategory(
  ctx: ServiceCtx,
  input: CategoryInput,
): Promise<ActionResult<Category>> {
  const p = parse(input);
  if (p.error) return p.error;

  const { count, error: countErr } = await ctx.supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId);
  if (countErr) return fail("Could not create category.");
  if ((count ?? 0) >= MAX_CATEGORIES) return fail(`You can have up to ${MAX_CATEGORIES} categories.`);

  const { data, error } = await ctx.supabase
    .from("categories")
    .insert({ user_id: ctx.userId, ...p.data })
    .select("id, name, color")
    .single();
  if (error) return fail(error.code === PG_UNIQUE_VIOLATION ? DUPLICATE : "Could not create category.");
  return ok(data);
}

export async function updateCategory(
  ctx: ServiceCtx,
  categoryId: string,
  input: CategoryInput,
): Promise<ActionResult<Category>> {
  if (!z.uuid().safeParse(categoryId).success) return fail("Invalid category id");
  const p = parse(input);
  if (p.error) return p.error;

  const { data, error } = await ctx.supabase
    .from("categories")
    .update(p.data)
    .eq("id", categoryId)
    .eq("user_id", ctx.userId)
    .select("id, name, color")
    .maybeSingle();
  if (error) return fail(error.code === PG_UNIQUE_VIOLATION ? DUPLICATE : "Could not save category.");
  if (!data) return fail("Category not found.");
  return ok(data);
}

/** Contacts in a deleted category are kept; they just become uncategorized (FK ON DELETE SET NULL). */
export async function deleteCategory(
  ctx: ServiceCtx,
  categoryId: string,
): Promise<ActionResult<undefined>> {
  if (!z.uuid().safeParse(categoryId).success) return fail("Invalid category id");
  const { data, error } = await ctx.supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", ctx.userId)
    .select("id");
  if (error) return fail("Could not delete category.");
  if (!data?.length) return fail("Category not found.");
  return ok(undefined);
}
