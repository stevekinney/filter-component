import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterEditorState } from './filter-editor-state.ts';
import type { FilterPopoverProps } from './filter-popover.tsx';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const fieldOptionRenderProbe = vi.hoisted(() => vi.fn());

vi.mock('@/utilities/filter/formatting.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/utilities/filter/formatting.ts')>();
  return {
    ...actual,
    fieldLabel: (...arguments_: Parameters<typeof actual.fieldLabel>) => {
      fieldOptionRenderProbe(arguments_[0].key);
      return actual.fieldLabel(...arguments_);
    },
  };
});

import { FieldSelectionStage } from './filter-popover-stages.tsx';

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

  it('renders the creation list without a search box and delegates pointer events', () => {
    const props = popoverProps(fieldState({ filterId: null }));
    render(
      <FieldSelectionStage {...props} state={fieldState({ filterId: null })} />,
    );
    expect(
      screen.queryByRole('combobox', { name: 'Search fields' }),
    ).not.toBeInTheDocument();
    const list = screen.getByRole('listbox', { name: 'Fields' });
    const option = within(list).getByRole('option', { name: 'Amountnumber' });
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    option.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
    fireEvent.mouseEnter(option);
    fireEvent.click(option);
    expect(props.onChangeActiveIndex).toHaveBeenCalledWith(1);
    expect(props.onSelectField).toHaveBeenCalledWith('amount');
  });

  it('uses shared results, clamps the active result, and handles every search key path', () => {
    const sharedResults = [FIELDS[1], FIELDS[2]];
    const props = popoverProps(
      fieldState({ query: 'a', activeIndex: 99 }),
      sharedResults,
    );
    const view = render(
      <FieldSelectionStage
        {...props}
        state={fieldState({ query: 'a', activeIndex: 99 })}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Search fields' });
    expect(input).toHaveAttribute('aria-activedescendant');
    fireEvent.change(input, { target: { value: 'am' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(props.onChangeQuery).toHaveBeenCalledWith('am');
    expect(props.onChangeActiveIndex).toHaveBeenCalledTimes(2);
    expect(props.onSelectField).toHaveBeenCalledTimes(2);

    const noResults = popoverProps(
      fieldState({ query: 'not present', activeIndex: 1 }),
      [],
    );
    view.rerender(
      <FieldSelectionStage
        {...noResults}
        state={fieldState({ query: 'not present', activeIndex: 1 })}
      />,
    );
    const emptyInput = screen.getByRole('combobox', { name: 'Search fields' });
    expect(screen.getByText('No matching fields')).toBeVisible();
    expect(emptyInput).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(emptyInput, { key: 'ArrowDown' });
    fireEvent.keyDown(emptyInput, { key: 'ArrowUp' });
    fireEvent.keyDown(emptyInput, { key: 'Enter' });
    fireEvent.keyDown(emptyInput, { key: 'Tab' });
    expect(noResults.onChangeActiveIndex).not.toHaveBeenCalled();
    expect(noResults.onSelectField).not.toHaveBeenCalled();

    const emptyQuery = popoverProps(fieldState({ query: '' }));
    view.rerender(
      <FieldSelectionStage {...emptyQuery} state={fieldState({ query: '' })} />,
    );
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search fields' }), {
      key: 'Tab',
    });
    expect(emptyQuery.onSelectField).not.toHaveBeenCalled();
  });

  it('rerenders only rows whose active state changes', () => {
    const fieldResults = FIELDS.slice(0, 3);
    const initialState = fieldState({ activeIndex: 0 });
    const props = popoverProps(initialState, fieldResults);
    const view = render(
      <FieldSelectionStage {...props} state={initialState} />,
    );

    expect(fieldOptionRenderProbe.mock.calls.map(([key]) => key)).toEqual([
      'name',
      'amount',
      'active',
    ]);

    fieldOptionRenderProbe.mockClear();
    view.rerender(
      <FieldSelectionStage {...props} state={fieldState({ activeIndex: 1 })} />,
    );
    expect(fieldOptionRenderProbe.mock.calls.map(([key]) => key)).toEqual([
      'name',
      'amount',
    ]);

    fieldOptionRenderProbe.mockClear();
    view.rerender(
      <FieldSelectionStage {...props} state={fieldState({ activeIndex: 2 })} />,
    );
    expect(fieldOptionRenderProbe.mock.calls.map(([key]) => key)).toEqual([
      'amount',
      'active',
    ]);
  });
});
