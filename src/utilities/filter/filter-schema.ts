import { z } from 'zod';
import type { FilterCondition, FilterGroup } from '@/types/filter.ts';

const nonblankString = z
  .string()
  .refine((value) => value.trim().length > 0, 'Expected a nonblank string');

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const date = new Date(0);

    date.setUTCFullYear(year, month - 1, day);

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    );
  }, 'Expected a real calendar date');

const finiteNumber = z.number().finite();
const noValueOperators = z.enum(['isEmpty', 'isNotEmpty']);

const numberRange = z
  .object({ from: finiteNumber, to: finiteNumber })
  .strict()
  .refine(({ from, to }) => from <= to, 'Range start must not exceed end');

const dateRange = z
  .object({ from: dateString, to: dateString })
  .strict()
  .refine(({ from, to }) => from <= to, 'Range start must not exceed end');

const enumValues = z
  .array(nonblankString)
  .min(1)
  .refine((values) => new Set(values).size === values.length, {
    message: 'Enum selections must be unique',
  });

const valuelessCondition = <T extends 'string' | 'number' | 'boolean' | 'enum' | 'date'>(type: T) =>
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal(type),
      operator: noValueOperators,
    })
    .strict();

/** Strict runtime contract for every public condition/operator/value pairing. */
export const filterConditionSchema: z.ZodType<FilterCondition> = z.union([
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('string'),
      operator: z.enum([
        'equals',
        'notEquals',
        'contains',
        'notContains',
        'startsWith',
        'endsWith',
      ]),
      value: nonblankString,
    })
    .strict(),
  valuelessCondition('string'),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('number'),
      operator: z.enum([
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
      ]),
      value: finiteNumber,
    })
    .strict(),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('number'),
      operator: z.literal('between'),
      value: numberRange,
    })
    .strict(),
  valuelessCondition('number'),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('boolean'),
      operator: z.literal('equals'),
      value: z.boolean(),
    })
    .strict(),
  valuelessCondition('boolean'),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('enum'),
      operator: z.enum(['equals', 'notEquals']),
      value: nonblankString,
    })
    .strict(),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('enum'),
      operator: z.enum(['in', 'notIn']),
      value: enumValues,
    })
    .strict(),
  valuelessCondition('enum'),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('date'),
      operator: z.enum(['on', 'notOn', 'before', 'onOrBefore', 'after', 'onOrAfter']),
      value: dateString,
    })
    .strict(),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('date'),
      operator: z.literal('between'),
      value: dateRange,
    })
    .strict(),
  z
    .object({
      fieldKey: nonblankString,
      type: z.literal('date'),
      operator: z.literal('withinLast'),
      value: z
        .object({
          amount: finiteNumber.int().min(1),
          unit: z.enum(['days', 'weeks', 'months']),
        })
        .strict(),
    })
    .strict(),
  valuelessCondition('date'),
]);

/** Recursive input schema; canonicalization happens in the expression model. */
export const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z
    .object({
      combinator: z.enum(['and', 'or']),
      conditions: z.array(z.union([filterConditionSchema, filterGroupSchema])),
    })
    .strict(),
);

/** Parses a public group and throws a concise prop-contract error on failure. */
export function parseFilterGroup(value: unknown, source = 'filter group'): FilterGroup {
  const result = filterGroupSchema.safeParse(value);

  if (result.success) return result.data;
  throw new TypeError(`Invalid ${source}:\n${z.prettifyError(result.error)}`);
}
