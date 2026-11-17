"use client";

import { CloudOff, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entryId } from "@/lib/offline-queue";
import { relativeFromNow } from "@/lib/dates";
import type { usePendingQueue } from "./use-pending-queue";

/** Visible list of entries saved on-device but not yet on the server. */
export function PendingQueue({ queue }: { queue: ReturnType<typeof usePendingQueue> }) {
  const { entries, syncing, flush, discard } = queue;
  if (entries.length === 0) return null;

  return (
    <section
      aria-label="Pending, not yet synced"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
          <CloudOff className="size-4" aria-hidden />
          {entries.length} not synced yet
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void flush()}
          disabled={syncing}
          className="h-8"
        >
          {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Retry now
        </Button>
      </div>
      <ul className="mt-2 divide-y divide-amber-500/20">
        {entries.map((e) => (
          <li key={entryId(e)} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {e.kind === "contact" ? e.label : `Conversation with ${e.label}`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Saved {relativeFromNow(e.queuedAt)}
                {e.lastError ? ` · ${e.lastError}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Discard pending entry for ${e.label}`}
              onClick={() => {
                if (window.confirm(`Discard the unsynced entry for ${e.label}? This can't be undone.`)) {
                  discard(e);
                }
              }}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
