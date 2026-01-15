import { z } from "zod";

export const createCategorySchema = z.object({
  listId: z.string().uuid("Invalid list ID"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
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
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
