"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { dashboardPath, loginAccount, setSession } from "../auth";

export default function SignInPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetSubmitted, setResetSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    if (!/^[^\s@]+@(std\.)?kyu\.ac\.ug$/.test(email)) {
      setSubmitted(false);
      setError("Use a valid KYU email ending in @std.kyu.ac.ug or @kyu.ac.ug.");
      return;
    }
    try {
      const account = await loginAccount(email, password);
      setError("");
      setSession(account);
      setSubmitted(true);
      window.setTimeout(() => router.push(dashboardPath(account.role)), 350);
    } catch (loginError) {
      if (loginError instanceof TypeError) {
        setError("The account service is unavailable. Start the backend and try again.");
      } else {
        setError(loginError instanceof Error ? loginError.message : "Sign-in failed.");
      }
      setSubmitted(false);
    }
  }

  function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetSubmitted(true);
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link href="/" className="auth-brand"><span className="auth-mark">U</span><span><b>UniAlert</b><small>Campus Safety &amp; Property Recovery</small></span></Link>
        <div className="auth-visual-copy">
          <span className="auth-eyebrow"><ShieldCheck size={14} /> Trusted campus access</span>
          <h1>Return to a safer campus.</h1>
          <p>Sign in to report property, review matches, receive alerts, and manage your verified campus account.</p>
        </div>
        <div className="auth-visual-footer"><span>SSO protected</span><span>FERPA aligned</span><span>24/7 dispatch</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {forgotOpen ? (
            <>
              <div className="auth-card-heading"><span className="auth-card-icon"><Mail size={17} /></span><span><b>Password recovery</b><small>Reset your secure access</small></span></div>
              <h2>Forgot password?</h2>
              <p className="auth-intro">Enter your university email and we will send instructions to reset your UniAlert password.</p>
              {resetSubmitted && <div className="auth-success">If an account exists for that email, reset instructions are on the way.</div>}
              {!resetSubmitted ? (
                <form onSubmit={handleResetSubmit} className="auth-form">
                  <label>University email<input type="email" required placeholder="name@std.kyu.ac.ug / name@kyu.ac.ug" /></label>
                  <button type="submit" className="auth-submit">Send reset instructions <ArrowRight size={15} /></button>
                </form>
              ) : null}
              <button type="button" className="auth-back-button" onClick={() => { setForgotOpen(false); setResetSubmitted(false); }}><ArrowLeft size={14} /> Back to sign in</button>
            </>
          ) : (
            <>
              <div className="auth-card-heading"><span className="auth-card-icon"><LockKeyhole size={17} /></span><span><b>Campus account</b><small>Secure sign in</small></span></div>
              <h2>Welcome back</h2>
              <p className="auth-intro">Use your university credentials to continue to UniAlert.</p>
              {submitted && <div className="auth-success">Sign-in successful. Opening your dashboard...</div>}
              {error && <div className="auth-error">{error}</div>}
              <form onSubmit={handleSubmit} className="auth-form">
                <label>University email<input name="email" type="email" required pattern="^[^\s@]+@(std\.)?kyu\.ac\.ug$" title="Use an email ending in @std.kyu.ac.ug or @kyu.ac.ug" placeholder="name@std.kyu.ac.ug / name@kyu.ac.ug" /></label>
                <label>Password<input name="password" type="password" required minLength={8} placeholder="Enter your password" /></label>
                <div className="auth-form-row"><label className="auth-checkbox"><input type="checkbox" /> Keep me signed in</label><button type="button" className="auth-link-button" onClick={() => setForgotOpen(true)}>Forgot password?</button></div>
                <button type="submit" className="auth-submit">Sign in <ArrowRight size={15} /></button>
              </form>
            </>
          )}
          <div className="auth-divider"><span>or</span></div>
          <p className="auth-switch">New to UniAlert? <Link href="/signup">Create an account</Link></p>
          <Link href="/" className="auth-back">Back to public portal</Link>
        </div>
      </section>
    </main>
  );
}
