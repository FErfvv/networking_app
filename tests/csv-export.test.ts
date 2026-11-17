import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "@/lib/csv";
import { backupJson, contactsCsv, interactionsCsv, type ExportData } from "@/lib/data/export";
import { USER_A, uuid } from "./helpers/fake-supabase";

describe("escapeCsvField", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null/undefined as empty and joins arrays", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
    expect(escapeCsvField(["a", "b"])).toBe("a; b");
  });

  it.each(["=SUM(A1)", "+1", "-2+3", "@cmd"])("neutralizes formula injection in %s", (v) => {
    expect(escapeCsvField(v).replace(/^"/, "")).toMatch(/^'/);
  });

  it("does not alter numbers", () => {
    expect(escapeCsvField(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("writes BOM, header and CRLF rows", () => {
    const csv = toCsv([{ a: "1", b: "x,y" }], [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
    ]);
    expect(csv).toBe('﻿A,B\r\n1,"x,y"\r\n');
  });
});

const data: ExportData = {
  events: [
    {
      id: uuid(10),
      user_id: USER_A,
      name: "Career Fair",
      event_date: "2026-10-01",
      location: "Gym",
      description: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
  ],
  tags: [{ id: uuid(20), user_id: USER_A, name: "ML", created_at: "2026-10-01T00:00:00Z" }],
  categories: [
    { id: uuid(40), user_id: USER_A, name: "Student / Peer", color: "teal", created_at: "2026-10-01T00:00:00Z" },
  ],
  contacts: [
    {
      id: uuid(1),
      user_id: USER_A,
      name: "Ada, Countess",
      company: "Analytical",
      job_title: "Engineer",
      email: "ada@example.com",
      phone: "+1 (555) 010-2000",
      other_contact: null,
      linkedin_url: null,
      categories: [
        { id: uuid(40), name: "Student / Peer", color: "teal" },
        { id: uuid(41), name: "Mentor", color: "rose" },
      ],
      category_ids: [uuid(40), uuid(41)],
      relationship_strength: "acquaintance",
      general_notes: "Likes math",
      where_met: "Career Fair",
      first_met_at: "2026-10-01T15:00:00Z",
      first_event_id: uuid(10),
      next_follow_up_on: "2026-11-10",
      next_action: "Email",
      created_at: "2026-10-01T15:00:00Z",
      updated_at: "2026-10-01T15:00:00Z",
      last_interaction_at: "2026-10-02T15:00:00Z",
      tag_names: ["ML"],
    },
  ],
  interactions: [
    {
      id: uuid(100),
      user_id: USER_A,
      contact_id: uuid(1),
      event_id: uuid(10),
      interaction_type: "in_person",
      notes: "Talked about engines",
      location: "Gym",
      occurred_at: "2026-10-01T15:00:00Z",
      created_at: "2026-10-01T15:00:00Z",
      updated_at: "2026-10-01T15:00:00Z",
    },
    {
      id: uuid(101),
      user_id: USER_A,
      contact_id: uuid(1),
      event_id: null,
      interaction_type: "email",
      notes: "Follow-up email",
      location: null,
      occurred_at: "2026-10-02T15:00:00Z",
      created_at: "2026-10-02T15:00:00Z",
      updated_at: "2026-10-02T15:00:00Z",
    },
  ],
};

describe("exports", () => {
  it("contacts CSV includes human-readable labels, tags and event name", () => {
    const csv = contactsCsv(data);
    const [header, row] = csv.replace("﻿", "").split("\r\n");
    expect(header.split(",")[0]).toBe("Name");
    expect(row).toContain('"Ada, Countess"');
    expect(row).toContain("Student / Peer; Mentor");
    expect(row).toContain("Acquaintance");
    expect(row).toContain("Career Fair");
    expect(row).toContain("2026-11-10");
    expect(row).not.toContain(USER_A); // never leak internal user ids
  });

  it("interactions CSV preserves every interaction with contact and event names", () => {
    const lines = interactionsCsv(data).replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Ada, Countess"');
    expect(lines[1]).toContain("In-person conversation");
    expect(lines[1]).toContain("Career Fair");
    expect(lines[2]).toContain("Email");
  });

  it("JSON backup nests interactions under contacts and strips user_id", () => {
    const json = JSON.parse(backupJson(data, new Date("2026-11-07T00:00:00Z")));
    expect(json.format).toBe("networking-crm-backup");
    expect(json.version).toBe(1);
    expect(json.contacts).toHaveLength(1);
    expect(json.contacts[0].interactions).toHaveLength(2);
    expect(json.tags).toEqual(["ML"]);
    expect(JSON.stringify(json)).not.toContain(USER_A);
  });
});
