"use client";

import { useSyncExternalStore } from "react";

/**
 * Remembers the People directory's query string (sort, category, company,
 * search) for this browser tab, so links back to /people restore the view
 * the user left instead of resetting it. Session-scoped: a new tab starts fresh.
 */
const KEY = "nc:v1:people-query";
const CHANGE_EVENT = "nc:people-query-change";
const BASE = "/people";

function read(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDirectoryQuery(qs: string) {
  if (read() === qs) return;
  try {
    if (qs) window.sessionStorage.setItem(KEY, qs);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — links just fall back to /people */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearDirectoryQuery() {
  saveDirectoryQuery("");
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/** `/people` plus the last directory query string, if any. */
export function useDirectoryHref(): string {
  const qs = useSyncExternalStore(subscribe, read, () => "");
  return qs ? `${BASE}?${qs}` : BASE;
}
