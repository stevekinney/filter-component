import { describe, expect, it } from 'vitest';
import { searchFields } from './field-search.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const fields: FilterFieldDefinition[] = [
  { key: 'dealValue', label: 'Deal value', type: 'number' },
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'lastEmailed', label: 'Last emailed', type: 'date' },
  { key: 'stage', label: 'Stage', type: 'enum', options: ['Lead'] },
];

describe('searchFields', () => {
  it('returns every field for an empty query', () => {
    expect(searchFields(fields, '')).toEqual(fields);
    expect(searchFields(fields, '   ')).toEqual(fields);
  });

  it('ranks prefix matches above contains matches', () => {
    // "stage" starts with "st"; "last emailed" merely contains it and sits
    // earlier in the list — prefix rank must win over definition order.
    const results = searchFields(fields, 'st');
    expect(results.map((field) => field.key)).toEqual(['stage', 'lastEmailed']);
  });

  it('matches on key as well as label, case-insensitively', () => {
    expect(searchFields(fields, 'DEALV').map((field) => field.key)).toEqual([
      'dealValue',
    ]);
  });

  it('uses the key as the searchable label when a label is omitted', () => {
    const keyOnly: readonly FilterFieldDefinition[] = [
      { key: 'accountOwner', type: 'string' },
    ];
    expect(searchFields(keyOnly, 'account').map((field) => field.key)).toEqual([
      'accountOwner',
    ]);
  });

  it('returns no results for an unmatched query', () => {
    expect(searchFields(fields, 'zzz')).toEqual([]);
  });

  it('reflects in-place field-definition changes', () => {
    const mutableFields: FilterFieldDefinition[] = [
      { key: 'stage', label: 'Stage', type: 'string' },
    ];
    expect(searchFields(mutableFields, 'stage')).toEqual(mutableFields);

    mutableFields[0] = {
      key: 'status',
      label: 'Status',
      type: 'string',
    };
    expect(searchFields(mutableFields, 'stage')).toEqual([]);
    expect(searchFields(mutableFields, 'status')).toEqual(mutableFields);
  });

  it('preserves stable definition order within each rank', () => {
    // Both "dealValue" and "name" merely contain "a"; "lastEmailed" and
    // "stage" do too — definition order must hold within the contains group.
    const results = searchFields(fields, 'a');
    expect(results.map((field) => field.key)).toEqual([
      'dealValue',
      'name',
      'lastEmailed',
      'stage',
    ]);
  });
});
