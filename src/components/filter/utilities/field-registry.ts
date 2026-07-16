import { z } from 'zod';

import type { FilterEnumOption, FilterFieldDefinition } from '@filter/types.ts';

import { ENUM_OPERATORS_BY_VALUE_CARDINALITY, OPERATORS_BY_TYPE } from './operators.ts';
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
const optionLabel = z
  .string()
  .refine(
    (value) => value.length > 0 && value === value.trim(),
    'Expected a nonblank, trimmed label',
  );
const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;
const operators = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).min(1).refine(unique, 'Operators must be unique').optional();
const enumOptionDescriptor = z.object({ value: key, label: optionLabel }).strict();
const enumOption = z.union([key, enumOptionDescriptor]);
const optionValue = (option: z.infer<typeof enumOption>) =>
  typeof option === 'string' ? option : option.value;
const options = z
  .array(enumOption)
  .min(1)
  .refine((values) => unique(values.map(optionValue)), 'Enum option values must be unique');
const enumOperators = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'containsAny',
  'containsAll',
  'containsNone',
  'isEmpty',
  'isNotEmpty',
] as const;
const enumFieldDefinitionSchema = z
  .object({
    key,
    label,
    type: z.literal('enum'),
    valueCardinality: z.enum(['single', 'multiple']).optional(),
    operators: operators(enumOperators),
    options,
  })
  .strict()
  .superRefine((field, context) => {
    if (!field.operators) return;

    const allowedOperators = new Set<string>(
      ENUM_OPERATORS_BY_VALUE_CARDINALITY[field.valueCardinality ?? 'single'],
    );

    for (const [index, operator] of field.operators.entries()) {
      if (allowedOperators.has(operator)) continue;

      context.addIssue({
        code: 'custom',
        message: `Operator "${operator}" is not valid for ${field.valueCardinality ?? 'single'}-value enum fields`,
        path: ['operators', index],
      });
    }
  });

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
  enumFieldDefinitionSchema,
  z
    .object({
      key,
      label,
      type: z.literal('date'),
      operators: operators(OPERATORS_BY_TYPE.date),
    })
    .strict(),
]);

export type NormalizedFilterEnumOption = Exclude<FilterEnumOption, string>;

function optionsAreNormalized(
  enumOptions: readonly FilterEnumOption[],
): enumOptions is readonly NormalizedFilterEnumOption[] {
  return enumOptions.every((option) => typeof option !== 'string');
}

/** Returns an enum field's options as stable value/display-label descriptors. */
export function enumOptionsForField(
  field: FilterFieldDefinition<'enum'>,
): readonly NormalizedFilterEnumOption[] {
  const enumOptions: readonly FilterEnumOption[] = field.options ?? [];

  if (optionsAreNormalized(enumOptions)) return enumOptions;

  return enumOptions.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
}

function normalizeFieldDefinition(field: FilterFieldDefinition): FilterFieldDefinition {
  const clonedField = structuredClone(field);

  if (clonedField.type !== 'enum') return clonedField;
  const normalizedOptions = enumOptionsForField(clonedField);

  if (clonedField.valueCardinality === 'multiple') {
    return {
      ...clonedField,
      valueCardinality: 'multiple',
      options: normalizedOptions,
    };
  }

  return {
    ...clonedField,
    valueCardinality: 'single',
    options: normalizedOptions,
  };
}

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

  const fields = value.map(normalizeFieldDefinition);
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
