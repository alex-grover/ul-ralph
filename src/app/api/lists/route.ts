import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists } from "@/db/schema";
import { createListSchema } from "@/lib/validations/list";
import {
  getCurrentSession,
  getOrCreateAnonymousSession,
} from "@/lib/session";
import { generateSlug, makeSlugUnique } from "@/lib/slug";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = createListSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, description } = result.data;

    // Get current session - support both authenticated and anonymous users
    let session = await getCurrentSession();

    // If no session exists, create an anonymous session for the user
    if (!session) {
      const anonymousSession = await getOrCreateAnonymousSession();
      session = {
        type: "anonymous",
        anonymousSessionId: anonymousSession.id,
      };
    }

    // Determine user ownership
    const userId =
      session.type === "authenticated" ? session.userId : null;
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

    // Generate unique slug from name
    const baseSlug = generateSlug(name);
    const slug = makeSlugUnique(baseSlug, existingSlugs);

    // Create the list
    const [newList] = await db
      .insert(lists)
      .values({
        userId,
        anonymousSessionId,
        name,
        slug,
        description: description ?? null,
        isPublic: false,
      })
      .returning({
        id: lists.id,
        name: lists.name,
        slug: lists.slug,
        description: lists.description,
        isPublic: lists.isPublic,
        createdAt: lists.createdAt,
        updatedAt: lists.updatedAt,
      });

    return NextResponse.json(
      {
        message: "List created successfully",
        list: newList,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
