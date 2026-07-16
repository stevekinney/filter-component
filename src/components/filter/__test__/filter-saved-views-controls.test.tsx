import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { FilterFieldDefinition } from '@/types/filter.ts';
import { savedViewKey } from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';

import { SavedViewsControls } from '../filter-saved-views.tsx';

const savedViewDerivationProbes = vi.hoisted(() => ({
  savedViewKey: vi.fn(),
}));

vi.mock('@/utilities/filter/saved-views.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/filter/saved-views.ts')>();
  return {
    ...actual,
    savedViewKey: (...arguments_: Parameters<typeof actual.savedViewKey>) => {
      savedViewDerivationProbes.savedViewKey();
      return actual.savedViewKey(...arguments_);
    },
  };
});

const FIELDS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'stage', label: 'Stage', type: 'enum', options: ['Lead', 'Won'] },
  { key: 'created', label: 'Created', type: 'date' },
] as const satisfies readonly FilterFieldDefinition[];

const ALPHA_VIEW: SavedView = {
  name: 'Alpha',
  group: {
    combinator: 'and',
    conditions: [
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'Alpha',
      },
    ],
  },
};

const ALL_VIEW: SavedView = {
  name: 'All names',
  group: {
    combinator: 'and',
    conditions: [
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'Alpha',
      },
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'Beta',
      },
    ],
  },
};

function savedViewsProps(
  overrides: Partial<ComponentProps<typeof SavedViewsControls>> = {},
): ComponentProps<typeof SavedViewsControls> {
  return {
    fields: FIELDS,
    views: [ALPHA_VIEW],
    canSaveCurrentGroup: true,
    currentGroupKey: savedViewKey(ALPHA_VIEW.group),
    disabled: false,
    onSaveView: vi.fn(),
    onLoadView: vi.fn(),
    onRemoveView: vi.fn(),
    ...overrides,
  };
}

describe('SavedViewsControls lifecycle', () => {
  it('toggles from the trigger, closes from the header, and light-dismisses', () => {
    const props = savedViewsProps();
    const view = render(<SavedViewsControls {...props} />);
    const trigger = screen.getByRole('button', { name: 'Saved views' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog', { name: 'Saved views' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Saved views' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    view.rerender(<SavedViewsControls {...props} disabled />);
    expect(screen.queryByRole('dialog', { name: 'Saved views' })).not.toBeInTheDocument();
  });

  it('does not recompute unchanged saved-view rows while typing a name', () => {
    const props = savedViewsProps({
      views: [ALPHA_VIEW, ALL_VIEW],
      currentGroupKey: 'not-active',
    });
    render(<SavedViewsControls {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saved views' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save current filters…' }));

    savedViewDerivationProbes.savedViewKey.mockClear();

    const input = screen.getByRole('textbox', { name: 'View name' });
    fireEvent.change(input, { target: { value: 'M' } });
    fireEvent.change(input, { target: { value: 'Mine' } });

    expect(input).toHaveValue('Mine');
    expect(screen.getByText('1 filter · Name')).toBeVisible();
    expect(screen.getByText('2 filters · All · Name')).toBeVisible();
    expect(savedViewDerivationProbes.savedViewKey).not.toHaveBeenCalled();
  });
});
