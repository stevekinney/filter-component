import type { FilterFieldDefinition } from '@filter/types.ts';

function rankFields(
  fields: readonly FilterFieldDefinition[],
  normalizedQuery: string,
): readonly FilterFieldDefinition[] {
  const prefix: FilterFieldDefinition[] = [];
  const contains: FilterFieldDefinition[] = [];

  for (const field of fields) {
    const label = (field.label ?? field.key).toLowerCase();
    const key = field.key.toLowerCase();

    if (label.startsWith(normalizedQuery) || key.startsWith(normalizedQuery)) {
      prefix.push(field);
    } else if (label.includes(normalizedQuery) || key.includes(normalizedQuery)) {
      contains.push(field);
    }
  }

  return [...prefix, ...contains];
}

/**
 * Ranks field definitions for an add-filter query: prefix matches (on label
 * or key) come before contains matches, preserving definition order within
 * each group. An empty query returns every field.
 */
export function searchFields(
  fields: readonly FilterFieldDefinition[],
  query: string,
): readonly FilterFieldDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return fields;
  return rankFields(fields, normalized);
}
