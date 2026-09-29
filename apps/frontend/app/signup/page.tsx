"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, UserPlus } from "lucide-react";
import { registerAccount, setSession } from "../auth";

export default function SignUpPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (!/^[^\s@]+@(std\.)?kyu\.ac\.ug$/.test(email)) {
      setSubmitted(false);
      setError("Use a valid KYU email ending in @std.kyu.ac.ug or @kyu.ac.ug.");
      return;
    }

    const account = {
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email,
      password: String(formData.get("password") || ""),
      role: "student" as const,
      studentId: `STU-${Date.now().toString().slice(-6)}`,
    };

    try {
      const registeredAccount = await registerAccount(account);
      setSession(registeredAccount);
      setError("");
      setSubmitted(true);
      window.setTimeout(() => router.push("/student"), 350);
    } catch (registrationError) {
      if (registrationError instanceof TypeError) {
        setError("The account service is unavailable. Start the backend and try again.");
      } else {
        setError(registrationError instanceof Error ? registrationError.message : "Registration failed.");
      }
      setSubmitted(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual signup-visual">
        <Link href="/" className="auth-brand"><span className="auth-mark">U</span><span><b>UniAlert</b><small>Campus Safety &amp; Property Recovery</small></span></Link>
        <div className="auth-visual-copy">
          <span className="auth-eyebrow"><ShieldCheck size={14} /> Verified campus identity</span>
          <h1>One account for every recovery workflow.</h1>
          <p>Create your verified profile to report found property, track claims, and receive location-aware campus safety notices.</p>
        </div>
        <div className="auth-visual-footer"><span><Check size={13} /> SSO ready</span><span><Check size={13} /> Private by design</span><span><Check size={13} /> Fast recovery</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card signup-card">
          <div className="auth-card-heading"><span className="auth-card-icon"><UserPlus size={17} /></span><span><b>New campus profile</b><small>Registration</small></span></div>
          <h2>Create your account</h2>
          <p className="auth-intro">Register with your university identity to access protected recovery records.</p>
          {submitted && <div className="auth-success">Account created. Opening your dashboard...</div>}
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-two-column"><label>First name<input name="firstName" required placeholder="Maya" /></label><label>Last name<input name="lastName" required placeholder="Chen" /></label></div>
            <label>University email<input name="email" type="email" required pattern="^[^\s@]+@(std\.)?kyu\.ac\.ug$" title="Use an email ending in @std.kyu.ac.ug or @kyu.ac.ug" placeholder="name@std.kyu.ac.ug / name@kyu.ac.ug" /></label>
            <label>Password<input name="password" type="password" required minLength={8} placeholder="At least 8 characters e.g user@123" /></label>
            <label className="auth-checkbox terms"><input type="checkbox" required /> I agree to the campus privacy and property recovery terms.</label>
            <button type="submit" className="auth-submit">Create account <ArrowRight size={15} /></button>
          </form>
          <p className="auth-switch">Already registered? <Link href="/signin">Sign in</Link></p>
          <Link href="/" className="auth-back">Back to public portal</Link>
        </div>
      </section>
    </main>
  );
}
