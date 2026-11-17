"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny per-user localStorage store with cross-component (same tab) and
 * cross-tab sync. Used for the active event and "where we met" memory.
 * Contains no contact data.
 */
const PREFIX = "nc:v1";
const CHANGE_EVENT = "nc:prefs-change";

export const prefKey = (name: string, userId: string) => `${PREFIX}:${name}:${userId}`;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setPref(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — preference just won't persist */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
}

export function usePref(key: string): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => safeGet(key),
    () => null,
  );
  const set = useCallback((v: string | null) => setPref(key, v), [key]);
  return [value, set];
}

export type ActiveEvent = { id: string; name: string };

export function useActiveEvent(userId: string): [ActiveEvent | null, (e: ActiveEvent | null) => void] {
  const [raw, setRaw] = usePref(prefKey("active-event", userId));
  let active: ActiveEvent | null = null;
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v.id === "string" && typeof v.name === "string") active = v;
    } catch {
      active = null;
    }
  }
  const set = useCallback(
    (e: ActiveEvent | null) => setRaw(e ? JSON.stringify({ id: e.id, name: e.name }) : null),
    [setRaw],
  );
  return [active, set];
}
