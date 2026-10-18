import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/storefront/page-heading";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { updatePassword } from "@/app/account/actions";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <StorefrontLayout active="profile">
      <PageHeading eyebrow="Account security" title="Choose a new password" description="Use a password of at least 10 characters. This form requires the verified Supabase password-reset session." />
      <section className="sb-order-detail-card sb-password-reset">
        {error && <p className="profile-form-message is-error" role="alert">{error === "password" ? "Password must be between 10 and 128 characters." : "The password could not be updated. Request a fresh reset email and try again."}</p>}
        <form action={updatePassword} className="profile-edit-form">
          <label htmlFor="new-password">New password</label>
          <input autoComplete="new-password" id="new-password" maxLength={128} minLength={10} name="password" required type="password" />
          <button className="sb-button sb-button-primary" type="submit">Update password</button>
        </form>
        <Link href="/account?section=security">Back to security settings</Link>
      </section>
    </StorefrontLayout>
  );
}
