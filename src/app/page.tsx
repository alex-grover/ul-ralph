import { redirect } from "next/navigation";
import { db } from "@/db";
import { lists } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getSessionUser,
  getAnonymousSession,
  getCurrentSession,
  getOrCreateAnonymousSession,
} from "@/lib/session";
import { generateSlug, makeSlugUnique } from "@/lib/slug";

async function createList() {
  "use server";

  // Get current session or create anonymous session
  let session = await getCurrentSession();

  if (!session) {
    const anonymousSession = await getOrCreateAnonymousSession();
    session = {
      type: "anonymous",
      anonymousSessionId: anonymousSession.id,
    };
  }

  // Determine user ownership
  const userId = session.type === "authenticated" ? session.userId : null;
  const anonymousSessionId =
    session.type === "anonymous" ? session.anonymousSessionId : null;

  // Get existing slugs for this user/session to ensure uniqueness
  const existingLists = await db
    .select({ slug: lists.slug })
    .from(lists)
    .where(
      userId
        ? eq(lists.userId, userId)
        : eq(lists.anonymousSessionId, anonymousSessionId!)
    );

  const existingSlugs = existingLists.map((l) => l.slug);

  // Generate unique slug from default name
  const defaultName = "New List";
  const baseSlug = generateSlug(defaultName);
  const slug = makeSlugUnique(baseSlug, existingSlugs);

  // Create the list
  const [newList] = await db
    .insert(lists)
    .values({
      userId,
      anonymousSessionId,
      name: defaultName,
      slug,
      description: null,
      isPublic: false,
    })
    .returning({ slug: lists.slug });

  redirect(`/lists/${newList.slug}`);
}

export default async function Home() {
  // Check for authenticated user first
  const user = await getSessionUser();

  if (user) {
    // Get most recently edited list for authenticated user
    const [mostRecentList] = await db
      .select({ slug: lists.slug })
      .from(lists)
      .where(eq(lists.userId, user.id))
      .orderBy(desc(lists.updatedAt))
      .limit(1);

    if (mostRecentList) {
      redirect(`/lists/${mostRecentList.slug}`);
    }
  } else {
    // Check for anonymous session
    const anonymousSession = await getAnonymousSession();

    if (anonymousSession) {
      // Get most recently edited list for anonymous user
      const [mostRecentList] = await db
        .select({ slug: lists.slug })
        .from(lists)
        .where(eq(lists.anonymousSessionId, anonymousSession.id))
        .orderBy(desc(lists.updatedAt))
        .limit(1);

      if (mostRecentList) {
        redirect(`/lists/${mostRecentList.slug}`);
      }
    }
  }

  // Show landing page for users without lists or sessions
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-2xl flex-col items-center gap-12 px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Ultralight Gear Tracker
          </h1>
          <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            Plan your next adventure with precision. Track your gear weight,
            organize by categories, and optimize your pack.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <form action={createList}>
            <button
              type="submit"
              className="flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get Started
            </button>
          </form>
        </div>

        <div className="grid gap-8 pt-8 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg
                className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Track Weight
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Log every item with precise weights in grams or ounces
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg
                className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Organize
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Group items into categories like shelter, sleep, and kitchen
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg
                className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Share
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Make your lists public and share with the community
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
