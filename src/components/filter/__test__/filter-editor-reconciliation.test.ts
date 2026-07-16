import { describe, expect, it } from 'vitest';

import {
  booleanActiveIndex,
  reconcileFilterEditor,
  reconcileIncompleteDraft,
} from '@filter/hooks/use-filter-editor/filter-editor-reconciliation.ts';
import type {
  FilterEditorState,
  IncompleteDraft,
} from '@filter/hooks/use-filter-editor/filter-editor-state.ts';
import type { FilterFieldDefinition } from '@filter/types.ts';
import { createFilterFieldRegistry } from '@filter/utilities/field-registry.ts';

const FIELDS: readonly FilterFieldDefinition[] = [
  { key: 'name', type: 'string' },
  { key: 'amount', type: 'number' },
  { key: 'active', type: 'boolean' },
  {
    key: 'stage',
    type: 'enum',
    options: ['Lead', 'Won'],
    operators: ['equals', 'in'],
  },
  { key: 'date', type: 'date' },
];

const registry = createFilterFieldRegistry(FIELDS);

describe('active choice reconciliation', () => {
  it('falls back to the first allowed boolean choice after narrowing', () => {
    expect(
      booleanActiveIndex(
        { key: 'active', type: 'boolean', operators: ['equals'] },
        'isNotEmpty',
        undefined,
      ),
    ).toBe(0);
  });
});

function valueEditor(
  overrides: Partial<Extract<FilterEditorState, { stage: 'value' }>> = {},
): Extract<FilterEditorState, { stage: 'value' }> {
  return {
    stage: 'value',
    filterId: null,
    fieldKey: 'name',
    fieldType: 'string',
    operator: 'equals',
    draft: { kind: 'scalar', input: 'Maria' },
    error: 'old error',
    activeIndex: 3,
    ...overrides,
  };
}

describe('reconcileFilterEditor', () => {
  it('leaves unrelated and compatible stages unchanged', () => {
    const idle = { stage: 'idle' } as const;
    const field = {
      stage: 'field' as const,
      filterId: null,
      query: 'na',
      activeIndex: 1,
    };
    const operator = {
      stage: 'operator' as const,
      filterId: null,
      fieldKey: 'name',
      fieldType: 'string' as const,
      activeIndex: 0,
    };
    const value = valueEditor({ error: null, activeIndex: 0 });
    expect(reconcileFilterEditor(idle, registry)).toBe(idle);
    expect(reconcileFilterEditor(field, registry)).toBe(field);
    expect(reconcileFilterEditor(operator, registry)).toBe(operator);
    expect(reconcileFilterEditor(value, registry)).toBe(value);
  });

  it('closes a removed field and returns changed types to field selection', () => {
    expect(reconcileFilterEditor(valueEditor({ fieldKey: 'missing' }), registry)).toEqual({
      stage: 'idle',
    });

    expect(
      reconcileFilterEditor(
        valueEditor({
          filterId: 'token',
          fieldKey: 'amount',
          fieldType: 'string',
        }),
        registry,
      ),
    ).toEqual({
      stage: 'field',
      filterId: 'token',
      query: '',
      activeIndex: 1,
    });
  });

  it('returns a removed active operator to operator selection', () => {
    expect(
      reconcileFilterEditor(
        valueEditor({
          fieldKey: 'stage',
          fieldType: 'enum',
          operator: 'notIn',
          draft: { kind: 'multiSelection', selectedOptions: ['Lead'] },
        }),
        registry,
      ),
    ).toEqual({
      stage: 'operator',
      filterId: null,
      fieldKey: 'stage',
      fieldType: 'enum',
      activeIndex: 0,
    });
  });

  it.each([
    [
      'range',
      valueEditor({
        fieldKey: 'amount',
        fieldType: 'number',
        operator: 'between',
      }),
      { kind: 'range', fromInput: '', toInput: '' },
    ],
    [
      'duration',
      valueEditor({
        fieldKey: 'date',
        fieldType: 'date',
        operator: 'withinLast',
      }),
      { kind: 'duration', amountInput: '', unit: 'days' },
    ],
    [
      'multi-selection',
      valueEditor({
        fieldKey: 'stage',
        fieldType: 'enum',
        operator: 'in',
      }),
      { kind: 'multiSelection', selectedOptions: [] },
    ],
    [
      'scalar',
      valueEditor({
        fieldKey: 'active',
        fieldType: 'boolean',
        operator: 'equals',
        draft: { kind: 'range', fromInput: '1', toInput: '2' },
      }),
      { kind: 'scalar', input: '' },
    ],
  ])('repairs a mismatched %s draft shape', (_label, editor, expectedDraft) => {
    expect(reconcileFilterEditor(editor, registry)).toMatchObject({
      stage: 'value',
      draft: expectedDraft,
      error: null,
      activeIndex: 0,
    });
  });

  it('removes unavailable enum selections and single values', () => {
    const multi = valueEditor({
      fieldKey: 'stage',
      fieldType: 'enum',
      operator: 'in',
      draft: {
        kind: 'multiSelection',
        selectedOptions: ['Lead', 'Removed'],
      },
    });
    expect(reconcileFilterEditor(multi, registry)).toMatchObject({
      draft: { kind: 'multiSelection', selectedOptions: ['Lead'] },
      error: null,
      activeIndex: 0,
    });

    const scalar = valueEditor({
      fieldKey: 'stage',
      fieldType: 'enum',
      operator: 'equals',
      draft: { kind: 'scalar', input: 'Removed' },
    });
    expect(reconcileFilterEditor(scalar, registry)).toMatchObject({
      draft: { kind: 'scalar', input: '' },
    });

    const empty = valueEditor({
      fieldKey: 'stage',
      fieldType: 'enum',
      operator: 'equals',
      draft: { kind: 'scalar', input: '' },
      error: null,
      activeIndex: 0,
    });
    expect(reconcileFilterEditor(empty, registry)).toBe(empty);
  });
});

describe('reconcileIncompleteDraft', () => {
  it('drops null and removed fields, and leaves type changes and operator stages resumable', () => {
    expect(reconcileIncompleteDraft(null, registry)).toBeNull();
    expect(
      reconcileIncompleteDraft(
        {
          stage: 'operator',
          fieldKey: 'missing',
          fieldType: 'string',
        },
        registry,
      ),
    ).toBeNull();

    const changedType: IncompleteDraft = {
      stage: 'value',
      fieldKey: 'amount',
      fieldType: 'string',
      operator: 'equals',
      draft: { kind: 'scalar', input: '1' },
    };
    expect(reconcileIncompleteDraft(changedType, registry)).toBe(changedType);

    const operator: IncompleteDraft = {
      stage: 'operator',
      fieldKey: 'name',
      fieldType: 'string',
    };
    expect(reconcileIncompleteDraft(operator, registry)).toBe(operator);
  });

  it('backs up to operators when the saved operator disappears', () => {
    expect(
      reconcileIncompleteDraft(
        {
          stage: 'value',
          fieldKey: 'stage',
          fieldType: 'enum',
          operator: 'notIn',
          draft: { kind: 'multiSelection', selectedOptions: ['Lead'] },
        },
        registry,
      ),
    ).toEqual({
      stage: 'operator',
      fieldKey: 'stage',
      fieldType: 'enum',
    });
  });

  it('prunes enum values while preserving compatible drafts by identity', () => {
    const pruned: IncompleteDraft = {
      stage: 'value',
      fieldKey: 'stage',
      fieldType: 'enum',
      operator: 'in',
      draft: {
        kind: 'multiSelection',
        selectedOptions: ['Lead', 'Removed'],
      },
    };
    expect(reconcileIncompleteDraft(pruned, registry)).toEqual({
      ...pruned,
      draft: { kind: 'multiSelection', selectedOptions: ['Lead'] },
    });

    const stringDraft: IncompleteDraft = {
      stage: 'value',
      fieldKey: 'name',
      fieldType: 'string',
      operator: 'equals',
      draft: { kind: 'scalar', input: 'Maria' },
    };
    expect(reconcileIncompleteDraft(stringDraft, registry)).toBe(stringDraft);
  });
});
