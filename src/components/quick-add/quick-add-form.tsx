"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  CloudOff,
  Loader2,
  MessageSquarePlus,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { quickAddContactAction } from "@/lib/actions/contacts";
import { addInteractionAction } from "@/lib/actions/interactions";
import { quickAddSchema } from "@/lib/validation/contact";
import { fieldErrorsOf } from "@/lib/validation/fields";
import { isNetworkError, type QueuedItem } from "@/lib/offline-queue";
import { prefKey, useActiveEvent, usePref } from "@/lib/local-prefs";
import type { SimilarContact } from "@/lib/services/contacts";
import { EventPicker, type EventOption } from "./event-picker";
import { PendingQueue } from "./pending-queue";
import { usePendingQueue } from "./use-pending-queue";
import { useSimilarContacts } from "./use-similar-contacts";

type Fields = {
  name: string;
  company: string;
  jobTitle: string;
  contact: string;
  linkedinUrl: string;
  notes: string;
};

const EMPTY: Fields = { name: "", company: "", jobTitle: "", contact: "", linkedinUrl: "", notes: "" };

/** The one "how do I reach them" field on Quick Add; the dropdown picks the column. */
type ContactKind = "phone" | "email" | "other";

const CONTACT_KINDS: Record<
  ContactKind,
  {
    label: string;
    field: "phone" | "email" | "otherContact";
    placeholder: string;
    inputProps: React.ComponentProps<"input">;
  }
> = {
  phone: {
    label: "Phone",
    field: "phone",
    placeholder: "Phone number",
    inputProps: { type: "tel", inputMode: "tel", maxLength: 50 },
  },
  email: {
    label: "Email",
    field: "email",
    placeholder: "Email address",
    inputProps: { type: "email", inputMode: "email", maxLength: 320 },
  },
  other: {
    label: "Other",
    field: "otherContact",
    placeholder: "Instagram, Discord, website…",
    inputProps: { type: "text", maxLength: 500 },
  },
};

const newIds = () => ({ contactId: crypto.randomUUID(), interactionId: crypto.randomUUID() });

export function QuickAddForm({ userId, events }: { userId: string; events: EventOption[] }) {
  const router = useRouter();
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [contactKind, setContactKind] = useState<ContactKind>("phone");
  const contactMeta = CONTACT_KINDS[contactKind];
  const contactError = errors[contactMeta.field];
  // When set, we log a conversation with an existing contact instead of creating one.
  const [existing, setExisting] = useState<SimilarContact | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);

  // IDs are generated once per draft and reused on retry/double tap => idempotent.
  // Created lazily on first submit, cleared after a confirmed save.
  const draftIds = useRef<{ contactId: string; interactionId: string } | null>(null);
  const getIds = () => (draftIds.current ??= newIds());

  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const [activeEvent, setActiveEvent] = useActiveEvent(userId);
  const [whereMet, setWhereMet] = usePref(prefKey("where-met", userId));
  const queue = usePendingQueue(userId);

  // Drop an active event that was deleted elsewhere.
  useEffect(() => {
    if (activeEvent && !events.some((e) => e.id === activeEvent.id)) setActiveEvent(null);
  }, [activeEvent?.id, events]); // eslint-disable-line react-hooks/exhaustive-deps

  const similar = useSimilarContacts(existing || dismissedSuggestions ? "" : fields.name);

  const set = (key: keyof Fields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key] || (key === "contact" && contactError)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        if (key === "contact") delete next[contactMeta.field];
        return next;
      });
    }
    if (key === "name") setDismissedSuggestions(false);
  };

  function resetAfterSave() {
    setFields(EMPTY);
    setErrors({});
    setExisting(null);
    setDismissedSuggestions(false);
    setShowMore(false);
    draftIds.current = null;
    // Keep event + "where met" — you're probably meeting the next person at the same place.
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // duplicate-submit guard
    inFlight.current = true;
    setPending(true);
    try {
      if (existing) await submitInteraction();
      else await submitContact();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function submitContact() {
    const ids = getIds();
    const location = (whereMet ?? "").trim() || activeEvent?.name || "";
    const input = {
      ...ids,
      name: fields.name,
      company: fields.company,
      jobTitle: fields.jobTitle,
      [contactMeta.field]: fields.contact,
      linkedinUrl: fields.linkedinUrl,
      notes: fields.notes,
      whereMet: location,
      eventId: activeEvent?.id ?? null,
      occurredAt: new Date().toISOString(),
    };

    const parsed = quickAddSchema.safeParse(input);
    if (!parsed.success) {
      const fe = fieldErrorsOf(parsed.error);
      setErrors(fe);
      if (fe.linkedinUrl || fe.company || fe.jobTitle) setShowMore(true);
      toast.error(Object.values(fe)[0] ?? "Please check the form.");
      return;
    }

    const name = parsed.data.name;
    const item: QueuedItem = { kind: "contact", input, label: name };

    let result: Awaited<ReturnType<typeof quickAddContactAction>>;
    try {
      result = await quickAddContactAction(input);
    } catch (err) {
      saveOffline(item, err);
      return;
    }

    if (result.ok) {
      const contactId = result.data.contactId;
      toast.success(result.data.created ? `Saved ${name}` : `${name} was already saved`, {
        description: activeEvent ? `at ${activeEvent.name}` : undefined,
        action: { label: "View", onClick: () => router.push(`/people/${contactId}`) },
      });
      resetAfterSave();
    } else {
      if (result.fieldErrors) setErrors(result.fieldErrors);
      toast.error(result.error, {
        action: { label: "Keep for later", onClick: () => saveOffline(item, result.error) },
      });
    }
  }

  async function submitInteraction() {
    if (!existing) return;
    const ids = getIds();
    const location = (whereMet ?? "").trim() || activeEvent?.name || "";
    const input = {
      id: ids.interactionId,
      contactId: existing.id,
      interactionType: "in_person" as const,
      notes: fields.notes,
      location,
      eventId: activeEvent?.id ?? null,
      occurredAt: new Date().toISOString(),
    };
    const item: QueuedItem = { kind: "interaction", input, label: existing.name };

    let result: Awaited<ReturnType<typeof addInteractionAction>>;
    try {
      result = await addInteractionAction(input);
    } catch (err) {
      saveOffline(item, err);
      return;
    }
    if (result.ok) {
      const contactId = existing.id;
      toast.success(`Logged conversation with ${existing.name}`, {
        action: { label: "View", onClick: () => router.push(`/people/${contactId}`) },
      });
      resetAfterSave();
    } else {
      toast.error(result.error);
    }
  }

  function saveOffline(item: QueuedItem, err: unknown) {
    const reason =
      typeof err === "string" ? err : isNetworkError(err) ? "Offline" : "Server unreachable";
    if (queue.add(item, reason)) {
      toast.warning(`${item.label} saved on this device`, {
        description: "Not synced yet — it will upload automatically when you're back online.",
        icon: <CloudOff className="size-4" />,
      });
      resetAfterSave();
    } else {
      toast.error("Couldn't save — your entry is still in the form. Try again.");
    }
  }

  const showSuggestions =
    !existing && !dismissedSuggestions && similar.contacts.length > 0 && fields.name.trim().length >= 2;

  return (
    <div className="space-y-4">
      <PendingQueue queue={queue} />

      <form id={formId} onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="flex flex-wrap items-center gap-2">
          <EventPicker
            userId={userId}
            events={events}
            active={activeEvent}
            onChange={setActiveEvent}
          />
        </div>

        {/* Name / existing contact */}
        {existing ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Logging a conversation with
              </p>
              <p className="truncate text-lg font-semibold">{existing.name}</p>
              {existing.company || existing.job_title ? (
                <p className="truncate text-sm text-muted-foreground">
                  {[existing.job_title, existing.company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="Create a new contact instead"
              onClick={() => {
                draftIds.current = null;
                setExisting(null);
                setDismissedSuggestions(true);
                requestAnimationFrame(() => nameRef.current?.focus());
              }}
            >
              <X />
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="qa-name" className="sr-only">
              Name
            </Label>
            <Input
              ref={nameRef}
              id="qa-name"
              name="name"
              placeholder="Name"
              autoComplete="off"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              required
              maxLength={200}
              value={fields.name}
              onChange={set("name")}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "qa-name-error" : undefined}
              className="h-14 rounded-xl px-4 text-xl font-medium md:text-xl"
            />
            {errors.name ? (
              <p id="qa-name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            ) : null}

            {showSuggestions ? (
              <div
                className="rounded-xl border bg-card p-2 shadow-xs"
                role="region"
                aria-label="Possible existing contacts"
              >
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <p className="text-xs text-muted-foreground">
                    Already met? Log a new conversation instead of a duplicate.
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setDismissedSuggestions(true)}
                  >
                    Dismiss
                  </button>
                </div>
                <ul className="space-y-1">
                  {similar.contacts.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          draftIds.current = null;
                          setExisting(c);
                        }}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <MessageSquarePlus className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          {c.company || c.job_title ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {[c.job_title, c.company].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">Log</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {/* Contact info — one field, the dropdown says what it is */}
        {!existing ? (
          <div className="space-y-1.5">
            <Label htmlFor="qa-contact" className="text-muted-foreground">
              Contact info
            </Label>
            <div className="flex gap-2">
              <Select
                value={contactKind}
                onValueChange={(v) => {
                  setContactKind(v as ContactKind);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next[contactMeta.field];
                    return next;
                  });
                }}
              >
                <SelectTrigger
                  aria-label="Contact info type"
                  className="w-28 shrink-0 rounded-xl data-[size=default]:h-11"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {(Object.keys(CONTACT_KINDS) as ContactKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {CONTACT_KINDS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="qa-contact"
                name="contact"
                {...contactMeta.inputProps}
                placeholder={contactMeta.placeholder}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                value={fields.contact}
                onChange={set("contact")}
                aria-invalid={Boolean(contactError)}
                aria-describedby={contactError ? "qa-contact-error" : undefined}
                className="h-11 min-w-0 flex-1 rounded-xl px-4"
              />
            </div>
            {contactError ? (
              <p id="qa-contact-error" className="text-sm text-destructive">
                {contactError}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Notes — always visible, dictation friendly */}
        <div className="space-y-1.5">
          <Label htmlFor="qa-notes" className="text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id="qa-notes"
            name="notes"
            placeholder="What did you talk about? Tap the mic on your keyboard to dictate."
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            rows={3}
            maxLength={20000}
            value={fields.notes}
            onChange={set("notes")}
            className="min-h-24 rounded-xl px-4 py-3 text-base md:text-base"
          />
        </div>

        {/* Where met — remembered between entries */}
        <div className="space-y-1.5">
          <Label htmlFor="qa-where" className="text-muted-foreground">
            Where you met
          </Label>
          <div className="relative">
            <Input
              id="qa-where"
              name="whereMet"
              placeholder={activeEvent ? activeEvent.name : "e.g. Career fair, coffee shop"}
              autoCapitalize="sentences"
              enterKeyHint="done"
              maxLength={200}
              value={whereMet ?? ""}
              onChange={(e) => setWhereMet(e.target.value || null)}
              className="h-11 rounded-xl px-4 pr-10"
            />
            {whereMet ? (
              <button
                type="button"
                aria-label="Clear where you met"
                onClick={() => setWhereMet(null)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Optional details */}
        {!existing ? (
          <div className="rounded-xl border">
            <button
              type="button"
              aria-expanded={showMore}
              aria-controls="qa-more"
              onClick={() => setShowMore((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none rounded-xl"
            >
              <span>
                More details
                <span className="ml-1.5 font-normal">
                  {summarizeMore(fields) ? `· ${summarizeMore(fields)}` : "· company, title, LinkedIn"}
                </span>
              </span>
              <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} />
            </button>
            <div id="qa-more" hidden={!showMore} className="space-y-3 px-4 pb-4">
              <Field id="qa-company" label="Company" error={errors.company}>
                <Input
                  id="qa-company"
                  autoComplete="organization"
                  autoCapitalize="words"
                  maxLength={200}
                  value={fields.company}
                  onChange={set("company")}
                  className="h-11"
                />
              </Field>
              <Field id="qa-title" label="Job title" error={errors.jobTitle}>
                <Input
                  id="qa-title"
                  autoComplete="organization-title"
                  autoCapitalize="words"
                  maxLength={200}
                  value={fields.jobTitle}
                  onChange={set("jobTitle")}
                  className="h-11"
                />
              </Field>
              <Field id="qa-linkedin" label="LinkedIn" error={errors.linkedinUrl}>
                <Input
                  id="qa-linkedin"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="linkedin.com/in/handle or just handle"
                  maxLength={500}
                  value={fields.linkedinUrl}
                  onChange={set("linkedinUrl")}
                  aria-invalid={Boolean(errors.linkedinUrl)}
                  className="h-11"
                />
              </Field>
            </div>
          </div>
        ) : null}

        {/* Sticky save — reachable with one thumb, above the tab bar */}
        <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-1 pt-2 md:bottom-4">
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="h-14 w-full rounded-xl text-base font-semibold shadow-lg shadow-black/5"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : existing ? (
              <MessageSquarePlus className="size-5" aria-hidden />
            ) : (
              <UserPlus className="size-5" aria-hidden />
            )}
            {pending ? "Saving…" : existing ? "Log conversation" : "Save contact"}
          </Button>
        </div>
      </form>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Only the name is required. Add everything else later from{" "}
        <Link href="/people" className="underline underline-offset-4">
          People
        </Link>
        .
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function summarizeMore(f: Fields) {
  return [f.company, f.jobTitle, f.linkedinUrl ? "LinkedIn" : ""]
    .filter((v) => v.trim())
    .join(", ");
}
