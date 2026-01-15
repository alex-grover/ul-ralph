import type { Item } from "@/db/schema";

export type WeightUnit = "g" | "oz" | "kg" | "lbs";

// Conversion factors to grams (base unit for calculations)
const TO_GRAMS: Record<WeightUnit, number> = {
  g: 1,
  oz: 28.3495,
  kg: 1000,
  lbs: 453.592,
};

// Conversion factors from grams
const FROM_GRAMS: Record<WeightUnit, number> = {
  g: 1,
  oz: 1 / 28.3495,
  kg: 1 / 1000,
  lbs: 1 / 453.592,
};

/**
 * Convert a weight value from one unit to another
 */
export function convertWeight(
  amount: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return amount;
  const grams = amount * TO_GRAMS[fromUnit];
  return grams * FROM_GRAMS[toUnit];
}

/**
 * Convert weight to grams for consistent calculations
 */
export function toGrams(amount: number, unit: string): number {
  const weightUnit = (unit === "g" || unit === "oz" || unit === "kg" || unit === "lbs")
    ? unit as WeightUnit
    : "g";
  return amount * TO_GRAMS[weightUnit];
}

/**
 * Convert weight from grams to a specified unit
 */
export function fromGrams(grams: number, toUnit: WeightUnit): number {
  return grams * FROM_GRAMS[toUnit];
}

/**
 * Format weight with appropriate precision
 */
export function formatWeight(amount: number, unit: WeightUnit): string {
  // For very small values, show more precision
  if (amount < 0.1 && amount > 0) {
    return `${amount.toFixed(2)} ${unit}`;
  }
  // For values under 10, show one decimal
  if (amount < 10) {
    return `${amount.toFixed(1)} ${unit}`;
  }
  // For larger values, round to nearest integer
  return `${Math.round(amount)} ${unit}`;
}

export interface CategoryWeight {
  categoryId: string;
  categoryName: string;
  baseWeight: number; // in grams
  wornWeight: number; // in grams
  consumableWeight: number; // in grams
  totalWeight: number; // in grams
  itemCount: number;
}

export interface ListWeightSummary {
  categories: CategoryWeight[];
  totalBaseWeight: number; // in grams
  totalWornWeight: number; // in grams
  totalConsumableWeight: number; // in grams
  totalPackWeight: number; // base + worn + consumable in grams
  totalItemCount: number;
}

interface CategoryWithItems {
  id: string;
  name: string;
  items: Item[];
}

/**
 * Calculate weight breakdown for a single item.
 * Handles the special case where worn items with quantity > 1
 * have the first one as worn weight and the rest as base weight.
 */
export function calculateItemWeights(item: Item): {
  baseWeight: number;
  wornWeight: number;
  consumableWeight: number;
} {
  const singleItemWeight = toGrams(item.weightAmount, item.weightUnit);
  const totalWeight = singleItemWeight * item.quantity;

  if (item.label === "worn") {
    if (item.quantity === 1) {
      return { baseWeight: 0, wornWeight: totalWeight, consumableWeight: 0 };
    }
    // First item is worn, rest are base weight
    return {
      baseWeight: singleItemWeight * (item.quantity - 1),
      wornWeight: singleItemWeight,
      consumableWeight: 0,
    };
  }

  if (item.label === "consumable") {
    return { baseWeight: 0, wornWeight: 0, consumableWeight: totalWeight };
  }

  // Default: all base weight (label === "none" or undefined)
  return { baseWeight: totalWeight, wornWeight: 0, consumableWeight: 0 };
}

/**
 * Calculate weight summary for a category
 */
export function calculateCategoryWeight(category: CategoryWithItems): CategoryWeight {
  let baseWeight = 0;
  let wornWeight = 0;
  let consumableWeight = 0;

  for (const item of category.items) {
    const weights = calculateItemWeights(item);
    baseWeight += weights.baseWeight;
    wornWeight += weights.wornWeight;
    consumableWeight += weights.consumableWeight;
  }

  return {
    categoryId: category.id,
    categoryName: category.name,
    baseWeight,
    wornWeight,
    consumableWeight,
    totalWeight: baseWeight + wornWeight + consumableWeight,
    itemCount: category.items.length,
  };
}

/**
 * Calculate complete weight summary for a list
 */
export function calculateListWeightSummary(
  categories: CategoryWithItems[]
): ListWeightSummary {
  const categoryWeights = categories.map(calculateCategoryWeight);

  const totalBaseWeight = categoryWeights.reduce((sum, c) => sum + c.baseWeight, 0);
  const totalWornWeight = categoryWeights.reduce((sum, c) => sum + c.wornWeight, 0);
  const totalConsumableWeight = categoryWeights.reduce((sum, c) => sum + c.consumableWeight, 0);
  const totalItemCount = categoryWeights.reduce((sum, c) => sum + c.itemCount, 0);

  return {
    categories: categoryWeights,
    totalBaseWeight,
    totalWornWeight,
    totalConsumableWeight,
    totalPackWeight: totalBaseWeight + totalWornWeight + totalConsumableWeight,
    totalItemCount,
  };
}
