import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  STRENGTH_LABELS,
  type RelationshipCategory,
  type RelationshipStrength,
} from "@/lib/constants";

const CATEGORY_STYLES: Record<RelationshipCategory, string> = {
  recruiter: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  engineer: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  professor: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  alumni: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  student_peer: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  mentor: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  founder: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  other: "bg-muted text-muted-foreground",
};

export function CategoryBadge({
  category,
  className,
}: {
  category: RelationshipCategory;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium", CATEGORY_STYLES[category], className)}>
      {CATEGORY_LABELS[category]}
    </Badge>
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
