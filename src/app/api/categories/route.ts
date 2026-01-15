import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories } from "@/db/schema";
import { createCategorySchema } from "@/lib/validations/category";
import { getCurrentSession } from "@/lib/session";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = createCategorySchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { listId, name, description } = result.data;

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the list and verify ownership
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, listId))
      .limit(1);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Verify ownership
    const isOwner =
      (session.type === "authenticated" && list.userId === session.userId) ||
      (session.type === "anonymous" &&
        list.anonymousSessionId === session.anonymousSessionId);

    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the highest position in the list to place new category at the end
    const [maxPositionResult] = await db
      .select({ maxPosition: sql<number>`COALESCE(MAX(${categories.position}), -1)` })
      .from(categories)
      .where(eq(categories.listId, listId));

    const nextPosition = (maxPositionResult?.maxPosition ?? -1) + 1;

    // Create the category
    const [newCategory] = await db
      .insert(categories)
      .values({
        listId,
        name,
        description: description ?? null,
        position: nextPosition,
      })
      .returning({
        id: categories.id,
        listId: categories.listId,
        name: categories.name,
        description: categories.description,
        position: categories.position,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      });

    return NextResponse.json(
      {
        message: "Category created successfully",
        category: newCategory,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
