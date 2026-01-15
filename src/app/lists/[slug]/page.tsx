import { notFound } from "next/navigation";
import { db } from "@/db";
import { lists, categories, items } from "@/db/schema";
import { eq, asc, inArray, and, or } from "drizzle-orm";
import { getCurrentSession } from "@/lib/session";
import { ListDetailClient, type ListPageData } from "./list-detail-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getListData(slug: string): Promise<ListPageData | null> {
  // Get current session
  const session = await getCurrentSession();

  if (!session) {
    // No session means no access to any private lists
    return null;
  }

  // Build ownership condition based on session type
  const ownershipCondition =
    session.type === "authenticated"
      ? eq(lists.userId, session.userId)
      : eq(lists.anonymousSessionId, session.anonymousSessionId);

  // Find the list by slug where user owns it, or it's public and user can access
  // First, try to find a list the user owns with this slug
  let [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.slug, slug), ownershipCondition))
    .limit(1);

  // If not found as owner, check if there's a public list the user can view
  // (This handles the case where someone visits their own list URL)
  if (!list) {
    // For now, if user doesn't own a list with this slug, return null
    // Public lists should be accessed via /{username}/{slug} route
    return null;
  }

  const isOwner = true; // If we found the list via ownership condition, user is the owner

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

  return {
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
    isOwner: isOwner,
    isAuthenticated: session.type === "authenticated",
  };
}

export default async function ListDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getListData(slug);

  if (!data) {
    notFound();
  }

  // Pass list.id (UUID) for API operations, but routing uses slug
  return <ListDetailClient initialData={data} listId={data.list.id} />;
}
