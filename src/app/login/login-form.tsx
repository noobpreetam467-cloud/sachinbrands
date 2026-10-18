"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { SITE_LOGO_PATH, SITE_NAME, SITE_TAGLINE } from "@/config/site";
import { loginWithCredentials, loginWithGoogle } from "./actions";
import type { LoginState } from "./login-types";

const initialState: LoginState = { error: null };

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 48 48" width="18">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 2)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.75 7.18l7.73 6C44.42 38.05 46.98 31.88 46.98 24.55Z" transform="translate(0 -1)" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.2a23.97 23.97 0 0 0 0 21.58l7.98-6.2Z" transform="translate(0 2)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -2)" />
    </svg>
  );
}

export default function LoginForm({
  authError,
  callbackUrl,
}: {
  authError: string | null;
  callbackUrl: string;
}) {
  const [state, formAction, pending] = useActionState(
    loginWithCredentials,
    initialState,
  );
  const error = state.error ?? authError;

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link aria-label={`${SITE_NAME} home`} className="auth-brand" href="/">
          <Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} />
          <span>{SITE_NAME}</span>
        </Link>
        <Link className="auth-header-link" href="/">Back to store <span aria-hidden="true">↗</span></Link>
      </header>

      <div className="auth-layout">
        <section aria-labelledby="login-heading" className="auth-card">
          <div aria-hidden="true" className="auth-mark">
            <Image alt="" height={28} src={SITE_LOGO_PATH} width={28} />
          </div>
          <p className="auth-eyebrow">YOUR ACCOUNT</p>
          <h1 id="login-heading">Welcome back</h1>
          <p className="auth-intro">Sign in to see your orders and manage your account.</p>

          <form action={loginWithGoogle}>
            <input name="callbackUrl" type="hidden" value={callbackUrl} />
            <button className="auth-google-button" type="submit">
              <GoogleMark />
              Continue with Google
            </button>
          </form>

          <div aria-hidden="true" className="auth-divider"><span>or continue with email</span></div>

          <form action={formAction} className="auth-credentials-form">
            <input name="callbackUrl" type="hidden" value={callbackUrl} />
            <label htmlFor="login-email">Email address</label>
            <input
              autoComplete="email"
              id="login-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />

            <div className="auth-password-label">
              <label htmlFor="login-password">Password</label>
              <span>Use your account password</span>
            </div>
            <input
              autoComplete="current-password"
              id="login-password"
              name="password"
              placeholder="Enter your password"
              required
              type="password"
            />

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" disabled={pending} type="submit">
              {pending ? "Signing in..." : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-help">
            New to Sachin Brands? <Link href="/signup">Create an account</Link>
          </p>
          <p className="auth-admin-link">
            Store administrator? <Link href="/admin/login">Admin sign in</Link>
          </p>
        </section>

        <aside aria-label="About the store" className="auth-aside">
          <div aria-hidden="true" className="auth-artwork">
            <div className="auth-art-shape auth-art-shape-sage" />
            <div className="auth-art-shape auth-art-shape-clay" />
            <div className="auth-art-shape auth-art-shape-sand" />
            <div className="auth-art-sun" />
          </div>
          <div className="auth-aside-copy">
            <span className="auth-aside-label">A LITTLE MORE INTENTIONAL</span>
            <p>{SITE_TAGLINE}</p>
            <span className="auth-aside-note">Thoughtfully chosen, just for you.</span>
          </div>
        </aside>
      </div>
      <footer className="auth-footer">© {new Date().getFullYear()} {SITE_NAME} <span>·</span> Considered essentials for everyday living.</footer>
    </main>
  );
}
