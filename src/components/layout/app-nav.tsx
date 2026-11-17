"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Contact } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { NAV_ITEMS, SETTINGS_ITEM, isActive } from "./nav-items";

/**
 * usePathname() is runtime data on dynamic routes, so each nav renders a
 * static fallback (no active highlight) into the prerendered shell and the
 * pathname-aware version streams in immediately after.
 */
export function Sidebar() {
  return (
    <Suspense fallback={<SidebarView pathname={null} />}>
      <SidebarWithPath />
    </Suspense>
  );
}

function SidebarWithPath() {
  return <SidebarView pathname={usePathname()} />;
}

/** Desktop sidebar (md and up). */
function SidebarView({ pathname }: { pathname: string | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 py-4 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Contact className="size-4" aria-hidden />
        </span>
        <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} {...item} active={pathname !== null && isActive(pathname, item.href)} />
        ))}
        <div className="mt-auto">
          <SidebarLink
            {...SETTINGS_ITEM}
            active={pathname !== null && isActive(pathname, SETTINGS_ITEM.href)}
          />
        </div>
      </nav>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "bg-sidebar-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname={null} />}>
      <BottomNavWithPath />
    </Suspense>
  );
}

function BottomNavWithPath() {
  return <BottomNavView pathname={usePathname()} />;
}

/** Mobile bottom tab bar. */
function BottomNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  active && "text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.25]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
