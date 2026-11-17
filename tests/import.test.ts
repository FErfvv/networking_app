import { describe, expect, it } from "vitest";
import { makeMatcher, phoneKey, toCandidate } from "@/lib/import/candidates";
import { parseVCards, readVCardFile, stripBinaryProperties, type RawContact } from "@/lib/import/vcard";
import { importContacts } from "@/lib/services/contacts";
import { createFakeSupabase, USER_A, uuid } from "./helpers/fake-supabase";

const raw = (over: Partial<RawContact>): RawContact => ({
  name: "Ada",
  company: null,
  jobTitle: null,
  emails: [],
  phones: [],
  urls: [],
  note: null,
  ...over,
});

describe("parseVCards", () => {
  it("reads an iPhone-style vCard 3.0 export with groups, folding and escapes", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "PRODID:-//Apple Inc.//iPhone OS 18.0//EN",
      "N:Lovelace;Ada;;Countess;",
      "FN:Ada Lovelace",
      "ORG:Analytical Engines\\, Ltd;Research;",
      "TITLE:Engineer",
      "item1.EMAIL;type=INTERNET;type=pref:ada@example.com",
      "item1.X-ABLabel:_$!<Other>!$_",
      "TEL;type=CELL;type=VOICE;type=pref:+1 (555) 010-2000",
      "TEL;type=WORK:555 010 3000",
      "item2.URL;type=pref:https://www.linkedin.com/in/ada-l",
      "NOTE:Met at the fair\\nLikes math",
      "PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQ",
      " AAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsN",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Grace",
      "EMAIL:grace@",
      " example.com",
      "END:VCARD",
    ].join("\r\n");

    const cards = parseVCards(vcf);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      name: "Ada Lovelace",
      company: "Analytical Engines, Ltd, Research",
      jobTitle: "Engineer",
      emails: ["ada@example.com"],
      phones: ["+1 (555) 010-2000", "555 010 3000"],
      urls: ["https://www.linkedin.com/in/ada-l"],
      note: "Met at the fair\nLikes math",
    });
    expect(cards[1].emails).toEqual(["grace@example.com"]);
  });

  it("reads Android vCard 2.1 with quoted-printable UTF-8 and bare params", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:2.1",
      "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;J=C3=BCrgen;;;",
      "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:J=C3=BCrgen M=C3=BC=",
      "ller",
      "TEL;CELL:+49 30 1234567",
      "END:VCARD",
    ].join("\n");
    const [c] = parseVCards(vcf);
    expect(c.name).toBe("Jürgen Müller");
    expect(c.phones).toEqual(["+49 30 1234567"]);
  });

  it("builds a name from N, then falls back to org/email/phone, and skips empty cards", () => {
    const vcf = `BEGIN:VCARD
N:Hopper;Grace;;;
END:VCARD
BEGIN:VCARD
ORG:Acme
END:VCARD
BEGIN:VCARD
TEL:5550100200
END:VCARD
BEGIN:VCARD
VERSION:4.0
END:VCARD`;
    expect(parseVCards(vcf).map((c) => c.name)).toEqual(["Grace Hopper", "Acme", "5550100200"]);
  });
});

describe("toCandidate", () => {
  it("uses the first valid email/phone and keeps the rest as other contact info", () => {
    const c = toCandidate(
      raw({
        emails: ["not-an-email", "Ada@Example.com", "second@example.com"],
        phones: ["*67", "+1 555 010 2000", "555 010 3000"],
        urls: ["linkedin.com/in/ada-l", "https://ada.dev"],
      }),
      uuid(1),
    );
    expect(c.email).toBe("ada@example.com");
    expect(c.phone).toBe("+1 555 010 2000");
    expect(c.linkedinUrl).toBe("https://www.linkedin.com/in/ada-l");
    expect(c.otherContact).toBe(
      "not-an-email · second@example.com · *67 · 555 010 3000 · https://ada.dev",
    );
  });

  it("clips over-long values to the column limits", () => {
    const c = toCandidate(raw({ name: "x".repeat(300), company: "y".repeat(300) }), uuid(1));
    expect(c.name).toHaveLength(200);
    expect(c.company).toHaveLength(200);
  });
});

describe("makeMatcher", () => {
  const match = makeMatcher({
    emails: ["ada@example.com"],
    phones: ["+1 (555) 010-2000"],
    names: ["Grace Hopper"],
  });

  it("flags existing contacts by email or phone (format-insensitive)", () => {
    expect(match(toCandidate(raw({ emails: ["ADA@example.com"] })))).toBe("existing");
    expect(match(toCandidate(raw({ phones: ["555.010.2000"] })))).toBe("existing");
  });

  it("flags a same-name match separately and everything else as new", () => {
    expect(match(toCandidate(raw({ name: "  grace   hopper " })))).toBe("same-name");
    expect(match(toCandidate(raw({ name: "Alan Turing" })))).toBe("new");
  });

  it("phoneKey ignores formatting and country code", () => {
    expect(phoneKey("+1 (555) 010-2000")).toBe(phoneKey("555-010-2000"));
    expect(phoneKey("123")).toBeNull();
  });
});

describe("importContacts", () => {
  const ctx = (fake: ReturnType<typeof createFakeSupabase>) => ({
    supabase: fake.client,
    userId: USER_A,
  });

  it("upserts rows idempotently by client id and reports how many were new", async () => {
    const fake = createFakeSupabase({ from: { contacts: { data: [{ id: uuid(1) }] } } });
    const r = await importContacts(ctx(fake), [
      { id: uuid(1), name: "Ada", phone: "+1 555 010 2000", email: "ADA@example.com" },
      { id: uuid(2), name: "Grace" },
    ]);
    expect(r).toEqual({ ok: true, data: { inserted: 1 } });

    const upsert = fake.calls[0].ops.find((o) => o.op === "upsert")!;
    expect(upsert.args[1]).toEqual({ onConflict: "id", ignoreDuplicates: true });
    expect(upsert.args[0]).toEqual([
      expect.objectContaining({ id: uuid(1), user_id: USER_A, email: "ada@example.com", phone: "+1 555 010 2000" }),
      expect.objectContaining({ id: uuid(2), user_id: USER_A, name: "Grace", email: null }),
    ]);
  });

  it("rejects the batch without touching the database when a row is invalid", async () => {
    const fake = createFakeSupabase({});
    const r = await importContacts(ctx(fake), [{ id: uuid(1), name: "Ada", email: "nope" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Ada: /);
    expect(fake.calls).toHaveLength(0);
  });

  it("rejects empty and oversized batches", async () => {
    const fake = createFakeSupabase({});
    expect((await importContacts(ctx(fake), [])).ok).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => ({ id: uuid(i + 1), name: `P${i}` }));
    expect((await importContacts(ctx(fake), many)).ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("photo stripping", () => {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const v3 = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Ada Lovelace",
    `PHOTO;ENCODING=b;TYPE=JPEG:${b64.slice(0, 40)}`,
    ` ${b64.slice(40, 80)}`,
    ` ${b64.slice(80)}`,
    "item1.EMAIL;type=INTERNET:ada@example.com",
    "END:VCARD",
  ].join("\r\n");
  // vCard 2.1: unindented base64 continuation, terminated by a blank line.
  const v21 = [
    "BEGIN:VCARD",
    "VERSION:2.1",
    "FN:Grace Hopper",
    `PHOTO;ENCODING=BASE64;JPEG:${b64.slice(0, 40)}`,
    b64.slice(40, 80),
    b64.slice(80),
    "",
    "TEL;CELL:+15550100",
    "END:VCARD",
  ].join("\r\n");

  it("removes folded (3.0/4.0) and unindented (2.1) photo data but keeps other fields", () => {
    const stripped = stripBinaryProperties(`${v3}\r\n${v21}`);
    expect(stripped).not.toContain(b64.slice(40, 80));
    expect(stripped).not.toMatch(/PHOTO/);
    const cards = parseVCards(stripped);
    expect(cards.map((c) => c.name)).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(cards[0].emails).toEqual(["ada@example.com"]);
    expect(cards[1].phones).toEqual(["+15550100"]);
  });

  it("streams a file in small chunks, including chunks split between \\r and \\n", async () => {
    const text = `${v3}\r\n${v21}\r\n`;
    const bytes = new TextEncoder().encode(text);
    for (const size of [1, 2, 3, 7, 64]) {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
          c.close();
        },
      });
      const file = { stream: () => stream } as unknown as Blob;
      const out = await readVCardFile(file);
      expect(out).toBe(stripBinaryProperties(text));
    }
  });
});
