import { describe, it, expect } from "vitest";
import type { Item } from "@/db/schema";
import {
  convertWeight,
  toGrams,
  fromGrams,
  formatWeight,
  calculateItemWeights,
  calculateCategoryWeight,
  calculateListWeightSummary,
  type WeightUnit,
} from "./weight";

// Helper to create a mock item for testing
function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    categoryId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Test Item",
    description: null,
    url: null,
    weightAmount: 100,
    weightUnit: "g",
    label: "none",
    quantity: 1,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("convertWeight", () => {
  describe("same unit conversions", () => {
    it("returns same value when converting g to g", () => {
      expect(convertWeight(100, "g", "g")).toBe(100);
    });

    it("returns same value when converting oz to oz", () => {
      expect(convertWeight(5, "oz", "oz")).toBe(5);
    });

    it("returns same value when converting kg to kg", () => {
      expect(convertWeight(2, "kg", "kg")).toBe(2);
    });

    it("returns same value when converting lbs to lbs", () => {
      expect(convertWeight(3, "lbs", "lbs")).toBe(3);
    });
  });

  describe("grams conversions", () => {
    it("converts grams to ounces correctly", () => {
      // 28.3495g = 1oz
      const result = convertWeight(28.3495, "g", "oz");
      expect(result).toBeCloseTo(1, 4);
    });

    it("converts grams to kilograms correctly", () => {
      expect(convertWeight(1000, "g", "kg")).toBe(1);
    });

    it("converts grams to pounds correctly", () => {
      // 453.592g = 1lb
      const result = convertWeight(453.592, "g", "lbs");
      expect(result).toBeCloseTo(1, 4);
    });
  });

  describe("ounces conversions", () => {
    it("converts ounces to grams correctly", () => {
      const result = convertWeight(1, "oz", "g");
      expect(result).toBeCloseTo(28.3495, 4);
    });

    it("converts ounces to kilograms correctly", () => {
      // 1oz = 0.0283495kg
      const result = convertWeight(1, "oz", "kg");
      expect(result).toBeCloseTo(0.0283495, 6);
    });

    it("converts ounces to pounds correctly", () => {
      // 16oz = 1lb
      const result = convertWeight(16, "oz", "lbs");
      expect(result).toBeCloseTo(1, 2);
    });
  });

  describe("kilograms conversions", () => {
    it("converts kilograms to grams correctly", () => {
      expect(convertWeight(1, "kg", "g")).toBe(1000);
    });

    it("converts kilograms to ounces correctly", () => {
      // 1kg = ~35.274oz
      const result = convertWeight(1, "kg", "oz");
      expect(result).toBeCloseTo(35.274, 2);
    });

    it("converts kilograms to pounds correctly", () => {
      // 1kg = ~2.205lbs
      const result = convertWeight(1, "kg", "lbs");
      expect(result).toBeCloseTo(2.205, 2);
    });
  });

  describe("pounds conversions", () => {
    it("converts pounds to grams correctly", () => {
      const result = convertWeight(1, "lbs", "g");
      expect(result).toBeCloseTo(453.592, 2);
    });

    it("converts pounds to ounces correctly", () => {
      // 1lb = ~16oz
      const result = convertWeight(1, "lbs", "oz");
      expect(result).toBeCloseTo(16, 2);
    });

    it("converts pounds to kilograms correctly", () => {
      // 1lb = ~0.4536kg
      const result = convertWeight(1, "lbs", "kg");
      expect(result).toBeCloseTo(0.4536, 3);
    });
  });

  describe("edge cases", () => {
    it("handles zero weight", () => {
      expect(convertWeight(0, "g", "oz")).toBe(0);
      expect(convertWeight(0, "kg", "lbs")).toBe(0);
    });

    it("handles very small weights", () => {
      const result = convertWeight(0.001, "g", "oz");
      expect(result).toBeGreaterThan(0);
    });

    it("handles very large weights", () => {
      const result = convertWeight(1000000, "g", "kg");
      expect(result).toBe(1000);
    });
  });
});

describe("toGrams", () => {
  it("converts grams to grams (no change)", () => {
    expect(toGrams(100, "g")).toBe(100);
  });

  it("converts ounces to grams", () => {
    const result = toGrams(1, "oz");
    expect(result).toBeCloseTo(28.3495, 4);
  });

  it("converts kilograms to grams", () => {
    expect(toGrams(1, "kg")).toBe(1000);
  });

  it("converts pounds to grams", () => {
    const result = toGrams(1, "lbs");
    expect(result).toBeCloseTo(453.592, 2);
  });

  it("handles invalid unit by defaulting to grams", () => {
    // Invalid unit should be treated as grams
    expect(toGrams(100, "invalid")).toBe(100);
    expect(toGrams(50, "")).toBe(50);
  });

  it("handles zero weight", () => {
    expect(toGrams(0, "oz")).toBe(0);
  });
});

describe("fromGrams", () => {
  it("converts grams to grams (no change)", () => {
    expect(fromGrams(100, "g")).toBe(100);
  });

  it("converts grams to ounces", () => {
    const result = fromGrams(28.3495, "oz");
    expect(result).toBeCloseTo(1, 4);
  });

  it("converts grams to kilograms", () => {
    expect(fromGrams(1000, "kg")).toBe(1);
  });

  it("converts grams to pounds", () => {
    const result = fromGrams(453.592, "lbs");
    expect(result).toBeCloseTo(1, 4);
  });

  it("handles zero grams", () => {
    expect(fromGrams(0, "oz")).toBe(0);
    expect(fromGrams(0, "kg")).toBe(0);
  });
});

describe("formatWeight", () => {
  describe("precision formatting", () => {
    it("shows two decimals for very small values (< 0.1)", () => {
      expect(formatWeight(0.05, "oz")).toBe("0.05 oz");
      expect(formatWeight(0.01, "kg")).toBe("0.01 kg");
    });

    it("shows one decimal for values under 10", () => {
      expect(formatWeight(5, "oz")).toBe("5.0 oz");
      expect(formatWeight(9.5, "g")).toBe("9.5 g");
      expect(formatWeight(0.5, "kg")).toBe("0.5 kg");
    });

    it("rounds to integer for values 10 and above", () => {
      expect(formatWeight(10, "g")).toBe("10 g");
      expect(formatWeight(100.6, "g")).toBe("101 g");
      expect(formatWeight(1500, "g")).toBe("1500 g");
    });
  });

  describe("unit display", () => {
    it("displays grams correctly", () => {
      expect(formatWeight(500, "g")).toBe("500 g");
    });

    it("displays ounces correctly", () => {
      expect(formatWeight(5, "oz")).toBe("5.0 oz");
    });

    it("displays kilograms correctly", () => {
      expect(formatWeight(2.5, "kg")).toBe("2.5 kg");
    });

    it("displays pounds correctly", () => {
      expect(formatWeight(3.5, "lbs")).toBe("3.5 lbs");
    });
  });

  describe("edge cases", () => {
    it("handles zero weight", () => {
      // 0 is < 10 and not (< 0.1 and > 0), so it falls to the second case
      expect(formatWeight(0, "g")).toBe("0.0 g");
    });

    it("handles exact boundary value of 0.1", () => {
      // 0.1 is not < 0.1, so it falls to the second case
      expect(formatWeight(0.1, "oz")).toBe("0.1 oz");
    });

    it("handles exact boundary value of 10", () => {
      // 10 is not < 10, so it falls to the third case
      expect(formatWeight(10, "oz")).toBe("10 oz");
    });
  });
});

describe("calculateItemWeights", () => {
  describe("base weight items (label: none)", () => {
    it("calculates base weight for single item", () => {
      const item = createMockItem({
        weightAmount: 500,
        weightUnit: "g",
        label: "none",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 500,
        wornWeight: 0,
        consumableWeight: 0,
      });
    });

    it("calculates base weight for multiple quantity items", () => {
      const item = createMockItem({
        weightAmount: 100,
        weightUnit: "g",
        label: "none",
        quantity: 5,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 500,
        wornWeight: 0,
        consumableWeight: 0,
      });
    });

    it("converts from ounces to grams for calculation", () => {
      const item = createMockItem({
        weightAmount: 1,
        weightUnit: "oz",
        label: "none",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result.baseWeight).toBeCloseTo(28.3495, 4);
      expect(result.wornWeight).toBe(0);
      expect(result.consumableWeight).toBe(0);
    });

    it("converts from kilograms to grams for calculation", () => {
      const item = createMockItem({
        weightAmount: 1,
        weightUnit: "kg",
        label: "none",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result.baseWeight).toBe(1000);
    });

    it("converts from pounds to grams for calculation", () => {
      const item = createMockItem({
        weightAmount: 1,
        weightUnit: "lbs",
        label: "none",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result.baseWeight).toBeCloseTo(453.592, 2);
    });
  });

  describe("worn weight items (label: worn)", () => {
    it("calculates worn weight for single worn item", () => {
      const item = createMockItem({
        weightAmount: 300,
        weightUnit: "g",
        label: "worn",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 0,
        wornWeight: 300,
        consumableWeight: 0,
      });
    });

    it("splits worn weight correctly for quantity > 1 (first worn, rest base)", () => {
      const item = createMockItem({
        weightAmount: 100,
        weightUnit: "g",
        label: "worn",
        quantity: 3,
      });
      const result = calculateItemWeights(item);
      // First item (100g) is worn, remaining 2 items (200g) are base weight
      expect(result).toEqual({
        baseWeight: 200,
        wornWeight: 100,
        consumableWeight: 0,
      });
    });

    it("handles worn item with quantity 2", () => {
      const item = createMockItem({
        weightAmount: 500,
        weightUnit: "g",
        label: "worn",
        quantity: 2,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 500, // 1 extra in pack
        wornWeight: 500, // 1 worn
        consumableWeight: 0,
      });
    });

    it("handles worn item with large quantity", () => {
      const item = createMockItem({
        weightAmount: 50,
        weightUnit: "g",
        label: "worn",
        quantity: 10,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 450, // 9 in pack (9 * 50g)
        wornWeight: 50, // 1 worn (1 * 50g)
        consumableWeight: 0,
      });
    });
  });

  describe("consumable weight items (label: consumable)", () => {
    it("calculates consumable weight for single item", () => {
      const item = createMockItem({
        weightAmount: 1000,
        weightUnit: "g",
        label: "consumable",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 0,
        wornWeight: 0,
        consumableWeight: 1000,
      });
    });

    it("calculates consumable weight for multiple quantity items", () => {
      const item = createMockItem({
        weightAmount: 500,
        weightUnit: "g",
        label: "consumable",
        quantity: 4,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 0,
        wornWeight: 0,
        consumableWeight: 2000,
      });
    });
  });

  describe("edge cases", () => {
    it("handles zero weight item", () => {
      const item = createMockItem({
        weightAmount: 0,
        weightUnit: "g",
        label: "none",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 0,
        wornWeight: 0,
        consumableWeight: 0,
      });
    });

    it("handles zero weight worn item", () => {
      const item = createMockItem({
        weightAmount: 0,
        weightUnit: "g",
        label: "worn",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result).toEqual({
        baseWeight: 0,
        wornWeight: 0,
        consumableWeight: 0,
      });
    });

    it("handles decimal weight amounts", () => {
      const item = createMockItem({
        weightAmount: 123.456,
        weightUnit: "g",
        label: "none",
        quantity: 1,
      });
      const result = calculateItemWeights(item);
      expect(result.baseWeight).toBe(123.456);
    });
  });
});

describe("calculateCategoryWeight", () => {
  it("calculates weights for empty category", () => {
    const category = {
      id: "cat-1",
      name: "Shelter",
      items: [],
    };
    const result = calculateCategoryWeight(category);
    expect(result).toEqual({
      categoryId: "cat-1",
      categoryName: "Shelter",
      baseWeight: 0,
      wornWeight: 0,
      consumableWeight: 0,
      totalWeight: 0,
      itemCount: 0,
    });
  });

  it("calculates weights for category with single base item", () => {
    const category = {
      id: "cat-1",
      name: "Shelter",
      items: [
        createMockItem({
          weightAmount: 500,
          weightUnit: "g",
          label: "none",
          quantity: 1,
        }),
      ],
    };
    const result = calculateCategoryWeight(category);
    expect(result).toEqual({
      categoryId: "cat-1",
      categoryName: "Shelter",
      baseWeight: 500,
      wornWeight: 0,
      consumableWeight: 0,
      totalWeight: 500,
      itemCount: 1,
    });
  });

  it("aggregates weights from multiple items", () => {
    const category = {
      id: "cat-1",
      name: "Clothing",
      items: [
        createMockItem({
          id: "item-1",
          name: "Shirt",
          weightAmount: 200,
          weightUnit: "g",
          label: "worn",
          quantity: 1,
        }),
        createMockItem({
          id: "item-2",
          name: "Pants",
          weightAmount: 300,
          weightUnit: "g",
          label: "worn",
          quantity: 1,
        }),
        createMockItem({
          id: "item-3",
          name: "Extra Socks",
          weightAmount: 50,
          weightUnit: "g",
          label: "none",
          quantity: 2,
        }),
      ],
    };
    const result = calculateCategoryWeight(category);
    expect(result).toEqual({
      categoryId: "cat-1",
      categoryName: "Clothing",
      baseWeight: 100, // 2 pairs of socks
      wornWeight: 500, // shirt + pants
      consumableWeight: 0,
      totalWeight: 600,
      itemCount: 3,
    });
  });

  it("handles mixed label types correctly", () => {
    const category = {
      id: "cat-1",
      name: "Food & Water",
      items: [
        createMockItem({
          id: "item-1",
          name: "Water Bottle",
          weightAmount: 100,
          weightUnit: "g",
          label: "none",
          quantity: 1,
        }),
        createMockItem({
          id: "item-2",
          name: "Water",
          weightAmount: 1000,
          weightUnit: "g",
          label: "consumable",
          quantity: 1,
        }),
        createMockItem({
          id: "item-3",
          name: "Food",
          weightAmount: 500,
          weightUnit: "g",
          label: "consumable",
          quantity: 2,
        }),
      ],
    };
    const result = calculateCategoryWeight(category);
    expect(result).toEqual({
      categoryId: "cat-1",
      categoryName: "Food & Water",
      baseWeight: 100,
      wornWeight: 0,
      consumableWeight: 2000, // 1000 + 500*2
      totalWeight: 2100,
      itemCount: 3,
    });
  });

  it("handles items with different units", () => {
    const category = {
      id: "cat-1",
      name: "Mixed",
      items: [
        createMockItem({
          id: "item-1",
          weightAmount: 1,
          weightUnit: "kg",
          label: "none",
          quantity: 1,
        }),
        createMockItem({
          id: "item-2",
          weightAmount: 1,
          weightUnit: "lbs",
          label: "none",
          quantity: 1,
        }),
      ],
    };
    const result = calculateCategoryWeight(category);
    // 1kg = 1000g, 1lb = ~453.592g
    expect(result.baseWeight).toBeCloseTo(1453.592, 2);
    expect(result.totalWeight).toBeCloseTo(1453.592, 2);
    expect(result.itemCount).toBe(2);
  });

  it("handles worn items with quantity > 1 correctly in category context", () => {
    const category = {
      id: "cat-1",
      name: "Clothing",
      items: [
        createMockItem({
          id: "item-1",
          name: "Socks",
          weightAmount: 50,
          weightUnit: "g",
          label: "worn",
          quantity: 3, // 1 worn (50g), 2 in pack (100g)
        }),
      ],
    };
    const result = calculateCategoryWeight(category);
    expect(result).toEqual({
      categoryId: "cat-1",
      categoryName: "Clothing",
      baseWeight: 100, // 2 extra socks
      wornWeight: 50, // 1 worn
      consumableWeight: 0,
      totalWeight: 150,
      itemCount: 1,
    });
  });
});

describe("calculateListWeightSummary", () => {
  it("calculates summary for empty list", () => {
    const result = calculateListWeightSummary([]);
    expect(result).toEqual({
      categories: [],
      totalBaseWeight: 0,
      totalWornWeight: 0,
      totalConsumableWeight: 0,
      totalPackWeight: 0,
      totalItemCount: 0,
    });
  });

  it("calculates summary for list with empty category", () => {
    const categories = [
      {
        id: "cat-1",
        name: "Shelter",
        items: [],
      },
    ];
    const result = calculateListWeightSummary(categories);
    expect(result.categories).toHaveLength(1);
    expect(result.totalPackWeight).toBe(0);
    expect(result.totalItemCount).toBe(0);
  });

  it("calculates summary for list with single category and items", () => {
    const categories = [
      {
        id: "cat-1",
        name: "Shelter",
        items: [
          createMockItem({
            weightAmount: 500,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
        ],
      },
    ];
    const result = calculateListWeightSummary(categories);
    expect(result).toEqual({
      categories: [
        {
          categoryId: "cat-1",
          categoryName: "Shelter",
          baseWeight: 500,
          wornWeight: 0,
          consumableWeight: 0,
          totalWeight: 500,
          itemCount: 1,
        },
      ],
      totalBaseWeight: 500,
      totalWornWeight: 0,
      totalConsumableWeight: 0,
      totalPackWeight: 500,
      totalItemCount: 1,
    });
  });

  it("aggregates weights across multiple categories", () => {
    const categories = [
      {
        id: "cat-1",
        name: "Shelter",
        items: [
          createMockItem({
            id: "item-1",
            weightAmount: 500,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
        ],
      },
      {
        id: "cat-2",
        name: "Clothing",
        items: [
          createMockItem({
            id: "item-2",
            weightAmount: 300,
            weightUnit: "g",
            label: "worn",
            quantity: 1,
          }),
        ],
      },
      {
        id: "cat-3",
        name: "Food",
        items: [
          createMockItem({
            id: "item-3",
            weightAmount: 1000,
            weightUnit: "g",
            label: "consumable",
            quantity: 1,
          }),
        ],
      },
    ];
    const result = calculateListWeightSummary(categories);
    expect(result.totalBaseWeight).toBe(500);
    expect(result.totalWornWeight).toBe(300);
    expect(result.totalConsumableWeight).toBe(1000);
    expect(result.totalPackWeight).toBe(1800);
    expect(result.totalItemCount).toBe(3);
    expect(result.categories).toHaveLength(3);
  });

  it("handles complex real-world pack list", () => {
    const categories = [
      {
        id: "cat-shelter",
        name: "Shelter",
        items: [
          createMockItem({
            id: "tent",
            name: "Tent",
            weightAmount: 539,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
          createMockItem({
            id: "stakes",
            name: "Stakes",
            weightAmount: 10,
            weightUnit: "g",
            label: "none",
            quantity: 6,
          }),
          createMockItem({
            id: "groundsheet",
            name: "Ground sheet",
            weightAmount: 100,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
        ],
      },
      {
        id: "cat-sleep",
        name: "Sleep System",
        items: [
          createMockItem({
            id: "quilt",
            name: "Quilt",
            weightAmount: 600,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
          createMockItem({
            id: "pad",
            name: "Sleeping Pad",
            weightAmount: 350,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
        ],
      },
      {
        id: "cat-worn",
        name: "Worn Clothing",
        items: [
          createMockItem({
            id: "shirt",
            name: "Hiking Shirt",
            weightAmount: 150,
            weightUnit: "g",
            label: "worn",
            quantity: 1,
          }),
          createMockItem({
            id: "shorts",
            name: "Shorts",
            weightAmount: 100,
            weightUnit: "g",
            label: "worn",
            quantity: 1,
          }),
          createMockItem({
            id: "shoes",
            name: "Trail Runners",
            weightAmount: 600,
            weightUnit: "g",
            label: "worn",
            quantity: 1,
          }),
          createMockItem({
            id: "socks",
            name: "Socks",
            weightAmount: 50,
            weightUnit: "g",
            label: "worn",
            quantity: 2, // 1 worn, 1 spare
          }),
        ],
      },
      {
        id: "cat-food",
        name: "Food & Water",
        items: [
          createMockItem({
            id: "water",
            name: "Water",
            weightAmount: 1,
            weightUnit: "kg",
            label: "consumable",
            quantity: 2,
          }),
          createMockItem({
            id: "food",
            name: "Food",
            weightAmount: 500,
            weightUnit: "g",
            label: "consumable",
            quantity: 3,
          }),
        ],
      },
    ];

    const result = calculateListWeightSummary(categories);

    // Calculate expected values:
    // Shelter: 539 + 60 + 100 = 699g base
    // Sleep: 600 + 350 = 950g base
    // Worn: shirt(150) + shorts(100) + shoes(600) + 1 sock(50) = 900g worn, 1 sock(50) = 50g base
    // Food: 2kg + 1500g = 3500g consumable

    expect(result.totalBaseWeight).toBe(699 + 950 + 50); // 1699g
    expect(result.totalWornWeight).toBe(900);
    expect(result.totalConsumableWeight).toBe(3500);
    expect(result.totalPackWeight).toBe(1699 + 900 + 3500); // 6099g
    expect(result.totalItemCount).toBe(11);
  });

  it("returns correct category weight breakdowns", () => {
    const categories = [
      {
        id: "cat-1",
        name: "Category A",
        items: [
          createMockItem({
            weightAmount: 100,
            weightUnit: "g",
            label: "none",
            quantity: 1,
          }),
        ],
      },
      {
        id: "cat-2",
        name: "Category B",
        items: [
          createMockItem({
            weightAmount: 200,
            weightUnit: "g",
            label: "worn",
            quantity: 1,
          }),
        ],
      },
    ];
    const result = calculateListWeightSummary(categories);

    expect(result.categories[0].categoryName).toBe("Category A");
    expect(result.categories[0].baseWeight).toBe(100);
    expect(result.categories[0].totalWeight).toBe(100);

    expect(result.categories[1].categoryName).toBe("Category B");
    expect(result.categories[1].wornWeight).toBe(200);
    expect(result.categories[1].totalWeight).toBe(200);
  });
});

describe("weight calculation integration", () => {
  it("round-trip conversion preserves value", () => {
    const originalGrams = 1000;
    const toOz = convertWeight(originalGrams, "g", "oz");
    const backToGrams = convertWeight(toOz, "oz", "g");
    expect(backToGrams).toBeCloseTo(originalGrams, 10);
  });

  it("toGrams and fromGrams are inverse operations", () => {
    const original = 500;
    const units: WeightUnit[] = ["g", "oz", "kg", "lbs"];
    for (const unit of units) {
      const grams = toGrams(original, unit);
      const back = fromGrams(grams, unit);
      expect(back).toBeCloseTo(original, 10);
    }
  });

  it("weight summary totals equal sum of category totals", () => {
    const categories = [
      {
        id: "cat-1",
        name: "A",
        items: [
          createMockItem({
            id: "1",
            weightAmount: 100,
            label: "none",
            quantity: 2,
          }),
        ],
      },
      {
        id: "cat-2",
        name: "B",
        items: [
          createMockItem({
            id: "2",
            weightAmount: 200,
            label: "worn",
            quantity: 1,
          }),
        ],
      },
      {
        id: "cat-3",
        name: "C",
        items: [
          createMockItem({
            id: "3",
            weightAmount: 300,
            label: "consumable",
            quantity: 1,
          }),
        ],
      },
    ];

    const result = calculateListWeightSummary(categories);

    const sumBase = result.categories.reduce((s, c) => s + c.baseWeight, 0);
    const sumWorn = result.categories.reduce((s, c) => s + c.wornWeight, 0);
    const sumConsumable = result.categories.reduce(
      (s, c) => s + c.consumableWeight,
      0
    );
    const sumTotal = result.categories.reduce((s, c) => s + c.totalWeight, 0);
    const sumItems = result.categories.reduce((s, c) => s + c.itemCount, 0);

    expect(result.totalBaseWeight).toBe(sumBase);
    expect(result.totalWornWeight).toBe(sumWorn);
    expect(result.totalConsumableWeight).toBe(sumConsumable);
    expect(result.totalPackWeight).toBe(sumTotal);
    expect(result.totalItemCount).toBe(sumItems);
  });
});
