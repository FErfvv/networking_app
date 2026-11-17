"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { completeFollowUpAction, rescheduleFollowUpAction } from "@/lib/actions/follow-ups";
import { applyPreset, formatDateOnly, RESCHEDULE_PRESETS } from "@/lib/dates";

/**
 * Done / Reschedule controls. `today` is the user's local date from the
 * server so presets ("next week") are computed in their time zone.
 */
export function FollowUpControls({
  contactId,
  contactName,
  today,
  hasFollowUp,
  compact = false,
}: {
  contactId: string;
  contactName: string;
  today: string;
  hasFollowUp: boolean;
  compact?: boolean;
}) {
  const [pending, setPending] = useState<"done" | "reschedule" | null>(null);
  const [custom, setCustom] = useState("");

  async function complete() {
    if (pending) return;
    setPending("done");
    try {
      const res = await completeFollowUpAction(contactId);
      if (res.ok) toast.success(`Follow-up with ${contactName} done`);
      else toast.error(res.error);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setPending(null);
    }
  }

  async function reschedule(date: string) {
    if (pending || !date) return;
    setPending("reschedule");
    try {
      const res = await rescheduleFollowUpAction(contactId, date);
      if (res.ok) toast.success(`Follow up with ${contactName} on ${formatDateOnly(date)}`);
      else toast.error(res.error);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {hasFollowUp ? (
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "h-8" : "h-10"}
          onClick={complete}
          disabled={pending !== null}
          aria-label={`Mark follow-up with ${contactName} as done`}
        >
          {pending === "done" ? <Loader2 className="animate-spin" /> : <Check />}
          Done
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className={compact ? "h-8" : "h-10"}
            disabled={pending !== null}
            aria-label={`${hasFollowUp ? "Reschedule" : "Schedule"} follow-up with ${contactName}`}
          >
            {pending === "reschedule" ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
            {hasFollowUp ? (compact ? "Snooze" : "Reschedule") : "Follow up"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Follow up…</DropdownMenuLabel>
          {RESCHEDULE_PRESETS.map((p) => {
            const date = applyPreset(today, p.key);
            return (
              <DropdownMenuItem key={p.key} onSelect={() => void reschedule(date)}>
                <span className="flex-1">{p.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateOnly(date, { withYear: false })}
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <form
            className="flex gap-1.5 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              void reschedule(custom);
            }}
          >
            <Input
              type="date"
              aria-label="Pick a date"
              min={today}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-9"
            />
            <Button type="submit" size="sm" className="h-9" disabled={!custom}>
              Set
            </Button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
