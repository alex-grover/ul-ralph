import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories, items } from "@/db/schema";
import { updateItemSchema } from "@/lib/validations/item";
import { getCurrentSession } from "@/lib/session";
import { eq } from "drizzle-orm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const body = await request.json();

    // Validate input
    const result = updateItemSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, description, url, weightAmount, weightUnit, label, quantity } =
      result.data;

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the item
    const [existingItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, id))
      .limit(1);

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Fetch the category to get the list ID
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, existingItem.categoryId))
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

    // Build update object
    const updateData: {
      name?: string;
      description?: string | null;
      url?: string | null;
      weightAmount?: number;
      weightUnit?: string;
      label?: string;
      quantity?: number;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (url !== undefined) {
      updateData.url = url;
    }

    if (weightAmount !== undefined) {
      updateData.weightAmount = weightAmount;
    }

    if (weightUnit !== undefined) {
      updateData.weightUnit = weightUnit;
    }

    if (label !== undefined) {
      updateData.label = label;
    }

    if (quantity !== undefined) {
      updateData.quantity = quantity;
    }

    // Update the item
    const [updatedItem] = await db
      .update(items)
      .set(updateData)
      .where(eq(items.id, id))
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

    return NextResponse.json({
      message: "Item updated successfully",
      item: updatedItem,
    });
  } catch (error) {
    console.error("Update item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the item
    const [existingItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, id))
      .limit(1);

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Fetch the category to get the list ID
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, existingItem.categoryId))
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

    // Delete the item
    await db.delete(items).where(eq(items.id, id));

    return NextResponse.json({
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Delete item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
