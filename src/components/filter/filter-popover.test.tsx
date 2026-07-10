import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterPopover } from './filter-popover.tsx';
import type {
  ActiveFilterEditorState,
  FilterPopoverProps,
} from './filter-popover.tsx';
import type { FilterEditorState } from './filter-editor-state.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterFieldDefinition, FilterOperator } from '@/types/filter.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';

const STRING_FIELD = {
  key: 'name',
  label: 'Name',
  type: 'string',
} as const satisfies FilterFieldDefinition;

const ENUM_FIELD = {
  key: 'stage',
  label: 'Stage',
  type: 'enum',
  options: ['Lead', 'Won'],
} as const satisfies FilterFieldDefinition;

const FIELDS: readonly FilterFieldDefinition[] = [STRING_FIELD, ENUM_FIELD];

const STRING_ENTRY: FilterEntry = {
  id: 'condition-1',
  fieldKey: 'name',
  type: 'string',
  operator: 'equals',
  value: 'Maria',
};

function fieldState(): Extract<FilterEditorState, { stage: 'field' }> {
  return {
    stage: 'field',
    filterId: 'condition-1',
    query: '',
    activeIndex: 0,
  };
}

function operatorState(
  field: FilterFieldDefinition,
): Extract<FilterEditorState, { stage: 'operator' }> {
  return {
    stage: 'operator',
    filterId: 'condition-1',
    fieldKey: field.key,
    fieldType: field.type,
    activeIndex: 0,
  };
}

function valueState(
  field: FilterFieldDefinition,
  operator: FilterOperator,
  draft: ValueDraft,
): Extract<FilterEditorState, { stage: 'value' }> {
  return {
    stage: 'value',
    filterId: 'condition-1',
    fieldKey: field.key,
    fieldType: field.type,
    operator,
    draft,
    error: null,
    activeIndex: 0,
  };
}

function popoverProps(
  state: FilterEditorState,
  overrides: Partial<FilterPopoverProps> = {},
): FilterPopoverProps {
  return {
    state,
    fields: FIELDS,
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
    ...overrides,
  };
}

describe('FilterPopover stage composition', () => {
  it('renders nothing while idle or when an active field disappeared', () => {
    const view = render(<FilterPopover {...popoverProps({ stage: 'idle' })} />);
    expect(view.container.querySelector('[popover]')).toBeNull();
    view.rerender(
      <FilterPopover
        {...popoverProps(operatorState({ key: 'missing', type: 'string' }), {
          fields: FIELDS,
        })}
      />,
    );
    expect(view.container.querySelector('[popover]')).toBeNull();
    view.rerender(
      <FilterPopover
        {...popoverProps(
          valueState({ key: 'missing', type: 'string' }, 'equals', {
            kind: 'scalar',
            input: 'x',
          }),
          { fields: FIELDS },
        )}
      />,
    );
    expect(view.container.querySelector('[popover]')).toBeNull();
  });

  it.each([
    [fieldState(), 'Choose field'],
    [operatorState(STRING_FIELD), 'Name'],
    [
      valueState(ENUM_FIELD, 'equals', { kind: 'scalar', input: 'Lead' }),
      'Stage is',
    ],
    [
      valueState(ENUM_FIELD, 'in', {
        kind: 'multiSelection',
        selectedOptions: ['Lead'],
      }),
      'Stage is any of',
    ],
    [
      valueState(STRING_FIELD, 'contains', {
        kind: 'scalar',
        input: 'Mar',
      }),
      'Name contains',
    ],
    [
      valueState(STRING_FIELD, 'isEmpty', { kind: 'scalar', input: '' }),
      'Name is empty',
    ],
  ] satisfies [ActiveFilterEditorState, string][])(
    'composes the %s stage into the dialog',
    (state, name) => {
      const props = popoverProps(state);
      render(<FilterPopover {...props} />);
      const dialog = screen.getByRole('dialog', { name });
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(props.onCancel).toHaveBeenCalledOnce();
    },
  );
});
