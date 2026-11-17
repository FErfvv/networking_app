import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signUpAction } from "@/lib/actions/auth";
import { hasSupabaseEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUpAction} configured={hasSupabaseEnv()} />;
}
