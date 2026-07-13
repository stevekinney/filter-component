import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterTokenList } from './filter-token-list.tsx';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import * as filterExpressionModule from '@/utilities/filter/expression.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
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

describe('FilterTokenList composition branches', () => {
  function renderList(expression: FilterExpression) {
    const callbacks = {
      editingFilterId: null,
      editingSegment: null,
      onOpenSegment: vi.fn(),
      onRemove: vi.fn(),
      onRemoveEnumValue: vi.fn(),
      onFlipJoiner: vi.fn(),
      onMoveFocusFromToken: vi.fn(),
      onMoveFocusFromJoiner: vi.fn(),
    };
    const view = render(
      <FilterTokenList
        expression={expression}
        fields={[STRING_FIELD, ENUM_FIELD]}
        disabled={false}
        {...callbacks}
      />,
    );
    return { ...view, callbacks };
  }

  it('renders an empty and a single-condition expression', () => {
    const view = renderList({ conditions: [], joiners: [] });
    expect(screen.getByRole('list')).toBeEmptyDOMElement();
    view.rerender(
      <FilterTokenList
        expression={{ conditions: [STRING_ENTRY], joiners: [] }}
        fields={[STRING_FIELD]}
        disabled={false}
        {...view.callbacks}
      />,
    );
    expect(screen.getByRole('listitem')).toBeVisible();
  });

  it('renders mixed joiners and brackets and delegates every row command', () => {
    const second: FilterEntry = {
      ...STRING_ENTRY,
      id: 'condition-2',
      value: 'Nadia',
    };
    const third: FilterEntry = {
      ...STRING_ENTRY,
      id: 'condition-3',
      value: 'Cora',
    };
    const { callbacks } = renderList({
      conditions: [STRING_ENTRY, second, third],
      joiners: ['or', 'and'],
    });
    const joiners = screen.getAllByRole('button', { name: /^Joined by/ });
    fireEvent.click(joiners[0] as HTMLElement);
    fireEvent.keyDown(joiners[1] as HTMLElement, { key: 'ArrowLeft' });
    expect(callbacks.onFlipJoiner).toHaveBeenCalledWith(0);
    expect(callbacks.onMoveFocusFromJoiner).toHaveBeenCalledWith('condition-2');
    expect(screen.getAllByText('(')).toHaveLength(1);
    expect(screen.getAllByText(')')).toHaveLength(1);

    const firstToken = screen.getAllByRole('group')[0] as HTMLElement;
    fireEvent.click(within(firstToken).getByTitle('Change field'));
    fireEvent.click(
      within(firstToken).getByRole('button', { name: /Remove Name is Maria/ }),
    );
    fireEvent.keyDown(firstToken, { key: 'ArrowRight' });
    expect(callbacks.onOpenSegment).toHaveBeenCalledWith(
      STRING_ENTRY,
      'field',
      expect.any(HTMLElement),
    );
    expect(callbacks.onRemove).toHaveBeenCalledWith('condition-1');
    expect(callbacks.onMoveFocusFromToken).toHaveBeenCalledWith(0, 1);
  });

  it('delegates enum pill removal from the list', () => {
    const enumEntry: FilterEntry = {
      id: 'condition-enum',
      fieldKey: 'stage',
      type: 'enum',
      operator: 'in',
      value: ['Lead'],
    };
    const { callbacks } = renderList({
      conditions: [enumEntry],
      joiners: [],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Lead from Stage filter' }),
    );
    expect(callbacks.onRemoveEnumValue).toHaveBeenCalledWith(
      'condition-enum',
      'Lead',
    );
  });

  it('falls back to a non-grouped token when marker derivation is unavailable', () => {
    const markerSpy = vi
      .spyOn(filterExpressionModule, 'describeAndRuns')
      .mockReturnValue([]);
    renderList({ conditions: [STRING_ENTRY], joiners: [] });
    expect(screen.getByRole('group')).toHaveAccessibleName('Name is Maria');
    markerSpy.mockRestore();
  });
});
