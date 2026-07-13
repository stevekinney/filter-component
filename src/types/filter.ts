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

/** Structured duration for the `withinLast` operator. */
export type WithinLastValue = {
  amount: number;
  unit: WithinLastUnit;
};

/** Inclusive range for `between` operators. */
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
export type FilterCondition<T extends FilterFieldType = FilterFieldType> =
  T extends FilterFieldType
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

/** A readonly flat collection of committed filter conditions. */
export type FilterList = readonly FilterCondition[];

/** How multiple conditions combine: every condition or any condition. */
export type FilterCombinator = 'and' | 'or';

/**
 * What the component reports through `onChange`. Emitted payloads are always
 * in disjunctive-normal form: either a flat all-`and` root, or an `or` root
 * whose children are bare conditions and `and`-groups of at least two
 * conditions — no `or` groups inside, no single-member groups, no depth
 * beyond two. The type is recursive so foreign trees (persisted payloads,
 * `initialFilters` input) can be accepted and normalized on the way in;
 * on the way out, groups never contain groups. Input trees that are not
 * DNF-equivalent (an `or` group joined into an `and` context) linearize by
 * reading order rather than by distribution — pass back emitted payloads to
 * guarantee exact restoration (see `fromFilterGroup`).
 */
export type FilterGroup = {
  combinator: FilterCombinator;
  conditions: readonly (FilterCondition | FilterGroup)[];
};

/**
 * Props for the public `Filter` component. Extends the native form interface;
 * `onSubmit` is reserved (native submit is prevented) and `onChange` reports
 * the full valid-only filter group after every committed change.
 *
 * Each `onChange` call receives a fresh `AbortController`; the previous
 * call's controller is aborted first. Pass `abortController.signal` to any
 * async work (such as a `fetch`) so a newer change cancels it.
 */
export type FilterProps = Omit<
  ComponentPropsWithRef<'form'>,
  'children' | 'onChange' | 'onSubmit'
> & {
  fields: readonly FilterFieldDefinition[];
  onChange?: (filters: FilterGroup, abortController: AbortController) => void;
  disabled?: boolean;
  /** Silent, non-undoable seed read only when the component mounts. */
  initialFilters?: FilterGroup;
  /** Saved-view persistence read once on mount; defaults to local storage. */
  savedViewsStorage?: SavedViewsStorage;
};
