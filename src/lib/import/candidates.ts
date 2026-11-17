import { z } from "zod";
import { isPlausiblePhone, normalizeLinkedIn } from "@/lib/validation/fields";
import type { RawContact } from "./vcard";

/** One row in the import checklist; `id` doubles as the idempotency key. */
export type ImportCandidate = {
  id: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  otherContact: string | null;
  linkedinUrl: string | null;
  generalNotes: string | null;
};

/** What we know about contacts already in the app, for duplicate flags. */
export type ExistingKeys = { emails: string[]; phones: string[]; names: string[] };

export type MatchStatus = "new" | "existing" | "same-name";

const isEmail = (v: string) => z.email().safeParse(v).success;

const clip = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
};

/**
 * Map a parsed vCard / Contact Picker entry onto our columns. The first valid
 * email and phone fill those fields; anything that doesn't fit (extra numbers,
 * odd formats, other links) goes into "other contact info" rather than being
 * dropped or failing validation.
 */
export function toCandidate(raw: RawContact, id: string = crypto.randomUUID()): ImportCandidate {
  const extras: string[] = [];

  let email: string | null = null;
  for (const e of raw.emails) {
    const v = e.trim().toLowerCase();
    if (!email && v.length <= 320 && isEmail(v)) email = v;
    else extras.push(e.trim());
  }

  let phone: string | null = null;
  for (const p of raw.phones) {
    const v = p.trim().replace(/\s+/g, " ");
    if (!phone && v.length <= 50 && isPlausiblePhone(v)) phone = v;
    else extras.push(v);
  }

  let linkedinUrl: string | null = null;
  for (const u of raw.urls) {
    const li = /linkedin\./i.test(u) ? normalizeLinkedIn(u) : null;
    if (li && !linkedinUrl && li.length <= 500) linkedinUrl = li;
    else extras.push(u.trim());
  }

  const other = [...new Set(extras.filter(Boolean))].join(" · ");
  return {
    id,
    name: clip(raw.name, 200) ?? "Unnamed",
    company: clip(raw.company, 200),
    jobTitle: clip(raw.jobTitle, 200),
    email,
    phone,
    otherContact: other ? other.slice(0, 500) : null,
    linkedinUrl,
    generalNotes: raw.note?.trim() ? raw.note.trim().slice(0, 20000) : null,
  };
}

/** Last 10 digits, so "+1 (555) 010-2000" and "555.010.2000" match. */
export function phoneKey(v: string | null | undefined): string | null {
  const digits = (v ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

const nameKey = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function makeMatcher(keys: ExistingKeys) {
  const emails = new Set(keys.emails.map((e) => e.toLowerCase()));
  const phones = new Set(keys.phones.map(phoneKey).filter((p): p is string => p !== null));
  const names = new Set(keys.names.map(nameKey));

  return (c: ImportCandidate): MatchStatus => {
    const pk = phoneKey(c.phone);
    if ((c.email && emails.has(c.email)) || (pk && phones.has(pk))) return "existing";
    if (names.has(nameKey(c.name))) return "same-name";
    return "new";
  };
}
