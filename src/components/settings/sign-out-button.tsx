"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { clearDirectoryQuery } from "@/lib/directory-query";
import { clearUserData, readQueue } from "@/lib/offline-queue";

/**
 * Signs out and removes this user's on-device data (pending queue, active
 * event, remembered location) so the next person on a shared device sees nothing.
 */
export function SignOutButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    let pendingCount = 0;
    try {
      pendingCount = readQueue(window.localStorage, userId).length;
    } catch {
      /* storage unavailable */
    }
    if (
      pendingCount > 0 &&
      !window.confirm(
        `${pendingCount} ${pendingCount === 1 ? "entry hasn't" : "entries haven't"} synced yet. Signing out will permanently discard ${pendingCount === 1 ? "it" : "them"}. Sign out anyway?`,
      )
    ) {
      return;
    }
    try {
      clearUserData(window.localStorage, userId);
      clearDirectoryQuery();
    } catch {
      /* ignore */
    }
    start(() => signOutAction());
  }

  return (
    <Button variant="outline" className="h-10" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Sign out
    </Button>
  );
}
