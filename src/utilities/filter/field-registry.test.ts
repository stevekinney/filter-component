import { describe, expect, it } from 'vitest';
import { createFilterFieldRegistry } from './field-registry.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const validFields: readonly FilterFieldDefinition[] = [
  {
    key: 'name',
    label: 'Name',
    type: 'string',
    operators: ['equals', 'contains'],
  },
  {
    key: 'value',
    type: 'number',
    operators: ['equals', 'between'],
  },
  {
    key: 'active',
    type: 'boolean',
    operators: ['equals'],
  },
  {
    key: 'stage',
    type: 'enum',
    operators: ['in'],
    options: ['Lead', 'Won'],
  },
  {
    key: 'closeDate',
    type: 'date',
    operators: ['on', 'withinLast'],
  },
];

function invalidFields(value: unknown): readonly FilterFieldDefinition[] {
  return value as readonly FilterFieldDefinition[];
}

describe('createFilterFieldRegistry', () => {
  it('validates every field family and builds a content-sensitive lookup', () => {
    const registry = createFilterFieldRegistry(validFields);

    expect(registry.fields).not.toBe(validFields);
    expect(registry.fields).toEqual(validFields);
    expect(registry.byKey.get('stage')).toBe(registry.fields[3]);
    expect(registry.byKey.get('missing')).toBeUndefined();
    expect(registry.signature).toContain('closeDate');
    expect(createFilterFieldRegistry([]).byKey.size).toBe(0);

    const changed = validFields.map((field) =>
      field.key === 'name' ? { ...field, label: 'Account name' } : field,
    );
    expect(createFilterFieldRegistry(changed).signature).not.toBe(registry.signature);
  });

  it('snapshots definitions so later in-place mutations cannot alter a registry', () => {
    const mutableFields: FilterFieldDefinition[] = [{ key: 'name', label: 'Name', type: 'string' }];
    const first = createFilterFieldRegistry(mutableFields);

    mutableFields[0] = {
      key: 'name',
      label: 'Account name',
      type: 'string',
    };
    const second = createFilterFieldRegistry(mutableFields);

    expect(first.byKey.get('name')?.label).toBe('Name');
    expect(second.byKey.get('name')?.label).toBe('Account name');
    expect(second.signature).not.toBe(first.signature);
  });

  it.each([
    {
      label: 'an empty key',
      fields: [{ key: '', type: 'string' }],
      path: '0.key',
    },
    {
      label: 'an untrimmed key',
      fields: [{ key: ' name ', type: 'string' }],
      path: '0.key',
    },
    {
      label: 'a blank label',
      fields: [{ key: 'name', label: ' ', type: 'string' }],
      path: '0.label',
    },
    {
      label: 'an empty operator set',
      fields: [{ key: 'name', type: 'string', operators: [] }],
      path: '0.operators',
    },
    {
      label: 'duplicate operators',
      fields: [
        {
          key: 'name',
          type: 'string',
          operators: ['equals', 'equals'],
        },
      ],
      path: '0.operators',
    },
    {
      label: 'an operator from another field family',
      fields: [{ key: 'name', type: 'string', operators: ['between'] }],
      path: '0.operators.0',
    },
    {
      label: 'an empty enum option set',
      fields: [{ key: 'stage', type: 'enum', options: [] }],
      path: '0.options',
    },
    {
      label: 'duplicate enum options',
      fields: [{ key: 'stage', type: 'enum', options: ['Lead', 'Lead'] }],
      path: '0.options',
    },
    {
      label: 'a blank enum option',
      fields: [{ key: 'stage', type: 'enum', options: [''] }],
      path: '0.options.0',
    },
    {
      label: 'an unknown field type',
      fields: [{ key: 'name', type: 'currency' }],
      path: '0.type',
    },
  ])('rejects $label with its definition path', ({ fields, path }) => {
    const prettyPath = path.replace(/^0/, '[0]').replace(/\.(\d+)/g, '[$1]');
    expect(() => createFilterFieldRegistry(invalidFields(fields))).toThrow(`→ at ${prettyPath}`);
  });

  it('rejects duplicate keys after each definition is valid', () => {
    expect(() =>
      createFilterFieldRegistry([
        { key: 'name', type: 'string' },
        { key: 'name', type: 'number' },
      ]),
    ).toThrow('Invalid fields: duplicate field key "name"');
  });

  it('reports an invalid registry root', () => {
    expect(() => createFilterFieldRegistry(invalidFields(null))).toThrow('Invalid fields:');
  });
});
