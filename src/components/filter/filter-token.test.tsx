import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterToken } from './filter-token.tsx';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterValidationIssue } from '@/utilities/filter/validation.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

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

function tokenCallbacks() {
  return {
    onOpenSegment: vi.fn(),
    onRemove: vi.fn(),
    onRemoveEnumValue: vi.fn(),
    onMoveFocus: vi.fn(),
  };
}

function tokenProps(
  overrides: Partial<ComponentProps<typeof FilterToken>> = {},
): ComponentProps<typeof FilterToken> {
  return {
    filter: STRING_ENTRY,
    field: STRING_FIELD,
    validationIssue: null,
    editingSegment: null,
    inAndRun: false,
    disabled: false,
    ...tokenCallbacks(),
    ...overrides,
  };
}

describe('FilterToken rendering and keyboard branches', () => {
  it('renders known, missing, invalid, grouped, editing, and valueless tokens', () => {
    const invalid: FilterValidationIssue = {
      segment: 'field',
      reason: 'Missing field',
    };
    const view = render(
      <FilterToken
        {...tokenProps({
          field: undefined,
          validationIssue: invalid,
          editingSegment: 'operator',
          inAndRun: true,
        })}
      />,
    );
    const token = screen.getByRole('group');
    expect(token).toHaveAccessibleName(
      /name is Maria \(in a group matching all\) \(invalid: Missing field\)/,
    );
    expect(screen.getByTitle('Change operator')).toHaveClass('is-editing');
    expect(
      screen.getByRole('button', { name: /Fix invalid filter/ }),
    ).toBeVisible();

    const valueless: FilterEntry = {
      id: 'condition-2',
      fieldKey: 'name',
      type: 'string',
      operator: 'isEmpty',
    };
    view.rerender(<FilterToken {...tokenProps({ filter: valueless })} />);
    expect(screen.queryByTitle('Change value')).not.toBeInTheDocument();
  });

  it('opens warning and ordinary segments and removes enum pills', () => {
    const callbacks = tokenCallbacks();
    const invalid: FilterValidationIssue = {
      segment: 'value',
      reason: 'Invalid option',
    };
    const enumEntry: FilterEntry = {
      id: 'condition-enum',
      fieldKey: 'stage',
      type: 'enum',
      operator: 'in',
      value: ['Lead', 'Won'],
    };
    render(
      <FilterToken
        {...tokenProps({
          filter: enumEntry,
          field: ENUM_FIELD,
          validationIssue: invalid,
          ...callbacks,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Fix invalid filter/ }));
    fireEvent.click(screen.getByTitle('Change field'));
    fireEvent.click(screen.getByTitle('Change operator'));
    fireEvent.click(screen.getAllByTitle('Change values')[0] as HTMLElement);
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Won from Stage filter' }),
    );
    expect(callbacks.onOpenSegment.mock.calls.map((call) => call[0])).toEqual([
      'value',
      'field',
      'operator',
      'value',
    ]);
    expect(callbacks.onRemoveEnumValue).toHaveBeenCalledWith('Won');
  });

  it('falls back to the warning control when its token root is unavailable', () => {
    const callbacks = tokenCallbacks();
    render(
      <FilterToken
        {...tokenProps({
          validationIssue: { segment: 'field', reason: 'Missing field' },
          ...callbacks,
        })}
      />,
    );
    const warning = screen.getByRole('button', { name: /Fix invalid filter/ });
    vi.spyOn(warning, 'closest').mockReturnValue(null);
    fireEvent.click(warning);
    expect(callbacks.onOpenSegment).toHaveBeenCalledWith('field', warning);
  });

  it('shows an ellipsis for an intrinsically empty display value', () => {
    render(
      <FilterToken
        {...tokenProps({ filter: { ...STRING_ENTRY, value: '' } })}
      />,
    );
    expect(screen.getByTitle('Change value')).toHaveTextContent('…');
  });

  it('implements root and segment delete, enter, escape, arrow, and tab behavior', () => {
    const callbacks = tokenCallbacks();
    render(<FilterToken {...tokenProps({ ...callbacks })} />);
    const token = screen.getByRole('group');
    const field = screen.getByTitle('Change field');
    const operator = screen.getByTitle('Change operator');
    const value = screen.getByTitle('Change value');
    const remove = screen.getByRole('button', { name: /Remove Name is Maria/ });

    fireEvent.keyDown(token, { key: 'Delete' });
    fireEvent.keyDown(token, { key: 'Backspace' });
    expect(callbacks.onRemove).toHaveBeenCalledTimes(2);

    field.focus();
    fireEvent.keyDown(field, { key: 'Delete' });
    expect(token).toHaveFocus();
    fireEvent.keyDown(token, { key: 'Enter' });
    expect(field).toHaveFocus();
    token.focus();
    fireEvent.keyDown(token, { key: ' ' });
    expect(field).toHaveFocus();

    fireEvent.keyDown(field, { key: 'Escape' });
    expect(token).toHaveFocus();
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(token).toHaveFocus();

    token.focus();
    fireEvent.keyDown(token, { key: 'ArrowDown' });
    expect(field).toHaveFocus();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(callbacks.onOpenSegment).toHaveBeenCalledWith('field', field);
    fireEvent.keyDown(remove, { key: 'ArrowDown' });

    token.focus();
    fireEvent.keyDown(token, { key: 'ArrowLeft' });
    fireEvent.keyDown(token, { key: 'ArrowRight' });
    expect(callbacks.onMoveFocus).toHaveBeenNthCalledWith(1, -1);
    expect(callbacks.onMoveFocus).toHaveBeenNthCalledWith(2, 1);

    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowLeft' });
    expect(token).toHaveFocus();
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(operator).toHaveFocus();
    fireEvent.keyDown(operator, { key: 'Tab' });
    expect(value).toHaveFocus();
    fireEvent.keyDown(value, { key: 'Tab', shiftKey: true });
    expect(operator).toHaveFocus();
    remove.focus();
    fireEvent.keyDown(remove, { key: 'Tab' });
    expect(callbacks.onMoveFocus).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(token, { key: 'Home' });
  });

  it('keeps a disabled token inert even if it was already focused', () => {
    const callbacks = tokenCallbacks();
    render(<FilterToken {...tokenProps({ disabled: true, ...callbacks })} />);
    const token = screen.getByRole('group');
    expect(token).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(token, { key: 'Delete' });
    expect(callbacks.onRemove).not.toHaveBeenCalled();
  });
});
