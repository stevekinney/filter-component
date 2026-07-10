import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addStringFilter, queryTokens, setup } from './filter-test-setup.tsx';
import type { FilterList } from '@/types/filter.ts';

describe('rail cluster dividers', () => {
  const dividerCount = (view: ReturnType<typeof setup>['view']) =>
    view.container.querySelectorAll('.filter-rail-divider').length;

  const seed = (conditions: FilterList) =>
    setup({
      initialFilters: { combinator: 'and', conditions },
    });

  it('shows no rail (and no dividers) while the row is empty', () => {
    const { view } = setup();
    expect(view.container.querySelector('.filter-rail')).toBeNull();
    expect(dividerCount(view)).toBe(0);
  });

  it('fences a divider count of one less than the visible clusters', async () => {
    // Seeded filters, no history: Views + Clear → 2 clusters, 1 divider.
    const two = seed([
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'a',
      },
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value: 'b',
      },
    ]);
    expect(dividerCount(two.view)).toBe(1);

    // Adding a filter by hand introduces history: Views + History + Clear →
    // 3 clusters, 2 dividers.
    await addStringFilter(two.user, two.addFilterInput, 'Cora');
    expect(dividerCount(two.view)).toBe(2);
  });
});

describe('undo and redo', () => {
  it('renders undo/redo icons only when available and emits restored filter lists', async () => {
    const { onChange, user, addFilterInput } = setup();
    expect(
      screen.queryByRole('button', { name: 'Undo filter change' }),
    ).not.toBeInTheDocument();
    await addStringFilter(user, addFilterInput);
    const undoButton = screen.getByRole('button', {
      name: 'Undo filter change',
    });
    expect(
      screen.queryByRole('button', { name: 'Redo filter change' }),
    ).not.toBeInTheDocument();

    await user.click(undoButton);
    expect(onChange).toHaveBeenLastCalledWith(
      { combinator: 'and', conditions: [] },
      expect.any(AbortController),
    );
    expect(queryTokens()).toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: 'Undo filter change' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Redo filter change' }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [expect.objectContaining({ value: 'Maria' })],
      },
      expect.any(AbortController),
    );
    expect(
      screen.getByRole('group', { name: 'Name is Maria' }),
    ).toBeInTheDocument();
  });

  it('clears the redo branch after a new committed change', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    await user.click(
      screen.getByRole('button', { name: 'Undo filter change' }),
    );
    await addStringFilter(user, addFilterInput, 'Nadia');
    expect(
      screen.queryByRole('button', { name: 'Redo filter change' }),
    ).not.toBeInTheDocument();
  });
});

describe('clear all', () => {
  it('clears every filter and reports an empty filter list', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    await user.click(addFilterInput);
    await user.keyboard('act{Enter}{Enter}'); // Active is true
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(queryTokens()).toHaveLength(0);
    expect(onChange).toHaveBeenLastCalledWith(
      { combinator: 'and', conditions: [] },
      expect.any(AbortController),
    );
    expect(
      screen.queryByRole('button', { name: 'Clear all filters' }),
    ).not.toBeInTheDocument();
  });
});

describe('smart joiners', () => {
  const joinerButton = (joiner: 'and' | 'or') =>
    screen.getByRole('button', {
      name: `Joined by ${joiner}. Switch to ${joiner === 'and' ? 'or' : 'and'} — grouping adjusts automatically.`,
    });

  it('flips a joiner, reports the derived group, announces it, and is undoable', async () => {
    const { onChange, user, addFilterInput, view } = setup();
    await addStringFilter(user, addFilterInput);
    expect(screen.queryByRole('button', { name: /^Joined by/ })).toBeNull();

    await addStringFilter(user, addFilterInput, 'Nadia');
    await user.click(joinerButton('and'));
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'or',
        conditions: [expect.anything(), expect.anything()],
      },
      expect.any(AbortController),
    );
    expect(joinerButton('or')).toBeInTheDocument();
    expect(
      view.container.querySelector('[aria-live="polite"]'),
    ).toHaveTextContent('Filters combined with or; grouping updated');

    await user.click(
      screen.getByRole('button', { name: 'Undo filter change' }),
    );
    expect(onChange.mock.lastCall?.[0].combinator).toBe('and');
    expect(joinerButton('and')).toBeInTheDocument();
  });

  it('derives or-of-and-runs: [A and B or C] emits or(and(A, B), C)', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput, 'Maria');
    await addStringFilter(user, addFilterInput, 'Nadia');
    await addStringFilter(user, addFilterInput, 'Cora');
    // Flip the second gap: the first two chips stay an and-run.
    const joiners = screen.getAllByRole('button', { name: /^Joined by and/ });
    await user.click(joiners[1] as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'or',
        conditions: [
          {
            combinator: 'and',
            conditions: [
              expect.objectContaining({ value: 'Maria' }),
              expect.objectContaining({ value: 'Nadia' }),
            ],
          },
          expect.objectContaining({ value: 'Cora' }),
        ],
      },
      expect.any(AbortController),
    );
  });

  it('brackets ≥2-member and-runs only while an or joiner exists, chips gaining run context', async () => {
    const { user, addFilterInput, view } = setup();
    await addStringFilter(user, addFilterInput, 'Maria');
    await addStringFilter(user, addFilterInput, 'Nadia');
    await addStringFilter(user, addFilterInput, 'Cora');
    const brackets = () => view.container.querySelectorAll('.filter-bracket');
    expect(brackets()).toHaveLength(0);

    const joiners = screen.getAllByRole('button', { name: /^Joined by and/ });
    await user.click(joiners[1] as HTMLElement);
    expect(brackets()).toHaveLength(2);
    expect(
      screen.getByRole('group', {
        name: 'Name is Maria (in a group matching all)',
      }),
    ).toBeInTheDocument();
    // The bare condition after the or carries no run context.
    expect(
      screen.getByRole('group', { name: 'Name is Cora' }),
    ).toBeInTheDocument();

    await user.click(joinerButton('or'));
    expect(brackets()).toHaveLength(0);
    expect(
      screen.getByRole('group', { name: 'Name is Maria' }),
    ).toBeInTheDocument();
  });

  it('appends new filters into the trailing and-run', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput, 'Maria');
    await addStringFilter(user, addFilterInput, 'Nadia');
    await user.click(joinerButton('and')); // A or B
    await addStringFilter(user, addFilterInput, 'Cora'); // → A or (B and C)
    expect(onChange).toHaveBeenLastCalledWith(
      {
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
      },
      expect.any(AbortController),
    );
  });

  it('clear-all resets the root to and', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput, 'Maria');
    await addStringFilter(user, addFilterInput, 'Nadia');
    await user.click(joinerButton('and'));
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onChange).toHaveBeenLastCalledWith(
      { combinator: 'and', conditions: [] },
      expect.any(AbortController),
    );
  });

  it('deleting a chip collapses its leading joiner and announces the grouping change', async () => {
    const { onChange, user, addFilterInput, view } = setup();
    await addStringFilter(user, addFilterInput, 'Maria');
    await addStringFilter(user, addFilterInput, 'Nadia');
    await addStringFilter(user, addFilterInput, 'Cora');
    const joiners = screen.getAllByRole('button', { name: /^Joined by and/ });
    await user.click(joiners[0] as HTMLElement); // A or B and C
    // Deleting B removes its leading or: A and C remain one flat run.
    await user.click(
      within(screen.getByRole('group', { name: /Nadia/ })).getByRole('button', {
        name: 'Remove Name is Nadia filter',
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({ value: 'Maria' }),
          expect.objectContaining({ value: 'Cora' }),
        ],
      },
      expect.any(AbortController),
    );
    expect(
      view.container.querySelector('[aria-live="polite"]'),
    ).toHaveTextContent('Filter removed: Name; grouping updated');
  });

  it('loads a nested initialFilters tree into joiners and brackets', async () => {
    const { view } = setup({
      initialFilters: {
        combinator: 'or',
        conditions: [
          {
            combinator: 'and',
            conditions: [
              {
                fieldKey: 'name',
                type: 'string',
                operator: 'equals',
                value: 'a',
              },
              {
                fieldKey: 'name',
                type: 'string',
                operator: 'equals',
                value: 'b',
              },
            ],
          },
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'c',
          },
        ],
      },
    });
    expect(
      await screen.findByRole('group', {
        name: 'Name is a (in a group matching all)',
      }),
    ).toBeInTheDocument();
    expect(joinerButton('or')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.filter-bracket')).toHaveLength(2);
  });

  it('loads v1 flat or-groups as a uniform or-joiner row', async () => {
    const { view } = setup({
      initialFilters: {
        combinator: 'or',
        conditions: [
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'a',
          },
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'b',
          },
        ],
      },
    });
    expect(
      await screen.findByRole('group', { name: 'Name is a' }),
    ).toBeVisible();
    expect(joinerButton('or')).toBeInTheDocument();
    // Two single-condition runs: no brackets to draw.
    expect(view.container.querySelectorAll('.filter-bracket')).toHaveLength(0);
  });
});
