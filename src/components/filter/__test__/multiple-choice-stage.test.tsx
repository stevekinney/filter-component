import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FilterEditorState } from '@filter/hooks/use-filter-editor/filter-editor-state.ts';
import type { FilterPopoverProps } from '@filter/popover/filter-popover.tsx';
import { MultipleChoiceStage } from '@filter/popover/multiple-choice-stage.tsx';
import type { FilterFieldDefinition, FilterOperator } from '@filter/types.ts';
import type { FilterEntry } from '@filter/utilities/filter-entry.ts';
import type { ValueDraft } from '@filter/utilities/value-drafts.ts';

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

const STRING_ENTRY: FilterEntry = {
  id: 'condition-1',
  fieldKey: 'name',
  type: 'string',
  operator: 'equals',
  value: 'Maria',
};

function valueState(
  field: FilterFieldDefinition,
  operator: FilterOperator,
  draft: ValueDraft,
  overrides: Partial<Extract<FilterEditorState, { stage: 'value' }>> = {},
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
    ...overrides,
  };
}

function popoverProps(state: FilterEditorState): FilterPopoverProps {
  return {
    state,
    fields: [STRING_FIELD, ENUM_FIELD],
    fieldResults: [STRING_FIELD, ENUM_FIELD],
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

describe('MultipleChoiceStage', () => {
  function renderMultiple(
    state = valueState(ENUM_FIELD, 'in', {
      kind: 'multiSelection',
      selectedOptions: ['Lead'],
    }),
  ) {
    const props = popoverProps(state);
    const view = render(
      <MultipleChoiceStage {...props} state={state} heading="Stage is any of" field={ENUM_FIELD} />,
    );
    return { ...view, props };
  }

  it('toggles selected and unselected choices and applies with keyboard and click', () => {
    const { props } = renderMultiple();
    const list = screen.getByRole('listbox', { name: 'Stage is any of' });
    const lead = screen.getByRole('option', { name: 'Lead' });
    const won = screen.getByRole('option', { name: 'Won' });
    expect(lead).toHaveAttribute('aria-selected', 'true');
    expect(won).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(lead);
    fireEvent.mouseEnter(won);
    fireEvent.click(won);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: ' ' });
    fireEvent.keyDown(list, { key: 'Enter' });
    fireEvent.keyDown(list, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onChangeDraft).toHaveBeenCalledWith({
      kind: 'multiSelection',
      selectedOptions: [],
    });
    expect(props.onChangeDraft).toHaveBeenCalledWith({
      kind: 'multiSelection',
      selectedOptions: ['Lead', 'Won'],
    });
    expect(props.onCommitValue).toHaveBeenCalledTimes(2);
    expect(props.onCancel).toHaveBeenCalledOnce();
  });
});
