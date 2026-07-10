import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterRail } from './filter-action-rail.tsx';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const STRING_FIELD = {
  key: 'name',
  label: 'Name',
  type: 'string',
} as const satisfies FilterFieldDefinition;

function railProps(
  overrides: Partial<ComponentProps<typeof FilterRail>> = {},
): ComponentProps<typeof FilterRail> {
  return {
    disabled: false,
    fields: [STRING_FIELD],
    savedViews: [],
    canSaveCurrentGroup: false,
    currentGroupKey: '',
    onSaveView: vi.fn(),
    onLoadView: vi.fn(),
    onRemoveView: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    hasFilters: false,
    onClearAll: vi.fn(),
    ...overrides,
  };
}

describe('FilterRail rendering branches', () => {
  it('renders nothing when all three clusters are unavailable', () => {
    const { container } = render(<FilterRail {...railProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders and invokes each history variant', () => {
    const undo = railProps({ canUndo: true });
    const view = render(<FilterRail {...undo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo filter change' }));
    expect(undo.onUndo).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Redo filter change' }),
    ).not.toBeInTheDocument();

    const redo = railProps({ canRedo: true });
    view.rerender(<FilterRail {...redo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Redo filter change' }));
    expect(redo.onRedo).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Undo filter change' }),
    ).not.toBeInTheDocument();

    const both = railProps({ canUndo: true, canRedo: true, disabled: true });
    view.rerender(<FilterRail {...both} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button')[0]).toBeDisabled();
  });

  it('renders saved views, destructive clear, and dividers by visible cluster', () => {
    const clear = railProps({ hasFilters: true });
    const view = render(<FilterRail {...clear} />);
    const clearButton = screen.getByRole('button', {
      name: 'Clear all filters',
    });
    expect(clearButton).toHaveClass('is-destructive');
    fireEvent.click(clearButton);
    expect(clear.onClearAll).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('.filter-rail-divider')).toHaveLength(0);

    const all = railProps({
      canSaveCurrentGroup: true,
      canUndo: true,
      canRedo: true,
      hasFilters: true,
    });
    view.rerender(<FilterRail {...all} />);
    expect(screen.getByRole('button', { name: 'Saved views' })).toBeVisible();
    expect(document.querySelectorAll('.filter-rail-divider')).toHaveLength(2);
  });
});
