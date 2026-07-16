import { z } from 'zod';

import type { FilterFieldDefinition } from '@/types/filter.ts';

import { OPERATORS_BY_TYPE } from './operators.ts';
import { stableSerialize } from './stable-serialize.ts';

const key = z
  .string()
  .refine(
    (value) => value.length > 0 && value === value.trim(),
    'Expected a nonblank, trimmed key',
  );
const label = z
  .string()
  .refine(
    (value) => value.length > 0 && value === value.trim(),
    'Expected a nonblank, trimmed label',
  )
  .optional();
const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;
const operators = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).min(1).refine(unique, 'Operators must be unique').optional();
const options = z.array(key).min(1).refine(unique, 'Enum options must be unique');

const fieldDefinitionSchema = z.discriminatedUnion('type', [
  z
    .object({
      key,
      label,
      type: z.literal('string'),
      operators: operators(OPERATORS_BY_TYPE.string),
    })
    .strict(),
  z
    .object({
      key,
      label,
      type: z.literal('number'),
      operators: operators(OPERATORS_BY_TYPE.number),
    })
    .strict(),
  z
    .object({
      key,
      label,
      type: z.literal('boolean'),
      operators: operators(OPERATORS_BY_TYPE.boolean),
    })
    .strict(),
  z
    .object({
      key,
      label,
      type: z.literal('enum'),
      operators: operators(OPERATORS_BY_TYPE.enum),
      options,
    })
    .strict(),
  z
    .object({
      key,
      label,
      type: z.literal('date'),
      operators: operators(OPERATORS_BY_TYPE.date),
    })
    .strict(),
]);

export type FilterFieldRegistry = {
  fields: readonly FilterFieldDefinition[];
  byKey: ReadonlyMap<string, FilterFieldDefinition>;
  signature: string;
};

/** Validates injected definitions and builds a content-sensitive lookup. */
export function createFilterFieldRegistry(
  value: readonly FilterFieldDefinition[],
): FilterFieldRegistry {
  const result = z.array(fieldDefinitionSchema).safeParse(value);

  if (!result.success) {
    throw new TypeError(`Invalid fields:\n${z.prettifyError(result.error)}`);
  }

  const fields = structuredClone(value);
  const byKey = new Map<string, FilterFieldDefinition>();

  for (const field of fields) {
    if (byKey.has(field.key)) {
      throw new TypeError(`Invalid fields: duplicate field key "${field.key}"`);
    }

    byKey.set(field.key, field);
  }

  return {
    fields,
    byKey,
    signature: stableSerialize(fields),
  };
}
