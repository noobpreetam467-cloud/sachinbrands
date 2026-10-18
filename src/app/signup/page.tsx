import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";
import { createReadOnlyClient } from "@/utils/supabase/server";
import { signUpWithEmail } from "./actions";

export const metadata: Metadata = { title: "Create your account" };

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const supabase = await createReadOnlyClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/account");
  const params = await searchParams;
  const message =
    params.created === "true"
      ? "If email confirmation is enabled, check your inbox to finish creating your account."
      : params.error === "exists"
        ? "An account with this email already exists. Try signing in."
        : params.error === "invalid"
          ? "Enter a name and email, and choose a password with at least 8 characters."
          : params.error
            ? "We couldn't create the account. Please try again."
            : null;

  return (
    <main className="auth-page">
      <header className="auth-header"><Link aria-label={`${SITE_NAME} home`} className="auth-brand" href="/"><Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} /><span>{SITE_NAME}</span></Link><Link className="auth-header-link" href="/">Back to store <span aria-hidden="true">↗</span></Link></header>
      <section className="sb-auth-prototype">
        <span className="sb-eyebrow">JOIN SACHIN BRANDS</span><h1>Create your account</h1><p>Set up a customer account with Supabase Auth.</p>
        {message && <p className={`profile-form-message${params.error ? " is-error" : ""}`} role={params.error ? "alert" : "status"}>{message}</p>}
        {params.created !== "true" && (
          <form action={signUpWithEmail} className="profile-edit-form">
            <label htmlFor="signup-name">Full name</label><input autoComplete="name" id="signup-name" maxLength={100} minLength={2} name="name" required />
            <label htmlFor="signup-email">Email address</label><input autoComplete="email" id="signup-email" name="email" required type="email" />
            <label htmlFor="signup-password">Password</label><input autoComplete="new-password" id="signup-password" minLength={8} name="password" required type="password" />
            <button type="submit">Create account</button>
          </form>
        )}
        <p className="sb-auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
