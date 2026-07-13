import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SingleChoiceStage } from './filter-popover-stages.tsx';
import type { FilterEditorState } from './filter-editor-state.ts';
import type { FilterPopoverProps } from './filter-popover.tsx';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const STRING_FIELD = {
  key: 'name',
  label: 'Name',
  type: 'string',
} as const satisfies FilterFieldDefinition;

const BOOLEAN_FIELD = {
  key: 'active',
  label: 'Active',
  type: 'boolean',
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

function operatorState(
  field: FilterFieldDefinition,
  overrides: Partial<Extract<FilterEditorState, { stage: 'operator' }>> = {},
): Extract<FilterEditorState, { stage: 'operator' }> {
  return {
    stage: 'operator',
    filterId: 'condition-1',
    fieldKey: field.key,
    fieldType: field.type,
    activeIndex: 0,
    ...overrides,
  };
}

function popoverProps(
  state: FilterEditorState,
  overrides: Partial<FilterPopoverProps> = {},
): FilterPopoverProps {
  return {
    state,
    fields: [STRING_FIELD, BOOLEAN_FIELD, ENUM_FIELD],
    fieldResults: [STRING_FIELD, BOOLEAN_FIELD, ENUM_FIELD],
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

describe('SingleChoiceStage', () => {
  it('renders normal operators, marks the committed choice, and navigates/selects', () => {
    const props = popoverProps(operatorState(STRING_FIELD));
    render(
      <SingleChoiceStage
        {...props}
        state={operatorState(STRING_FIELD)}
        heading="Name"
        field={STRING_FIELD}
      />,
    );
    const list = screen.getByRole('listbox', { name: 'Name' });
    expect(within(list).getByRole('option', { name: 'is' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.mouseDown(list);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'Enter' });
    fireEvent.keyDown(list, { key: ' ' });
    fireEvent.keyDown(list, { key: 'Escape' });
    const contains = within(list).getByRole('option', { name: 'contains' });
    fireEvent.mouseEnter(contains);
    fireEvent.click(contains);
    expect(props.onChangeActiveIndex).toHaveBeenCalledTimes(3);
    expect(props.onSelectOperator).toHaveBeenCalledTimes(3);
  });

  it('renders narrowed boolean choices and both committed selection shapes', () => {
    const narrowed = {
      ...BOOLEAN_FIELD,
      operators: ['equals', 'isEmpty'] as const,
    } satisfies FilterFieldDefinition<'boolean'>;
    const trueEntry: FilterEntry = {
      id: 'boolean',
      fieldKey: 'active',
      type: 'boolean',
      operator: 'equals',
      value: true,
    };
    const props = popoverProps(operatorState(narrowed), {
      editingFilter: trueEntry,
    });
    const view = render(
      <SingleChoiceStage
        {...props}
        state={operatorState(narrowed)}
        heading="Active"
        field={narrowed}
      />,
    );
    expect(screen.getByRole('option', { name: 'is true' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.queryByRole('option', { name: 'is not empty' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'is empty' }));
    expect(props.onPickBoolean).toHaveBeenCalledWith('isEmpty');

    const emptyEntry: FilterEntry = {
      id: 'boolean-empty',
      fieldKey: 'active',
      type: 'boolean',
      operator: 'isEmpty',
    };
    const emptyProps = popoverProps(operatorState(narrowed), {
      editingFilter: emptyEntry,
    });
    view.rerender(
      <SingleChoiceStage
        {...emptyProps}
        state={operatorState(narrowed)}
        heading="Active"
        field={narrowed}
      />,
    );
    expect(screen.getByRole('option', { name: 'is empty' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('option', { name: 'is false' }));
    expect(emptyProps.onPickBoolean).toHaveBeenCalledWith('false');
  });

  it('ignores choices invalidated between render and activation', () => {
    const booleanOperators: ('equals' | 'isEmpty' | 'isNotEmpty')[] = [
      'equals',
    ];
    const mutableBoolean = {
      ...BOOLEAN_FIELD,
      operators: booleanOperators,
    } satisfies FilterFieldDefinition<'boolean'>;
    const booleanProps = popoverProps(operatorState(mutableBoolean));
    const view = render(
      <SingleChoiceStage
        {...booleanProps}
        state={operatorState(mutableBoolean)}
        heading="Active"
        field={mutableBoolean}
      />,
    );
    const trueOption = screen.getByRole('option', { name: 'is true' });
    booleanOperators.splice(0);
    fireEvent.click(trueOption);
    expect(booleanProps.onPickBoolean).not.toHaveBeenCalled();

    const stringOperators: ('equals' | 'contains')[] = ['equals'];
    const mutableString = {
      ...STRING_FIELD,
      operators: stringOperators,
    } satisfies FilterFieldDefinition<'string'>;
    const stringProps = popoverProps(operatorState(mutableString));
    view.rerender(
      <SingleChoiceStage
        {...stringProps}
        state={operatorState(mutableString)}
        heading="Name"
        field={mutableString}
      />,
    );
    const equalsOption = screen.getByRole('option', { name: 'is' });
    stringOperators.splice(0);
    fireEvent.click(equalsOption);
    expect(stringProps.onSelectOperator).not.toHaveBeenCalled();
  });
});
