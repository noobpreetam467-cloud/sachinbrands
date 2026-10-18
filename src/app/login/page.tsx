import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createReadOnlyClient } from "@/utils/supabase/server";
import { safeInternalPath } from "@/utils/safe-internal-path";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your customer account.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeInternalPath(params.callbackUrl);
  const supabase = await createReadOnlyClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect(callbackUrl);
  }

  const { error } = params;
  const authError =
    error === "google"
      ? "Google sign-in is unavailable. Check that Google is enabled in Supabase Auth."
      : error
        ? "We couldn't complete sign-in. Please try again or use your email and password."
        : null;

  return <LoginForm authError={authError} callbackUrl={callbackUrl} />;
}
