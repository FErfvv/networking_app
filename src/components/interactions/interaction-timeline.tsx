"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarDays,
  Coffee,
  Link2 as Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteInteractionAction } from "@/lib/actions/interactions";
import { INTERACTION_LABELS, type InteractionType } from "@/lib/constants";
import { formatTimestamp } from "@/lib/dates";
import type { EventOption } from "@/components/quick-add/event-picker";
import type { InteractionWithEvent } from "@/lib/data/contacts";
import { InteractionSheet } from "./interaction-sheet";

const ICONS: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  in_person: Users,
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
  coffee_chat: Coffee,
  meeting: Briefcase,
  other: MessageCircle,
};

export function InteractionTimeline({
  interactions,
  contactId,
  contactName,
  events,
  tz,
}: {
  interactions: InteractionWithEvent[];
  contactId: string;
  contactName: string;
  events: EventOption[];
  tz: string;
}) {
  const [editing, setEditing] = useState<InteractionWithEvent | null>(null);

  async function onDelete(i: InteractionWithEvent) {
    if (!window.confirm("Delete this interaction from the history?")) return;
    try {
      const res = await deleteInteractionAction(i.id);
      if (res.ok) toast.success("Interaction deleted");
      else toast.error(res.error);
    } catch {
      toast.error("Network error — nothing was deleted.");
    }
  }

  return (
    <>
      <ol className="relative space-y-5 border-l pl-6">
        {interactions.map((i) => {
          const Icon = ICONS[i.interaction_type];
          return (
            <li key={i.id} className="relative">
              <span className="absolute top-0.5 -left-[37px] flex size-6 items-center justify-center rounded-full border bg-background">
                <Icon className="size-3.5 text-muted-foreground" />
              </span>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{INTERACTION_LABELS[i.interaction_type]}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <time dateTime={i.occurred_at}>{formatTimestamp(i.occurred_at, tz, { time: true })}</time>
                    {i.event ? (
                      <Link
                        href={`/events/${i.event.id}`}
                        className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                      >
                        <CalendarDays className="size-3" />
                        {i.event.name}
                      </Link>
                    ) : null}
                    {i.location && i.location !== i.event?.name ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {i.location}
                      </span>
                    ) : null}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Interaction options">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(i)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => void onDelete(i)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {i.notes ? (
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{i.notes}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground italic">No notes</p>
              )}
            </li>
          );
        })}
      </ol>
      <InteractionSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        contactId={contactId}
        contactName={contactName}
        events={events}
        interaction={editing}
      />
    </>
  );
}
