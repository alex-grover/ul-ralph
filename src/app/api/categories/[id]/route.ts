import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories } from "@/db/schema";
import { updateCategorySchema } from "@/lib/validations/category";
import { getCurrentSession } from "@/lib/session";
import { revalidateListCache } from "@/lib/cache";
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
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const result = updateCategorySchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, description } = result.data;

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the category
    const [existingCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Fetch the parent list to verify ownership
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, existingCategory.listId))
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

    // Update the category
    const [updatedCategory] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning({
        id: categories.id,
        listId: categories.listId,
        name: categories.name,
        description: categories.description,
        position: categories.position,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      });

    // Invalidate cache for the parent list
    revalidateListCache(list.id);

    return NextResponse.json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Update category error:", error);
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
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 }
      );
    }

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the category
    const [existingCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Fetch the parent list to verify ownership
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, existingCategory.listId))
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

    // Invalidate cache for the parent list
    revalidateListCache(list.id);

    // Delete the category (items will cascade delete)
    await db.delete(categories).where(eq(categories.id, id));

    return NextResponse.json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
