import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories, items } from "@/db/schema";
import { createItemSchema } from "@/lib/validations/item";
import { getCurrentSession } from "@/lib/session";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = createItemSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const {
      categoryId,
      name,
      description,
      url,
      weightAmount,
      weightUnit,
      label,
      quantity,
    } = result.data;

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the category
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Fetch the list to verify ownership
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, category.listId))
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

    // Get the highest position in the category to place new item at the end
    const [maxPositionResult] = await db
      .select({
        maxPosition: sql<number>`COALESCE(MAX(${items.position}), -1)`,
      })
      .from(items)
      .where(eq(items.categoryId, categoryId));

    const nextPosition = (maxPositionResult?.maxPosition ?? -1) + 1;

    // Create the item
    const [newItem] = await db
      .insert(items)
      .values({
        categoryId,
        name,
        description: description ?? null,
        url: url ?? null,
        weightAmount,
        weightUnit,
        label,
        quantity,
        position: nextPosition,
      })
      .returning({
        id: items.id,
        categoryId: items.categoryId,
        name: items.name,
        description: items.description,
        url: items.url,
        weightAmount: items.weightAmount,
        weightUnit: items.weightUnit,
        label: items.label,
        quantity: items.quantity,
        position: items.position,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      });

    return NextResponse.json(
      {
        message: "Item created successfully",
        item: newItem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
