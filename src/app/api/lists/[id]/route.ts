import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lists, categories, items } from "@/db/schema";
import { updateListSchema } from "@/lib/validations/list";
import { getCurrentSession } from "@/lib/session";
import { generateSlug, makeSlugUnique } from "@/lib/slug";
import { revalidateListCache } from "@/lib/cache";
import { eq, and, ne, asc, inArray } from "drizzle-orm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Get current session
    const session = await getCurrentSession();

    // Fetch the list
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, id))
      .limit(1);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Check access: either the list is public, or the user owns it
    const isOwner =
      session &&
      ((session.type === "authenticated" && list.userId === session.userId) ||
        (session.type === "anonymous" &&
          list.anonymousSessionId === session.anonymousSessionId));

    if (!list.isPublic && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch categories for this list, ordered by position
    const listCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.listId, id))
      .orderBy(asc(categories.position));

    // Fetch all items for these categories
    const categoryIds = listCategories.map((c) => c.id);
    let listItems: (typeof items.$inferSelect)[] = [];

    if (categoryIds.length > 0) {
      listItems = await db
        .select()
        .from(items)
        .where(inArray(items.categoryId, categoryIds))
        .orderBy(asc(items.position));
    }

    // Group items by category
    const categoriesWithItems = listCategories.map((category) => ({
      ...category,
      items: listItems
        .filter((item) => item.categoryId === category.id)
        .sort((a, b) => a.position - b.position),
    }));

    return NextResponse.json({
      list: {
        id: list.id,
        name: list.name,
        slug: list.slug,
        description: list.description,
        isPublic: list.isPublic,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      },
      categories: categoriesWithItems,
      isOwner: !!isOwner,
      isAuthenticated: session?.type === "authenticated",
    });
  } catch (error) {
    console.error("Get list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    const body = await request.json();

    // Validate input
    const result = updateListSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, description, isPublic } = result.data;

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the list and verify ownership
    const [existingList] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, id))
      .limit(1);

    if (!existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Verify ownership
    const isOwner =
      (session.type === "authenticated" &&
        existingList.userId === session.userId) ||
      (session.type === "anonymous" &&
        existingList.anonymousSessionId === session.anonymousSessionId);

    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update object
    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      isPublic?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    // If name is changing, regenerate slug
    if (name !== undefined && name !== existingList.name) {
      updateData.name = name;

      // Get existing slugs for this user/session (excluding current list)
      const userId =
        session.type === "authenticated" ? session.userId : null;
      const anonymousSessionId =
        session.type === "anonymous" ? session.anonymousSessionId : null;

      const existingLists = await db
        .select({ slug: lists.slug })
        .from(lists)
        .where(
          and(
            userId
              ? eq(lists.userId, userId)
              : eq(lists.anonymousSessionId, anonymousSessionId!),
            ne(lists.id, id)
          )
        );

      const existingSlugs = existingLists.map((l) => l.slug);

      // Generate unique slug from new name
      const baseSlug = generateSlug(name);
      updateData.slug = makeSlugUnique(baseSlug, existingSlugs);
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (isPublic !== undefined) {
      // Only authenticated users can change public/private status
      if (session.type !== "authenticated") {
        return NextResponse.json(
          { error: "Only registered users can make lists public" },
          { status: 403 }
        );
      }
      updateData.isPublic = isPublic;
    }

    // Update the list
    const [updatedList] = await db
      .update(lists)
      .set(updateData)
      .where(eq(lists.id, id))
      .returning({
        id: lists.id,
        name: lists.name,
        slug: lists.slug,
        description: lists.description,
        isPublic: lists.isPublic,
        createdAt: lists.createdAt,
        updatedAt: lists.updatedAt,
      });

    // Invalidate cache for this list
    revalidateListCache(id);

    return NextResponse.json({
      message: "List updated successfully",
      list: updatedList,
    });
  } catch (error) {
    console.error("Update list error:", error);
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
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Get current session
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the list and verify ownership
    const [existingList] = await db
      .select()
      .from(lists)
      .where(eq(lists.id, id))
      .limit(1);

    if (!existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Verify ownership
    const isOwner =
      (session.type === "authenticated" &&
        existingList.userId === session.userId) ||
      (session.type === "anonymous" &&
        existingList.anonymousSessionId === session.anonymousSessionId);

    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Invalidate cache for this list before deletion
    revalidateListCache(id);

    // Delete the list (categories and items will cascade delete)
    await db.delete(lists).where(eq(lists.id, id));

    return NextResponse.json({
      message: "List deleted successfully",
    });
  } catch (error) {
    console.error("Delete list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
