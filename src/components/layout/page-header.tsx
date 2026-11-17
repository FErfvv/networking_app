import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/** Consistent page title row. Shows a Settings shortcut on mobile. */
export function PageHeader({
  title,
  description,
  actions,
  className,
  showSettings = true,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  showSettings?: boolean;
}) {
  return (
    <header className={cn("mb-5 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {showSettings ? (
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
          >
            <Settings className="size-5" />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
