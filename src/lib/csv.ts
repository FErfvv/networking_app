/**
 * Minimal RFC 4180 CSV writer.
 * - Quotes fields containing comma, quote, CR or LF; doubles embedded quotes.
 * - Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR prefix)
 *   by prefixing a single quote, as recommended by OWASP.
 */
export type CsvValue = string | number | boolean | null | undefined | string[];

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join("; ") : String(value);
  if (typeof value === "string" || Array.isArray(value)) {
    if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T extends Record<string, CsvValue>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","));
  // BOM so Excel opens UTF-8 correctly; CRLF per RFC 4180.
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
}
