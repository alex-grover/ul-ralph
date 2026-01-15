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
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:px-4 sm:py-3">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Weight Summary
        </h2>
      </div>
      {/* Mobile card layout */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
        {summary.categories.map((category) => (
          <CategoryCard
            key={category.categoryId}
            category={category}
            displayUnit={displayUnit}
          />
        ))}
        <TotalsCard summary={summary} displayUnit={displayUnit} />
      </div>
      {/* Desktop table layout */}
      <div className="hidden overflow-x-auto sm:block">
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
      <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:px-4">
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

// Mobile card components
function CategoryCard({ category, displayUnit }: CategoryRowProps) {
  const display = (grams: number) => {
    if (grams === 0) return "-";
    return formatWeight(fromGrams(grams, displayUnit), displayUnit);
  };

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {category.categoryName}
        </span>
        <span className="text-sm tabular-nums font-medium text-zinc-900 dark:text-zinc-100 shrink-0 ml-2">
          {display(category.totalWeight)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-zinc-500 dark:text-zinc-500">
          {category.itemCount} {category.itemCount === 1 ? "item" : "items"}
        </span>
        {category.baseWeight > 0 && (
          <span className="text-zinc-600 dark:text-zinc-400">
            Base: {display(category.baseWeight)}
          </span>
        )}
        {category.wornWeight > 0 && (
          <span className="text-blue-600 dark:text-blue-400">
            Worn: {display(category.wornWeight)}
          </span>
        )}
        {category.consumableWeight > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            Cons: {display(category.consumableWeight)}
          </span>
        )}
      </div>
    </div>
  );
}

function TotalsCard({ summary, displayUnit }: TotalsRowProps) {
  const display = (grams: number) => {
    if (grams === 0) return "-";
    return formatWeight(fromGrams(grams, displayUnit), displayUnit);
  };

  return (
    <div className="px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          Total
        </span>
        <span className="text-sm tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
          {display(summary.totalPackWeight)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-zinc-500 dark:text-zinc-500">
          {summary.totalItemCount} {summary.totalItemCount === 1 ? "item" : "items"}
        </span>
        {summary.totalBaseWeight > 0 && (
          <span className="text-zinc-600 dark:text-zinc-400">
            Base: {display(summary.totalBaseWeight)}
          </span>
        )}
        {summary.totalWornWeight > 0 && (
          <span className="text-blue-600 dark:text-blue-400">
            Worn: {display(summary.totalWornWeight)}
          </span>
        )}
        {summary.totalConsumableWeight > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            Cons: {display(summary.totalConsumableWeight)}
          </span>
        )}
      </div>
    </div>
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
    <div className="space-y-2 sm:space-y-3">
      {/* Weight bar visualization */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 sm:h-3">
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
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4 sm:gap-4 sm:text-sm">
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Base Weight</div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
            {formatWeight(baseWeight, displayUnit)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Skin-Out</div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
            {formatWeight(skinOutWeight, displayUnit)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Consumables</div>
          <div className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
            {formatWeight(consumableWeight, displayUnit)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 dark:text-zinc-500">Total Pack</div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {formatWeight(packWeight, displayUnit)}
          </div>
        </div>
      </div>
    </div>
  );
}
