import { z } from 'zod';
import { fromFilterGroup, isFilterGroup, toFilterGroup } from './expression.ts';
import { filterGroupSchema } from './filter-schema.ts';
import { stableSerialize } from './stable-serialize.ts';
import type { FilterGroup } from '@/types/filter.ts';

export const SAVED_VIEWS_STORAGE_KEY = 'filter.saved-views';

const EMPTY_SAVED_GROUP: FilterGroup = {
  combinator: 'and',
  conditions: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Restores only the root defaults accepted by the documented v1 reader. */
function withLegacyRootDefaults(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    combinator: value['combinator'] === undefined ? 'and' : value['combinator'],
    conditions: value['conditions'] === undefined ? [] : value['conditions'],
  };
}

const savedFilterGroupSchema = z
  .preprocess(withLegacyRootDefaults, filterGroupSchema)
  .refine(
    (group) =>
      group.conditions.every(
        (member) =>
          !isFilterGroup(member) ||
          member.conditions.every((child) => !isFilterGroup(child)),
      ),
    { message: 'Saved groups may not be nested more than two levels' },
  )
  .refine(
    (group) =>
      group.combinator === 'or' ||
      group.conditions.every(
        (member) =>
          !isFilterGroup(member) ||
          member.combinator === 'and' ||
          member.conditions.length < 2,
      ),
    { message: 'An or group inside an and root is not expressible' },
  );

const savedViewSchema = z
  .object({
    name: z.string().trim().min(1).default('Untitled view'),
    group: savedFilterGroupSchema.default(EMPTY_SAVED_GROUP),
  })
  .strict();

/** A named canonical public filter group that can be persisted and restored. */
export type SavedView = z.infer<typeof savedViewSchema>;

/** Validates each stored view independently and keeps the first unique name. */
export function parseSavedViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return [];
  const views: SavedView[] = [];
  const seenNames = new Set<string>();
  for (const entry of raw) {
    const result = savedViewSchema.safeParse(entry);
    if (!result.success || seenNames.has(result.data.name)) continue;
    seenNames.add(result.data.name);
    views.push(result.data);
  }
  return views;
}

/** Canonical, key-order-independent identity for active-view comparison. */
export function savedViewKey(group: FilterGroup): string {
  let nextId = 0;
  const canonical = toFilterGroup(
    fromFilterGroup(group, () => `saved-view-key-${nextId++}`),
  );
  return stableSerialize(canonical);
}
