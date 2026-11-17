import { describe, expect, it } from "vitest";
import {
  contactUpdateSchema,
  dedupeTags,
  quickAddSchema,
  toContactColumns,
} from "@/lib/validation/contact";
import { isIsoDate, normalizeLinkedIn } from "@/lib/validation/fields";
import { interactionSchema } from "@/lib/validation/interaction";
import { eventSchema } from "@/lib/validation/event";
import { uuid } from "./helpers/fake-supabase";

const ids = { contactId: uuid(1), interactionId: uuid(2) };

describe("quickAddSchema", () => {
  it("accepts a contact with only a name and nulls every optional field", () => {
    const r = quickAddSchema.safeParse({ ...ids, name: "  Ada Lovelace  " });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe("Ada Lovelace");
    expect(r.data.company).toBeNull();
    expect(r.data.email).toBeNull();
    expect(r.data.linkedinUrl).toBeNull();
    expect(r.data.notes).toBeNull();
    expect(r.data.eventId).toBeNull();
    expect(Number.isNaN(Date.parse(r.data.occurredAt))).toBe(false);
  });

  it.each(["", "   ", undefined])("rejects a missing/blank name (%j)", (name) => {
    const r = quickAddSchema.safeParse({ ...ids, name });
    expect(r.success).toBe(false);
  });

  it("rejects names longer than 200 characters", () => {
    expect(quickAddSchema.safeParse({ ...ids, name: "x".repeat(201) }).success).toBe(false);
  });

  it("converts blank optional strings to null", () => {
    const r = quickAddSchema.parse({ ...ids, name: "A", company: "  ", jobTitle: "", whereMet: " " });
    expect(r.company).toBeNull();
    expect(r.jobTitle).toBeNull();
    expect(r.whereMet).toBeNull();
  });

  it("lower-cases valid emails and rejects invalid ones", () => {
    expect(quickAddSchema.parse({ ...ids, name: "A", email: " Ada@Example.COM " }).email).toBe(
      "ada@example.com",
    );
    const bad = quickAddSchema.safeParse({ ...ids, name: "A", email: "not-an-email" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].path).toEqual(["email"]);
  });

  it.each([
    ["+1 (555) 010-2000", "+1 (555) 010-2000"],
    ["  555.010.2000  ", "555.010.2000"],
    ["+44 20  7946 0958", "+44 20 7946 0958"],
    ["555-010-2000 ext. 12", "555-010-2000 ext. 12"],
  ])("accepts phone %j", (input, expected) => {
    expect(quickAddSchema.parse({ ...ids, name: "A", phone: input }).phone).toBe(expected);
  });

  it.each(["12345", "call me maybe", "555-0100; drop table", "1".repeat(21)])(
    "rejects phone %j",
    (phone) => {
      const r = quickAddSchema.safeParse({ ...ids, name: "A", phone });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toEqual(["phone"]);
    },
  );

  it("keeps free-form other contact info and nulls blanks", () => {
    expect(quickAddSchema.parse({ ...ids, name: "A", otherContact: " @ada on Discord " }).otherContact).toBe(
      "@ada on Discord",
    );
    const r = quickAddSchema.parse({ ...ids, name: "A", phone: " ", otherContact: "" });
    expect(r.phone).toBeNull();
    expect(r.otherContact).toBeNull();
  });

  it("requires client-generated UUIDs (idempotency keys)", () => {
    expect(quickAddSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(
      quickAddSchema.safeParse({ contactId: "nope", interactionId: uuid(2), name: "A" }).success,
    ).toBe(false);
  });

  it("treats an empty event id as no event, and rejects a malformed one", () => {
    expect(quickAddSchema.parse({ ...ids, name: "A", eventId: "" }).eventId).toBeNull();
    expect(quickAddSchema.safeParse({ ...ids, name: "A", eventId: "x" }).success).toBe(false);
  });
});

describe("normalizeLinkedIn", () => {
  it.each([
    ["https://www.linkedin.com/in/ada-l/", "https://www.linkedin.com/in/ada-l"],
    ["linkedin.com/in/ada-l", "https://www.linkedin.com/in/ada-l"],
    ["http://linkedin.com/in/ada-l?trk=x", "https://www.linkedin.com/in/ada-l"],
    ["in/ada-l", "https://www.linkedin.com/in/ada-l"],
    ["ada-l", "https://www.linkedin.com/in/ada-l"],
    ["@ada-l", "https://www.linkedin.com/in/ada-l"],
    ["https://de.linkedin.com/in/ada-l", "https://www.linkedin.com/in/ada-l"],
    ["https://www.linkedin.com/company/acme", "https://www.linkedin.com/company/acme"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeLinkedIn(input)).toBe(expected);
  });

  it.each(["https://evil.com/in/ada", "javascript:alert(1)", "https://linkedin.com.evil.com/in/x"])(
    "rejects non-LinkedIn URL %s",
    (input) => {
      expect(normalizeLinkedIn(input)).toBeNull();
    },
  );

  it("surfaces a field error via the schema", () => {
    const r = quickAddSchema.safeParse({ ...ids, name: "A", linkedinUrl: "https://evil.com/x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["linkedinUrl"]);
  });
});

describe("contactUpdateSchema", () => {
  const base = {
    name: "Ada",
    company: "",
    jobTitle: "",
    email: "",
    linkedinUrl: "",
    whereMet: "",
    firstMetOn: null,
    categoryIds: ["00000000-0000-4000-8000-000000000040"],
    relationshipStrength: "new" as const,
    generalNotes: "",
    nextFollowUpOn: "",
    nextAction: "",
    tags: [],
  };

  it("accepts a valid follow-up date and maps to DB columns", () => {
    const d = contactUpdateSchema.parse({ ...base, nextFollowUpOn: "2026-12-01", nextAction: " Send resume " });
    const cols = toContactColumns(d);
    expect(cols.next_follow_up_on).toBe("2026-12-01");
    expect(cols.next_action).toBe("Send resume");
    expect("category_id" in cols).toBe(false); // categories are saved separately
    expect("first_met_at" in cols).toBe(false); // untouched unless changed
  });

  it("clears the follow-up when the date is blank", () => {
    expect(toContactColumns(contactUpdateSchema.parse(base)).next_follow_up_on).toBeNull();
  });

  it.each(["2026-13-01", "12/01/2026", "tomorrow"])("rejects malformed follow-up date %s", (d) => {
    expect(contactUpdateSchema.safeParse({ ...base, nextFollowUpOn: d }).success).toBe(false);
  });

  it("dedupes categories and defaults to none", () => {
    const id = "00000000-0000-4000-8000-000000000040";
    expect(contactUpdateSchema.parse({ ...base, categoryIds: [id, id] }).categoryIds).toEqual([id]);
    const { categoryIds: _omit, ...rest } = base;
    void _omit;
    expect(contactUpdateSchema.parse(rest).categoryIds).toEqual([]);
  });

  it("rejects non-UUID categories and unknown strengths", () => {
    expect(contactUpdateSchema.safeParse({ ...base, categoryIds: ["boss"] }).success).toBe(false);
    expect(contactUpdateSchema.safeParse({ ...base, relationshipStrength: "best" }).success).toBe(false);
  });

  it("clears the first-met date when it's emptied, and rejects bad dates", () => {
    expect(toContactColumns(contactUpdateSchema.parse({ ...base, firstMetOn: "" })).first_met_at).toBeNull();
    expect(contactUpdateSchema.safeParse({ ...base, firstMetOn: "2026-02-31" }).success).toBe(false);
  });

  it("stores a changed first-met date at midday UTC to avoid timezone day shifts", () => {
    const cols = toContactColumns(contactUpdateSchema.parse({ ...base, firstMetOn: "2026-09-15" }));
    expect(cols.first_met_at).toBe("2026-09-15T12:00:00Z");
  });

  it("dedupes tags case-insensitively and caps the count", () => {
    expect(dedupeTags(["ML", "ml", " Boston ", "boston", "AI  research"])).toEqual([
      "ML",
      "Boston",
      "AI research",
    ]);
    const many = Array.from({ length: 31 }, (_, i) => `t${i}`);
    expect(contactUpdateSchema.safeParse({ ...base, tags: many }).success).toBe(false);
  });
});

describe("interactionSchema", () => {
  it("defaults the type to in-person and the date to now", () => {
    const r = interactionSchema.parse({ id: uuid(5), contactId: uuid(1) });
    expect(r.interactionType).toBe("in_person");
    expect(Math.abs(Date.parse(r.occurredAt) - Date.now())).toBeLessThan(5000);
  });

  it("requires a contact id", () => {
    expect(interactionSchema.safeParse({ id: uuid(5) }).success).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(
      interactionSchema.safeParse({ id: uuid(5), contactId: uuid(1), occurredAt: "garbage" }).success,
    ).toBe(false);
  });
});

describe("eventSchema", () => {
  it("requires name and date", () => {
    expect(eventSchema.safeParse({ name: "", eventDate: "2026-10-01" }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "Fair", eventDate: "" }).success).toBe(false);
    expect(eventSchema.parse({ name: " Fair ", eventDate: "2026-10-01" }).name).toBe("Fair");
  });
});

describe("isIsoDate", () => {
  it("rejects impossible calendar dates", () => {
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
});
