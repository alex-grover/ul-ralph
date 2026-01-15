import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";

const SESSION_COOKIE_NAME = "session_token";
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
