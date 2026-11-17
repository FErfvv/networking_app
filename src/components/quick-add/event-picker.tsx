"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, Loader2, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/bottom-sheet";
import { cn } from "@/lib/utils";
import { createEventAction } from "@/lib/actions/events";
import { formatDateOnly, toDateTimeLocalValue } from "@/lib/dates";
import type { ActiveEvent } from "@/lib/local-prefs";
import type { EventRow } from "@/lib/types/database";

export type EventOption = Pick<EventRow, "id" | "name" | "event_date" | "location">;

/**
 * Chip showing the active event. New contacts and interactions are linked
 * to it automatically and it stays selected across submissions.
 */
export function EventPicker({
  events,
  active,
  onChange,
}: {
  userId: string;
  events: EventOption[];
  active: ActiveEvent | null;
  onChange: (e: ActiveEvent | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createAndActivate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await createEventAction({
        name,
        eventDate: toDateTimeLocalValue().slice(0, 10),
        location: null,
        description: null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange({ id: res.data.id, name: res.data.name });
      setNewName("");
      setOpen(false);
      toast.success(`Active event: ${res.data.name}`);
    } catch {
      toast.error("You're offline — can't create an event right now.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          active
            ? "border-primary/20 bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <CalendarDays className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{active ? active.name : "No active event"}</span>
      </button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Active event"
        description="Everyone you add is linked to the active event until you change it."
      >
        <form onSubmit={createAndActivate} className="mb-4 flex gap-2">
          <Input
            placeholder="New event, e.g. Fall Career Fair"
            aria-label="New event name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={200}
            autoCapitalize="words"
            enterKeyHint="go"
            className="h-11"
          />
          <Button type="submit" className="h-11 shrink-0" disabled={!newName.trim() || creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Start
          </Button>
        </form>

        <ul className="-mx-1 space-y-0.5 pb-2" role="listbox" aria-label="Events">
          <EventRowButton
            selected={!active}
            onSelect={() => {
              onChange(null);
              setOpen(false);
            }}
            title="No event"
            subtitle="Contacts won't be linked to an event"
          />
          {events.map((ev) => (
            <EventRowButton
              key={ev.id}
              selected={active?.id === ev.id}
              onSelect={() => {
                onChange({ id: ev.id, name: ev.name });
                setOpen(false);
              }}
              title={ev.name}
              subtitle={
                <>
                  {formatDateOnly(ev.event_date)}
                  {ev.location ? (
                    <>
                      {" · "}
                      <MapPin className="inline size-3" aria-hidden /> {ev.location}
                    </>
                  ) : null}
                </>
              }
            />
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

function EventRowButton({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
      </button>
    </li>
  );
}
