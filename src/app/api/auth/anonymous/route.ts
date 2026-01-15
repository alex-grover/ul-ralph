import { NextResponse } from "next/server";
import {
  getOrCreateAnonymousSession,
  getAnonymousSession,
  deleteAnonymousSession,
  getSessionUser,
} from "@/lib/session";

export async function POST() {
  try {
    // Check if user is already authenticated
    const authenticatedUser = await getSessionUser();
    if (authenticatedUser) {
      return NextResponse.json(
        { error: "Already authenticated. Anonymous session not needed." },
        { status: 400 }
      );
    }

    const session = await getOrCreateAnonymousSession();

    return NextResponse.json({
      id: session.id,
      message: "Anonymous session created or retrieved",
    });
  } catch (error) {
    console.error("Anonymous session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create anonymous session" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check if user is authenticated first
    const authenticatedUser = await getSessionUser();
    if (authenticatedUser) {
      return NextResponse.json({
        type: "authenticated",
        userId: authenticatedUser.id,
        username: authenticatedUser.username,
        email: authenticatedUser.email,
      });
    }

    // Check for anonymous session
    const anonymousSession = await getAnonymousSession();
    if (anonymousSession) {
      return NextResponse.json({
        type: "anonymous",
        anonymousSessionId: anonymousSession.id,
      });
    }

    return NextResponse.json({ type: "none" });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Failed to check session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await deleteAnonymousSession();

    return NextResponse.json({
      message: "Anonymous session deleted successfully",
    });
  } catch (error) {
    console.error("Anonymous session deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete anonymous session" },
      { status: 500 }
    );
  }
}
