import { revalidateTag as nextRevalidateTag } from "next/cache";

/**
 * Cache tag for a public list. Used to invalidate the SSR cache when list data changes.
 */
export function getListCacheTag(listId: string): string {
  return `list-${listId}`;
}

/**
 * Revalidate the cache for a specific list.
 * Call this whenever list data (list metadata, categories, or items) changes.
 * Uses "max" cacheLife profile for stale-while-revalidate behavior.
 */
export function revalidateListCache(listId: string): void {
  nextRevalidateTag(getListCacheTag(listId), "max");
}
