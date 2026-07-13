import { describe, expect, it } from 'vitest';
import { filterHistoryReducer } from './history.ts';
import type { FilterHistory } from './history.ts';
import type { FilterEntry } from './filter-entry.ts';
import type { FilterExpression } from './expression.ts';
import type { FilterCombinator } from '@/types/filter.ts';

const nameFilter: FilterEntry = {
  id: 'a',
  fieldKey: 'name',
  type: 'string',
  operator: 'startsWith',
  value: 'M',
};

const valueFilter: FilterEntry = {
  id: 'b',
  fieldKey: 'dealValue',
  type: 'number',
  operator: 'greaterThan',
  value: 100,
};

const activeFilter: FilterEntry = {
  id: 'c',
  fieldKey: 'active',
  type: 'boolean',
  operator: 'equals',
  value: false,
};

function expression(
  conditions: FilterEntry[],
  joiners: FilterCombinator[] = conditions.slice(1).map(() => 'and'),
): FilterExpression {
  return { conditions, joiners };
}

const EMPTY_HISTORY: FilterHistory = {
  past: [],
  present: expression([]),
  future: [],
};

function reduceExpression(
  present: FilterExpression,
  action: Parameters<typeof filterHistoryReducer>[1],
): FilterExpression {
  return filterHistoryReducer({ past: [], present, future: [] }, action)
    .present;
}

describe('committed filter actions', () => {
  it('adds the first filter without a joiner', () => {
    expect(
      reduceExpression(expression([]), {
        type: 'add',
        filter: nameFilter,
      }),
    ).toEqual(expression([nameFilter], []));
  });

  it('appends new filters with an and joiner', () => {
    expect(
      reduceExpression(expression([nameFilter, valueFilter], ['or']), {
        type: 'add',
        filter: activeFilter,
      }),
    ).toEqual(
      expression([nameFilter, valueFilter, activeFilter], ['or', 'and']),
    );
  });

  it('updates a filter by id without touching joiners', () => {
    const updated: FilterEntry = { ...nameFilter, value: 'N' };
    expect(
      reduceExpression(expression([nameFilter, valueFilter], ['or']), {
        type: 'update',
        id: 'a',
        filter: updated,
      }),
    ).toEqual(expression([updated, valueFilter], ['or']));
  });

  it('returns the same expression when updating an unknown id', () => {
    const filters = expression([nameFilter]);
    expect(
      reduceExpression(filters, {
        type: 'update',
        id: 'zzz',
        filter: valueFilter,
      }),
    ).toBe(filters);
  });

  it('returns the same expression when an update changes nothing', () => {
    const filters = expression([nameFilter]);
    expect(
      reduceExpression(filters, {
        type: 'update',
        id: 'a',
        filter: { ...nameFilter },
      }),
    ).toBe(filters);
  });

  it('removes a filter together with its leading joiner', () => {
    expect(
      reduceExpression(
        expression([nameFilter, valueFilter, activeFilter], ['and', 'or']),
        { type: 'remove', id: 'b' },
      ),
    ).toEqual(expression([nameFilter, activeFilter], ['or']));
  });

  it('removes the first filter together with the first joiner', () => {
    expect(
      reduceExpression(
        expression([nameFilter, valueFilter, activeFilter], ['or', 'and']),
        { type: 'remove', id: 'a' },
      ),
    ).toEqual(expression([valueFilter, activeFilter], ['and']));
  });

  it('returns the same expression when removing an unknown id', () => {
    const filters = expression([nameFilter]);
    expect(reduceExpression(filters, { type: 'remove', id: 'zzz' })).toBe(
      filters,
    );
  });

  it('clears all filters and joiners', () => {
    expect(
      reduceExpression(expression([nameFilter, valueFilter], ['or']), {
        type: 'clear',
      }),
    ).toEqual(expression([], []));
  });

  it('returns the same expression when clearing an empty expression', () => {
    const filters = expression([]);
    expect(reduceExpression(filters, { type: 'clear' })).toBe(filters);
  });

  it('flips exactly the addressed joiner', () => {
    expect(
      reduceExpression(
        expression([nameFilter, valueFilter, activeFilter], ['and', 'and']),
        { type: 'flipJoiner', index: 1 },
      ),
    ).toEqual(
      expression([nameFilter, valueFilter, activeFilter], ['and', 'or']),
    );
  });

  it('flips an or joiner back to and', () => {
    expect(
      reduceExpression(expression([nameFilter, valueFilter], ['or']), {
        type: 'flipJoiner',
        index: 0,
      }),
    ).toEqual(expression([nameFilter, valueFilter], ['and']));
  });

  it('returns the same expression when flipping an out-of-range joiner', () => {
    const filters = expression([nameFilter, valueFilter], ['and']);
    expect(reduceExpression(filters, { type: 'flipJoiner', index: 1 })).toBe(
      filters,
    );
  });
});

describe('filterHistoryReducer', () => {
  it('moves present into past on a committed change and clears future', () => {
    const seeded: FilterHistory = {
      past: [expression([])],
      present: expression([nameFilter]),
      future: [expression([nameFilter, valueFilter])],
    };
    const next = filterHistoryReducer(seeded, {
      type: 'add',
      filter: valueFilter,
    });
    expect(next.past).toEqual([expression([]), expression([nameFilter])]);
    expect(next.present).toEqual(expression([nameFilter, valueFilter]));
    expect(next.future).toEqual([]);
  });

  it('does not create an entry for a no-op action', () => {
    const history = filterHistoryReducer(EMPTY_HISTORY, {
      type: 'clear',
    });
    expect(history).toBe(EMPTY_HISTORY);
  });

  it('records one entry per joiner flip', () => {
    const seeded: FilterHistory = {
      past: [],
      present: expression([nameFilter, valueFilter], ['and']),
      future: [],
    };
    const flipped = filterHistoryReducer(seeded, {
      type: 'flipJoiner',
      index: 0,
    });
    expect(flipped.present).toEqual(
      expression([nameFilter, valueFilter], ['or']),
    );
    expect(flipped.past).toEqual([seeded.present]);

    const undone = filterHistoryReducer(flipped, { type: 'undo' });
    expect(undone.present).toEqual(seeded.present);
  });

  it('treats a chip deletion (condition plus joiner) as a single entry', () => {
    const seeded: FilterHistory = {
      past: [],
      present: expression([nameFilter, valueFilter], ['or']),
      future: [],
    };
    const removed = filterHistoryReducer(seeded, { type: 'remove', id: 'b' });
    expect(removed.present).toEqual(expression([nameFilter], []));
    expect(removed.past).toEqual([seeded.present]);

    const undone = filterHistoryReducer(removed, { type: 'undo' });
    expect(undone.present).toEqual(seeded.present);
  });

  it('undo restores the previous expression and pushes present into future', () => {
    const history = filterHistoryReducer(EMPTY_HISTORY, {
      type: 'add',
      filter: nameFilter,
    });
    const undone = filterHistoryReducer(history, { type: 'undo' });
    expect(undone.present).toEqual(expression([]));
    expect(undone.past).toEqual([]);
    expect(undone.future).toEqual([expression([nameFilter])]);
  });

  it('redo reverses an undo', () => {
    const added = filterHistoryReducer(EMPTY_HISTORY, {
      type: 'add',
      filter: nameFilter,
    });
    const undone = filterHistoryReducer(added, { type: 'undo' });
    const redone = filterHistoryReducer(undone, { type: 'redo' });
    expect(redone).toEqual(added);
  });

  it('undo with an empty past is a no-op', () => {
    expect(filterHistoryReducer(EMPTY_HISTORY, { type: 'undo' })).toBe(
      EMPTY_HISTORY,
    );
  });

  it('redo with an empty future is a no-op', () => {
    expect(filterHistoryReducer(EMPTY_HISTORY, { type: 'redo' })).toBe(
      EMPTY_HISTORY,
    );
  });

  it('a committed change after undo clears the future (no branching redo)', () => {
    const added = filterHistoryReducer(EMPTY_HISTORY, {
      type: 'add',
      filter: nameFilter,
    });
    const undone = filterHistoryReducer(added, { type: 'undo' });
    const diverged = filterHistoryReducer(undone, {
      type: 'add',
      filter: valueFilter,
    });
    expect(diverged.future).toEqual([]);
    expect(diverged.present).toEqual(expression([valueFilter]));
  });

  it('replace swaps in a whole expression as an undoable entry', () => {
    const added = filterHistoryReducer(EMPTY_HISTORY, {
      type: 'add',
      filter: nameFilter,
    });
    const replaced = filterHistoryReducer(added, {
      type: 'replace',
      expression: expression([valueFilter, activeFilter], ['or']),
    });
    expect(replaced.present).toEqual(
      expression([valueFilter, activeFilter], ['or']),
    );
    expect(replaced.past).toEqual([...added.past, added.present]);
    expect(replaced.future).toEqual([]);

    const undone = filterHistoryReducer(replaced, { type: 'undo' });
    expect(undone.present).toEqual(added.present);
  });

  it('replace always commits — identical-load detection is the caller’s job (savedViewKey)', () => {
    const added = filterHistoryReducer(EMPTY_HISTORY, {
      type: 'add',
      filter: nameFilter,
    });
    const replaced = filterHistoryReducer(added, {
      type: 'replace',
      expression: expression([{ ...nameFilter }]),
    });
    expect(replaced).not.toBe(added);
    expect(replaced.past).toEqual([...added.past, added.present]);
  });

  it('treats key order as irrelevant when detecting no-op updates', () => {
    const reordered = {
      value: 'M',
      operator: 'startsWith',
      type: 'string',
      fieldKey: 'name',
      id: 'a',
    } as FilterEntry;
    const history: FilterHistory = {
      past: [],
      present: expression([reordered]),
      future: [],
    };
    expect(
      filterHistoryReducer(history, {
        type: 'update',
        id: 'a',
        filter: nameFilter,
      }),
    ).toBe(history);
  });
});
