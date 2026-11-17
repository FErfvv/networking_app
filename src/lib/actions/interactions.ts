"use server";

import * as interactions from "@/lib/services/interactions";
import type { InteractionInput, InteractionUpdateInput } from "@/lib/validation/interaction";
import { withAuth } from "./with-auth";

export async function addInteractionAction(input: InteractionInput) {
  return withAuth((ctx) => interactions.addInteraction(ctx, input));
}

export async function updateInteractionAction(input: InteractionUpdateInput) {
  return withAuth((ctx) => interactions.updateInteraction(ctx, input));
}

export async function deleteInteractionAction(id: string) {
  return withAuth((ctx) => interactions.deleteInteraction(ctx, id));
}
