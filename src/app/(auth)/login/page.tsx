import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { signInAction } from "@/lib/actions/auth";
import { hasSupabaseEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthForm mode="login" action={signInAction} configured={hasSupabaseEnv()} />}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <>
      {error === "confirm" ? (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That confirmation link is invalid or expired. Try signing in, or sign up again.
        </p>
      ) : null}
      <AuthForm mode="login" action={signInAction} next={next} configured={hasSupabaseEnv()} />
    </>
  );
}
