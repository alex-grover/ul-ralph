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
  createItemSchema,
  updateItemSchema,
} from "@/lib/validations/item";
import type {
  CreateItemInput,
  UpdateItemInput,
} from "@/lib/validations/item";
import type { Item } from "@/db/schema";

interface ItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  item?: Item;
  onSuccess?: (item: Item) => void;
}

interface FieldErrors {
  categoryId?: string[];
  name?: string[];
  description?: string[];
  url?: string[];
  weightAmount?: string[];
  weightUnit?: string[];
  label?: string[];
  quantity?: string[];
}

const inputClassName = (hasError: boolean) =>
  `flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300 ${
    hasError
      ? "border-red-500 dark:border-red-500"
      : "border-neutral-200 dark:border-neutral-800"
  }`;

const selectClassName = (hasError: boolean) =>
  `flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300 ${
    hasError
      ? "border-red-500 dark:border-red-500"
      : "border-neutral-200 dark:border-neutral-800"
  }`;

export function ItemForm({
  open,
  onOpenChange,
  categoryId,
  item,
  onSuccess,
}: ItemFormProps) {
  const isEditing = !!item;

  const [name, setName] = React.useState(item?.name ?? "");
  const [description, setDescription] = React.useState(
    item?.description ?? ""
  );
  const [url, setUrl] = React.useState(item?.url ?? "");
  const [weightAmount, setWeightAmount] = React.useState(
    item?.weightAmount?.toString() ?? "0"
  );
  const [weightUnit, setWeightUnit] = React.useState<"g" | "oz">(
    (item?.weightUnit as "g" | "oz") ?? "g"
  );
  const [label, setLabel] = React.useState<"none" | "worn" | "consumable">(
    (item?.label as "none" | "worn" | "consumable") ?? "none"
  );
  const [quantity, setQuantity] = React.useState(
    item?.quantity?.toString() ?? "1"
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Reset form when dialog opens/closes or item changes
  React.useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setDescription(item?.description ?? "");
      setUrl(item?.url ?? "");
      setWeightAmount(item?.weightAmount?.toString() ?? "0");
      setWeightUnit((item?.weightUnit as "g" | "oz") ?? "g");
      setLabel((item?.label as "none" | "worn" | "consumable") ?? "none");
      setQuantity(item?.quantity?.toString() ?? "1");
      setError(null);
      setFieldErrors({});
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Parse numeric values
    const parsedWeightAmount = parseFloat(weightAmount) || 0;
    const parsedQuantity = parseInt(quantity, 10) || 1;

    // Client-side validation
    const data: CreateItemInput | UpdateItemInput = isEditing
      ? {
          name,
          description: description || null,
          url: url || null,
          weightAmount: parsedWeightAmount,
          weightUnit,
          label,
          quantity: parsedQuantity,
        }
      : {
          categoryId,
          name,
          description: description || null,
          url: url || null,
          weightAmount: parsedWeightAmount,
          weightUnit,
          label,
          quantity: parsedQuantity,
        };

    const schema = isEditing ? updateItemSchema : createItemSchema;
    const validationResult = schema.safeParse(data);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors as FieldErrors;
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = isEditing
        ? `/api/items/${item.id}`
        : "/api/items";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(apiUrl, {
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

      onSuccess?.(result.item);
      onOpenChange(false);
    } catch {
      setError("Failed to save item. Please try again.");
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
              {isEditing ? "Edit Item" : "New Item"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {isEditing
                ? "Update your gear item details."
                : "Add a new gear item to this category."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            {fieldErrors.categoryId && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {fieldErrors.categoryId[0]}
              </div>
            )}

            {/* Name */}
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
                placeholder="Enter item name"
                disabled={isSubmitting}
                className={inputClassName(!!fieldErrors.name)}
              />
              {fieldErrors.name && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

            {/* Weight and Unit Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label
                  htmlFor="weightAmount"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Weight
                </label>
                <input
                  id="weightAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weightAmount}
                  onChange={(e) => setWeightAmount(e.target.value)}
                  placeholder="0"
                  disabled={isSubmitting}
                  className={inputClassName(!!fieldErrors.weightAmount)}
                />
                {fieldErrors.weightAmount && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.weightAmount[0]}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label
                  htmlFor="weightUnit"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Unit
                </label>
                <select
                  id="weightUnit"
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as "g" | "oz")}
                  disabled={isSubmitting}
                  className={selectClassName(!!fieldErrors.weightUnit)}
                >
                  <option value="g">Grams (g)</option>
                  <option value="oz">Ounces (oz)</option>
                </select>
                {fieldErrors.weightUnit && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.weightUnit[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity and Label Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label
                  htmlFor="quantity"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  step="1"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  disabled={isSubmitting}
                  className={inputClassName(!!fieldErrors.quantity)}
                />
                {fieldErrors.quantity && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.quantity[0]}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label
                  htmlFor="label"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Label
                </label>
                <select
                  id="label"
                  value={label}
                  onChange={(e) =>
                    setLabel(e.target.value as "none" | "worn" | "consumable")
                  }
                  disabled={isSubmitting}
                  className={selectClassName(!!fieldErrors.label)}
                >
                  <option value="none">None</option>
                  <option value="worn">Worn</option>
                  <option value="consumable">Consumable</option>
                </select>
                {fieldErrors.label && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.label[0]}
                  </p>
                )}
              </div>
            </div>

            {/* URL */}
            <div className="grid gap-2">
              <label
                htmlFor="url"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                URL{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  (optional)
                </span>
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/product"
                disabled={isSubmitting}
                className={inputClassName(!!fieldErrors.url)}
              />
              {fieldErrors.url && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.url[0]}
                </p>
              )}
            </div>

            {/* Description */}
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
                placeholder="Add notes about this item"
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
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Item"}
            </button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
