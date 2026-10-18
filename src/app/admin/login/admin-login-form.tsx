"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";
import { loginAdminWithCredentials } from "./actions";
import type { LoginState } from "@/app/login/login-types";

const initialState: LoginState = { error: null };

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAdminWithCredentials,
    initialState,
  );

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link aria-label={`${SITE_NAME} home`} className="auth-brand" href="/">
          <Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} />
          <span>{SITE_NAME}</span>
        </Link>
        <Link className="auth-header-link" href="/">Back to store <span aria-hidden="true">↗</span></Link>
      </header>

      <div className="auth-layout auth-layout-single">
        <section aria-labelledby="admin-login-heading" className="auth-card">
          <div aria-hidden="true" className="auth-mark">
            <Image alt="" height={28} src={SITE_LOGO_PATH} width={28} />
          </div>
          <p className="auth-eyebrow">STORE ADMINISTRATION</p>
          <h1 id="admin-login-heading">Admin sign in</h1>
          <p className="auth-intro">Sign in with the email and password for your provisioned administrator account.</p>

          <form action={formAction} className="auth-credentials-form">
            <label htmlFor="admin-login-email">Email address</label>
            <input
              autoComplete="username"
              id="admin-login-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />

            <div className="auth-password-label">
              <label htmlFor="admin-login-password">Password</label>
              <span>Administrator account</span>
            </div>
            <input
              autoComplete="current-password"
              id="admin-login-password"
              name="password"
              placeholder="Enter your password"
              required
              type="password"
            />

            {state.error && <p className="auth-error" role="alert">{state.error}</p>}

            <button className="auth-submit" disabled={pending} type="submit">
              {pending ? "Signing in..." : "Sign in to admin"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-help">
            Customer? <Link href="/login">Sign in to your account</Link>
          </p>
        </section>
      </div>

      <footer className="auth-footer">© {new Date().getFullYear()} {SITE_NAME}</footer>
    </main>
  );
}
