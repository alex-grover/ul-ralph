import { describe, it, expect } from "vitest";
import { createListSchema, updateListSchema } from "./list";

describe("createListSchema", () => {
  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = createListSchema.safeParse({
        name: "My Gear List",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with minimum length (1 character)", () => {
      const result = createListSchema.safeParse({
        name: "X",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with maximum length (255 characters)", () => {
      const result = createListSchema.safeParse({
        name: "a".repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createListSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("rejects name exceeding 255 characters", () => {
      const result = createListSchema.safeParse({
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("rejects missing name", () => {
      const result = createListSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("accepts Unicode characters in name", () => {
      const result = createListSchema.safeParse({
        name: "山岳装備リスト",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("description validation", () => {
    it("accepts valid description", () => {
      const result = createListSchema.safeParse({
        name: "Test List",
        description: "A detailed description of my gear list",
      });
      expect(result.success).toBe(true);
    });

    it("accepts description at maximum length (5000 characters)", () => {
      const result = createListSchema.safeParse({
        name: "Test List",
        description: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description exceeding 5000 characters", () => {
      const result = createListSchema.safeParse({
        name: "Test List",
        description: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toBeDefined();
      }
    });

    it("accepts null description", () => {
      const result = createListSchema.safeParse({
        name: "Test List",
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing description (optional)", () => {
      const result = createListSchema.safeParse({
        name: "Test List",
      });
      expect(result.success).toBe(true);
    });

    it("accepts Unicode characters in description", () => {
      const result = createListSchema.safeParse({
        name: "Test List",
        description: "日本アルプス用の装備一覧",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("updateListSchema", () => {
  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = updateListSchema.safeParse({
        name: "Updated Gear List",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with minimum length (1 character)", () => {
      const result = updateListSchema.safeParse({
        name: "X",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with maximum length (255 characters)", () => {
      const result = updateListSchema.safeParse({
        name: "a".repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = updateListSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 255 characters", () => {
      const result = updateListSchema.safeParse({
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("accepts missing name (optional for update)", () => {
      const result = updateListSchema.safeParse({
        description: "Just updating description",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("description validation", () => {
    it("accepts valid description", () => {
      const result = updateListSchema.safeParse({
        description: "Updated description",
      });
      expect(result.success).toBe(true);
    });

    it("accepts description at maximum length (5000 characters)", () => {
      const result = updateListSchema.safeParse({
        description: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description exceeding 5000 characters", () => {
      const result = updateListSchema.safeParse({
        description: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts null description", () => {
      const result = updateListSchema.safeParse({
        description: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("isPublic validation", () => {
    it("accepts true value", () => {
      const result = updateListSchema.safeParse({
        isPublic: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts false value", () => {
      const result = updateListSchema.safeParse({
        isPublic: false,
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing isPublic (optional)", () => {
      const result = updateListSchema.safeParse({
        name: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-boolean isPublic", () => {
      const result = updateListSchema.safeParse({
        isPublic: "true",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("empty update", () => {
    it("accepts empty object (no fields to update)", () => {
      const result = updateListSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
