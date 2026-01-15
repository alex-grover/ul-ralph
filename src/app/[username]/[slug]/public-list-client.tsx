"use client";

import Link from "next/link";
import { WeightSummary } from "@/components/weight-summary";
import type { Category, Item } from "@/db/schema";

interface ListData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryWithItems extends Category {
  items: Item[];
}

interface PublicListClientProps {
  list: ListData;
  categories: CategoryWithItems[];
  username: string;
}

export function PublicListClient({
  list,
  categories,
  username,
}: PublicListClientProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* List Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {list.name}
              </h1>
              {list.description && (
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                  {list.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
                <span>by</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {username}
                </span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                  Public
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Weight Summary */}
        <div className="mb-8">
          <WeightSummary categories={categories} />
        </div>

        {/* Categories Section */}
        <div className="space-y-6">
          {categories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-zinc-600 dark:text-zinc-400">
                No categories in this list yet.
              </p>
            </div>
          ) : (
            categories.map((category) => (
              <CategorySection key={category.id} category={category} />
            ))
          )}
        </div>

        {/* Back link */}
        <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Create your own gear list
          </Link>
        </div>
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: CategoryWithItems;
}

function CategorySection({ category }: CategorySectionProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Category Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {category.name}
        </h2>
        {category.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {category.description}
          </p>
        )}
      </div>

      {/* Items List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {category.items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
            No items in this category
          </div>
        ) : (
          category.items.map((item) => <ItemRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

interface ItemRowProps {
  item: Item;
}

function ItemRow({ item }: ItemRowProps) {
  const formatWeight = (amount: number, unit: string) => {
    return `${amount} ${unit}`;
  };

  const totalWeight = item.weightAmount * item.quantity;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {item.name}
          </span>
          {item.label && item.label !== "none" && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item.label === "worn"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              }`}
            >
              {item.label}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Open link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-500 truncate">
            {item.description}
          </p>
        )}
      </div>

      {/* Weight & Quantity */}
      <div className="flex items-center gap-4 text-sm">
        {item.quantity > 1 && (
          <span className="text-zinc-500 dark:text-zinc-500">
            x{item.quantity}
          </span>
        )}
        <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">
          {formatWeight(totalWeight, item.weightUnit)}
        </span>
      </div>
    </div>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
