"use server";

import * as categories from "@/lib/services/categories";
import type { CategoryInput } from "@/lib/validation/category";
import { withAuth } from "./with-auth";

export async function createCategoryAction(input: CategoryInput) {
  return withAuth((ctx) => categories.createCategory(ctx, input));
}

export async function updateCategoryAction(categoryId: string, input: CategoryInput) {
  return withAuth((ctx) => categories.updateCategory(ctx, categoryId, input));
}

export async function deleteCategoryAction(categoryId: string) {
  return withAuth((ctx) => categories.deleteCategory(ctx, categoryId));
}
