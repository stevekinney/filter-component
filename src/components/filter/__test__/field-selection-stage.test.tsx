import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FilterEditorState } from '@filter/hooks/use-filter-editor/filter-editor-state.ts';
import { FieldSelectionStage } from '@filter/popover/field-selection-stage.tsx';
import type { FilterPopoverProps } from '@filter/popover/filter-popover.tsx';
import type { FilterFieldDefinition } from '@filter/types.ts';
import type { FilterEntry } from '@filter/utilities/filter-entry.ts';

const fieldOptionRenderProbe = vi.hoisted(() => vi.fn());

vi.mock('@filter/utilities/formatting.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@filter/utilities/formatting.ts')>();
  return {
    ...actual,
    fieldLabel: (...arguments_: Parameters<typeof actual.fieldLabel>) => {
      fieldOptionRenderProbe(arguments_[0].key);
      return actual.fieldLabel(...arguments_);
    },
  };
});

const FIELDS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'stage', label: 'Stage', type: 'enum', options: ['Lead', 'Won'] },
  { key: 'created', label: 'Created', type: 'date' },
] as const satisfies readonly FilterFieldDefinition[];

const STRING_ENTRY: FilterEntry = {
  id: 'condition-1',
  fieldKey: 'name',
  type: 'string',
  operator: 'equals',
  value: 'Maria',
};

function fieldState(
  overrides: Partial<Extract<FilterEditorState, { stage: 'field' }>> = {},
): Extract<FilterEditorState, { stage: 'field' }> {
  return {
    stage: 'field',
    filterId: 'condition-1',
    query: '',
    activeIndex: 0,
    ...overrides,
  };
}

function popoverProps(
  state: FilterEditorState,
  fieldResults: readonly FilterFieldDefinition[] = FIELDS,
): FilterPopoverProps {
  return {
    state,
    fields: FIELDS,
    fieldResults,
    editingFilter: STRING_ENTRY,
    idPrefix: 'popover',
    resolveAnchor: () => document.body,
    onBrowserDismiss: vi.fn(),
    onChangeQuery: vi.fn(),
    onChangeActiveIndex: vi.fn(),
    onChangeDraft: vi.fn(),
    onSelectField: vi.fn(),
    onSelectOperator: vi.fn(),
    onPickBoolean: vi.fn(),
    onPickSingleValue: vi.fn(),
    onCommitValue: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('FieldSelectionStage', () => {
  beforeEach(() => fieldOptionRenderProbe.mockClear());

  it('rerenders only rows whose active state changes', () => {
    const fieldResults = FIELDS.slice(0, 3);
    const initialState = fieldState({ activeIndex: 0 });
    const props = popoverProps(initialState, fieldResults);
    const view = render(<FieldSelectionStage {...props} state={initialState} />);

    expect(fieldOptionRenderProbe.mock.calls.map(([key]) => key)).toEqual([
      'name',
      'amount',
      'active',
    ]);

    fieldOptionRenderProbe.mockClear();
    view.rerender(<FieldSelectionStage {...props} state={fieldState({ activeIndex: 1 })} />);
    expect(fieldOptionRenderProbe.mock.calls.map(([key]) => key)).toEqual(['name', 'amount']);

    fieldOptionRenderProbe.mockClear();
    view.rerender(<FieldSelectionStage {...props} state={fieldState({ activeIndex: 2 })} />);
    expect(fieldOptionRenderProbe.mock.calls.map(([key]) => key)).toEqual(['amount', 'active']);
  });
});
