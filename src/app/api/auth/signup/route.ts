import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, lists } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { signUpSchema } from "@/lib/validations/auth";
import {
  getAnonymousSession,
  deleteAnonymousSession,
  createSession,
} from "@/lib/session";
import { eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = signUpSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { username, email, password } = result.data;

    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);

    if (existingUser.length > 0) {
      const existing = existingUser[0];
      if (existing.username === username) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 409 }
        );
      }
      if (existing.email === email) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
      });

    // Check for anonymous session and migrate data
    const anonymousSession = await getAnonymousSession();
    let migratedListsCount = 0;

    if (anonymousSession) {
      // Transfer all lists from anonymous session to the new user
      const migratedLists = await db
        .update(lists)
        .set({
          userId: newUser.id,
          anonymousSessionId: null,
          updatedAt: new Date(),
        })
        .where(eq(lists.anonymousSessionId, anonymousSession.id))
        .returning({ id: lists.id });

      migratedListsCount = migratedLists.length;

      // Delete the anonymous session (also clears the cookie)
      await deleteAnonymousSession();
    }

    // Create an authenticated session for the new user
    await createSession(newUser.id);

    return NextResponse.json(
      {
        message: "User created successfully",
        user: newUser,
        migratedLists: migratedListsCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
