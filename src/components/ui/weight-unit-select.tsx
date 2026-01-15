"use client";

import * as React from "react";
import type { WeightUnit } from "@/lib/weight";

export interface WeightUnitOption {
  value: WeightUnit;
  label: string;
  shortLabel: string;
}

export const WEIGHT_UNIT_OPTIONS: WeightUnitOption[] = [
  { value: "g", label: "Grams (g)", shortLabel: "g" },
  { value: "oz", label: "Ounces (oz)", shortLabel: "oz" },
  { value: "kg", label: "Kilograms (kg)", shortLabel: "kg" },
  { value: "lbs", label: "Pounds (lbs)", shortLabel: "lbs" },
];

export interface WeightUnitSelectProps {
  value: WeightUnit;
  onChange: (value: WeightUnit) => void;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  className?: string;
}

export function WeightUnitSelect({
  value,
  onChange,
  disabled = false,
  hasError = false,
  id,
  className,
}: WeightUnitSelectProps) {
  const baseClassName = `flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300 ${
    hasError
      ? "border-red-500 dark:border-red-500"
      : "border-neutral-200 dark:border-neutral-800"
  }`;

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as WeightUnit)}
      disabled={disabled}
      className={className ?? baseClassName}
    >
      {WEIGHT_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
