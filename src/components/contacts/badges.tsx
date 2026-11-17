import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STRENGTH_LABELS,
  type CategoryColor,
  type RelationshipStrength,
} from "@/lib/constants";

/** Full class strings so Tailwind can see them at build time. */
export const CATEGORY_STYLES: Record<CategoryColor, string> = {
  slate: "bg-muted text-muted-foreground",
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  pink: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  amber: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  teal: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
};

/** Solid swatch per color, for pickers and dots. */
export const CATEGORY_SWATCHES: Record<CategoryColor, string> = {
  slate: "bg-slate-400",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
};

/** Renders nothing for uncategorized contacts. */
export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string | null;
  color: CategoryColor | null;
  className?: string;
}) {
  if (!name) return null;
  return (
    <Badge
      variant="secondary"
      className={cn("border-0 font-medium", CATEGORY_STYLES[color ?? "slate"], className)}
    >
      {name}
    </Badge>
  );
}

/**
 * A contact's categories. With `max`, shows that many then a "+N" chip, for
 * compact rows; the full list is in the chip's tooltip and accessible name.
 */
export function CategoryBadges({
  categories,
  max,
  className,
}: {
  categories: { id: string; name: string; color: CategoryColor }[];
  max?: number;
  className?: string;
}) {
  if (categories.length === 0) return null;
  const shown = max ? categories.slice(0, max) : categories;
  const hidden = categories.slice(shown.length);
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((c) => (
        <CategoryBadge key={c.id} name={c.name} color={c.color} className="max-w-40 truncate" />
      ))}
      {hidden.length ? (
        <Badge
          variant="secondary"
          className="border-0 bg-muted font-medium text-muted-foreground"
          title={hidden.map((c) => c.name).join(", ")}
          aria-label={`and ${hidden.map((c) => c.name).join(", ")}`}
        >
          +{hidden.length}
        </Badge>
      ) : null}
    </span>
  );
}

const STRENGTH_DOTS: Record<RelationshipStrength, number> = {
  new: 1,
  acquaintance: 2,
  established: 3,
  strong: 4,
};

export function StrengthIndicator({ strength }: { strength: RelationshipStrength }) {
  const n = STRENGTH_DOTS[strength];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("size-1.5 rounded-full", i <= n ? "bg-foreground/70" : "bg-foreground/15")}
          />
        ))}
      </span>
      {STRENGTH_LABELS[strength]}
    </span>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
