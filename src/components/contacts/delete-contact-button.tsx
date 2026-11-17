"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
import { deleteContactAction } from "@/lib/actions/contacts";

export function DeleteContactButton({
  contactId,
  name,
  redirectTo,
  variant = "button",
}: {
  contactId: string;
  name: string;
  redirectTo?: string;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const res = await deleteContactAction(contactId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${name}`);
      setOpen(false);
      if (redirectTo) router.replace(redirectTo);
    } catch {
      toast.error("Network error — contact was not deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" aria-label={`Delete ${name}`}>
            <Trash2 />
          </Button>
        ) : (
          <Button variant="destructive" className="h-10">
            <Trash2 />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the contact and their entire interaction history. Consider
            exporting your data first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
