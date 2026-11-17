import { CalendarDays, BellRing, Settings, UserPlus, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Quick Add", icon: UserPlus },
  { href: "/people", label: "People", icon: Users },
  { href: "/follow-ups", label: "Follow-Ups", icon: BellRing },
  { href: "/events", label: "Events", icon: CalendarDays },
] as const;

export const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: Settings } as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
