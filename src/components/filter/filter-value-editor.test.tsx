import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterValueEditor } from './filter-value-editor.tsx';
import type { FilterEditorState } from './filter-editor-state.ts';
import type { FilterOperator } from '@/types/filter.ts';

function valueState(
  operator: FilterOperator,
  draft: Extract<FilterEditorState, { stage: 'value' }>['draft'],
  error: string | null = null,
): Extract<FilterEditorState, { stage: 'value' }> {
  return {
    stage: 'value',
    filterId: null,
    fieldKey: 'field',
    fieldType: 'string',
    operator,
    draft,
    error,
    activeIndex: 0,
  };
}

describe('FilterValueEditor rendering branches', () => {
  function editorProps(
    overrides: Partial<ComponentProps<typeof FilterValueEditor>> = {},
  ): ComponentProps<typeof FilterValueEditor> {
    return {
      state: valueState('equals', { kind: 'scalar', input: '' }),
      heading: 'Value editor',
      kind: 'text',
      idPrefix: 'editor',
      onDraftChange: vi.fn(),
      onCommitValue: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    };
  }

  it.each(['text', 'number', 'date'] as const)(
    'edits and commits a %s scalar with keyboard and Apply',
    (kind) => {
      const initialValue = kind === 'date' ? '2026-01-01' : '1';
      const nextValue = kind === 'date' ? '2026-01-02' : '2';
      const onCommitValue = vi.fn();
      const props = editorProps({
        kind,
        onCommitValue,
        state: valueState(
          'equals',
          { kind: 'scalar', input: initialValue },
          'Invalid value',
        ),
      });
      render(<FilterValueEditor {...props} />);
      const input = screen.getByLabelText('Value');
      expect(input).toHaveAttribute('aria-describedby', 'editor-error');
      fireEvent.change(input, { target: { value: nextValue } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Escape' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onDraftChange).toHaveBeenCalledWith({
        kind: 'scalar',
        input: nextValue,
      });
      expect(onCommitValue).toHaveBeenCalledTimes(2);
      expect(props.onCancel).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['numberRange', 'dateRange'] as const)(
    'edits and applies a %s draft',
    (kind) => {
      const initialFrom = kind === 'dateRange' ? '2026-01-01' : '1';
      const initialTo = kind === 'dateRange' ? '2026-01-02' : '2';
      const nextFrom = kind === 'dateRange' ? '2026-01-03' : '3';
      const nextTo = kind === 'dateRange' ? '2026-01-04' : '4';
      const onCommitValue = vi.fn();
      const props = editorProps({
        kind,
        onCommitValue,
        state: valueState('between', {
          kind: 'range',
          fromInput: initialFrom,
          toInput: initialTo,
        }),
      });
      render(<FilterValueEditor {...props} />);
      const from = screen.getByLabelText('From');
      const to = screen.getByLabelText('To');
      expect(from).not.toHaveAttribute('aria-describedby');
      fireEvent.change(from, { target: { value: nextFrom } });
      fireEvent.change(to, { target: { value: nextTo } });
      fireEvent.keyDown(to, { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(props.onDraftChange).toHaveBeenNthCalledWith(1, {
        kind: 'range',
        fromInput: nextFrom,
        toInput: initialTo,
      });
      expect(props.onDraftChange).toHaveBeenNthCalledWith(2, {
        kind: 'range',
        fromInput: initialFrom,
        toInput: nextTo,
      });
      expect(onCommitValue).toHaveBeenCalledTimes(2);
    },
  );

  it('edits and applies a duration and ignores an unknown unit', () => {
    const props = editorProps({
      kind: 'duration',
      state: valueState('withinLast', {
        kind: 'duration',
        amountInput: '7',
        unit: 'days',
      }),
    });
    render(<FilterValueEditor {...props} />);
    const amount = screen.getByRole('spinbutton', { name: 'Amount' });
    const unit = screen.getByRole('combobox', { name: 'Unit' });
    fireEvent.change(amount, { target: { value: '8' } });
    fireEvent.change(unit, { target: { value: 'weeks' } });
    fireEvent.change(unit, { target: { value: 'unknown' } });
    fireEvent.keyDown(unit, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onDraftChange).toHaveBeenNthCalledWith(1, {
      kind: 'duration',
      amountInput: '8',
      unit: 'days',
    });
    expect(props.onDraftChange).toHaveBeenNthCalledWith(2, {
      kind: 'duration',
      amountInput: '7',
      unit: 'weeks',
    });
    expect(props.onCommitValue).toHaveBeenCalledOnce();
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('renders no typed controls for mismatched draft/editor shapes', () => {
    const view = render(
      <FilterValueEditor
        {...editorProps({
          kind: 'text',
          state: valueState('equals', {
            kind: 'range',
            fromInput: '',
            toInput: '',
          }),
        })}
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    view.rerender(
      <FilterValueEditor
        {...editorProps({
          kind: 'numberRange',
          state: valueState('between', { kind: 'scalar', input: '' }),
        })}
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    view.rerender(
      <FilterValueEditor
        {...editorProps({
          kind: 'duration',
          state: valueState('withinLast', { kind: 'scalar', input: '' }),
        })}
      />,
    );
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    view.rerender(
      <FilterValueEditor
        {...editorProps({
          kind: 'text',
          state: valueState('withinLast', {
            kind: 'duration',
            amountInput: '',
            unit: 'days',
          }),
        })}
      />,
    );
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    view.rerender(
      <FilterValueEditor
        {...editorProps({
          kind: 'enumMulti',
          state: valueState('in', {
            kind: 'multiSelection',
            selectedOptions: ['Lead'],
          }),
        })}
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    view.rerender(
      <FilterValueEditor
        {...editorProps({
          kind: 'none',
          state: valueState('isEmpty', { kind: 'scalar', input: '' }),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeVisible();
  });
});
