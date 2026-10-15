import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your customer account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/account");
  }

  const { error } = await searchParams;
  const authError =
    error === "google_not_configured"
      ? "Google sign-in is not set up yet. Add the Google OAuth credentials to your environment."
      : error
        ? "We couldn't complete sign-in. Please try again or use your email and password."
        : null;

  return <LoginForm authError={authError} />;
}
