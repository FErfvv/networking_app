"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BookUser, Check, FileUp, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { importContactsAction } from "@/lib/actions/contacts";
import {
  makeMatcher,
  phoneKey,
  toCandidate,
  type ExistingKeys,
  type ImportCandidate,
  type MatchStatus,
} from "@/lib/import/candidates";
import { parseVCards, readVCardFile, type RawContact } from "@/lib/import/vcard";
import { IMPORT_BATCH_SIZE } from "@/lib/validation/contact";

// Contact Picker API (https://developer.mozilla.org/docs/Web/API/Contact_Picker_API).
// Not in TypeScript's DOM lib yet.
type PickerProperty = "name" | "email" | "tel" | "address" | "icon";
type PickedContact = { name?: string[]; email?: string[]; tel?: string[] };
type ContactsManager = {
  getProperties?: () => Promise<PickerProperty[]>;
  select: (props: PickerProperty[], opts?: { multiple?: boolean }) => Promise<PickedContact[]>;
};

const noopSubscribe = () => () => {};
const hasContactPicker = () => "contacts" in navigator && "ContactsManager" in window;

// Photos are stripped while the file streams in, so only the text stays in memory.
const MAX_FILE_BYTES = 1024 * 1024 * 1024;

type Row = ImportCandidate & { status: MatchStatus | "imported" };

const toPayload = (r: Row): ImportCandidate => ({
  id: r.id,
  name: r.name,
  company: r.company,
  jobTitle: r.jobTitle,
  email: r.email,
  phone: r.phone,
  otherContact: r.otherContact,
  linkedinUrl: r.linkedinUrl,
  generalNotes: r.generalNotes,
});

export function ImportContacts({ existing }: { existing: ExistingKeys }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const matcher = useMemo(() => makeMatcher(existing), [existing]);

  // false on the server, real answer in the browser — no hydration mismatch.
  const pickerSupported = useSyncExternalStore(noopSubscribe, hasContactPicker, () => false);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);

  function load(raw: RawContact[], selectNew: boolean) {
    const seen = new Set<string>();
    const next: Row[] = [];
    for (const r of raw) {
      const c = toCandidate(r);
      // Drop exact repeats within the same file/pick.
      const key = [c.name.toLowerCase(), c.email ?? "", phoneKey(c.phone) ?? ""].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ ...c, status: matcher(c) });
    }
    next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    setRows(next);
    setFilter("");
    setSelected(new Set(selectNew ? next.filter((r) => r.status === "new").map((r) => r.id) : []));
    if (next.length === 0) toast.error("No contacts found.");
  }

  async function pickFromPhone() {
    const contacts = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
    if (!contacts) return;
    try {
      const available = (await contacts.getProperties?.()) ?? ["name", "email", "tel"];
      const props = (["name", "email", "tel"] as const).filter((p) => available.includes(p));
      const picked = await contacts.select([...props], { multiple: true });
      const raw: RawContact[] = picked
        .map((p) => {
          const emails = p.email ?? [];
          const phones = p.tel ?? [];
          return {
            name: p.name?.find((n) => n.trim()) ?? emails[0] ?? phones[0] ?? "",
            company: null,
            jobTitle: null,
            emails,
            phones,
            urls: [],
            note: null,
          };
        })
        .filter((r) => r.name);
      if (raw.length) load(raw, true); // you already chose them in the picker
    } catch (err) {
      // Closing the picker without choosing anyone isn't an error worth showing.
      if ((err as Error)?.name !== "AbortError") toast.error("Couldn't open your contacts.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("That file is too large (max 1 GB). Try exporting without photos.");
      return;
    }
    try {
      const text = await readVCardFile(file);
      if (!/BEGIN:VCARD/i.test(text)) {
        toast.error("That doesn't look like a vCard (.vcf) file.");
        return;
      }
      load(parseVCards(text), false);
    } catch {
      toast.error("Couldn't read that file.");
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.company, r.email, r.phone, r.otherContact].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  const selectable = (r: Row) => r.status !== "imported";
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const counts = useMemo(() => {
    const c = { new: 0, existing: 0, "same-name": 0, imported: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  async function runImport() {
    const chosen = rows.filter((r) => selected.has(r.id) && selectable(r));
    if (chosen.length === 0 || importing) return;
    setImporting({ done: 0, total: chosen.length });

    let inserted = 0;
    let done = 0;
    for (let i = 0; i < chosen.length; i += IMPORT_BATCH_SIZE) {
      const chunk = chosen.slice(i, i + IMPORT_BATCH_SIZE);
      let result: Awaited<ReturnType<typeof importContactsAction>>;
      try {
        result = await importContactsAction(chunk.map(toPayload));
      } catch {
        result = { ok: false, error: "Connection lost. Check your network and try again." };
      }
      if (!result.ok) {
        toast.error(result.error, {
          description: done ? `${done} of ${chosen.length} were imported before this.` : undefined,
        });
        break;
      }
      inserted += result.data.inserted;
      done += chunk.length;
      const ids = new Set(chunk.map((c) => c.id));
      setRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, status: "imported" } : r)));
      setMany([...ids], false);
      setImporting({ done, total: chosen.length });
    }

    setImporting(null);
    if (done > 0) {
      toast.success(`Imported ${inserted} ${inserted === 1 ? "contact" : "contacts"}`, {
        action: { label: "View", onClick: () => router.push("/people") },
      });
    }
  }

  const selectedCount = rows.filter((r) => selected.has(r.id) && selectable(r)).length;
  const visibleSelectable = visible.filter(selectable);
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((r) => selected.has(r.id));

  return (
    <div className="space-y-5">
      {/* Sources */}
      <div className="grid gap-3 sm:grid-cols-2">
        {pickerSupported ? (
          <SourceButton
            icon={BookUser}
            title="Choose from this phone"
            description="Pick people from your contacts. Only the ones you choose are shared."
            onClick={pickFromPhone}
          />
        ) : null}
        <SourceButton
          icon={FileUp}
          title="Upload a vCard (.vcf)"
          description="Exported from iPhone, Mac, iCloud or Google Contacts. Read on this device; photos are skipped."
          onClick={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,.vcard,text/vcard,text/x-vcard"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {rows.length === 0 ? <HowToExport pickerSupported={pickerSupported} /> : null}

      {/* Checklist */}
      {rows.length > 0 ? (
        <section className="space-y-3" aria-label="Contacts to import">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {rows.length} found · {counts.new} new
              {counts.existing ? ` · ${counts.existing} already saved` : ""}
              {counts.imported ? ` · ${counts.imported} imported` : ""}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setMany(
                    visibleSelectable.filter((r) => r.status === "new").map((r) => r.id),
                    true,
                  )
                }
              >
                Select new
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMany(visibleSelectable.map((r) => r.id), !allVisibleSelected)}
              >
                {allVisibleSelected ? "Clear" : "Select all"}
              </Button>
            </div>
          </div>

          {rows.length > 10 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter by name, company, email or phone"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-11 rounded-xl pl-9"
                aria-label="Filter contacts"
              />
            </div>
          ) : null}

          <ul className="divide-y rounded-xl border">
            {visible.map((r) => {
              const disabled = !selectable(r);
              const detail = [r.phone, r.email, r.company].filter(Boolean).join(" · ");
              return (
                <li key={r.id}>
                  <label
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5",
                      disabled && "cursor-default opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-primary"
                      checked={disabled ? false : selected.has(r.id)}
                      disabled={disabled}
                      onChange={() => toggle(r.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      {detail ? (
                        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                      ) : null}
                    </span>
                    <StatusBadge status={r.status} />
                  </label>
                </li>
              );
            })}
            {visible.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</li>
            ) : null}
          </ul>

          <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-1 pt-2 md:bottom-4">
            <Button
              type="button"
              onClick={runImport}
              disabled={selectedCount === 0 || importing !== null}
              aria-busy={importing !== null}
              className="h-14 w-full rounded-xl text-base font-semibold shadow-lg shadow-black/5"
            >
              {importing ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="size-5" aria-hidden />
              )}
              {importing
                ? `Importing ${importing.done} of ${importing.total}…`
                : selectedCount === 0
                  ? "Select people to import"
                  : `Import ${selectedCount} ${selectedCount === 1 ? "contact" : "contacts"}`}
            </Button>
          </div>
        </section>
      ) : null}

      {counts.imported > 0 && !importing ? (
        <p className="text-center text-sm">
          <Link href="/people" className="underline underline-offset-4">
            Go to People
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function SourceButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  if (status === "new") return null;
  const label =
    status === "imported" ? "Imported" : status === "existing" ? "Already saved" : "Same name";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "imported"
          ? "bg-primary/10 text-primary"
          : status === "existing"
            ? "bg-muted text-muted-foreground"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      {status === "imported" ? <Check className="size-3" /> : null}
      {label}
    </span>
  );
}

function HowToExport({ pickerSupported }: { pickerSupported: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-4 text-sm">
      <h2 className="font-medium">Getting a .vcf file</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
        <li>
          <span className="text-foreground">iPhone:</span> Contacts app → Lists → touch and hold
          “All Contacts” (or any list) → Export. Save it to Files, then upload it here.
        </li>
        <li>
          <span className="text-foreground">Mac:</span> Contacts app → select people (⌘A for all)
          → File → Export → Export vCard.
        </li>
        <li>
          <span className="text-foreground">iCloud.com:</span> Contacts → select → ⋯ → Export
          vCard.
        </li>
        <li>
          <span className="text-foreground">Google Contacts:</span> select → ⋮ Export → vCard.
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Everyone in the file is listed for you to tick; only the people you choose are saved.
        {pickerSupported
          ? ""
          : " On Android Chrome you can also pick straight from your phone's contacts."}
      </p>
    </section>
  );
}
