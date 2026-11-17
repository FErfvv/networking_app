"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CircleDot, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteEventAction } from "@/lib/actions/events";
import { useActiveEvent } from "@/lib/local-prefs";
import type { EventRow } from "@/lib/types/database";
import { EventFormSheet } from "./event-form-sheet";

export function EventDetailActions({ event, userId }: { event: EventRow; userId: string }) {
  const router = useRouter();
  const [active, setActive] = useActiveEvent(userId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isActive = active?.id === event.id;

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    setDeleting(true);
    try {
      const res = await deleteEventAction(event.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (isActive) setActive(null);
      toast.success(`Deleted ${event.name}`);
      router.replace("/events");
    } catch {
      toast.error("Network error — event not deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={isActive ? "secondary" : "default"}
        className="h-10"
        aria-pressed={isActive}
        onClick={() => {
          setActive(isActive ? null : { id: event.id, name: event.name });
          toast.success(isActive ? "No active event" : `Active event: ${event.name}`);
        }}
      >
        <CircleDot />
        {isActive ? "Active — tap to deactivate" : "Set as active event"}
      </Button>
      <Button variant="outline" className="h-10" onClick={() => setEditOpen(true)}>
        <Pencil />
        Edit
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="h-10">
            <Trash2 />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {event.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Contacts and interactions are kept — they just won&apos;t be linked to this event anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">
              {deleting ? <Loader2 className="animate-spin" /> : null}
              Delete event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EventFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        onSaved={(e) => {
          if (isActive) setActive({ id: e.id, name: e.name });
        }}
      />
    </div>
  );
}
