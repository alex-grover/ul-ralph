"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordSchema } from "@/lib/validations/auth";

interface FieldErrors {
  token?: string[];
  password?: string[];
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const validationResult = resetPasswordSchema.safeParse({ token, password });

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({ token: errors.token, password: errors.password });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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
      setError("Failed to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Invalid reset link
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              This password reset link is invalid or has expired. Please request a
              new one.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Password reset successful
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Your password has been reset. You can now sign in with your new
              password.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 ring-offset-white transition-colors hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 dark:bg-neutral-50 dark:text-neutral-900 dark:ring-offset-neutral-950 dark:hover:bg-neutral-50/90 dark:focus-visible:ring-neutral-300"
            >
              Go to sign in
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
            Reset your password
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          {fieldErrors.token && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {fieldErrors.token[0]}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none text-neutral-900 dark:text-neutral-100"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={isSubmitting}
              className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300 ${
                fieldErrors.password
                  ? "border-red-500 dark:border-red-500"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            />
            {fieldErrors.password && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.password[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium leading-none text-neutral-900 dark:text-neutral-100"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 ring-offset-white transition-colors hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:ring-offset-neutral-950 dark:hover:bg-neutral-50/90 dark:focus-visible:ring-neutral-300"
          >
            {isSubmitting ? "Resetting..." : "Reset password"}
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
