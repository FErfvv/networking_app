"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { dedupeTags } from "@/lib/validation/contact";

/** Chip-style tag editor. Enter or comma adds; Backspace on empty removes the last. */
export function TagInput({
  value,
  onChange,
  suggestions,
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add(raw: string) {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange(dedupeTags([...value, ...parts.map((p) => p.slice(0, 50))]).slice(0, 30));
    setDraft("");
  }

  const lower = new Set(value.map((v) => v.toLowerCase()));
  const available = suggestions.filter((s) => !lower.has(s.toLowerCase()));

  return (
    <div className="rounded-lg border px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <ul className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <li
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-2 text-sm"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        <li className="min-w-32 flex-1">
          <Input
            id={id}
            list={listId}
            value={draft}
            placeholder={value.length ? "Add tag" : "e.g. ML, internship, Boston"}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith(",")) add(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => add(draft)}
            enterKeyHint="enter"
            className="h-8 border-0 px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <datalist id={listId}>
            {available.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </li>
      </ul>
    </div>
  );
}
