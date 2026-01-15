import { describe, it, expect } from "vitest";
import { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } from "./category";

describe("createCategorySchema", () => {
  describe("listId validation", () => {
    it("accepts valid UUID", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID format", () => {
      const result = createCategorySchema.safeParse({
        listId: "not-a-uuid",
        name: "Shelter",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.listId).toBeDefined();
      }
    });

    it("rejects missing listId", () => {
      const result = createCategorySchema.safeParse({
        name: "Shelter",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.listId).toBeDefined();
      }
    });
  });

  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with minimum length (1 character)", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "X",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with maximum length (255 characters)", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "a".repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 255 characters", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(false);
    });

    it("accepts Unicode characters in name", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "寝袋カテゴリー",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("description validation", () => {
    it("accepts valid description", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
        description: "Tents, tarps, and hammocks",
      });
      expect(result.success).toBe(true);
    });

    it("accepts description at maximum length (5000 characters)", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
        description: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description exceeding 5000 characters", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
        description: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts null description", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing description (optional)", () => {
      const result = createCategorySchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Shelter",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("updateCategorySchema", () => {
  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = updateCategorySchema.safeParse({
        name: "Updated Category",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with minimum length (1 character)", () => {
      const result = updateCategorySchema.safeParse({
        name: "X",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = updateCategorySchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 255 characters", () => {
      const result = updateCategorySchema.safeParse({
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("accepts missing name (optional for update)", () => {
      const result = updateCategorySchema.safeParse({
        description: "Just updating description",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("description validation", () => {
    it("accepts valid description", () => {
      const result = updateCategorySchema.safeParse({
        description: "Updated description",
      });
      expect(result.success).toBe(true);
    });

    it("accepts description at maximum length (5000 characters)", () => {
      const result = updateCategorySchema.safeParse({
        description: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description exceeding 5000 characters", () => {
      const result = updateCategorySchema.safeParse({
        description: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts null description", () => {
      const result = updateCategorySchema.safeParse({
        description: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("empty update", () => {
    it("accepts empty object", () => {
      const result = updateCategorySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("reorderCategoriesSchema", () => {
  describe("listId validation", () => {
    it("accepts valid UUID", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        categoryIds: ["b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "invalid-uuid",
        categoryIds: ["b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing listId", () => {
      const result = reorderCategoriesSchema.safeParse({
        categoryIds: ["b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("categoryIds validation", () => {
    it("accepts single category ID", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        categoryIds: ["b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts multiple category IDs", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        categoryIds: [
          "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty categoryIds array", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        categoryIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUID in categoryIds", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        categoryIds: ["invalid-uuid"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects duplicate category IDs", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        categoryIds: [
          "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing categoryIds", () => {
      const result = reorderCategoriesSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(false);
    });
  });
});
