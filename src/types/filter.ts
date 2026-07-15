import type { ComponentPropsWithRef } from 'react';
import type { SavedViewsStorage } from '@/utilities/storage/saved-views-storage.ts';

/**
 * `FilterOperatorsByFieldType` is the single source of truth for the type
 * model: it names every supported field type and the operators each one
 * accepts. Everything else — operator unions, condition shapes, field
 * definitions, value shapes — derives from it, so narrowing a condition's
 * `type` also narrows its `operator` and `value`.
 */
export type FilterOperatorsByFieldType = {
  string:
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'isEmpty'
    | 'isNotEmpty';
  number:
    | 'equals'
    | 'notEquals'
    | 'greaterThan'
    | 'greaterThanOrEqual'
    | 'lessThan'
    | 'lessThanOrEqual'
    | 'between'
    | 'isEmpty'
    | 'isNotEmpty';
  boolean: 'equals' | 'isEmpty' | 'isNotEmpty';
  enum: 'equals' | 'notEquals' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty';
  date:
    | 'on'
    | 'notOn'
    | 'before'
    | 'onOrBefore'
    | 'after'
    | 'onOrAfter'
    | 'between'
    | 'withinLast'
    | 'isEmpty'
    | 'isNotEmpty';
};

export type FilterFieldType = keyof FilterOperatorsByFieldType;

export type FilterOperator = FilterOperatorsByFieldType[FilterFieldType];

export type WithinLastUnit = 'days' | 'weeks' | 'months';

/** Amount and unit used by the date `withinLast` operator. */
export type WithinLastValue = {
  amount: number;
  unit: WithinLastUnit;
};

/** Inclusive endpoints for number and date `between` operators. */
export type RangeValue<Scalar> = {
  from: Scalar;
  to: Scalar;
};

/**
 * The scalar each field type edits. Dates travel as `YYYY-MM-DD` strings —
 * the parent decides how to parse or compare them.
 */
export type FilterScalarValue<T extends FilterFieldType> = T extends 'number'
  ? number
  : T extends 'boolean'
    ? boolean
    : string;

/**
 * Value shape for a field type + operator pair: no value for
 * `isEmpty`/`isNotEmpty`, `{ from, to }` for `between`, `string[]` for
 * `in`/`notIn`, a structured duration for `withinLast`, and the type's
 * scalar otherwise.
 */
type FilterValue<
  T extends FilterFieldType,
  O extends FilterOperatorsByFieldType[T] = FilterOperatorsByFieldType[T],
> = O extends 'isEmpty' | 'isNotEmpty'
  ? undefined
  : O extends 'between'
    ? RangeValue<FilterScalarValue<T>>
    : O extends 'in' | 'notIn'
      ? string[]
      : O extends 'withinLast'
        ? WithinLastValue
        : FilterScalarValue<T>;

type FilterConditionForOperator<
  T extends FilterFieldType,
  O extends FilterOperatorsByFieldType[T],
> = O extends FilterOperatorsByFieldType[T]
  ? FilterValue<T, O> extends undefined
    ? {
        fieldKey: string;
        type: T;
        operator: O;
        value?: never;
      }
    : {
        fieldKey: string;
        type: T;
        operator: O;
        value: FilterValue<T, O>;
      }
  : never;

/**
 * An active filter condition. Distributes over both the field type and the
 * operator so that narrowing `type` narrows `operator`, and narrowing
 * `operator` narrows `value`.
 */
export type FilterCondition<T extends FilterFieldType = FilterFieldType> = T extends FilterFieldType
  ? FilterConditionForOperator<T, FilterOperatorsByFieldType[T]>
  : never;

/**
 * A field the parent makes available for filtering. `operators` may narrow
 * the type's default operator set; enum fields must supply their options.
 */
export type FilterFieldDefinition<T extends FilterFieldType = FilterFieldType> =
  T extends FilterFieldType
    ? {
        readonly key: string;
        readonly label?: string;
        readonly type: T;
        readonly operators?: readonly FilterOperatorsByFieldType[T][];
      } & (T extends 'enum'
        ? { readonly options: readonly string[] }
        : { readonly options?: never })
    : never;

export type FilterList = readonly FilterCondition[];

export type FilterCombinator = 'and' | 'or';

/**
 * Public filter expression. Emitted groups are canonical: either one flat
 * `and` group or an `or` group containing conditions and multi-condition `and`
 * groups. Recursive inputs are accepted; non-DNF trees flatten in reading
 * order rather than being distributed.
 */
export type FilterGroup = {
  combinator: FilterCombinator;
  conditions: readonly (FilterCondition | FilterGroup)[];
};

/**
 * Props for `Filter`. Native submit is prevented. Each committed change reports
 * the complete valid group with a fresh `AbortController` after aborting the
 * previous controller.
 */
export type FilterProps = Omit<
  ComponentPropsWithRef<'form'>,
  'children' | 'onChange' | 'onSubmit'
> & {
  /** Immutable schema snapshot. Replace the array when any field definition changes. */
  fields: readonly FilterFieldDefinition[];
  onChange?: (filters: FilterGroup, abortController: AbortController) => void;
  disabled?: boolean;
  /** Initial value read once on mount; it is neither emitted nor added to history. */
  initialFilters?: FilterGroup;
  /** Persistence adapter read once on mount; defaults to local storage. */
  savedViewsStorage?: SavedViewsStorage;
};
