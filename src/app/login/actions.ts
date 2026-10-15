"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import type { LoginState } from "./login-types";

export async function loginWithCredentials(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/account",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "That email and password combination doesn't look right." };
      }

      console.error("Sign-in failed:", error.type);
      return { error: "We couldn't sign you in. Please try again." };
    }

    throw error;
  }

  return { error: null };
}

export async function loginWithGoogle() {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    redirect("/login?error=google_not_configured");
  }

  await signIn("google", { redirectTo: "/account" });
}
