/**
 * Generates a URL-safe slug from a given string.
 * Converts to lowercase, replaces spaces and special characters with hyphens,
 * removes consecutive hyphens, and trims hyphens from start/end.
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generates a unique slug by appending a numeric suffix if the base slug already exists.
 * @param baseSlug - The initial slug to try
 * @param existingSlugs - Array of slugs that already exist (for the same user/session)
 * @returns A unique slug that doesn't conflict with existing ones
 */
export function makeSlugUnique(
  baseSlug: string,
  existingSlugs: string[]
): string {
  // If baseSlug is empty after processing, use a default
  const slug = baseSlug || "list";

  if (!existingSlugs.includes(slug)) {
    return slug;
  }

  // Find the next available number
  let counter = 1;
  while (existingSlugs.includes(`${slug}-${counter}`)) {
    counter++;
  }

  return `${slug}-${counter}`;
}
