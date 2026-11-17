"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addInteractionAction, updateInteractionAction } from "@/lib/actions/interactions";
import { INTERACTION_LABELS, INTERACTION_TYPES, type InteractionType } from "@/lib/constants";
import { formatDateOnly, toDateTimeLocalValue } from "@/lib/dates";
import type { EventOption } from "@/components/quick-add/event-picker";
import type { InteractionRow } from "@/lib/types/database";

const NO_EVENT = "__none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  events: EventOption[];
  /** When provided, the sheet edits this interaction instead of adding one. */
  interaction?: InteractionRow | null;
  onSaved?: () => void;
};

export function InteractionSheet(props: Props) {
  const { open, onOpenChange, interaction, contactName } = props;
  const editing = Boolean(interaction);
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={editing ? "Edit interaction" : "Log interaction"}
      description={editing ? undefined : `A new entry in ${contactName}'s history. Earlier notes are kept.`}
    >
      {/* Remount per open so every "add" gets a fresh id (idempotent submit). */}
      {open ? (
        <InteractionFormBody key={interaction?.id ?? "new"} {...props} onBusyChange={setBusy} />
      ) : null}
    </BottomSheet>
  );
}

function InteractionFormBody({
  onOpenChange,
  contactId,
  contactName,
  events,
  interaction,
  onSaved,
  onBusyChange,
}: Props & { onBusyChange: (busy: boolean) => void }) {
  const editing = Boolean(interaction);
  const [id] = useState(() => interaction?.id ?? crypto.randomUUID());
  const [type, setType] = useState<InteractionType>(interaction?.interaction_type ?? "in_person");
  const [when, setWhen] = useState(() =>
    toDateTimeLocalValue(interaction ? new Date(interaction.occurred_at) : new Date()),
  );
  const [notes, setNotes] = useState(interaction?.notes ?? "");
  const [location, setLocation] = useState(interaction?.location ?? "");
  const [eventId, setEventId] = useState<string>(interaction?.event_id ?? NO_EVENT);
  const [pending, setPendingState] = useState(false);
  const setPending = (b: boolean) => {
    setPendingState(b);
    onBusyChange(b);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const payload = {
      id,
      interactionType: type,
      notes,
      location,
      eventId: eventId === NO_EVENT ? null : eventId,
      // datetime-local is local wall time; Date() interprets it in the browser zone.
      occurredAt: when ? new Date(when).toISOString() : undefined,
    };
    try {
      const res = editing
        ? await updateInteractionAction(payload)
        : await addInteractionAction({ ...payload, contactId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Interaction updated" : `Logged interaction with ${contactName}`);
      setPending(false);
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Network error — nothing was saved. Your text is still here.");
    } finally {
      setPending(false);
    }
  }

  return (
      <form onSubmit={onSubmit} className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ix-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
              <SelectTrigger id="ix-type" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {INTERACTION_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ix-when">When</Label>
            <Input
              id="ix-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="h-11"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ix-notes">Notes</Label>
          <Textarea
            id="ix-notes"
            rows={4}
            autoCapitalize="sentences"
            placeholder="What did you discuss? Any promises or next steps?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={20000}
            className="min-h-28 text-base md:text-base"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ix-location">Location</Label>
            <Input
              id="ix-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={200}
              placeholder="Optional"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ix-event">Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger id="ix-event" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                <SelectItem value={NO_EVENT}>No event</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.name} · {formatDateOnly(ev.event_date, { withYear: false })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {editing ? "Save changes" : "Add to history"}
        </Button>
      </form>
  );
}
