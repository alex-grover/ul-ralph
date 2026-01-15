import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users, anonymousSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";

const SESSION_COOKIE_NAME = "session_token";
const ANONYMOUS_SESSION_COOKIE_NAME = "anonymous_session_token";
const SESSION_DURATION_DAYS = 30;

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function getSessionExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
  return expiresAt;
}

export async function createSession(userId: string): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiration();

  await db.insert(sessions).values({
    userId,
    sessionToken,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return sessionToken;
}

export async function getSessionUser(): Promise<{
  id: string;
  username: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const result = await db
    .select({
      userId: sessions.userId,
      username: users.username,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionToken, sessionToken),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    id: result[0].userId,
    username: result[0].username,
    email: result[0].email,
  };
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// Anonymous Session Functions

export async function createAnonymousSession(): Promise<{
  id: string;
  sessionToken: string;
}> {
  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiration();

  const result = await db
    .insert(anonymousSessions)
    .values({
      sessionToken,
      expiresAt,
    })
    .returning({ id: anonymousSessions.id });

  const cookieStore = await cookies();
  cookieStore.set(ANONYMOUS_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return {
    id: result[0].id,
    sessionToken,
  };
}

export async function getAnonymousSession(): Promise<{
  id: string;
  sessionToken: string;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const result = await db
    .select({
      id: anonymousSessions.id,
      sessionToken: anonymousSessions.sessionToken,
    })
    .from(anonymousSessions)
    .where(
      and(
        eq(anonymousSessions.sessionToken, sessionToken),
        gt(anonymousSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

export async function getOrCreateAnonymousSession(): Promise<{
  id: string;
  sessionToken: string;
}> {
  const existingSession = await getAnonymousSession();
  if (existingSession) {
    return existingSession;
  }
  return createAnonymousSession();
}

export async function deleteAnonymousSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await db
      .delete(anonymousSessions)
      .where(eq(anonymousSessions.sessionToken, sessionToken));
  }

  cookieStore.delete(ANONYMOUS_SESSION_COOKIE_NAME);
}

export type AuthenticatedSession = {
  type: "authenticated";
  userId: string;
  username: string;
  email: string;
};

export type AnonymousSessionData = {
  type: "anonymous";
  anonymousSessionId: string;
};

export type CurrentSession = AuthenticatedSession | AnonymousSessionData | null;

export async function getCurrentSession(): Promise<CurrentSession> {
  // First check for authenticated session
  const authenticatedUser = await getSessionUser();
  if (authenticatedUser) {
    return {
      type: "authenticated",
      userId: authenticatedUser.id,
      username: authenticatedUser.username,
      email: authenticatedUser.email,
    };
  }

  // Then check for anonymous session
  const anonymousSession = await getAnonymousSession();
  if (anonymousSession) {
    return {
      type: "anonymous",
      anonymousSessionId: anonymousSession.id,
    };
  }

  return null;
}
