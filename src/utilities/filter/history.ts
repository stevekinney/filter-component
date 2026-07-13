import { EMPTY_FILTER_EXPRESSION, removeConditionAt } from './expression.ts';
import { stableSerialize } from './stable-serialize.ts';
import type { FilterEntry } from './filter-entry.ts';
import type { FilterExpression } from './expression.ts';

type FilterAction =
  | { type: 'add'; filter: FilterEntry }
  | { type: 'update'; id: string; filter: FilterEntry }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'flipJoiner'; index: number };

export type FilterHistoryAction =
  | FilterAction
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; expression: FilterExpression };

export type FilterHistory = {
  past: FilterExpression[];
  present: FilterExpression;
  future: FilterExpression[];
};

function filtersEqual(a: unknown, b: unknown): boolean {
  return stableSerialize(a) === stableSerialize(b);
}

/** Applies committed edits. No-op actions preserve identity so history ignores them. */
function filterExpressionReducer(
  expression: FilterExpression,
  action: FilterAction,
): FilterExpression {
  switch (action.type) {
    case 'add':
      return {
        conditions: [...expression.conditions, action.filter],
        joiners:
          expression.conditions.length > 0 ? [...expression.joiners, 'and'] : expression.joiners,
      };
    case 'update': {
      const index = expression.conditions.findIndex((filter) => filter.id === action.id);

      if (index === -1) return expression;
      if (filtersEqual(expression.conditions[index], action.filter)) {
        return expression;
      }
      const conditions = expression.conditions.slice();

      conditions[index] = action.filter;

      return { conditions, joiners: expression.joiners };
    }
    case 'remove': {
      const index = expression.conditions.findIndex((filter) => filter.id === action.id);

      if (index === -1) return expression;
      return removeConditionAt(expression, index);
    }
    case 'clear':
      return expression.conditions.length === 0 ? expression : EMPTY_FILTER_EXPRESSION;
    case 'flipJoiner': {
      const joiner = expression.joiners[action.index];

      if (joiner === undefined) return expression;
      const joiners = expression.joiners.slice();

      joiners[action.index] = joiner === 'and' ? 'or' : 'and';

      return { conditions: expression.conditions, joiners };
    }
  }
}

/**
 * Adds undo and redo around committed edits. Real edits clear the redo future;
 * no-ops preserve history identity.
 */
export function filterHistoryReducer(
  history: FilterHistory,
  action: FilterHistoryAction,
): FilterHistory {
  switch (action.type) {
    case 'undo': {
      const previous = history.past[history.past.length - 1];

      if (previous === undefined) return history;
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      };
    }
    case 'redo': {
      const next = history.future[0];

      if (next === undefined) return history;
      return {
        past: [...history.past, history.present],
        present: next,
        future: history.future.slice(1),
      };
    }
    // Always commits: the one caller (loading a saved view) no-ops identical
    // loads upfront via `savedViewKey`, the id-ignoring group identity. An
    // id-inclusive equality check here could never fire — loads mint fresh
    // condition ids.
    case 'replace':
      return {
        past: [...history.past, history.present],
        present: action.expression,
        future: [],
      };
    default: {
      const present = filterExpressionReducer(history.present, action);

      if (present === history.present) return history;
      return {
        past: [...history.past, history.present],
        present,
        future: [],
      };
    }
  }
}
