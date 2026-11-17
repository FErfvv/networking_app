"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validation/auth";
import { fieldErrorsOf } from "@/lib/validation/fields";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  email?: string;
};

/** Only allow same-origin relative redirects after login. */
function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg =
      error.code === "email_not_confirmed"
        ? "Please confirm your email first — check your inbox."
        : "Incorrect email or password.";
    return { error: msg, email };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), email };

  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    return {
      error:
        error.code === "weak_password"
          ? "That password is too weak. Try a longer one."
          : error.message || "Could not create account.",
      email,
    };
  }
  if (data.session) redirect("/");
  return {
    message: "Check your email to confirm your account, then sign in.",
    email,
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
