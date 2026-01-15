import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users, lists, categories, items } from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { PublicListClient } from "./public-list-client";

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

async function getListData(username: string, slug: string) {
  // Find the user by username
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    return null;
  }

  // Find the list by user ID and slug
  const [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.userId, user.id), eq(lists.slug, slug)))
    .limit(1);

  if (!list) {
    return null;
  }

  // Only allow access to public lists via this route
  if (!list.isPublic) {
    return null;
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
    username: user.username,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getListData(username, slug);

  if (!data) {
    return {
      title: "List Not Found",
    };
  }

  return {
    title: `${data.list.name} by ${data.username}`,
    description:
      data.list.description || `Gear list by ${data.username}`,
  };
}

export default async function PublicListPage({ params }: PageProps) {
  const { username, slug } = await params;
  const data = await getListData(username, slug);

  if (!data) {
    notFound();
  }

  return (
    <PublicListClient
      list={data.list}
      categories={data.categories}
      username={data.username}
    />
  );
}
