import { z } from "zod";
import { CATEGORY_COLORS } from "@/lib/constants";

export const categorySchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, "Name is required")
        .max(50, "Name must be 50 characters or fewer"),
    ),
  color: z.enum(CATEGORY_COLORS, { error: "Pick a color" }),
});
export type CategoryInput = z.input<typeof categorySchema>;
