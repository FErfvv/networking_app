import { describe, expect, it, vi } from "vitest";
import {
  clearUserData,
  enqueue,
  flushQueue,
  queueKey,
  readQueue,
  type KeyValueStorage,
  type QueuedItem,
} from "@/lib/offline-queue";
import { USER_A, USER_B, uuid } from "./helpers/fake-supabase";

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const contactItem = (n: number, name = `Person ${n}`): QueuedItem => ({
  kind: "contact",
  label: name,
  input: { contactId: uuid(n), interactionId: uuid(n + 1000), name },
});

describe("offline queue", () => {
  it("namespaces entries per user so accounts never see each other's data", () => {
    const s = memoryStorage();
    enqueue(s, USER_A, contactItem(1));
    expect(readQueue(s, USER_A)).toHaveLength(1);
    expect(readQueue(s, USER_B)).toHaveLength(0);
  });

  it("dedupes by client id: re-enqueueing the same draft replaces it", () => {
    const s = memoryStorage();
    enqueue(s, USER_A, contactItem(1, "Ada"));
    enqueue(s, USER_A, contactItem(1, "Ada L."));
    const q = readQueue(s, USER_A);
    expect(q).toHaveLength(1);
    expect(q[0].label).toBe("Ada L.");
  });

  it("removes only confirmed entries; keeps failed ones with their error", async () => {
    const s = memoryStorage();
    enqueue(s, USER_A, contactItem(1));
    enqueue(s, USER_A, contactItem(2));
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: {} })
      .mockResolvedValueOnce({ ok: false, error: "Invalid input" });
    const out = await flushQueue(s, USER_A, send);
    expect(out.sent).toBe(1);
    expect(out.remaining).toHaveLength(1);
    expect(out.remaining[0].label).toBe("Person 2");
    expect(out.remaining[0].lastError).toBe("Invalid input");
    expect(out.remaining[0].attempts).toBe(1);
  });

  it("stops at the first network error and loses nothing", async () => {
    const s = memoryStorage();
    enqueue(s, USER_A, contactItem(1));
    enqueue(s, USER_A, contactItem(2));
    const send = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const out = await flushQueue(s, USER_A, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(out.remaining).toHaveLength(2);
  });

  it("re-sends the same idempotency key on retry", async () => {
    const s = memoryStorage();
    enqueue(s, USER_A, contactItem(7));
    const seen: string[] = [];
    const send = vi.fn(async (item: QueuedItem) => {
      if (item.kind === "contact") seen.push(item.input.contactId);
      return seen.length === 1 ? { ok: false as const, error: "boom" } : { ok: true as const, data: {} };
    });
    await flushQueue(s, USER_A, send);
    await flushQueue(s, USER_A, send);
    expect(seen).toEqual([uuid(7), uuid(7)]);
    expect(readQueue(s, USER_A)).toHaveLength(0);
  });

  it("tolerates corrupt storage", () => {
    const s = memoryStorage();
    s.setItem(queueKey(USER_A), "{not json");
    expect(readQueue(s, USER_A)).toEqual([]);
  });

  it("clearUserData removes only that user's keys", () => {
    const s = memoryStorage();
    enqueue(s, USER_A, contactItem(1));
    enqueue(s, USER_B, contactItem(2));
    s.setItem(`nc:v1:active-event:${USER_A}`, "{}");
    s.setItem("unrelated", "x");
    clearUserData(s, USER_A);
    expect(readQueue(s, USER_A)).toHaveLength(0);
    expect(readQueue(s, USER_B)).toHaveLength(1);
    expect(s.getItem(`nc:v1:active-event:${USER_A}`)).toBeNull();
    expect(s.getItem("unrelated")).toBe("x");
  });
});
