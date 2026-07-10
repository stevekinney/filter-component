import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddFilterCombobox } from './add-filter-combobox.tsx';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const STRING_FIELD = {
  key: 'name',
  label: 'Name',
  type: 'string',
} as const satisfies FilterFieldDefinition;

function comboboxProps(
  overrides: Partial<ComponentProps<typeof AddFilterCombobox>> = {},
): ComponentProps<typeof AddFilterCombobox> {
  return {
    inputRef: createRef<HTMLInputElement>(),
    idPrefix: 'filter',
    disabled: false,
    lastFilterId: null,
    open: false,
    query: '',
    results: [STRING_FIELD],
    activeIndex: 0,
    canFocusTokens: true,
    onOpenMenu: vi.fn(),
    onQueryChange: vi.fn(),
    onNavigate: vi.fn(),
    onSelectActive: vi.fn(),
    onCloseMenu: vi.fn(),
    onFocusLastToken: vi.fn(),
    ...overrides,
  };
}

describe('AddFilterCombobox rendering branches', () => {
  it('opens or updates the menu as text changes', () => {
    const closed = comboboxProps();
    const view = render(<AddFilterCombobox {...closed} />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'na' },
    });
    expect(closed.onOpenMenu).toHaveBeenCalledWith('na');

    const open = comboboxProps({ open: true, query: 'na' });
    view.rerender(<AddFilterCombobox {...open} />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'nam' },
    });
    expect(open.onQueryChange).toHaveBeenCalledWith('nam');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      'filter-field-0',
    );
  });

  it('handles open and closed arrow, enter, escape, and tab paths', () => {
    const closed = comboboxProps();
    const view = render(<AddFilterCombobox {...closed} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(closed.onOpenMenu).toHaveBeenNthCalledWith(1, '');
    expect(closed.onOpenMenu).toHaveBeenNthCalledWith(2, '');
    expect(closed.onSelectActive).not.toHaveBeenCalled();
    expect(closed.onCloseMenu).not.toHaveBeenCalled();

    const open = comboboxProps({ open: true, query: 'n' });
    view.rerender(<AddFilterCombobox {...open} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Tab' });
    expect(open.onNavigate).toHaveBeenNthCalledWith(1, 1);
    expect(open.onNavigate).toHaveBeenNthCalledWith(2, -1);
    expect(open.onSelectActive).toHaveBeenCalledTimes(2);
    expect(open.onSelectActive).toHaveBeenCalledWith(STRING_FIELD);
    expect(open.onQueryChange).toHaveBeenCalledWith('');

    const emptyQuery = comboboxProps({ open: true, query: '' });
    view.rerender(<AddFilterCombobox {...emptyQuery} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Tab' });
    expect(emptyQuery.onCloseMenu).toHaveBeenCalledTimes(2);

    const noResults = comboboxProps({
      open: true,
      query: 'missing',
      results: [],
      activeIndex: 12,
    });
    view.rerender(<AddFilterCombobox {...noResults} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Tab' });
    expect(noResults.onNavigate).not.toHaveBeenCalled();
    expect(noResults.onSelectActive).not.toHaveBeenCalled();
    expect(noResults.onCloseMenu).toHaveBeenCalledOnce();
    expect(screen.getByRole('combobox')).not.toHaveAttribute(
      'aria-activedescendant',
    );
  });

  it('moves into tokens only from the start and closes only on an open blur', () => {
    const focusable = comboboxProps({
      lastFilterId: 'condition-last',
      open: true,
    });
    const view = render(<AddFilterCombobox {...focusable} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.setSelectionRange(0, 0);
    fireEvent.keyDown(input, { key: 'Backspace' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(focusable.onFocusLastToken).toHaveBeenCalledTimes(2);
    expect(focusable.onFocusLastToken).toHaveBeenCalledWith('condition-last');
    fireEvent.blur(input);
    expect(focusable.onCloseMenu).toHaveBeenCalledOnce();

    const variants = [
      comboboxProps({ lastFilterId: null }),
      comboboxProps({
        lastFilterId: 'condition-last',
        canFocusTokens: false,
      }),
    ];
    for (const props of variants) {
      view.rerender(<AddFilterCombobox {...props} />);
      const nextInput = screen.getByRole('combobox') as HTMLInputElement;
      nextInput.setSelectionRange(0, 0);
      fireEvent.keyDown(nextInput, { key: 'Backspace' });
      fireEvent.blur(nextInput);
      expect(props.onFocusLastToken).not.toHaveBeenCalled();
      expect(props.onCloseMenu).not.toHaveBeenCalled();
    }

    const positioned = comboboxProps({ lastFilterId: 'condition-last' });
    view.rerender(<AddFilterCombobox {...positioned} />);
    const positionedInput = screen.getByRole('combobox') as HTMLInputElement;
    positionedInput.value = 'x';
    positionedInput.setSelectionRange(1, 1);
    fireEvent.keyDown(positionedInput, { key: 'Backspace' });
    positionedInput.setSelectionRange(0, 1);
    fireEvent.keyDown(positionedInput, { key: 'ArrowLeft' });
    expect(positioned.onFocusLastToken).not.toHaveBeenCalled();
  });

  it('renders disabled and populated placeholders', () => {
    const { rerender } = render(
      <AddFilterCombobox {...comboboxProps({ disabled: true })} />,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByPlaceholderText('Filter by field…')).toBeVisible();
    rerender(
      <AddFilterCombobox
        {...comboboxProps({ lastFilterId: 'condition-last' })}
      />,
    );
    expect(screen.getByPlaceholderText('Add filter…')).toBeVisible();
  });
});
