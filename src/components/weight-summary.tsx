"use client";

import * as React from "react";
import type { Item } from "@/db/schema";
import {
  calculateListWeightSummary,
  fromGrams,
  formatWeight,
  type WeightUnit,
  type ListWeightSummary,
} from "@/lib/weight";

interface CategoryWithItems {
  id: string;
  name: string;
  items: Item[];
}

interface WeightSummaryProps {
  categories: CategoryWithItems[];
  displayUnit?: WeightUnit;
}

export function WeightSummary({
  categories,
  displayUnit = "g",
}: WeightSummaryProps) {
  const summary = React.useMemo(
    () => calculateListWeightSummary(categories),
    [categories]
  );

  if (categories.length === 0 || summary.totalItemCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Weight Summary
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
              <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Category
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                Items
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  Base
                  <span className="text-zinc-400 dark:text-zinc-500">*</span>
                </span>
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  Worn
                  <span className="text-blue-500">*</span>
                </span>
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  Consumable
                  <span className="text-amber-500">*</span>
                </span>
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {summary.categories.map((category) => (
              <CategoryRow
                key={category.categoryId}
                category={category}
                displayUnit={displayUnit}
              />
            ))}
          </tbody>
          <tfoot>
            <TotalsRow summary={summary} displayUnit={displayUnit} />
          </tfoot>
        </table>
      </div>
      <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <WeightBreakdown summary={summary} displayUnit={displayUnit} />
      </div>
    </div>
  );
}

interface CategoryRowProps {
  category: {
    categoryId: string;
    categoryName: string;
    baseWeight: number;
    wornWeight: number;
    consumableWeight: number;
    totalWeight: number;
    itemCount: number;
  };
  displayUnit: WeightUnit;
}

function CategoryRow({ category, displayUnit }: CategoryRowProps) {
  const display = (grams: number) => {
    if (grams === 0) return "-";
    return formatWeight(fromGrams(grams, displayUnit), displayUnit);
  };

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
        {category.categoryName}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
        {category.itemCount}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
        {display(category.baseWeight)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">
        {display(category.wornWeight)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
        {display(category.consumableWeight)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
        {display(category.totalWeight)}
      </td>
    </tr>
  );
}

interface TotalsRowProps {
  summary: ListWeightSummary;
  displayUnit: WeightUnit;
}

function TotalsRow({ summary, displayUnit }: TotalsRowProps) {
  const display = (grams: number) => {
    if (grams === 0) return "-";
    return formatWeight(fromGrams(grams, displayUnit), displayUnit);
  };

  return (
    <tr className="border-t border-zinc-200 bg-zinc-50 font-medium dark:border-zinc-800 dark:bg-zinc-800/50">
      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">Total</td>
      <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
        {summary.totalItemCount}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
        {display(summary.totalBaseWeight)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">
        {display(summary.totalWornWeight)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
        {display(summary.totalConsumableWeight)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
        {display(summary.totalPackWeight)}
      </td>
    </tr>
  );
}

interface WeightBreakdownProps {
  summary: ListWeightSummary;
  displayUnit: WeightUnit;
}

function WeightBreakdown({ summary, displayUnit }: WeightBreakdownProps) {
  const baseWeight = fromGrams(summary.totalBaseWeight, displayUnit);
  const wornWeight = fromGrams(summary.totalWornWeight, displayUnit);
  const consumableWeight = fromGrams(summary.totalConsumableWeight, displayUnit);
  const packWeight = fromGrams(summary.totalPackWeight, displayUnit);
  const skinOutWeight = baseWeight + wornWeight;

  // Calculate percentages
  const basePercent = packWeight > 0 ? (baseWeight / packWeight) * 100 : 0;
  const wornPercent = packWeight > 0 ? (wornWeight / packWeight) * 100 : 0;
  const consumablePercent = packWeight > 0 ? (consumableWeight / packWeight) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Weight bar visualization */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="flex h-full">
          {basePercent > 0 && (
            <div
              className="bg-zinc-400 dark:bg-zinc-500"
              style={{ width: `${basePercent}%` }}
              title={`Base: ${basePercent.toFixed(1)}%`}
            />
          )}
          {wornPercent > 0 && (
            <div
              className="bg-blue-500"
              style={{ width: `${wornPercent}%` }}
              title={`Worn: ${wornPercent.toFixed(1)}%`}
            />
          )}
          {consumablePercent > 0 && (
            <div
              className="bg-amber-500"
              style={{ width: `${consumablePercent}%` }}
              title={`Consumable: ${consumablePercent.toFixed(1)}%`}
            />
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Base Weight</div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatWeight(baseWeight, displayUnit)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Skin-Out</div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatWeight(skinOutWeight, displayUnit)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Consumables</div>
          <div className="font-medium text-amber-600 dark:text-amber-400">
            {formatWeight(consumableWeight, displayUnit)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Total Pack</div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {formatWeight(packWeight, displayUnit)}
          </div>
        </div>
      </div>
    </div>
  );
}
