import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Server Action auth wrapper -------------------------------------------
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const getAuthedContext = vi.fn();
vi.mock("@/lib/auth", () => ({ getAuthedContext: () => getAuthedContext() }));

// --- Proxy: mock Supabase session lookup -----------------------------------
const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { SESSION_EXPIRED, withAuth } from "@/lib/actions/with-auth";
import { isPublicPath, updateSession } from "@/lib/supabase/proxy";

describe("withAuth (every Server Action goes through this)", () => {
  beforeEach(() => {
    getAuthedContext.mockReset();
    vi.mocked(revalidatePath).mockClear();
  });

  it("rejects unauthenticated calls without running the service", async () => {
    getAuthedContext.mockResolvedValue(null);
    const service = vi.fn();
    const r = await withAuth(service);
    expect(r).toEqual({ ok: false, error: SESSION_EXPIRED });
    expect(service).not.toHaveBeenCalled();
  });

  it("passes the verified user id (never a client-supplied one) to the service", async () => {
    getAuthedContext.mockResolvedValue({ supabase: {}, userId: "verified-user", email: null });
    const service = vi.fn().mockResolvedValue({ ok: true, data: 1 });
    await withAuth(service);
    expect(service).toHaveBeenCalledWith({ supabase: {}, userId: "verified-user" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not revalidate on failure and hides unexpected errors", async () => {
    getAuthedContext.mockResolvedValue({ supabase: {}, userId: "u", email: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await withAuth(() => Promise.reject(new Error("db exploded: secret detail")));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("proxy route protection", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    getClaims.mockReset();
  });

  it("classifies public paths", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/people")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });

  it("redirects signed-out users from app pages to /login with ?next", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const res = await updateSession(new NextRequest("http://localhost/people/abc"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/people/abc");
  });

  it("lets signed-in users through and bounces them away from /login", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const ok = await updateSession(new NextRequest("http://localhost/people"));
    expect(ok.headers.get("location")).toBeNull();
    const bounce = await updateSession(new NextRequest("http://localhost/login"));
    expect(new URL(bounce.headers.get("location")!).pathname).toBe("/");
  });

  it("returns 401 JSON (not a redirect) for API routes when signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const res = await updateSession(new NextRequest("http://localhost/api/export/contacts.csv"));
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows public pages when signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const res = await updateSession(new NextRequest("http://localhost/signup"));
    expect(res.headers.get("location")).toBeNull();
  });
});
