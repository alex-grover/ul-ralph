import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories } from "@/db/schema";
import { reorderCategoriesSchema } from "@/lib/validations/category";
import { getCurrentSession } from "@/lib/session";
import { eq, inArray } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = reorderCategoriesSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { listId, categoryIds } = result.data;

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

    // Verify all category IDs belong to this list
    const existingCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, categoryIds));

    const existingCategoryIds = new Set(existingCategories.map((c) => c.id));

    // Check if all provided category IDs exist
    const missingIds = categoryIds.filter((id) => !existingCategoryIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some categories were not found",
          details: { missingIds },
        },
        { status: 404 }
      );
    }

    // Verify all categories belong to the specified list
    const categoriesInList = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.listId, listId));

    const categoryIdsInList = new Set(categoriesInList.map((c) => c.id));
    const invalidIds = categoryIds.filter((id) => !categoryIdsInList.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some categories do not belong to this list",
          details: { invalidIds },
        },
        { status: 400 }
      );
    }

    // Update positions using a transaction
    await db.transaction(async (tx) => {
      const updatePromises = categoryIds.map((categoryId, index) =>
        tx
          .update(categories)
          .set({ position: index, updatedAt: new Date() })
          .where(eq(categories.id, categoryId))
      );
      await Promise.all(updatePromises);
    });

    // Fetch updated categories to return
    const updatedCategories = await db
      .select({
        id: categories.id,
        listId: categories.listId,
        name: categories.name,
        description: categories.description,
        position: categories.position,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .where(eq(categories.listId, listId))
      .orderBy(categories.position);

    return NextResponse.json({
      message: "Categories reordered successfully",
      categories: updatedCategories,
    });
  } catch (error) {
    console.error("Reorder categories error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
