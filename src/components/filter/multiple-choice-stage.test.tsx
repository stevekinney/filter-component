import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MultipleChoiceStage } from './filter-popover-stages.tsx';
import type { FilterEditorState } from './filter-editor-state.ts';
import type { FilterPopoverProps } from './filter-popover.tsx';
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
      <MultipleChoiceStage
        {...props}
        state={state}
        heading="Stage is any of"
        field={ENUM_FIELD}
      />,
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

  it('falls back to no selections for a mismatched draft and handles no options', () => {
    const mismatch = valueState(ENUM_FIELD, 'in', {
      kind: 'scalar',
      input: 'Lead',
    });
    const view = renderMultiple(mismatch);
    expect(screen.getByRole('option', { name: 'Lead' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    const emptyField = {
      key: 'empty',
      label: 'Empty',
      type: 'enum',
      options: [],
    } as const satisfies FilterFieldDefinition;
    const emptyState = valueState(emptyField, 'in', {
      kind: 'multiSelection',
      selectedOptions: [],
    });
    const props = popoverProps(emptyState);
    view.rerender(
      <MultipleChoiceStage
        {...props}
        state={emptyState}
        heading="Empty"
        field={emptyField}
      />,
    );
    const list = screen.getByRole('listbox', { name: 'Empty' });
    expect(list).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: ' ' });
    expect(props.onChangeActiveIndex).not.toHaveBeenCalled();
    expect(props.onChangeDraft).not.toHaveBeenCalled();
  });

  it('handles an undefined options list and an unavailable active multi-choice', () => {
    const noOptionsState = valueState(STRING_FIELD, 'equals', {
      kind: 'multiSelection',
      selectedOptions: [],
    });
    const noOptionsProps = popoverProps(noOptionsState);
    const view = render(
      <MultipleChoiceStage
        {...noOptionsProps}
        state={noOptionsState}
        heading="No choices"
        field={STRING_FIELD}
      />,
    );
    expect(screen.getByRole('listbox')).not.toHaveAttribute(
      'aria-activedescendant',
    );

    const unavailableState = valueState(
      ENUM_FIELD,
      'in',
      { kind: 'multiSelection', selectedOptions: [] },
      { activeIndex: Number.NaN },
    );
    const unavailableProps = popoverProps(unavailableState);
    view.rerender(
      <MultipleChoiceStage
        {...unavailableProps}
        state={unavailableState}
        heading="Stage"
        field={ENUM_FIELD}
      />,
    );
    const list = screen.getByRole('listbox');
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    list.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
    fireEvent.keyDown(list, { key: ' ' });
    expect(unavailableProps.onChangeDraft).not.toHaveBeenCalled();
  });
});
