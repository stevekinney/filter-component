import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addStringFilter, setup } from './filter-test-setup.tsx';
import { SAVED_VIEWS_STORAGE_KEY } from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import type { FilterGroup } from '@/types/filter.ts';

function storedViews(): SavedView[] {
  const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
  return raw === null ? [] : (JSON.parse(raw) as SavedView[]);
}

function seedViews(views: SavedView[]): void {
  window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
}

/** The single bookmarks trigger; null while neither savable nor holding views. */
const savedViewsButton = () =>
  screen.queryByRole('button', { name: 'Saved views' });

/** The in-menu save action; only present inside an open menu while savable. */
const saveAction = () =>
  screen.queryByRole('button', { name: 'Save current filters…' });

const menu = () => screen.getByRole('dialog', { name: 'Saved views' });

async function openMenu(user: ReturnType<typeof setup>['user']): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Saved views' }));
}

async function saveCurrentViewAs(
  user: ReturnType<typeof setup>['user'],
  name: string,
): Promise<void> {
  await openMenu(user);
  await user.click(
    screen.getByRole('button', { name: 'Save current filters…' }),
  );
  await user.keyboard(name);
  await user.keyboard('{Enter}');
}

const MARIA_VIEW: SavedView = {
  name: 'Maria deals',
  group: {
    combinator: 'and',
    conditions: [
      { fieldKey: 'name', type: 'string', operator: 'equals', value: 'Maria' },
    ],
  },
};

/** The group most recently reported through onChange. */
function lastReportedGroup(
  onChange: ReturnType<typeof setup>['onChange'],
): FilterGroup {
  const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
  return lastCall?.[0] as FilterGroup;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('trigger visibility', () => {
  it('is hidden while the row is empty and nothing is saved', () => {
    setup();
    expect(savedViewsButton()).not.toBeInTheDocument();
  });

  it('appears once a filter makes the group savable', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    expect(savedViewsButton()).toBeVisible();
  });

  it('stays even when the current group is already saved', async () => {
    seedViews([MARIA_VIEW]);
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    expect(savedViewsButton()).toBeVisible();
  });
});

describe('the in-menu save action', () => {
  it('is offered only while the group is savable', async () => {
    seedViews([MARIA_VIEW]);
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput); // matches MARIA_VIEW
    await openMenu(user);
    // The group already matches a saved view, so there is nothing to save.
    expect(saveAction()).not.toBeInTheDocument();
  });

  it('persists the current group without ids and returns focus to the trigger', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);

    await saveCurrentViewAs(user, 'Maria deals');

    expect(storedViews()).toEqual([MARIA_VIEW]);
    expect(
      screen.queryByRole('dialog', { name: 'Saved views' }),
    ).not.toBeInTheDocument();
    expect(savedViewsButton()).toHaveFocus();
  });

  it('shows a visible session-only notice when saving cannot reach storage', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    await saveCurrentViewAs(user, 'Session view');

    expect(
      screen.getByText(
        '“Session view” is saved for this session only because browser storage is unavailable.',
      ),
    ).toBeVisible();
    setItemSpy.mockRestore();
  });

  it('rejects an empty name inline without saving or closing', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);

    await openMenu(user);
    await user.click(
      screen.getByRole('button', { name: 'Save current filters…' }),
    );
    await user.keyboard('{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    expect(storedViews()).toEqual([]);
    expect(menu()).toBeInTheDocument();
  });

  it('overwrites an existing view saved under the same name', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    await saveCurrentViewAs(user, 'Mine');
    await addStringFilter(user, addFilterInput, 'Nadia');

    await saveCurrentViewAs(user, 'Mine');

    const views = storedViews();
    expect(views).toHaveLength(1);
    expect(views[0]?.group.conditions).toHaveLength(2);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);

    await openMenu(user);
    await user.click(
      screen.getByRole('button', { name: 'Save current filters…' }),
    );
    expect(screen.getByRole('textbox', { name: 'View name' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: 'Saved views' }),
    ).not.toBeInTheDocument();
    expect(savedViewsButton()).toHaveFocus();
    expect(storedViews()).toEqual([]);
  });
});

describe('saved rows', () => {
  it('marks the active view with aria-current and lists a summary subline', async () => {
    seedViews([MARIA_VIEW]);
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput); // matches MARIA_VIEW

    await openMenu(user);
    const row = within(menu()).getByRole('button', { name: 'Maria deals' });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(within(menu()).getByText('1 filter · Name')).toBeInTheDocument();
  });

  it('names the combinator and dedupes fields for a multi-condition view', async () => {
    seedViews([
      {
        name: 'Broad',
        group: {
          combinator: 'or',
          conditions: [
            {
              fieldKey: 'name',
              type: 'string',
              operator: 'contains',
              value: 'a',
            },
            {
              fieldKey: 'name',
              type: 'string',
              operator: 'contains',
              value: 'b',
            },
            {
              fieldKey: 'active',
              type: 'boolean',
              operator: 'equals',
              value: true,
            },
          ],
        },
      },
    ]);
    const { user } = setup();
    await openMenu(user);
    expect(
      within(menu()).getByText('3 filters · Any · Name, Active'),
    ).toBeInTheDocument();
  });
});

describe('loading a view', () => {
  it('replaces the row, reports an ID-free group, and undo restores', async () => {
    seedViews([MARIA_VIEW]);
    const { user, onChange, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput, 'Nadia');
    const callsBeforeLoad = onChange.mock.calls.length;

    await openMenu(user);
    await user.click(
      within(menu()).getByRole('button', { name: 'Maria deals' }),
    );

    expect(onChange.mock.calls.length).toBe(callsBeforeLoad + 1);
    const loaded = lastReportedGroup(onChange);
    expect(loaded.combinator).toBe('and');
    expect(loaded.conditions).toHaveLength(1);
    expect(loaded.conditions[0]).toMatchObject({
      fieldKey: 'name',
      operator: 'equals',
      value: 'Maria',
    });
    expect(loaded).not.toHaveProperty('conditions.0.id');

    await user.click(
      screen.getByRole('button', { name: 'Undo filter change' }),
    );
    const undone = lastReportedGroup(onChange);
    expect(undone.conditions).toHaveLength(1);
    expect(undone.conditions[0]).toMatchObject({ value: 'Nadia' });

    await user.click(
      screen.getByRole('button', { name: 'Redo filter change' }),
    );
    expect(lastReportedGroup(onChange).conditions[0]).toMatchObject({
      value: 'Maria',
    });
  });

  it('loading the already-applied view neither notifies nor creates history', async () => {
    seedViews([MARIA_VIEW]);
    const { user, onChange, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    const callsBeforeLoad = onChange.mock.calls.length;

    await openMenu(user);
    await user.click(
      within(menu()).getByRole('button', { name: 'Maria deals' }),
    );

    expect(onChange.mock.calls.length).toBe(callsBeforeLoad);
    expect(
      screen.getByRole('button', { name: 'Undo filter change' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Redo filter change' }),
    ).not.toBeInTheDocument();
  });
});

describe('removing a view', () => {
  it('removes from storage and unmounts the menu with the last view', async () => {
    seedViews([MARIA_VIEW]);
    const { user } = setup();

    await openMenu(user);
    await user.click(
      screen.getByRole('button', { name: 'Remove view: Maria deals' }),
    );

    expect(storedViews()).toEqual([]);
    expect(
      screen.queryByRole('dialog', { name: 'Saved views' }),
    ).not.toBeInTheDocument();
    // No conditions and nothing saved: the trigger is gone entirely.
    expect(savedViewsButton()).not.toBeInTheDocument();
  });

  it('keeps the trigger alive when the group is still savable', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    await saveCurrentViewAs(user, 'Maria deals'); // group now matches the view

    await openMenu(user);
    await user.click(
      screen.getByRole('button', { name: 'Remove view: Maria deals' }),
    );

    // The group is unsaved again, so the trigger survives for the save action.
    expect(storedViews()).toEqual([]);
    expect(savedViewsButton()).toBeVisible();
    expect(savedViewsButton()).toHaveFocus();
  });

  it('shows a visible session-only notice when removal cannot reach storage', async () => {
    seedViews([MARIA_VIEW]);
    const { user } = setup();
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    await openMenu(user);
    await user.click(
      screen.getByRole('button', { name: 'Remove view: Maria deals' }),
    );

    expect(
      screen.getByText(
        '“Maria deals” was removed for this session only because browser storage is unavailable.',
      ),
    ).toBeVisible();
    setItemSpy.mockRestore();
  });

  it('keeps the menu open and focuses the neighbor when views remain', async () => {
    const secondView: SavedView = {
      name: 'Empty row',
      group: { combinator: 'and', conditions: [] },
    };
    seedViews([MARIA_VIEW, secondView]);
    const { user } = setup();

    await openMenu(user);
    await user.click(
      screen.getByRole('button', { name: 'Remove view: Maria deals' }),
    );

    expect(storedViews()).toEqual([secondView]);
    expect(
      within(menu()).getByRole('button', { name: 'Empty row' }),
    ).toHaveFocus();
  });
});

describe('menu keyboard navigation', () => {
  const VIEW_NAMES = ['Alpha', 'Beta', 'Gamma'];
  const threeViews: SavedView[] = VIEW_NAMES.map((name, index) => ({
    name,
    group: {
      combinator: 'and',
      conditions: [
        {
          fieldKey: 'name',
          type: 'string',
          operator: 'equals',
          value: `value-${index}`,
        },
      ],
    },
  }));

  const viewButton = (name: string) => screen.getByRole('button', { name });

  it('arrows move between views with wraparound; Home and End jump', async () => {
    seedViews(threeViews);
    const { user } = setup();

    await openMenu(user);
    expect(viewButton('Alpha')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(viewButton('Beta')).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(viewButton('Alpha')).toHaveFocus(); // wrapped past Gamma
    await user.keyboard('{ArrowUp}');
    expect(viewButton('Gamma')).toHaveFocus(); // wrapped back
    await user.keyboard('{Home}');
    expect(viewButton('Alpha')).toHaveFocus();
    await user.keyboard('{End}');
    expect(viewButton('Gamma')).toHaveFocus();
  });

  it('ArrowRight steps onto the remove button and ArrowLeft returns', async () => {
    seedViews(threeViews);
    const { user } = setup();

    await openMenu(user);
    await user.keyboard('{ArrowRight}');
    expect(viewButton('Remove view: Alpha')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(viewButton('Beta')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(viewButton('Beta')).toHaveFocus();
  });

  it('Delete removes the focused view and focuses its neighbor', async () => {
    seedViews(threeViews);
    const { user } = setup();

    await openMenu(user);
    await user.keyboard('{ArrowDown}'); // Beta
    await user.keyboard('{Delete}');

    expect(storedViews().map((view) => view.name)).toEqual(['Alpha', 'Gamma']);
    expect(viewButton('Gamma')).toHaveFocus();

    await user.keyboard('{Backspace}'); // Gamma was last; neighbor is Alpha
    expect(storedViews().map((view) => view.name)).toEqual(['Alpha']);
    expect(viewButton('Alpha')).toHaveFocus();
  });

  it('ArrowDown on the trigger opens onto the first view; ArrowUp onto the last', async () => {
    seedViews(threeViews);
    const { user } = setup();
    const trigger = screen.getByRole('button', { name: 'Saved views' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(viewButton('Alpha')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(viewButton('Gamma')).toHaveFocus();
  });

  it('opens onto the save action when there are no views to focus', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);

    const trigger = screen.getByRole('button', { name: 'Saved views' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    expect(
      screen.getByRole('button', { name: 'Save current filters…' }),
    ).toHaveFocus();
  });
});

describe('nested structure persistence', () => {
  it('saves the derived grouping without ids and restores it exactly', async () => {
    const { user, onChange, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput, 'Maria');
    await addStringFilter(user, addFilterInput, 'Nadia');
    await addStringFilter(user, addFilterInput, 'Cora');
    // Flip the first gap: Maria or (Nadia and Cora).
    const joiners = screen.getAllByRole('button', { name: /^Joined by and/ });
    await user.click(joiners[0] as HTMLElement);

    await saveCurrentViewAs(user, 'Split view');
    const savedCondition = (value: string) => ({
      fieldKey: 'name',
      type: 'string',
      operator: 'equals',
      value,
    });
    expect(storedViews()).toEqual([
      {
        name: 'Split view',
        group: {
          combinator: 'or',
          conditions: [
            savedCondition('Maria'),
            {
              combinator: 'and',
              conditions: [savedCondition('Nadia'), savedCondition('Cora')],
            },
          ],
        },
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    await openMenu(user);
    await user.click(
      within(menu()).getByRole('button', { name: 'Split view' }),
    );
    expect(lastReportedGroup(onChange)).toEqual({
      combinator: 'or',
      conditions: [
        expect.objectContaining({ value: 'Maria' }),
        {
          combinator: 'and',
          conditions: [
            expect.objectContaining({ value: 'Nadia' }),
            expect.objectContaining({ value: 'Cora' }),
          ],
        },
      ],
    });
    // The restored expression re-derives the same brackets and joiners.
    expect(
      screen.getByRole('button', {
        name: 'Joined by or. Switch to and — grouping adjusts automatically.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: 'Name is Nadia (in a group matching all)',
      }),
    ).toBeInTheDocument();
  });
});

describe('storage resilience', () => {
  it('treats corrupted storage as having no views', () => {
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, '{corrupted');
    setup();
    expect(savedViewsButton()).not.toBeInTheDocument();
  });

  it('reads views saved by a previous mount', async () => {
    const { user, addFilterInput, view } = setup();
    await addStringFilter(user, addFilterInput);
    await saveCurrentViewAs(user, 'Maria deals');
    view.unmount();

    setup();
    expect(savedViewsButton()).toBeVisible();
  });
});
