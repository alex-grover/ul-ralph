"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AuthButtonsProps {
  user: {
    id: string;
    username: string;
    email: string;
  } | null;
}

export function AuthButtons({ user }: AuthButtonsProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
      });
      router.push("/");
      router.refresh();
    } catch {
      // Silently fail and refresh anyway
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.username}
        </span>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {isSigningOut ? "..." : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/signin"
        className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Sign up
      </Link>
    </div>
  );
}
