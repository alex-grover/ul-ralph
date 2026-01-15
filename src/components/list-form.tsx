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
import { createListSchema, updateListSchema } from "@/lib/validations/list";
import type { CreateListInput, UpdateListInput } from "@/lib/validations/list";

interface List {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ListFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: List;
  onSuccess?: (list: List) => void;
}

interface FieldErrors {
  name?: string[];
  description?: string[];
}

export function ListForm({ open, onOpenChange, list, onSuccess }: ListFormProps) {
  const isEditing = !!list;

  const [name, setName] = React.useState(list?.name ?? "");
  const [description, setDescription] = React.useState(list?.description ?? "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Reset form when dialog opens/closes or list changes
  React.useEffect(() => {
    if (open) {
      setName(list?.name ?? "");
      setDescription(list?.description ?? "");
      setError(null);
      setFieldErrors({});
    }
  }, [open, list]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const data: CreateListInput | UpdateListInput = {
      name,
      description: description || null,
    };

    const schema = isEditing ? updateListSchema : createListSchema;
    const validationResult = schema.safeParse(data);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        name: errors.name,
        description: errors.description,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/lists/${list.id}` : "/api/lists";
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

      onSuccess?.(result.list);
      onOpenChange(false);
    } catch {
      setError("Failed to save list. Please try again.");
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
              {isEditing ? "Edit List" : "New List"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {isEditing
                ? "Update your gear list details."
                : "Create a new gear list to track your backpacking items."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
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
                placeholder="Enter list name"
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
                placeholder="Describe your gear list"
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
                  : "Create List"}
            </button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
