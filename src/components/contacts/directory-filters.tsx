"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_SORTS, NO_CATEGORY, SORT_LABELS } from "@/lib/constants";
import { saveDirectoryQuery } from "@/lib/directory-query";
import type { Category } from "@/lib/services/categories";
import { CATEGORY_SWATCHES } from "./badges";

const ALL = "__all";

/** Search/sort/filter controls. State lives in the URL so it's shareable and back-button friendly. */
export function DirectoryFilters({
  companies,
  categories,
}: {
  companies: string[];
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce typing into the URL.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q: q.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Remember this view so "back to People" links can restore it.
  const query = sp.toString();
  useEffect(() => saveDirectoryQuery(query), [query]);

  const hasFilters = Boolean(sp.get("q") || sp.get("category") || sp.get("company"));

  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Search names, companies, notes…"
          aria-label="Search contacts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 rounded-xl pr-10 pl-9"
        />
        {isPending ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Select value={sp.get("sort") ?? "recent"} onValueChange={(v) => update({ sort: v === "recent" ? null : v })}>
          <SelectTrigger aria-label="Sort" className="h-9 shrink-0 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {CONTACT_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sp.get("category") ?? ALL} onValueChange={(v) => update({ category: v })}>
          <SelectTrigger aria-label="Filter by category" className="h-9 shrink-0 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${CATEGORY_SWATCHES[c.color]}`} />
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value={NO_CATEGORY}>No category</SelectItem>
          </SelectContent>
        </Select>

        {companies.length > 0 ? (
          <Select value={sp.get("company") ?? ALL} onValueChange={(v) => update({ company: v })}>
            <SelectTrigger aria-label="Filter by company" className="h-9 max-w-52 shrink-0 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={ALL}>All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {hasFilters ? (
          <Button
            variant="ghost"
            className="h-9 shrink-0 rounded-full"
            onClick={() => {
              setQ("");
              update({ q: null, category: null, company: null });
            }}
          >
            <X />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
