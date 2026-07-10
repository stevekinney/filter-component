import type { FilterCondition } from '@/types/filter.ts';

/** Internal condition identity used only for rendering, focus, and history. */
export type FilterEntry = FilterCondition & { id: string };

/** Attaches a component-owned identifier to a checked public condition. */
export function createFilterEntry(
  condition: FilterCondition,
  id: string,
): FilterEntry {
  return { ...condition, id };
}
