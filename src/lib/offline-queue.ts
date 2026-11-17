/**
 * Local queue for Quick Add submissions that could not reach the server.
 *
 * - Namespaced by user id, so a different account on the same device never
 *   sees (or sends) another user's pending entries.
 * - Entries are keyed by a client-generated UUID (contact id or interaction
 *   id); the server is idempotent on that id, so retries never duplicate.
 * - Entries are only removed after the server confirms success.
 *
 * Storage is injected so the logic is unit-testable without a browser.
 */
import type { ActionResult } from "@/lib/action-result";
import type { QuickAddInput } from "@/lib/validation/contact";
import type { InteractionInput } from "@/lib/validation/interaction";

export type QueuedQuickAdd = QuickAddInput & { contactId: string; interactionId: string };
export type QueuedInteraction = InteractionInput & { id: string; contactId: string };

/** What the user was doing: creating a contact, or logging a conversation. */
export type QueuedItem =
  | { kind: "contact"; input: QueuedQuickAdd; label: string }
  | { kind: "interaction"; input: QueuedInteraction; label: string };

export type PendingEntry = QueuedItem & {
  queuedAt: string;
  attempts: number;
  lastError: string | null;
};

/** Stable idempotency key of an entry. */
export function entryId(item: QueuedItem): string {
  return item.kind === "contact" ? item.input.contactId : item.input.id;
}

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  key?: (i: number) => string | null;
  length?: number;
};

const PREFIX = "nc:v1";
export const queueKey = (userId: string) => `${PREFIX}:queue:${userId}`;

/** Parse a stored queue, tolerating corrupt/legacy values. */
export function parseQueue(raw: string | null): PendingEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as PendingEntry[]).filter((e) => e && (e.kind === "contact" || e.kind === "interaction"))
      : [];
  } catch {
    return [];
  }
}

export function readQueue(storage: KeyValueStorage, userId: string): PendingEntry[] {
  try {
    return parseQueue(storage.getItem(queueKey(userId)));
  } catch {
    return [];
  }
}

function writeQueue(storage: KeyValueStorage, userId: string, entries: PendingEntry[]) {
  if (entries.length === 0) storage.removeItem(queueKey(userId));
  else storage.setItem(queueKey(userId), JSON.stringify(entries));
}

/** Add (or replace, by idempotency key) a pending entry. Returns the new queue. */
export function enqueue(
  storage: KeyValueStorage,
  userId: string,
  item: QueuedItem,
  error: string | null = null,
  now: Date = new Date(),
): PendingEntry[] {
  const entries = readQueue(storage, userId);
  const id = entryId(item);
  const idx = entries.findIndex((e) => entryId(e) === id);
  const entry: PendingEntry = {
    ...item,
    queuedAt: idx >= 0 ? entries[idx].queuedAt : now.toISOString(),
    attempts: idx >= 0 ? entries[idx].attempts : 0,
    lastError: error,
  };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  writeQueue(storage, userId, entries);
  return entries;
}

export function removeEntry(
  storage: KeyValueStorage,
  userId: string,
  id: string,
): PendingEntry[] {
  const entries = readQueue(storage, userId).filter((e) => entryId(e) !== id);
  writeQueue(storage, userId, entries);
  return entries;
}

export type FlushOutcome = { sent: number; failed: number; remaining: PendingEntry[] };

/**
 * Try to send every pending entry in order. Successful ones are removed;
 * failures are kept with their error so nothing typed by the user is lost.
 * A thrown error (network down) stops the flush early.
 */
export async function flushQueue(
  storage: KeyValueStorage,
  userId: string,
  send: (item: QueuedItem) => Promise<ActionResult<unknown>>,
): Promise<FlushOutcome> {
  let sent = 0;
  let failed = 0;
  for (const entry of readQueue(storage, userId)) {
    const id = entryId(entry);
    let result: ActionResult<unknown>;
    try {
      result = await send(entry);
    } catch {
      bumpAttempt(storage, userId, id, "Offline — will retry");
      failed++;
      break; // network is down; don't hammer
    }
    if (result.ok) {
      removeEntry(storage, userId, id);
      sent++;
    } else {
      bumpAttempt(storage, userId, id, result.error);
      failed++;
    }
  }
  return { sent, failed, remaining: readQueue(storage, userId) };
}

function bumpAttempt(storage: KeyValueStorage, userId: string, id: string, error: string) {
  const entries = readQueue(storage, userId).map((e) =>
    entryId(e) === id ? { ...e, attempts: e.attempts + 1, lastError: error } : e,
  );
  writeQueue(storage, userId, entries);
}

/** Remove every key this app stored for a user (used on sign-out). */
export function clearUserData(storage: KeyValueStorage, userId: string) {
  if (typeof storage.key !== "function" || typeof storage.length !== "number") {
    storage.removeItem(queueKey(userId));
    return;
  }
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(PREFIX) && k.endsWith(`:${userId}`)) doomed.push(k);
  }
  doomed.forEach((k) => storage.removeItem(k));
}

/** Heuristic: did the request fail because we're offline / network broke? */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true; // fetch failed
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("network") || msg.includes("fetch") || msg.includes("load failed");
}
