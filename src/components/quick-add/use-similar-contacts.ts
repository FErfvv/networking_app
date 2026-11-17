"use client";

import { useEffect, useState } from "react";
import type { SimilarContact } from "@/lib/services/contacts";

/** Debounced, abortable lookup of existing contacts with a similar name. */
export function useSimilarContacts(name: string, delayMs = 300) {
  const [result, setResult] = useState<{ q: string; contacts: SimilarContact[] }>({
    q: "",
    contacts: [],
  });
  const q = name.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/similar?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { contacts?: SimilarContact[] };
        setResult({ q, contacts: json.contacts ?? [] });
      } catch {
        /* offline or aborted — suggestions are best-effort */
      }
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, delayMs]);

  // Only show results that belong to the current query (never stale ones).
  return { contacts: q.length >= 2 && result.q === q ? result.contacts : [] };
}
