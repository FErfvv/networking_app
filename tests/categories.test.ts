import { describe, expect, it } from "vitest";
import { createCategory, deleteCategory, updateCategory } from "@/lib/services/categories";
import { updateContact } from "@/lib/services/contacts";
import { categorySchema } from "@/lib/validation/category";
import { createFakeSupabase, USER_A, uuid } from "./helpers/fake-supabase";

const ctx = (fake: ReturnType<typeof createFakeSupabase>) => ({ supabase: fake.client, userId: USER_A });

describe("categorySchema", () => {
  it("trims and collapses whitespace", () => {
    expect(categorySchema.parse({ name: "  Hiring   manager ", color: "sky" }).name).toBe("Hiring manager");
  });

  it.each([
    [{ name: "   ", color: "sky" }],
    [{ name: "x".repeat(51), color: "sky" }],
    [{ name: "Ok", color: "chartreuse" }],
  ])("rejects %j", (input) => {
    expect(categorySchema.safeParse(input).success).toBe(false);
  });
});

describe("createCategory", () => {
  it("validates before touching the database", async () => {
    const fake = createFakeSupabase({});
    expect((await createCategory(ctx(fake), { name: "", color: "sky" })).ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("inserts for the current user", async () => {
    const fake = createFakeSupabase({
      from: {
        categories: [
          { data: null, count: 3 } as never,
          { data: { id: uuid(40), name: "Investor", color: "emerald" } },
        ],
      },
    });
    const r = await createCategory(ctx(fake), { name: " Investor ", color: "emerald" });
    expect(r).toEqual({ ok: true, data: { id: uuid(40), name: "Investor", color: "emerald" } });
    const insert = fake.calls[1].ops.find((o) => o.op === "insert");
    expect(insert?.args[0]).toEqual({ user_id: USER_A, name: "Investor", color: "emerald" });
  });

  it("enforces the per-user limit", async () => {
    const fake = createFakeSupabase({ from: { categories: { data: null, count: 50 } as never } });
    const r = await createCategory(ctx(fake), { name: "One more", color: "sky" });
    expect(r.ok).toBe(false);
    expect(fake.calls).toHaveLength(1); // count only, no insert
  });

  it("explains a duplicate name", async () => {
    const fake = createFakeSupabase({
      from: { categories: [{ data: null, count: 1 } as never, { error: { code: "23505" } }] },
    });
    const r = await createCategory(ctx(fake), { name: "Mentor", color: "rose" });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/already have/) });
  });
});

describe("updateCategory / deleteCategory", () => {
  it("scopes renames to the user's own row and reports not-found otherwise", async () => {
    const fake = createFakeSupabase({ from: { categories: { data: null } } });
    const r = await updateCategory(ctx(fake), uuid(40), { name: "Mentors", color: "rose" });
    expect(r).toEqual({ ok: false, error: "Category not found." });
    const eqs = fake.calls[0].ops.filter((o) => o.op === "eq").map((o) => o.args);
    expect(eqs).toContainEqual(["id", uuid(40)]);
    expect(eqs).toContainEqual(["user_id", USER_A]);
  });

  it("deletes the user's own category", async () => {
    const fake = createFakeSupabase({ from: { categories: { data: [{ id: uuid(40) }] } } });
    expect((await deleteCategory(ctx(fake), uuid(40))).ok).toBe(true);
    const eqs = fake.calls[0].ops.filter((o) => o.op === "eq").map((o) => o.args);
    expect(eqs).toContainEqual(["user_id", USER_A]);
  });

  it("rejects non-UUID ids before touching the database", async () => {
    const fake = createFakeSupabase({});
    expect((await deleteCategory(ctx(fake), "1 or 1=1")).ok).toBe(false);
    expect((await updateCategory(ctx(fake), "nope", { name: "X", color: "sky" })).ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("updateContact with a category", () => {
  it("reports a deleted category clearly", async () => {
    const fake = createFakeSupabase({ from: { contacts: { error: { code: "23503" } } } });
    const r = await updateContact(ctx(fake), uuid(1), {
      name: "Ada",
      categoryId: uuid(40),
      relationshipStrength: "new",
    });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/category no longer exists/) });
  });
});
