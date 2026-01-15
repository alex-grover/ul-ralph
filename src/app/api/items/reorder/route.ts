import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories, items } from "@/db/schema";
import { reorderItemsSchema } from "@/lib/validations/item";
import { getCurrentSession } from "@/lib/session";
import { eq, inArray } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = reorderItemsSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { listId, items: itemsToReorder } = result.data;

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

    // Extract unique IDs
    const itemIds = itemsToReorder.map((item) => item.id);
    const categoryIds = [...new Set(itemsToReorder.map((item) => item.categoryId))];

    // Verify all category IDs belong to this list
    const categoriesInList = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.listId, listId));

    const categoryIdsInList = new Set(categoriesInList.map((c) => c.id));
    const invalidCategoryIds = categoryIds.filter((id) => !categoryIdsInList.has(id));

    if (invalidCategoryIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some categories do not belong to this list",
          details: { invalidCategoryIds },
        },
        { status: 400 }
      );
    }

    // Verify all items exist
    const existingItems = await db
      .select({ id: items.id, categoryId: items.categoryId })
      .from(items)
      .where(inArray(items.id, itemIds));

    const existingItemIds = new Set(existingItems.map((i) => i.id));

    // Check if all provided item IDs exist
    const missingIds = itemIds.filter((id) => !existingItemIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some items were not found",
          details: { missingIds },
        },
        { status: 404 }
      );
    }

    // Verify all items belong to the list (by checking their categories)
    // Get all category IDs that belong to this list
    const allCategoriesInList = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.listId, listId));

    const allCategoryIdsInList = new Set(allCategoriesInList.map((c) => c.id));

    // Get all items that belong to categories in this list
    const itemsInList = existingItems.filter((item) =>
      allCategoryIdsInList.has(item.categoryId)
    );
    const itemIdsInList = new Set(itemsInList.map((i) => i.id));

    const itemsNotInList = itemIds.filter((id) => !itemIdsInList.has(id));
    if (itemsNotInList.length > 0) {
      return NextResponse.json(
        {
          error: "Some items do not belong to this list",
          details: { invalidItemIds: itemsNotInList },
        },
        { status: 400 }
      );
    }

    // Update positions and category assignments using a transaction
    await db.transaction(async (tx) => {
      const updatePromises = itemsToReorder.map((item) =>
        tx
          .update(items)
          .set({
            categoryId: item.categoryId,
            position: item.position,
            updatedAt: new Date(),
          })
          .where(eq(items.id, item.id))
      );
      await Promise.all(updatePromises);
    });

    // Fetch updated items grouped by category to return
    const updatedItems = await db
      .select({
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
      })
      .from(items)
      .where(inArray(items.id, itemIds))
      .orderBy(items.categoryId, items.position);

    return NextResponse.json({
      message: "Items reordered successfully",
      items: updatedItems,
    });
  } catch (error) {
    console.error("Reorder items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
