import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedViewsControls } from './filter-saved-views.tsx';
import { savedViewKey } from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

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

const EMPTY_VIEW: SavedView = {
  name: 'Empty',
  group: { combinator: 'and', conditions: [] },
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
    expect(
      screen.queryByRole('dialog', { name: 'Saved views' }),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('dialog', { name: 'Saved views' }),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    view.rerender(<SavedViewsControls {...props} disabled />);
    expect(
      screen.queryByRole('dialog', { name: 'Saved views' }),
    ).not.toBeInTheDocument();
  });

  it('covers naming changes, non-submit keys, save click, and inactive summaries', () => {
    const props = savedViewsProps({
      views: [EMPTY_VIEW, ALPHA_VIEW, ALL_VIEW],
      currentGroupKey: 'not-active',
      fields: [],
    });
    render(<SavedViewsControls {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saved views' }));
    expect(screen.getByText('0 filters')).toBeVisible();
    expect(screen.getByText('1 filter · name')).toBeVisible();
    expect(screen.getByText('2 filters · All · name')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Alpha' })).not.toHaveAttribute(
      'aria-current',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save current filters…' }),
    );
    const input = screen.getByRole('textbox', { name: 'View name' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: '  Mine  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSaveView).toHaveBeenCalledWith('Mine');
  });

  it('handles list key events when the list itself is the target', () => {
    const props = savedViewsProps({ views: [ALPHA_VIEW, EMPTY_VIEW] });
    render(<SavedViewsControls {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saved views' }));
    const list = document.querySelector('.filter-saved-views-list');
    expect(list).toBeInstanceOf(HTMLUListElement);
    fireEvent.keyDown(list as HTMLUListElement, { key: 'ArrowLeft' });
    fireEvent.keyDown(list as HTMLUListElement, { key: 'ArrowRight' });
    fireEvent.keyDown(list as HTMLUListElement, { key: 'Home' });
    fireEvent.keyDown(list as HTMLUListElement, { key: 'End' });
    fireEvent.keyDown(list as HTMLUListElement, { key: 'PageDown' });
    expect(screen.getByRole('button', { name: 'Empty' })).toHaveFocus();
  });

  it('handles stale or externally changed list DOM without invoking a missing view', () => {
    const mutableViews = [ALPHA_VIEW];
    const props = savedViewsProps({ views: mutableViews });
    const view = render(<SavedViewsControls {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saved views' }));
    const list = document.querySelector('.filter-saved-views-list');
    expect(list).toBeInstanceOf(HTMLUListElement);
    const row = list?.querySelector('li');
    expect(row).toBeInstanceOf(HTMLLIElement);
    mutableViews.splice(0);
    fireEvent.keyDown(row as HTMLLIElement, { key: 'Delete' });
    expect(props.onRemoveView).not.toHaveBeenCalled();

    const textTarget = document.createTextNode('keyboard target');
    list?.appendChild(textTarget);
    textTarget.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );

    list?.querySelectorAll('li').forEach((item) => item.remove());
    fireEvent.keyDown(list as HTMLUListElement, { key: 'ArrowDown' });
    view.unmount();
  });
});
