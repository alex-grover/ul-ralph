import { z } from "zod";

export const createListSchema = z.object({
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

export type CreateListInput = z.infer<typeof createListSchema>;
