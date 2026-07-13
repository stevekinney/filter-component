import { describe, expect, it } from 'vitest';
import { parseSavedViews, savedViewKey } from './saved-views.ts';
import type { SavedView } from './saved-views.ts';
import type { FilterGroup } from '@/types/filter.ts';

const GROUP: FilterGroup = {
  combinator: 'or',
  conditions: [
    {
      fieldKey: 'name',
      type: 'string',
      operator: 'contains',
      value: 'corp',
    },
    {
      fieldKey: 'stage',
      type: 'enum',
      operator: 'in',
      value: ['Lead', 'Negotiation'],
    },
  ],
};

describe('parseSavedViews', () => {
  it('returns no views for non-array input', () => {
    expect(parseSavedViews(null)).toEqual([]);
    expect(parseSavedViews('views')).toEqual([]);
    expect(parseSavedViews({ name: 'x', group: GROUP })).toEqual([]);
  });

  it('drops malformed views while keeping valid ones', () => {
    const valid: SavedView = { name: 'Corp deals', group: GROUP };
    const parsed = parseSavedViews([
      42,
      { name: '', group: GROUP }, // blank name
      {
        name: 'Broken pairing',
        group: {
          combinator: 'and',
          // `between` requires a { from, to } value.
          conditions: [
            { fieldKey: 'v', type: 'number', operator: 'between', value: 5 },
          ],
        },
      },
      { name: 'Number group', group: 42 },
      { name: 'Null group', group: null },
      { name: 'Array group', group: [] },
      valid,
    ]);
    expect(parsed).toEqual([valid]);
  });

  it('applies defaults for a missing combinator, conditions, and name', () => {
    const parsed = parseSavedViews([
      { name: 'Bare', group: {} },
      { group: GROUP },
    ]);
    expect(parsed[0]?.group).toEqual({ combinator: 'and', conditions: [] });
    expect(parsed[1]?.name).toBe('Untitled view');
  });

  it('keeps the first of two views sharing a name', () => {
    const first: SavedView = { name: 'Dupe', group: GROUP };
    const second: SavedView = {
      name: 'Dupe',
      group: { combinator: 'and', conditions: [] },
    };
    expect(parseSavedViews([first, second])).toEqual([first]);
  });

  it('accepts conditions whose field is unknown to the current schema', () => {
    // Schema drift is handled at render time by validation against `fields`;
    // parsing only guarantees the persisted shape is a FilterCondition.
    const view: SavedView = {
      name: 'Ghost field',
      group: {
        combinator: 'and',
        conditions: [
          { fieldKey: 'retired', type: 'string', operator: 'isEmpty' },
        ],
      },
    };
    expect(parseSavedViews([view])).toEqual([view]);
  });

  it('keeps v1 flat saved views compatible', () => {
    const v1View: SavedView = { name: 'V1 flat view', group: GROUP };
    expect(parseSavedViews([v1View])).toEqual([v1View]);
  });
});

describe('nested groups', () => {
  const condition = (value: string) =>
    ({
      fieldKey: 'name',
      type: 'string',
      operator: 'equals',
      value,
    }) as const;

  const NESTED: FilterGroup = {
    combinator: 'or',
    conditions: [
      {
        combinator: 'and',
        conditions: [condition('alpha'), condition('beta')],
      },
      condition('gamma'),
    ],
  };

  it('parses nested stored views', () => {
    const view: SavedView = { name: 'Nested', group: NESTED };
    expect(parseSavedViews([view])).toEqual([view]);
  });

  it('drops a view whose or group sits inside an and root (not expressible)', () => {
    // "A and (B or C)" cannot be expressed as or-of-and-runs; loading it
    // would silently change which records match, so the storage boundary
    // rejects the whole view instead.
    expect(
      parseSavedViews([
        {
          name: 'CNF shape',
          group: {
            combinator: 'and',
            conditions: [
              {
                fieldKey: 'name',
                type: 'string',
                operator: 'equals',
                value: 'alpha',
              },
              {
                combinator: 'or',
                conditions: [
                  {
                    fieldKey: 'name',
                    type: 'string',
                    operator: 'equals',
                    value: 'beta',
                  },
                  {
                    fieldKey: 'name',
                    type: 'string',
                    operator: 'equals',
                    value: 'gamma',
                  },
                ],
              },
            ],
          },
        },
      ]),
    ).toEqual([]);
  });

  it('keeps a view whose single-member or group dissolves losslessly', () => {
    // One member makes the group combinator meaningless: "A and (B)" is
    // "A and B", so the view loads.
    const view: SavedView = {
      name: 'Dissolvable',
      group: {
        combinator: 'and',
        conditions: [
          {
            combinator: 'or',
            conditions: [
              {
                fieldKey: 'name',
                type: 'string',
                operator: 'equals',
                value: 'alpha',
              },
            ],
          },
        ],
      },
    };
    expect(parseSavedViews([view])).toEqual([view]);
  });

  it('drops a view whose nested member is malformed', () => {
    expect(
      parseSavedViews([
        {
          name: 'Broken nesting',
          group: {
            combinator: 'or',
            conditions: [
              {
                combinator: 'and',
                // A group nested inside a group is out of contract.
                conditions: [{ combinator: 'or', conditions: [] }],
              },
            ],
          },
        },
      ]),
    ).toEqual([]);
  });

  it('keys structurally equivalent trees identically after canonicalization', () => {
    const withSingleMemberGroup: FilterGroup = {
      combinator: 'or',
      conditions: [
        { combinator: 'and', conditions: [condition('alpha')] },
        condition('gamma'),
      ],
    };
    const flat: FilterGroup = {
      combinator: 'or',
      conditions: [condition('alpha'), condition('gamma')],
    };
    expect(savedViewKey(withSingleMemberGroup)).toBe(savedViewKey(flat));
  });
});

describe('savedViewKey', () => {
  it('ignores object key order', () => {
    const reordered: FilterGroup = {
      conditions: [
        {
          value: 'corp',
          operator: 'contains',
          type: 'string',
          fieldKey: 'name',
        },
        {
          value: ['Lead', 'Negotiation'],
          operator: 'in',
          type: 'enum',
          fieldKey: 'stage',
        },
      ],
      combinator: 'or',
    };
    expect(savedViewKey(reordered)).toBe(savedViewKey(GROUP));
  });

  it('distinguishes combinator and value differences', () => {
    expect(savedViewKey({ ...GROUP, combinator: 'and' })).not.toBe(
      savedViewKey(GROUP),
    );
    const base = {
      fieldKey: 'name',
      type: 'string',
      operator: 'contains',
    } as const;
    const differentValue: FilterGroup = {
      combinator: 'or',
      conditions: [{ ...base, value: 'labs' }],
    };
    const sameShape: FilterGroup = {
      combinator: 'or',
      conditions: [{ ...base, value: 'corp' }],
    };
    expect(savedViewKey(differentValue)).not.toBe(savedViewKey(sameShape));
  });
});
