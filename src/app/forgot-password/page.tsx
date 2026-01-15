"use client";

import * as React from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@/lib/validations/auth";

interface FieldErrors {
  email?: string[];
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const validationResult = forgotPasswordSchema.safeParse({ email });

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({ email: errors.email });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details) {
          setFieldErrors(result.details);
        } else {
          setError(result.error || "An error occurred");
        }
        return;
      }

      setIsSuccess(true);
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Check your email
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              If an account with that email exists, we&apos;ve sent a password reset
              link. Check your inbox and spam folder.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Forgot your password?
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Enter your email address and we&apos;ll send you a link to reset your
            password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium leading-none text-neutral-900 dark:text-neutral-100"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300 ${
                fieldErrors.email
                  ? "border-red-500 dark:border-red-500"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            />
            {fieldErrors.email && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 ring-offset-white transition-colors hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:ring-offset-neutral-950 dark:hover:bg-neutral-50/90 dark:focus-visible:ring-neutral-300"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
