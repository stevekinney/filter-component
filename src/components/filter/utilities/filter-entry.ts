import type { FilterCondition } from '@filter/types.ts';

/** Internal condition identity used only for rendering, focus, and history. */
export type FilterEntry = FilterCondition & { id: string };

export function createFilterEntry(condition: FilterCondition, id: string): FilterEntry {
  return { ...condition, id };
}
