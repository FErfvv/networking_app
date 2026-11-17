"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventOption } from "@/components/quick-add/event-picker";
import { InteractionSheet } from "./interaction-sheet";

export function LogInteractionButton({
  contactId,
  contactName,
  events,
  className,
  size = "default",
  label = "Log interaction",
}: {
  contactId: string;
  contactName: string;
  events: EventOption[];
  className?: string;
  size?: "default" | "sm" | "icon";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {size === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Log interaction with ${contactName}`}
          className={className}
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus />
        </Button>
      ) : (
        <Button
          className={cn(size === "sm" ? "h-8" : "h-10", className)}
          variant={size === "sm" ? "outline" : "default"}
          size={size === "sm" ? "sm" : "default"}
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus />
          {label}
        </Button>
      )}
      <InteractionSheet
        open={open}
        onOpenChange={setOpen}
        contactId={contactId}
        contactName={contactName}
        events={events}
      />
    </>
  );
}
