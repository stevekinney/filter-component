import { describe, expect, it } from 'vitest';
import {
  andRuns,
  describeAndRuns,
  EMPTY_FILTER_EXPRESSION,
  filterExpression,
  fromFilterGroup,
  isFilterGroup,
  removeConditionAt,
  toFilterGroup,
} from './expression.ts';
import type { FilterExpression } from './expression.ts';
import type { FilterEntry } from './filter-entry.ts';
import { filterConditionSchema } from './filter-schema.ts';
import type { FilterCombinator, FilterGroup } from '@/types/filter.ts';

function condition(id: string): FilterEntry {
  return {
    id,
    fieldKey: 'name',
    type: 'string',
    operator: 'contains',
    value: id,
  };
}

const [a, b, c, d] = [
  condition('a'),
  condition('b'),
  condition('c'),
  condition('d'),
];

function expression(
  conditions: FilterEntry[],
  joiners: FilterCombinator[],
): FilterExpression {
  return { conditions, joiners };
}

const externalMember = (member: FilterEntry | FilterGroup) => {
  if (isFilterGroup(member)) return member;
  const { id: _id, ...condition } = member;
  return filterConditionSchema.parse(condition);
};

const andGroup = (
  ...conditions: (FilterEntry | FilterGroup)[]
): FilterGroup => ({
  combinator: 'and',
  conditions: conditions.map(externalMember),
});

function loadFilterGroup(group: FilterGroup): FilterExpression {
  const identifiers: string[] = [];
  const collectIdentifiers = (member: FilterGroup['conditions'][number]) => {
    if (isFilterGroup(member)) {
      member.conditions.forEach(collectIdentifiers);
      return;
    }
    identifiers.push(
      typeof member.value === 'string'
        ? member.value
        : (JSON.stringify(member.value) ?? 'condition'),
    );
  };
  group.conditions.forEach(collectIdentifiers);
  let index = 0;
  return fromFilterGroup(group, () => identifiers[index++] ?? `entry-${index}`);
}

describe('isFilterGroup', () => {
  it('tells nested groups apart from conditions', () => {
    expect(isFilterGroup(andGroup(a, b))).toBe(true);
    expect(isFilterGroup(a)).toBe(false);
  });
});

describe('toFilterGroup', () => {
  it('emits an empty and root for an empty expression', () => {
    expect(toFilterGroup(EMPTY_FILTER_EXPRESSION)).toEqual({
      combinator: 'and',
      conditions: [],
    });
  });

  it('keeps a single condition as a flat and root', () => {
    expect(toFilterGroup(expression([a], []))).toEqual(andGroup(a));
  });

  it('keeps an all-and expression flat', () => {
    expect(toFilterGroup(expression([a, b, c], ['and', 'and']))).toEqual(
      andGroup(a, b, c),
    );
  });

  it('derives [A and B or C] as or(and(A, B), C)', () => {
    expect(toFilterGroup(expression([a, b, c], ['and', 'or']))).toEqual({
      combinator: 'or',
      conditions: [andGroup(a, b), externalMember(c)],
    });
  });

  it('derives [A or B and C] as or(A, and(B, C))', () => {
    expect(toFilterGroup(expression([a, b, c], ['or', 'and']))).toEqual({
      combinator: 'or',
      conditions: [externalMember(a), andGroup(b, c)],
    });
  });

  it('keeps every run of one a bare condition under an or root', () => {
    expect(toFilterGroup(expression([a, b], ['or']))).toEqual({
      combinator: 'or',
      conditions: [externalMember(a), externalMember(b)],
    });
  });
});

describe('fromFilterGroup', () => {
  it('loads v1 flat and groups as all-and joiners', () => {
    expect(loadFilterGroup(andGroup(a, b, c))).toEqual(
      expression([a, b, c], ['and', 'and']),
    );
  });

  it('loads v1 flat or groups as all-or joiners', () => {
    expect(
      loadFilterGroup({
        combinator: 'or',
        conditions: [externalMember(a), externalMember(b)],
      }),
    ).toEqual(expression([a, b], ['or']));
  });

  it('reads inner gaps with the group combinator and outer gaps with the root combinator', () => {
    expect(
      loadFilterGroup({
        combinator: 'or',
        conditions: [andGroup(a, b), externalMember(c)],
      }),
    ).toEqual(expression([a, b, c], ['and', 'or']));
  });

  it('dissolves single-member groups', () => {
    expect(
      loadFilterGroup({
        combinator: 'or',
        conditions: [andGroup(a), externalMember(b)],
      }),
    ).toEqual(expression([a, b], ['or']));
  });

  it('drops empty groups', () => {
    expect(
      loadFilterGroup({
        combinator: 'or',
        conditions: [andGroup(), externalMember(a)],
      }),
    ).toEqual(expression([a], []));
  });

  it('does not let a leading empty nested group consume the outer joiner', () => {
    expect(
      loadFilterGroup({
        combinator: 'and',
        conditions: [
          externalMember(a),
          {
            combinator: 'or',
            conditions: [
              { combinator: 'and', conditions: [] },
              externalMember(b),
            ],
          },
        ],
      }),
    ).toEqual(expression([a, b], ['and']));
  });

  it('merges same-combinator groups into their parent', () => {
    expect(
      loadFilterGroup({
        combinator: 'and',
        conditions: [externalMember(a), andGroup(b, c), externalMember(d)],
      }),
    ).toEqual(expression([a, b, c, d], ['and', 'and', 'and']));
  });

  it('flattens nesting deeper than two levels', () => {
    expect(
      loadFilterGroup({
        combinator: 'or',
        conditions: [andGroup(a, andGroup(b, c)), externalMember(d)],
      }),
    ).toEqual(expression([a, b, c, d], ['and', 'and', 'or']));
  });

  it('promotes a root whose only child is a group', () => {
    const loaded = loadFilterGroup({
      combinator: 'or',
      conditions: [andGroup(a, b)],
    });
    expect(loaded).toEqual(expression([a, b], ['and']));
    expect(toFilterGroup(loaded)).toEqual(andGroup(a, b));
  });

  it('reads a non-DNF tree by joiner position instead of distributing', () => {
    // "A and (B or C)" has no faithful expression in the joiner model (its
    // DNF would need to duplicate A). The documented behavior — matching how
    // the reference's smart mode reads gap labels — is reading order: inner
    // gaps take the group combinator, outer gaps the root's, and the result
    // re-derives from those joiners. The saved-views schema rejects this
    // shape at the storage boundary; here the linearization itself is pinned.
    const linearized = loadFilterGroup({
      combinator: 'and',
      conditions: [
        externalMember(a),
        {
          combinator: 'or',
          conditions: [externalMember(b), externalMember(c)],
        },
      ],
    });
    expect(linearized).toEqual(expression([a, b, c], ['and', 'or']));
    expect(toFilterGroup(linearized)).toEqual({
      combinator: 'or',
      conditions: [andGroup(a, b), externalMember(c)],
    });
  });

  it('dissolves a single-member or group inside an and root losslessly', () => {
    // With one member the group's combinator is meaningless, so this shape
    // stays faithfully representable: "A and (B)" is just "A and B".
    expect(
      loadFilterGroup({
        combinator: 'and',
        conditions: [
          externalMember(a),
          { combinator: 'or', conditions: [externalMember(b)] },
        ],
      }),
    ).toEqual(expression([a, b], ['and']));
  });
});

describe('round-trip', () => {
  // Grouping is a function of the joiner sequence alone, so enumerating
  // every joiner pattern up to six conditions covers the whole structural
  // space — a complete proof rather than a sampled property test.
  it('holds for every joiner pattern up to six conditions', () => {
    for (let length = 0; length <= 6; length++) {
      const conditions = Array.from({ length }, (_, i) => condition(`c${i}`));
      const joinerCount = Math.max(0, length - 1);
      for (let mask = 0; mask < 1 << joinerCount; mask++) {
        const joiners = Array.from({ length: joinerCount }, (_, i) =>
          mask & (1 << i) ? ('or' as const) : ('and' as const),
        );
        const original = expression(conditions, joiners);
        const canonical = toFilterGroup(original);
        // Expression → group → expression is the identity.
        expect(loadFilterGroup(canonical)).toEqual(original);
        // Canonical group → expression → group is the identity.
        expect(toFilterGroup(loadFilterGroup(canonical))).toEqual(canonical);
      }
    }
  });
});

describe('removeConditionAt', () => {
  it('removes a condition together with its leading joiner', () => {
    expect(removeConditionAt(expression([a, b, c], ['and', 'or']), 1)).toEqual(
      expression([a, c], ['or']),
    );
  });

  it('removes the first condition together with the first joiner', () => {
    expect(removeConditionAt(expression([a, b, c], ['or', 'and']), 0)).toEqual(
      expression([b, c], ['and']),
    );
  });

  it('leaves no joiner behind when removing from a pair', () => {
    expect(removeConditionAt(expression([a, b], ['or']), 1)).toEqual(
      expression([a], []),
    );
  });

  it('returns the input unchanged for out-of-range indexes', () => {
    const input = expression([a], []);
    expect(removeConditionAt(input, -1)).toBe(input);
    expect(removeConditionAt(input, 1)).toBe(input);
  });

  it('touches no other joiner, so grouping re-derives around the gap', () => {
    const removed = removeConditionAt(
      expression([a, b, c, d], ['or', 'and', 'or']),
      3,
    );
    expect(removed).toEqual(expression([a, b, c], ['or', 'and']));
    expect(toFilterGroup(removed)).toEqual({
      combinator: 'or',
      conditions: [externalMember(a), andGroup(b, c)],
    });
  });
});

describe('filterExpression', () => {
  it('drops rejected conditions along with their adjacent joiners', () => {
    expect(
      filterExpression(expression([a, b, c], ['and', 'or']), (x) => x !== b),
    ).toEqual(expression([a, c], ['or']));
  });

  it('drops several rejected conditions independently', () => {
    // Each exclusion consumes its own leading joiner: dropping `a` takes the
    // first 'and', dropping `c` takes the 'or' that led into it, so `b` and
    // `d` are left joined by the 'and' that sat between `c` and `d`.
    expect(
      filterExpression(
        expression([a, b, c, d], ['and', 'or', 'and']),
        (x) => x === b || x === d,
      ),
    ).toEqual(expression([b, d], ['and']));
  });

  it('returns the input unchanged when everything is kept', () => {
    const input = expression([a, b], ['or']);
    expect(filterExpression(input, () => true)).toBe(input);
  });

  it('empties fully when everything is rejected', () => {
    expect(filterExpression(expression([a, b], ['or']), () => false)).toEqual(
      EMPTY_FILTER_EXPRESSION,
    );
  });
});

describe('andRuns', () => {
  it('treats the whole expression as one run without or joiners', () => {
    expect(andRuns(expression([a, b], ['and']))).toEqual([[a, b]]);
  });

  it('starts a new run at each or joiner', () => {
    expect(andRuns(expression([a, b, c], ['or', 'and']))).toEqual([
      [a],
      [b, c],
    ]);
  });
});

describe('describeAndRuns', () => {
  it('marks nothing while no or joiner exists', () => {
    expect(describeAndRuns(expression([a, b], ['and']))).toEqual([
      { opensRun: false, closesRun: false, inRun: false },
      { opensRun: false, closesRun: false, inRun: false },
    ]);
  });

  it('brackets only runs of two or more', () => {
    expect(describeAndRuns(expression([a, b, c], ['and', 'or']))).toEqual([
      { opensRun: true, closesRun: false, inRun: true },
      { opensRun: false, closesRun: true, inRun: true },
      { opensRun: false, closesRun: false, inRun: false },
    ]);
  });
});
