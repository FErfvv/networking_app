import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/contacts/badges";
import { FollowUpChip } from "@/components/contacts/contact-list";
import { LogInteractionButton } from "@/components/interactions/log-interaction-button";
import type { EventOption } from "@/components/quick-add/event-picker";
import { cn } from "@/lib/utils";
import { formatTimestamp, relativeFromNow } from "@/lib/dates";
import type { ContactOverviewRow } from "@/lib/types/database";
import { FollowUpControls } from "./follow-up-controls";

export function FollowUpSection({
  title,
  contacts,
  today,
  events,
  tone = "default",
  emptyText,
}: {
  title: string;
  contacts: ContactOverviewRow[];
  today: string;
  events: EventOption[];
  tone?: "danger" | "warning" | "default";
  emptyText?: string;
}) {
  if (contacts.length === 0 && !emptyText) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <h2
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {contacts.length}
        </span>
      </h2>
      {contacts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
              <Link
                href={`/people/${c.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Avatar name={c.name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate font-medium">{c.name}</span>
                    {c.next_follow_up_on ? <FollowUpChip date={c.next_follow_up_on} today={today} /> : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.next_action || [c.job_title, c.company].filter(Boolean).join(" · ") || "No next action set"}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <FollowUpControls
                  contactId={c.id}
                  contactName={c.name}
                  today={today}
                  hasFollowUp={Boolean(c.next_follow_up_on)}
                  compact
                />
                <LogInteractionButton
                  contactId={c.id}
                  contactName={c.name}
                  events={events}
                  size="icon"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Compact list of people for the "recently added/contacted" panels. */
export function PeopleMiniList({
  title,
  contacts,
  field,
  tz,
}: {
  title: string;
  contacts: ContactOverviewRow[];
  field: "created_at" | "last_interaction_at";
  tz: string;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {contacts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Nobody yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {contacts.map((c) => {
            const ts = c[field];
            return (
              <li key={c.id}>
                <Link
                  href={`/people/${c.id}`}
                  className="flex min-h-12 items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <Avatar name={c.name} className="size-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.company ?? c.where_met ?? "—"}
                    </p>
                  </div>
                  {ts ? (
                    <span className="shrink-0 text-xs text-muted-foreground" title={formatTimestamp(ts, tz, { time: true })}>
                      {relativeFromNow(ts)}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
