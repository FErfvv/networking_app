import Link from "next/link";
import { CalendarClock, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { describeDue, followUpBucket, formatDateOnly, formatTimestamp } from "@/lib/dates";
import type { ContactOverviewRow } from "@/lib/types/database";
import { Avatar, CategoryBadges } from "./badges";
import { DeleteContactButton } from "./delete-contact-button";

type Props = { contacts: ContactOverviewRow[]; today: string; tz: string };

export function ContactList({ contacts, today, tz }: Props) {
  return (
    <>
      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {contacts.map((c) => (
          <li key={c.id}>
            <Link
              href={`/people/${c.id}`}
              className="flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">{c.name}</p>
                  <CategoryBadges categories={c.categories} max={1} className="shrink-0 flex-nowrap" />
                </div>
                {c.job_title || c.company ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.job_title, c.company].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {c.last_interaction_at
                      ? `Last: ${formatTimestamp(c.last_interaction_at, tz)}`
                      : `Added ${formatTimestamp(c.created_at, tz)}`}
                  </span>
                  {c.next_follow_up_on ? (
                    <FollowUpChip date={c.next_follow_up_on} today={today} />
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Last interaction</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead className="w-24 pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id} className="group">
                <TableCell className="pl-4 font-medium">
                  <Link
                    href={`/people/${c.id}`}
                    className="flex items-center gap-2.5 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    <Avatar name={c.name} className="size-7 text-[11px]" />
                    <span className="max-w-48 truncate">{c.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{c.company ?? "—"}</TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{c.job_title ?? "—"}</TableCell>
                <TableCell>
                  <CategoryBadges categories={c.categories} max={2} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.last_interaction_at ? formatTimestamp(c.last_interaction_at, tz) : "—"}
                </TableCell>
                <TableCell>
                  {c.next_follow_up_on ? (
                    <FollowUpChip date={c.next_follow_up_on} today={today} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Link
                      href={`/people/${c.id}/edit`}
                      aria-label={`Edit ${c.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <DeleteContactButton contactId={c.id} name={c.name} variant="icon" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function FollowUpChip({ date, today }: { date: string; today: string }) {
  const bucket = followUpBucket(date, today);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        bucket === "overdue" && "bg-destructive/10 text-destructive",
        bucket === "today" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        (bucket === "upcoming" || bucket === "later") && "bg-muted text-muted-foreground",
      )}
      title={formatDateOnly(date)}
    >
      <CalendarClock className="size-3" aria-hidden />
      {describeDue(date, today)}
    </span>
  );
}
