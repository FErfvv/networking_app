"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { quickAddContactAction } from "@/lib/actions/contacts";
import { addInteractionAction } from "@/lib/actions/interactions";
import {
  enqueue,
  entryId,
  flushQueue,
  parseQueue,
  queueKey,
  readQueue,
  removeEntry,
  type PendingEntry,
  type QueuedItem,
} from "@/lib/offline-queue";

const QUEUE_EVENT = "nc:queue-change";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(QUEUE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(QUEUE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function send(item: QueuedItem) {
  return item.kind === "contact"
    ? quickAddContactAction(item.input)
    : addInteractionAction(item.input);
}

/**
 * Per-user pending-submission queue with automatic retry when the app comes
 * back online or regains focus. Exposes `add` for failed submissions.
 */
export function usePendingQueue(userId: string) {
  const key = queueKey(userId);
  // Snapshot is the raw string so React can compare cheaply.
  const raw = useSyncExternalStore(
    subscribe,
    () => storage()?.getItem(key) ?? null,
    () => null,
  );
  const entries = useMemo(() => parseQueue(raw), [raw]);

  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  const flush = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const s = storage();
      if (!s || flushing.current || readQueue(s, userId).length === 0) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (!opts.silent) toast.info("Still offline. Entries stay saved on this device.");
        return;
      }
      flushing.current = true;
      setSyncing(true);
      try {
        const { sent, remaining } = await flushQueue(s, userId, send);
        notify();
        if (sent > 0) {
          toast.success(`Synced ${sent} pending ${sent === 1 ? "entry" : "entries"}`);
        }
        if (remaining.length > 0 && !opts.silent) {
          toast.error(`${remaining.length} still pending — will retry automatically.`);
        }
      } finally {
        flushing.current = false;
        setSyncing(false);
      }
    },
    [userId],
  );

  const add = useCallback(
    (item: QueuedItem, error: string | null) => {
      const s = storage();
      if (!s) return false;
      try {
        enqueue(s, userId, item, error);
        notify();
        return true;
      } catch {
        return false; // quota exceeded / storage disabled
      }
    },
    [userId],
  );

  const discard = useCallback(
    (entry: PendingEntry) => {
      const s = storage();
      if (!s) return;
      removeEntry(s, userId, entryId(entry));
      notify();
    },
    [userId],
  );

  // Auto-retry: on mount, when connectivity returns, and when the app is foregrounded.
  useEffect(() => {
    // Small delay so a cold start renders first, then quietly syncs.
    const initial = setTimeout(() => void flush({ silent: true }), 400);
    const onOnline = () => void flush({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush({ silent: true });
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush]);

  return { entries, syncing, flush, add, discard };
}
