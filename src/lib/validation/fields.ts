import { z } from "zod";

// NOTE (Zod 4): object keys are only optional when the field schema is
// optional at its input. So every helper here starts from `.nullish()`
// rather than a union containing z.undefined(), letting callers omit keys.

/** Trim; empty string / whitespace / null / missing -> null. */
export const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    })
    .pipe(z.string().max(max, `Must be ${max} characters or fewer`).nullable());

export const requiredName = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

export const optionalEmail = optionalText(320).pipe(
  z.union([z.email("Enter a valid email address").transform((e) => e.toLowerCase()), z.null()]),
);

const PHONE_RE = /^\+?[\d\s().\-/]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?$/i;

/** True for a plausible phone number: phone punctuation only, 7–20 digits. */
export function isPlausiblePhone(v: string): boolean {
  if (!PHONE_RE.test(v)) return false;
  const digits = v.replace(/(?:ext\.?|x)\s*\d+$/i, "").replace(/\D/g, "").length;
  return digits >= 7 && digits <= 20;
}

/** Kept as typed (trimmed, inner whitespace collapsed); formats vary by country. */
export const optionalPhone = optionalText(50)
  .transform((v) => (v === null ? null : v.replace(/\s+/g, " ")))
  .refine((v) => v === null || isPlausiblePhone(v), {
    message: "Enter a valid phone number",
  });

/**
 * Accepts a full LinkedIn URL, a URL without scheme, "in/handle", or a bare
 * handle, and normalizes to https://www.linkedin.com/in/<handle>.
 * Other URLs (e.g. company pages) are kept if they are linkedin.com URLs.
 */
export function normalizeLinkedIn(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  const handleOnly = /^@?([A-Za-z0-9\-_%.]{2,100})\/?$/;
  const inPath = /^\/?in\/([A-Za-z0-9\-_%.]{2,100})\/?$/i;

  let m = v.match(inPath) ?? v.match(handleOnly);
  if (m && !v.includes(".com")) return `https://www.linkedin.com/in/${m[1]}`;

  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;

  m = url.pathname.match(/^\/in\/([^/?#]+)/i);
  if (m) return `https://www.linkedin.com/in/${m[1]}`;
  url.protocol = "https:";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export const optionalLinkedIn = optionalText(500).transform((v, ctx) => {
  if (v === null) return null;
  const normalized = normalizeLinkedIn(v);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Enter a LinkedIn profile URL or handle" });
    return z.NEVER;
  }
  return normalized;
});

export const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export function isIsoDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export const optionalDate = z
  .string()
  .nullish()
  .transform((v) => (v ?? "").trim() || null)
  .refine((v) => v === null || isIsoDate(v), {
    message: "Enter a valid date",
  });

export const requiredDate = z
  .string()
  .trim()
  .refine((v) => isIsoDate(v), {
    message: "Enter a valid date",
  });

/** ISO timestamp or datetime-local value; defaults to now. */
export const occurredAt = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    const s = (v ?? "").trim();
    if (!s) return new Date().toISOString();
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return d.toISOString();
  });

/** Flatten zod issues into { field: firstMessage }. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
