import { describe, expect, it } from "vitest";
import { deleteContact, quickAddContact, updateContact } from "@/lib/services/contacts";
import { addInteraction } from "@/lib/services/interactions";
import { completeFollowUp, rescheduleFollowUp } from "@/lib/services/follow-ups";
import { createEvent } from "@/lib/services/events";
import { createFakeSupabase, USER_A, uuid } from "./helpers/fake-supabase";

const ids = { contactId: uuid(1), interactionId: uuid(2) };

describe("quickAddContact", () => {
  it("never calls the database when validation fails", async () => {
    const fake = createFakeSupabase({});
    const r = await quickAddContact({ supabase: fake.client, userId: USER_A }, { ...ids, name: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.name).toBeDefined();
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("creates contact + first interaction atomically via the idempotent RPC", async () => {
    const fake = createFakeSupabase({
      rpc: { quick_add_contact: { data: [{ contact_id: ids.contactId, created: true }] } },
    });
    const r = await quickAddContact(
      { supabase: fake.client, userId: USER_A },
      { ...ids, name: "Grace Hopper", notes: "Navy, COBOL", eventId: uuid(9), whereMet: "Fair" },
    );
    expect(r).toEqual({ ok: true, data: { contactId: ids.contactId, created: true } });
    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0].fn).toBe("quick_add_contact");
    expect(fake.rpcCalls[0].args).toMatchObject({
      p_contact_id: ids.contactId,
      p_interaction_id: ids.interactionId,
      p_name: "Grace Hopper",
      p_notes: "Navy, COBOL",
      p_event_id: uuid(9),
      p_where_met: "Fair",
      p_company: null,
    });
  });

  it("reports duplicate submissions as not-created instead of creating twice", async () => {
    const fake = createFakeSupabase({
      rpc: { quick_add_contact: { data: [{ contact_id: ids.contactId, created: false }] } },
    });
    const r = await quickAddContact({ supabase: fake.client, userId: USER_A }, { ...ids, name: "Grace" });
    expect(r.ok && r.data.created).toBe(false);
  });

  it("maps a foreign-key failure (missing/foreign event) to a helpful error", async () => {
    const fake = createFakeSupabase({ rpc: { quick_add_contact: { error: { code: "23503" } } } });
    const r = await quickAddContact(
      { supabase: fake.client, userId: USER_A },
      { ...ids, name: "Grace", eventId: uuid(9) },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/event/i);
  });
});

describe("addInteraction", () => {
  const input = { id: uuid(50), contactId: uuid(1), notes: "Coffee", interactionType: "coffee_chat" as const };

  it("inserts a new row tied to the contact and the signed-in user", async () => {
    const fake = createFakeSupabase({ from: { interactions: { error: null } } });
    const r = await addInteraction({ supabase: fake.client, userId: USER_A }, input);
    expect(r).toMatchObject({ ok: true, data: { contactId: uuid(1), created: true } });
    const insert = fake.calls[0].ops.find((o) => o.op === "insert");
    expect(insert?.args[0]).toMatchObject({
      id: uuid(50),
      user_id: USER_A,
      contact_id: uuid(1),
      interaction_type: "coffee_chat",
      notes: "Coffee",
    });
    // Appending history never issues an UPDATE on existing interactions.
    expect(fake.calls[0].ops.some((o) => o.op === "update")).toBe(false);
  });

  it("treats a duplicate id (double tap / retry) as success without a second row", async () => {
    const fake = createFakeSupabase({ from: { interactions: { error: { code: "23505" } } } });
    const r = await addInteraction({ supabase: fake.client, userId: USER_A }, input);
    expect(r).toMatchObject({ ok: true, data: { created: false } });
  });

  it("refuses to link to a contact the user doesn't own (composite FK error)", async () => {
    const fake = createFakeSupabase({ from: { interactions: { error: { code: "23503" } } } });
    const r = await addInteraction({ supabase: fake.client, userId: USER_A }, input);
    expect(r.ok).toBe(false);
  });

  it("rejects input without a contact id", async () => {
    const fake = createFakeSupabase({});
    const r = await addInteraction({ supabase: fake.client, userId: USER_A }, { id: uuid(50) } as never);
    expect(r.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("updateContact / deleteContact ownership", () => {
  const base = {
    name: "Ada",
    categoryId: uuid(40),
    relationshipStrength: "established" as const,
    nextFollowUpOn: "2026-12-01",
    tags: ["ML"],
  };

  it("scopes updates to the user's own row and reports not-found otherwise", async () => {
    const fake = createFakeSupabase({ from: { contacts: { data: null } } });
    const r = await updateContact({ supabase: fake.client, userId: USER_A }, uuid(1), base as never);
    expect(r).toEqual({ ok: false, error: "Contact not found." });
    const eqs = fake.calls[0].ops.filter((o) => o.op === "eq").map((o) => o.args);
    expect(eqs).toContainEqual(["id", uuid(1)]);
    expect(eqs).toContainEqual(["user_id", USER_A]);
  });

  it("updates fields then syncs tags", async () => {
    const fake = createFakeSupabase({
      from: {
        contacts: { data: { id: uuid(1) } },
        tags: [{ data: [] }, { data: [{ id: uuid(30), name: "ML" }] }],
        contact_tags: { error: null },
      },
    });
    const r = await updateContact({ supabase: fake.client, userId: USER_A }, uuid(1), base as never);
    expect(r.ok).toBe(true);
    const update = fake.calls[0].ops.find((o) => o.op === "update");
    expect(update?.args[0]).toMatchObject({ next_follow_up_on: "2026-12-01", relationship_strength: "established" });
    const linkInsert = fake.calls
      .filter((c) => c.table === "contact_tags")
      .flatMap((c) => c.ops)
      .find((o) => o.op === "insert");
    expect(linkInsert?.args[0]).toEqual([{ contact_id: uuid(1), tag_id: uuid(30), user_id: USER_A }]);
  });

  it("rejects a non-UUID id before touching the database", async () => {
    const fake = createFakeSupabase({});
    expect((await deleteContact({ supabase: fake.client, userId: USER_A }, "1 or 1=1")).ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("reports not-found when RLS hides the row", async () => {
    const fake = createFakeSupabase({ from: { contacts: { data: [] } } });
    expect(await deleteContact({ supabase: fake.client, userId: USER_A }, uuid(1))).toEqual({
      ok: false,
      error: "Contact not found.",
    });
  });
});

describe("follow-ups", () => {
  it("completing clears the date and next action", async () => {
    const fake = createFakeSupabase({ from: { contacts: { data: { id: uuid(1) } } } });
    const r = await completeFollowUp({ supabase: fake.client, userId: USER_A }, { contactId: uuid(1) });
    expect(r.ok).toBe(true);
    expect(fake.calls[0].ops.find((o) => o.op === "update")?.args[0]).toEqual({
      next_follow_up_on: null,
      next_action: null,
    });
  });

  it("rescheduling sets a new date and leaves next action alone unless provided", async () => {
    const fake = createFakeSupabase({ from: { contacts: { data: { id: uuid(1) } } } });
    await rescheduleFollowUp({ supabase: fake.client, userId: USER_A }, { contactId: uuid(1), date: "2026-11-14" });
    expect(fake.calls[0].ops.find((o) => o.op === "update")?.args[0]).toEqual({
      next_follow_up_on: "2026-11-14",
    });
  });

  it("rejects invalid reschedule dates", async () => {
    const fake = createFakeSupabase({});
    const r = await rescheduleFollowUp(
      { supabase: fake.client, userId: USER_A },
      { contactId: uuid(1), date: "next tuesday" },
    );
    expect(r.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("events", () => {
  it("creates events owned by the current user", async () => {
    const fake = createFakeSupabase({ from: { events: { data: { id: uuid(9), name: "Fair" } } } });
    const r = await createEvent(
      { supabase: fake.client, userId: USER_A },
      { name: "Fair", eventDate: "2026-11-07", location: null, description: null },
    );
    expect(r.ok).toBe(true);
    expect(fake.calls[0].ops.find((o) => o.op === "insert")?.args[0]).toMatchObject({
      user_id: USER_A,
      name: "Fair",
      event_date: "2026-11-07",
    });
  });
});
