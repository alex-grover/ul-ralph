import { z } from "zod";

export const createItemSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
  url: z
    .string()
    .url("Invalid URL format")
    .max(2000, "URL must be at most 2000 characters")
    .optional()
    .nullable(),
  weightAmount: z
    .number()
    .min(0, "Weight cannot be negative")
    .optional()
    .default(0),
  weightUnit: z.enum(["g", "oz", "kg", "lbs"], { message: "Weight unit must be 'g', 'oz', 'kg', or 'lbs'" }).optional().default("g"),
  label: z
    .enum(["none", "worn", "consumable"], {
      message: "Label must be 'none', 'worn', or 'consumable'",
    })
    .optional()
    .default("none"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .optional()
    .default(1),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
  url: z
    .string()
    .url("Invalid URL format")
    .max(2000, "URL must be at most 2000 characters")
    .optional()
    .nullable(),
  weightAmount: z.number().min(0, "Weight cannot be negative").optional(),
  weightUnit: z.enum(["g", "oz", "kg", "lbs"], { message: "Weight unit must be 'g', 'oz', 'kg', or 'lbs'" }).optional(),
  label: z
    .enum(["none", "worn", "consumable"], {
      message: "Label must be 'none', 'worn', or 'consumable'",
    })
    .optional(),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const reorderItemsSchema = z.object({
  listId: z.string().uuid("Invalid list ID"),
  items: z
    .array(
      z.object({
        id: z.string().uuid("Invalid item ID"),
        categoryId: z.string().uuid("Invalid category ID"),
        position: z.number().int("Position must be an integer").min(0, "Position cannot be negative"),
      })
    )
    .min(1, "At least one item is required")
    .refine(
      (itemsArray) => new Set(itemsArray.map((i) => i.id)).size === itemsArray.length,
      "Duplicate item IDs are not allowed"
    ),
});

export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
