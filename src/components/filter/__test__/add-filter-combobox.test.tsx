import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { FilterFieldDefinition } from '@/types/filter.ts';

import { AddFilterCombobox } from '../add-filter-combobox.tsx';

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
  it('preserves native backward focus navigation for Shift+Tab', () => {
    const props = comboboxProps({
      open: true,
      query: 'na',
    });
    render(<AddFilterCombobox {...props} />);

    const keyDownWasNotPrevented = fireEvent.keyDown(screen.getByRole('combobox'), {
      key: 'Tab',
      shiftKey: true,
    });

    expect(keyDownWasNotPrevented).toBe(true);
    expect(props.onSelectActive).not.toHaveBeenCalled();
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
});
