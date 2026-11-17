"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEventAction, updateEventAction } from "@/lib/actions/events";
import { toDateTimeLocalValue } from "@/lib/dates";
import type { EventRow } from "@/lib/types/database";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event?: EventRow | null;
  onSaved?: (e: EventRow) => void;
};

export function EventFormSheet(props: Props) {
  const { open, onOpenChange, event } = props;
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={event ? "Edit event" : "New event"}>
      {open ? <EventFormBody key={event?.id ?? "new"} {...props} /> : null}
    </BottomSheet>
  );
}

function EventFormBody({ onOpenChange, event, onSaved }: Props) {
  const [name, setName] = useState(event?.name ?? "");
  const [date, setDate] = useState(() => event?.event_date ?? toDateTimeLocalValue().slice(0, 10));
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const input = { name, eventDate: date, location, description };
    try {
      const res = event ? await updateEventAction(event.id, input) : await createEventAction(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(event ? "Event updated" : `Created ${res.data.name}`);
      onOpenChange(false);
      onSaved?.(res.data);
    } catch {
      toast.error("Network error — event not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
      <form onSubmit={onSubmit} className="space-y-4 pb-2" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="ev-name">Name</Label>
          <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoCapitalize="words" placeholder="e.g. University Career Fair" className="h-11" aria-invalid={Boolean(errors.name)} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev-date">Date</Label>
            <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-11" />
            {errors.eventDate ? <p className="text-sm text-destructive">{errors.eventDate}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-location">Location</Label>
            <Input id="ev-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Optional" className="h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-desc">Description</Label>
          <Textarea id="ev-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} placeholder="Optional" className="text-base md:text-sm" />
        </div>
        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {event ? "Save changes" : "Create event"}
        </Button>
      </form>
  );
}
