"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { LoginState } from "@/app/login/login-types";

export async function loginAdminWithCredentials(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your email address and password." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (signInError) {
    if (signInError.code === "invalid_credentials" || signInError.code === "email_not_confirmed") {
      return { error: "That email and password combination doesn't look right." };
    }

    console.error("Administrator sign-in failed:", signInError.message);
    return { error: "We couldn't sign you in. Please try again." };
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_store_admin");
  if (roleError) {
    console.error("Could not verify administrator access after sign-in:", roleError.message);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error("Could not clear the unverified administrator session:", signOutError.message);
    return { error: "We couldn't verify administrator access. Please try again later." };
  }

  if (isAdmin !== true) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error("Could not clear the non-administrator session:", signOutError.message);
    return { error: "This account is not authorized for administrator access." };
  }

  redirect("/admin");
}
