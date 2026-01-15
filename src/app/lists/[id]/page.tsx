import { notFound } from "next/navigation";
import { db } from "@/db";
import { lists, categories, items } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { getCurrentSession } from "@/lib/session";
import { ListDetailClient, type ListPageData } from "./list-detail-client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getListData(listId: string): Promise<ListPageData | null> {
  // Validate UUID format
  if (!UUID_REGEX.test(listId)) {
    return null;
  }

  // Get current session
  const session = await getCurrentSession();

  // Fetch the list
  const [list] = await db
    .select()
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);

  if (!list) {
    return null;
  }

  // Check access: either the list is public, or the user owns it
  const isOwner =
    session &&
    ((session.type === "authenticated" && list.userId === session.userId) ||
      (session.type === "anonymous" &&
        list.anonymousSessionId === session.anonymousSessionId));

  if (!list.isPublic && !isOwner) {
    return null;
  }

  // Fetch categories for this list, ordered by position
  const listCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.listId, listId))
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
    isOwner: !!isOwner,
    isAuthenticated: session?.type === "authenticated",
  };
}

export default async function ListDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getListData(id);

  if (!data) {
    notFound();
  }

  return <ListDetailClient initialData={data} listId={id} />;
}
