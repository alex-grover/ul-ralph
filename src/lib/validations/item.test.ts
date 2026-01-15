import { describe, it, expect } from "vitest";
import { createItemSchema, updateItemSchema, reorderItemsSchema } from "./item";

describe("createItemSchema", () => {
  describe("categoryId validation", () => {
    it("accepts valid UUID", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID format", () => {
      const result = createItemSchema.safeParse({
        categoryId: "not-a-uuid",
        name: "Tent",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.categoryId).toBeDefined();
      }
    });

    it("rejects missing categoryId", () => {
      const result = createItemSchema.safeParse({
        name: "Tent",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.categoryId).toBeDefined();
      }
    });
  });

  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Big Agnes Copper Spur HV UL2",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with minimum length (1 character)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "X",
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with maximum length (255 characters)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "a".repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 255 characters", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(false);
    });

    it("accepts Unicode characters in name", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "寝袋 Sleeping Bag",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("description validation", () => {
    it("accepts valid description", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        description: "Ultralight 2-person tent",
      });
      expect(result.success).toBe(true);
    });

    it("accepts description at maximum length (5000 characters)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        description: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description exceeding 5000 characters", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        description: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts null description", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing description (optional)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("url validation", () => {
    it("accepts valid URL", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        url: "https://example.com/products/tent",
      });
      expect(result.success).toBe(true);
    });

    it("accepts URL at maximum length (2000 characters)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        url: "https://example.com/" + "a".repeat(1980),
      });
      expect(result.success).toBe(true);
    });

    it("rejects URL exceeding 2000 characters", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        url: "https://example.com/" + "a".repeat(2000),
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL format", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("accepts null URL", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        url: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing URL (optional)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("weightAmount validation", () => {
    it("accepts valid weight", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightAmount: 500,
      });
      expect(result.success).toBe(true);
    });

    it("accepts zero weight", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightAmount: 0,
      });
      expect(result.success).toBe(true);
    });

    it("accepts decimal weight", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightAmount: 123.45,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative weight", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightAmount: -5,
      });
      expect(result.success).toBe(false);
    });

    it("defaults to 0 when missing", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weightAmount).toBe(0);
      }
    });
  });

  describe("weightUnit validation", () => {
    it("accepts 'g' unit", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightUnit: "g",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'oz' unit", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightUnit: "oz",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'kg' unit", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightUnit: "kg",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'lbs' unit", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightUnit: "lbs",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid weight unit", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        weightUnit: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("defaults to 'g' when missing", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weightUnit).toBe("g");
      }
    });
  });

  describe("label validation", () => {
    it("accepts 'none' label", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        label: "none",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'worn' label", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Trail Runners",
        label: "worn",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'consumable' label", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Water",
        label: "consumable",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid label", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        label: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("defaults to 'none' when missing", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe("none");
      }
    });
  });

  describe("quantity validation", () => {
    it("accepts valid quantity", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent Stakes",
        quantity: 6,
      });
      expect(result.success).toBe(true);
    });

    it("accepts quantity of 1 (minimum)", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        quantity: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects quantity of 0", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative quantity", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        quantity: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer quantity", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
        quantity: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it("defaults to 1 when missing", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Tent",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantity).toBe(1);
      }
    });
  });

  describe("full item validation", () => {
    it("accepts complete item with all fields", () => {
      const result = createItemSchema.safeParse({
        categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Zpacks Duplex",
        description: "DCF tent for 2 people",
        url: "https://zpacks.com/products/duplex-tent",
        weightAmount: 539,
        weightUnit: "g",
        label: "none",
        quantity: 1,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("updateItemSchema", () => {
  describe("name validation", () => {
    it("accepts valid name", () => {
      const result = updateItemSchema.safeParse({
        name: "Updated Tent Name",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = updateItemSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 255 characters", () => {
      const result = updateItemSchema.safeParse({
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("accepts missing name (optional for update)", () => {
      const result = updateItemSchema.safeParse({
        description: "Updated description",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("weightAmount validation", () => {
    it("accepts valid weight", () => {
      const result = updateItemSchema.safeParse({
        weightAmount: 750,
      });
      expect(result.success).toBe(true);
    });

    it("accepts zero weight", () => {
      const result = updateItemSchema.safeParse({
        weightAmount: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative weight", () => {
      const result = updateItemSchema.safeParse({
        weightAmount: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("weightUnit validation", () => {
    it("accepts valid weight units", () => {
      for (const unit of ["g", "oz", "kg", "lbs"]) {
        const result = updateItemSchema.safeParse({
          weightUnit: unit,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid weight unit", () => {
      const result = updateItemSchema.safeParse({
        weightUnit: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("label validation", () => {
    it("accepts valid labels", () => {
      for (const label of ["none", "worn", "consumable"]) {
        const result = updateItemSchema.safeParse({
          label,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid label", () => {
      const result = updateItemSchema.safeParse({
        label: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("quantity validation", () => {
    it("accepts valid quantity", () => {
      const result = updateItemSchema.safeParse({
        quantity: 5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects quantity of 0", () => {
      const result = updateItemSchema.safeParse({
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer quantity", () => {
      const result = updateItemSchema.safeParse({
        quantity: 2.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("url validation", () => {
    it("accepts valid URL", () => {
      const result = updateItemSchema.safeParse({
        url: "https://example.com/new-url",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null URL (clear URL)", () => {
      const result = updateItemSchema.safeParse({
        url: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL", () => {
      const result = updateItemSchema.safeParse({
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("empty update", () => {
    it("accepts empty object", () => {
      const result = updateItemSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("reorderItemsSchema", () => {
  describe("listId validation", () => {
    it("accepts valid UUID", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "invalid-uuid",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("items validation", () => {
    it("accepts single item", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts multiple items", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0,
          },
          {
            id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 1,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty items array", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects duplicate item IDs", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0,
          },
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 1,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid item ID", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "invalid-uuid",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid category ID", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "invalid-uuid",
            position: 0,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative position", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: -1,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer position", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            position: 0.5,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("cross-category move validation", () => {
    it("accepts moving items to different categories", () => {
      const result = reorderItemsSchema.safeParse({
        listId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [
          {
            id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // original category
            position: 0,
          },
          {
            id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            categoryId: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // different category
            position: 0,
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});
