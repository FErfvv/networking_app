"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CircleDot, MapPin, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/dates";
import { useActiveEvent } from "@/lib/local-prefs";
import type { EventWithCounts } from "@/lib/data/events";
import { EventFormSheet } from "./event-form-sheet";

export function NewEventButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [, setActive] = useActiveEvent(userId);
  return (
    <>
      <Button className="h-9" onClick={() => setOpen(true)}>
        <Plus />
        New event
      </Button>
      <EventFormSheet
        open={open}
        onOpenChange={setOpen}
        onSaved={(e) => {
          setActive({ id: e.id, name: e.name });
          toast.info(`${e.name} is now your active event`);
        }}
      />
    </>
  );
}

export function EventList({ events, userId }: { events: EventWithCounts[]; userId: string }) {
  const [active, setActive] = useActiveEvent(userId);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No events yet"
        description="Create an event before a career fair or conference. Everyone you add while it's active is linked to it."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const isActive = active?.id === e.id;
        return (
          <li
            key={e.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors",
              isActive && "border-primary/40 ring-1 ring-primary/20",
            )}
          >
            <Link href={`/events/${e.id}`} className="min-w-0 flex-1 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <p className="flex items-center gap-2 truncate font-medium">
                {e.name}
                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-foreground uppercase">
                    <CircleDot className="size-2.5" /> Active
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {formatDateOnly(e.event_date)}
                </span>
                {e.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {e.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" />
                  {e.contact_count} met · {e.interaction_count} interactions
                </span>
              </p>
            </Link>
            <Button
              variant={isActive ? "secondary" : "outline"}
              size="sm"
              className="h-9 shrink-0"
              aria-pressed={isActive}
              onClick={() => {
                setActive(isActive ? null : { id: e.id, name: e.name });
                toast.success(isActive ? "No active event" : `Active event: ${e.name}`);
              }}
            >
              {isActive ? "Deactivate" : "Set active"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
