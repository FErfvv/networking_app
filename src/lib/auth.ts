import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type AuthedContext = {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
};

/**
 * Data Access Layer entry point. Verifies the session JWT (getClaims validates
 * the signature) and returns a user-scoped Supabase client. Returns null when
 * signed out so callers can decide between redirecting and returning an error.
 */
export async function getAuthedContext(): Promise<AuthedContext | null> {
  // getClaims() checks the JWT's expiry against Date.now(). With Cache
  // Components + partial prefetching, cookies() alone can resolve during a
  // prerender, so explicitly wait for a real request before reading the clock.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId: sub, email };
}

/** For Server Components / Route Handlers: redirect to /login when signed out. */
export async function requireUser(): Promise<AuthedContext> {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  return ctx;
}
