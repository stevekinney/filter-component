import type { FilterCombinator, FilterCondition, FilterGroup } from '@filter/types.ts';

import { createFilterEntry } from './filter-entry.ts';
import type { FilterEntry } from './filter-entry.ts';
import { filterConditionSchema } from './filter-schema.ts';

/**
 * The smart-joiners expression model. The committed filter state is a flat
 * sequence of conditions with a joiner word between each adjacent pair;
 * grouping is derived, never managed — `and` binds tighter than `or`, so the
 * expression always reads as an or of and-runs (or a flat all-`and` list).
 * This module owns the two directions of that derivation plus the sequence
 * edits whose joiner bookkeeping has semantic weight (removal, exclusion).
 */

export type FilterExpression = {
  conditions: FilterEntry[];
  joiners: FilterCombinator[];
};

export const EMPTY_FILTER_EXPRESSION: FilterExpression = {
  conditions: [],
  joiners: [],
};

export function isFilterGroup(member: FilterCondition | FilterGroup): member is FilterGroup {
  return 'combinator' in member;
}

/**
 * The maximal `and`-joined runs of the expression, in order. A single run
 * means no `'or'` joiner exists (the whole expression is one run); each
 * `'or'` joiner starts a new run.
 */
function andRuns(expression: FilterExpression): FilterEntry[][] {
  const runs: FilterEntry[][] = [];

  expression.conditions.forEach((condition, index) => {
    const lastRun = runs[runs.length - 1];

    if (lastRun === undefined || expression.joiners[index - 1] === 'or') {
      runs.push([condition]);
    } else {
      lastRun.push(condition);
    }
  });

  return runs;
}

/**
 * Derives the emitted payload: split the conditions on `'or'` joiners into
 * runs — a run of one stays a bare condition, a run of two or more becomes
 * an `and`-group — under an `or` root; with no `'or'` joiner the whole
 * expression is a flat `and` root. The result is always canonical
 * disjunctive-normal form.
 */
export function toFilterGroup(expression: FilterExpression): FilterGroup {
  const publicConditions = expression.conditions.map((entry) => {
    const { id: _id, ...condition } = entry;

    return filterConditionSchema.parse(condition);
  });

  if (!expression.joiners.includes('or')) {
    return {
      combinator: 'and',
      conditions: publicConditions,
    };
  }

  let offset = 0;

  return {
    combinator: 'or',
    conditions: andRuns(expression).map((run) => {
      const conditions = publicConditions.slice(offset, offset + run.length);

      offset += run.length;
      const only = conditions[0];

      return conditions.length === 1 && only !== undefined
        ? only
        : {
            combinator: 'and' as const,
            conditions,
          };
    }),
  };
}

/**
 * The inverse of `toFilterGroup`, for saved views and controlled input.
 * Foreign trees are normalized on the way in by the linearization itself:
 * a member sequence reads left to right with the owning group's combinator
 * between its members, so deep nesting flattens, empty groups vanish,
 * single-member groups dissolve, and same-combinator groups merge — exactly
 * the rules the canonical form demands. Round-trips every canonical group
 * unchanged; v1 flat groups load as a uniform joiner sequence (`and` roots
 * as all-`and`).
 *
 * The joiner model expresses or-of-and-runs only, so a tree that is not
 * DNF-equivalent — a ≥2-member `or` group joined into an `and` context,
 * as in "A and (B or C)" — has no faithful linearization. Such trees read
 * by joiner position exactly as the bar would render them (inner gaps show
 * the group's combinator, outer gaps the root's), which re-derives as a
 * different formula; distribution is deliberately not performed. The saved-
 * views schema rejects that shape at the storage boundary; parents passing
 * trees through `initialFilters` should feed back emitted (canonical)
 * payloads.
 */
export function fromFilterGroup(
  group: FilterGroup,
  createConditionId: () => string,
): FilterExpression {
  const conditions: FilterEntry[] = [];
  const joiners: FilterCombinator[] = [];
  const append = (member: FilterCondition | FilterGroup, joiner: FilterCombinator) => {
    if (isFilterGroup(member)) {
      let emittedMember = false;

      for (const child of member.conditions) {
        const previousConditionCount = conditions.length;

        append(child, emittedMember ? member.combinator : joiner);
        if (conditions.length > previousConditionCount) emittedMember = true;
      }
      return;
    }

    if (conditions.length > 0) joiners.push(joiner);

    conditions.push(createFilterEntry(member, createConditionId()));
  };

  for (const member of group.conditions) append(member, group.combinator);

  return { conditions, joiners };
}

/**
 * Removes the condition at `index` along with its leading joiner
 * (`joiners[index - 1]`; for the first condition, `joiners[0]`) — the rule
 * shared by chip deletion and invalid-condition exclusion. Grouping
 * re-derives; no other joiner changes. Out-of-range indexes return the
 * input unchanged.
 */
export function removeConditionAt(expression: FilterExpression, index: number): FilterExpression {
  if (index < 0 || index >= expression.conditions.length) return expression;

  const conditions = expression.conditions.toSpliced(index, 1);
  const joiners = expression.joiners.toSpliced(Math.max(0, index - 1), 1);

  return { conditions, joiners };
}

/**
 * Drops every condition the predicate rejects, each taking its leading
 * joiner with it (the `removeConditionAt` rule, applied per condition).
 * The emit boundary uses this to exclude invalid conditions without
 * mutating the internal state that keeps them visible.
 */
export function filterExpression(
  expression: FilterExpression,
  keep: (condition: FilterEntry) => boolean,
): FilterExpression {
  let result = expression;

  for (let index = result.conditions.length - 1; index >= 0; index--) {
    const condition = result.conditions[index];

    if (condition !== undefined && !keep(condition)) {
      result = removeConditionAt(result, index);
    }
  }

  return result;
}

/**
 * How each condition sits inside the derived grouping, for brackets and
 * accessible names. Markers are all-false while no `'or'` joiner exists:
 * a flat all-`and` expression renders without brackets, so nothing is
 * "in a group" yet.
 */
type AndRunMarker = {
  opensRun: boolean;
  closesRun: boolean;
  inRun: boolean;
};

/** Per-condition bracket markers, aligned with `expression.conditions`. */
export function describeAndRuns(expression: FilterExpression): AndRunMarker[] {
  if (!expression.joiners.includes('or')) {
    return expression.conditions.map(() => ({
      opensRun: false,
      closesRun: false,
      inRun: false,
    }));
  }

  return andRuns(expression).flatMap((run) =>
    run.map((_, memberIndex) => ({
      opensRun: run.length > 1 && memberIndex === 0,
      closesRun: run.length > 1 && memberIndex === run.length - 1,
      inRun: run.length > 1,
    })),
  );
}
