"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { safeInternalPath } from "@/utils/safe-internal-path";
import type { LoginState } from "./login-types";

function getCallbackPath(value: FormDataEntryValue | null) {
  return safeInternalPath(typeof value === "string" ? value : null);
}

export async function loginWithCredentials(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackPath = getCallbackPath(formData.get("callbackUrl"));
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    if (error.code === "invalid_credentials" || error.code === "email_not_confirmed") {
      return { error: "That email and password combination doesn't look right." };
    }

    console.error("Supabase sign-in failed:", error.message);
    return { error: "We couldn't sign you in. Please try again." };
  }

  redirect(callbackPath);
}

export async function loginWithGoogle(formData: FormData) {
  const callbackPath = getCallbackPath(formData.get("callbackUrl"));
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Could not determine the application host for OAuth.");
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${protocol}://${host}/auth/callback?next=${encodeURIComponent(callbackPath)}` },
  });

  if (error) {
    console.error("Supabase Google sign-in failed:", error.message);
    redirect("/login?error=google");
  }

  redirect(data.url);
}
