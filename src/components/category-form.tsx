"use client";

import * as React from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
} from "@/components/ui/responsive-dialog";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/category";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validations/category";
import type { Category } from "@/db/schema";

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  category?: Category;
  onSuccess?: (category: Category) => void;
}

interface FieldErrors {
  listId?: string[];
  name?: string[];
  description?: string[];
}

export function CategoryForm({
  open,
  onOpenChange,
  listId,
  category,
  onSuccess,
}: CategoryFormProps) {
  const isEditing = !!category;

  const [name, setName] = React.useState(category?.name ?? "");
  const [description, setDescription] = React.useState(
    category?.description ?? ""
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Reset form when dialog opens/closes or category changes
  React.useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setDescription(category?.description ?? "");
      setError(null);
      setFieldErrors({});
    }
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const data: CreateCategoryInput | UpdateCategoryInput = isEditing
      ? { name, description: description || null }
      : { listId, name, description: description || null };

    const schema = isEditing ? updateCategorySchema : createCategorySchema;
    const validationResult = schema.safeParse(data);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors as {
        listId?: string[];
        name?: string[];
        description?: string[];
      };
      setFieldErrors({
        listId: errors.listId,
        name: errors.name,
        description: errors.description,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/categories/${category.id}`
        : "/api/categories";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details) {
          setFieldErrors(result.details);
        } else {
          setError(result.error || "An error occurred");
        }
        return;
      }

      onSuccess?.(result.category);
      onOpenChange(false);
    } catch {
      setError("Failed to save category. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <form onSubmit={handleSubmit}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {isEditing ? "Edit Category" : "New Category"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {isEditing
                ? "Update your category details."
                : "Create a new category to organize your gear items."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            {fieldErrors.listId && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {fieldErrors.listId[0]}
              </div>
            )}

            <div className="grid gap-2">
              <label
                htmlFor="name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter category name"
                disabled={isSubmitting}
                className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300 ${
                  fieldErrors.name
                    ? "border-red-500 dark:border-red-500"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              />
              {fieldErrors.name && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="description"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Description{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  (optional)
                </span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this category"
                rows={3}
                disabled={isSubmitting}
                className={`flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300 ${
                  fieldErrors.description
                    ? "border-red-500 dark:border-red-500"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              />
              {fieldErrors.description && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.description[0]}
                </p>
              )}
            </div>
          </div>

          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <button
                type="button"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium ring-offset-white transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50 dark:focus-visible:ring-neutral-300"
              >
                Cancel
              </button>
            </ResponsiveDialogClose>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 ring-offset-white transition-colors hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:ring-offset-neutral-950 dark:hover:bg-neutral-50/90 dark:focus-visible:ring-neutral-300"
            >
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Category"}
            </button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
