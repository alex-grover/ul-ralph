import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, lists, categories, items } from "@/db/schema";
import { getCurrentSession } from "@/lib/session";
import { eq, and, asc, inArray } from "drizzle-orm";

type RouteParams = {
  params: Promise<{ username: string; slug: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { username, slug } = await params;

    // Find the user by username
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the list by user ID and slug
    const [list] = await db
      .select()
      .from(lists)
      .where(and(eq(lists.userId, user.id), eq(lists.slug, slug)))
      .limit(1);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Get current session to check ownership
    const session = await getCurrentSession();

    // Check access: either the list is public, or the user owns it
    const isOwner =
      session &&
      session.type === "authenticated" &&
      list.userId === session.userId;

    if (!list.isPublic && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch categories for this list, ordered by position
    const listCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.listId, list.id))
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
      username: user.username,
    });
  } catch (error) {
    console.error("Get public list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
