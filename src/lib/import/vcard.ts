/**
 * Minimal vCard (.vcf) reader covering what iPhone/iCloud, macOS Contacts,
 * Google Contacts and Android export: vCard 2.1, 3.0 and 4.0, line folding,
 * quoted-printable values, grouped properties (item1.EMAIL) and escapes.
 * Runs entirely in the browser — the file is never uploaded as-is.
 */

export type RawContact = {
  name: string;
  company: string | null;
  jobTitle: string | null;
  emails: string[];
  phones: string[];
  urls: string[];
  note: string | null;
};

type Line = { prop: string; params: Record<string, string[]>; value: string };

export function parseVCards(text: string): RawContact[] {
  const out: RawContact[] = [];
  let card: Line[] | null = null;

  for (const line of logicalLines(text)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (parsed.prop === "BEGIN" && parsed.value.trim().toUpperCase() === "VCARD") {
      card = [];
    } else if (parsed.prop === "END" && parsed.value.trim().toUpperCase() === "VCARD") {
      if (card) {
        const c = toRawContact(card);
        if (c) out.push(c);
      }
      card = null;
    } else if (card) {
      card.push(parsed);
    }
  }
  return out;
}

/** Unfold continuation lines (RFC 6350 §3.2) and quoted-printable soft breaks. */
function logicalLines(text: string): string[] {
  const physical = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const lines: string[] = [];
  for (const raw of physical) {
    const prev = lines.length ? lines[lines.length - 1] : null;
    if (prev !== null && /^[ \t]/.test(raw)) {
      lines[lines.length - 1] = prev + raw.slice(1);
    } else if (prev !== null && isQuotedPrintable(prev) && prev.endsWith("=")) {
      lines[lines.length - 1] = prev.slice(0, -1) + raw;
    } else {
      lines.push(raw);
    }
  }
  return lines.filter((l) => l.trim() !== "");
}

function isQuotedPrintable(line: string): boolean {
  const colon = line.indexOf(":");
  const head = colon === -1 ? line : line.slice(0, colon);
  return /ENCODING=QUOTED-PRINTABLE|;QUOTED-PRINTABLE/i.test(head);
}

function parseLine(line: string): Line | null {
  // The value starts at the first ':' that isn't inside a quoted parameter.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon === -1) return null;

  const [nameWithGroup, ...rawParams] = line.slice(0, colon).split(";");
  const prop = nameWithGroup.split(".").pop()!.trim().toUpperCase();
  const params: Record<string, string[]> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    // vCard 2.1 allows bare params like ";CELL" or ";QUOTED-PRINTABLE".
    const key = (eq === -1 ? "TYPE" : p.slice(0, eq)).trim().toUpperCase();
    const val = eq === -1 ? p : p.slice(eq + 1);
    for (const v of val.split(",")) {
      (params[key] ??= []).push(v.replace(/^"|"$/g, "").trim());
    }
  }

  let value = line.slice(colon + 1);
  const qp =
    params.ENCODING?.some((e) => e.toUpperCase() === "QUOTED-PRINTABLE") ||
    params.TYPE?.some((e) => e.toUpperCase() === "QUOTED-PRINTABLE");
  if (qp) value = decodeQuotedPrintable(value);
  return { prop, params, value };
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const hex = s.slice(i + 1, i + 3);
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(s[i]));
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/** Split a structured value on unescaped ';' and unescape each component. */
function components(value: string): string[] {
  return value.split(/(?<!\\);/).map(unescapeText);
}

function unescapeText(s: string): string {
  return s.replace(/\\([nN,;\\:])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c)).trim();
}

function toRawContact(lines: Line[]): RawContact | null {
  let fn = "";
  let structured = "";
  let company: string | null = null;
  let jobTitle: string | null = null;
  let note: string | null = null;
  const emails: string[] = [];
  const phones: string[] = [];
  const urls: string[] = [];

  for (const { prop, value } of lines) {
    switch (prop) {
      case "FN":
        fn = unescapeText(value);
        break;
      case "N": {
        // Family; Given; Additional; Prefix; Suffix
        const [family = "", given = "", additional = "", prefix = "", suffix = ""] =
          components(value);
        structured = [prefix, given, additional, family, suffix].filter(Boolean).join(" ");
        break;
      }
      case "ORG":
        company = components(value).filter(Boolean).join(", ") || null;
        break;
      case "TITLE":
        jobTitle = unescapeText(value) || null;
        break;
      case "NOTE":
        note = unescapeText(value) || null;
        break;
      case "EMAIL":
        pushValue(emails, unescapeText(value).replace(/^mailto:/i, ""));
        break;
      case "TEL":
        pushValue(phones, unescapeText(value).replace(/^tel:/i, ""));
        break;
      case "URL":
      case "X-SOCIALPROFILE":
        pushValue(urls, unescapeText(value));
        break;
    }
  }

  const name = fn || structured || company || emails[0] || phones[0] || "";
  if (!name) return null;
  return { name, company, jobTitle, emails, phones, urls, note };
}

function pushValue(list: string[], v: string) {
  const t = v.trim();
  if (t && !list.includes(t)) list.push(t);
}
