"use client";

import * as React from "react";
import Link from "next/link";
import { ListForm } from "@/components/list-form";
import { CategoryForm } from "@/components/category-form";
import { ItemForm } from "@/components/item-form";
import { WeightSummary } from "@/components/weight-summary";
import { ListEditPopover } from "@/components/list-edit-popover";
import { SortableCategoryList, type DragHandleProps } from "@/components/sortable-category-list";
import { SortableItemList, ItemDndProvider, type ItemDragHandleProps } from "@/components/sortable-item-list";
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

interface ListApiResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryWithItems extends Category {
  items: Item[];
}

interface ListDetailClientProps {
  listId: string;
}

export function ListDetailClient({ listId }: ListDetailClientProps) {
  const [list, setList] = React.useState<ListData | null>(null);
  const [categories, setCategories] = React.useState<CategoryWithItems[]>([]);
  const [isOwner, setIsOwner] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Form dialogs state
  const [isListFormOpen, setIsListFormOpen] = React.useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | undefined>();
  const [isItemFormOpen, setIsItemFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<Item | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("");
  const [isUpdatingList, setIsUpdatingList] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/lists/${listId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("List not found");
        } else if (response.status === 403) {
          setError("You don't have permission to view this list");
        } else {
          setError("Failed to load list");
        }
        return;
      }

      const data = await response.json();
      const apiList: ListApiResponse = data.list;
      setList({
        ...apiList,
        createdAt: new Date(apiList.createdAt),
        updatedAt: new Date(apiList.updatedAt),
      });
      setCategories(data.categories);
      setIsOwner(data.isOwner);
      setIsAuthenticated(data.isAuthenticated);
    } catch {
      setError("Failed to load list");
    } finally {
      setIsLoading(false);
    }
  }, [listId]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleListUpdate = (updatedList: { id: string; name: string; slug: string; description: string | null; isPublic: boolean; createdAt: Date; updatedAt: Date }) => {
    setList(updatedList);
  };

  const handleListDelete = async () => {
    if (!list) return;

    if (!confirm(`Are you sure you want to delete "${list.name}"? This will also delete all categories and items in this list.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Redirect to home after successful deletion
        window.location.href = "/";
      }
    } catch {
      console.error("Failed to delete list");
    }
  };

  const handleTogglePublic = async () => {
    if (!list) return;

    setIsUpdatingList(true);

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublic: !list.isPublic }),
      });

      if (response.ok) {
        const data = await response.json();
        const apiList = data.list;
        setList({
          ...apiList,
          createdAt: new Date(apiList.createdAt),
          updatedAt: new Date(apiList.updatedAt),
        });
      }
    } catch {
      console.error("Failed to update list visibility");
    } finally {
      setIsUpdatingList(false);
    }
  };

  const handleCategoryCreated = (newCategory: Category) => {
    setCategories((prev) => [...prev, { ...newCategory, items: [] }]);
  };

  const handleCategoryUpdated = (updatedCategory: Category) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === updatedCategory.id ? { ...updatedCategory, items: c.items } : c
      )
    );
  };

  const handleCategoryDelete = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category? All items in it will also be deleted.")) {
      return;
    }

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      }
    } catch {
      console.error("Failed to delete category");
    }
  };

  const handleItemCreated = (newItem: Item) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === newItem.categoryId
          ? { ...c, items: [...c.items, newItem] }
          : c
      )
    );
  };

  const handleItemUpdated = (updatedItem: Item) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === updatedItem.categoryId
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === updatedItem.id ? updatedItem : i
              ),
            }
          : c
      )
    );
  };

  const handleItemDelete = async (itemId: string, categoryId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId
              ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
              : c
          )
        );
      }
    } catch {
      console.error("Failed to delete item");
    }
  };

  const openAddCategory = () => {
    setEditingCategory(undefined);
    setIsCategoryFormOpen(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsCategoryFormOpen(true);
  };

  const openAddItem = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setEditingItem(undefined);
    setIsItemFormOpen(true);
  };

  const openEditItem = (item: Item) => {
    setSelectedCategoryId(item.categoryId);
    setEditingItem(item);
    setIsItemFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {error || "List not found"}
          </h1>
          <Link
            href="/"
            className="mt-4 inline-block text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Go back home
          </Link>
        </div>
      </div>
    );
  }

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
                {list.isPublic ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                    Public
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Private
                  </span>
                )}
              </div>
            </div>
            {isOwner && (
              <ListEditPopover
                list={list}
                onEdit={() => setIsListFormOpen(true)}
                onDelete={handleListDelete}
                onTogglePublic={handleTogglePublic}
                isUpdating={isUpdatingList}
                canShare={isAuthenticated}
              />
            )}
          </div>
        </header>

        {/* Weight Summary */}
        <div className="mb-8">
          <WeightSummary categories={categories} />
        </div>

        {/* Categories Section */}
        <div>
          {categories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-zinc-600 dark:text-zinc-400">
                No categories yet.{" "}
                {isOwner && "Add a category to start organizing your gear."}
              </p>
              {isOwner && (
                <button
                  onClick={openAddCategory}
                  className="mt-4 inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Add Category
                </button>
              )}
            </div>
          ) : (
            <>
              <ItemDndProvider
                categories={categories}
                listId={listId}
                isOwner={isOwner}
                onCategoriesChange={setCategories}
                renderOverlayItem={(item) => (
                  <div className="rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <ItemRow
                      item={item}
                      isOwner={false}
                      onEdit={() => {}}
                      onDelete={() => {}}
                    />
                  </div>
                )}
              >
                <SortableCategoryList
                  categories={categories}
                  listId={listId}
                  isOwner={isOwner}
                  onReorder={setCategories}
                  renderCategory={(category, dragHandleProps) => (
                    <CategorySection
                      category={category}
                      isOwner={isOwner}
                      dragHandleProps={dragHandleProps}
                      onEditCategory={() => openEditCategory(category)}
                      onDeleteCategory={() => handleCategoryDelete(category.id)}
                      onAddItem={() => openAddItem(category.id)}
                      renderItemRow={(item, itemDragHandleProps) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          isOwner={isOwner}
                          onEdit={() => openEditItem(item)}
                          onDelete={() => handleItemDelete(item.id, category.id)}
                          dragHandleProps={itemDragHandleProps}
                        />
                      )}
                    />
                  )}
                />
              </ItemDndProvider>
              {isOwner && (
                <button
                  onClick={openAddCategory}
                  className="mt-6 w-full rounded-lg border border-dashed border-zinc-300 bg-white py-4 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                >
                  + Add Category
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Forms */}
      {isOwner && (
        <>
          <ListForm
            open={isListFormOpen}
            onOpenChange={setIsListFormOpen}
            list={list || undefined}
            onSuccess={handleListUpdate}
          />

          <CategoryForm
            open={isCategoryFormOpen}
            onOpenChange={setIsCategoryFormOpen}
            listId={listId}
            category={editingCategory}
            onSuccess={editingCategory ? handleCategoryUpdated : handleCategoryCreated}
          />

          {selectedCategoryId && (
            <ItemForm
              open={isItemFormOpen}
              onOpenChange={setIsItemFormOpen}
              categoryId={selectedCategoryId}
              item={editingItem}
              onSuccess={editingItem ? handleItemUpdated : handleItemCreated}
            />
          )}
        </>
      )}
    </div>
  );
}

interface CategorySectionProps {
  category: CategoryWithItems;
  isOwner: boolean;
  dragHandleProps: DragHandleProps;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddItem: () => void;
  renderItemRow: (item: Item, itemDragHandleProps: ItemDragHandleProps) => React.ReactNode;
}

function CategorySection({
  category,
  isOwner,
  dragHandleProps,
  onEditCategory,
  onDeleteCategory,
  onAddItem,
  renderItemRow,
}: CategorySectionProps) {
  const { attributes, listeners, isDragging } = dragHandleProps;

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isOwner && (
            <button
              className="cursor-grab touch-none rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 active:cursor-grabbing"
              aria-label="Drag to reorder category"
              {...attributes}
              {...listeners}
            >
              <DragHandleIcon className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {category.name}
            </h2>
            {category.description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                {category.description}
              </p>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEditCategory}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Edit category"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onDeleteCategory}
              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              aria-label="Delete category"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {category.items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
            No items in this category
          </div>
        ) : (
          <SortableItemList
            items={category.items}
            categoryId={category.id}
            isOwner={isOwner}
            renderItem={(item, itemDragHandleProps) => renderItemRow(item, itemDragHandleProps)}
          />
        )}
      </div>

      {/* Add Item Button */}
      {isOwner && (
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <button
            onClick={onAddItem}
            className="w-full rounded py-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            + Add Item
          </button>
        </div>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleProps?: ItemDragHandleProps;
}

function ItemRow({ item, isOwner, onEdit, onDelete, dragHandleProps }: ItemRowProps) {
  const formatWeight = (amount: number, unit: string) => {
    return `${amount} ${unit}`;
  };

  const totalWeight = item.weightAmount * item.quantity;

  return (
    <div className="group flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      {/* Drag Handle */}
      {isOwner && dragHandleProps && (
        <button
          className="cursor-grab touch-none rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 active:cursor-grabbing"
          aria-label="Drag to reorder item"
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
        >
          <DragHandleIcon className="h-4 w-4" />
        </button>
      )}
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

      {/* Actions */}
      {isOwner && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            aria-label="Edit item"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete item"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Icons
function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
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

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 13a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
