import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryTokens, setup as renderFilter } from './filter-test-setup.tsx';
import type { FilterList } from '@/types/filter.ts';

const TWO_FILTERS: FilterList = [
  {
    fieldKey: 'name',
    type: 'string',
    operator: 'startsWith',
    value: 'M',
  },
  {
    fieldKey: 'dealValue',
    type: 'number',
    operator: 'greaterThan',
    value: 100,
  },
];

/**
 * The shared fixture, seeded with committed tokens. The full focus-traversal
 * matrices (chip → joiner → chip roving, Tab order, segment drilling, the
 * two-step Delete) live in `end-to-end/keyboard.spec.ts`, where a real browser
 * owns focus semantics — this suite covers the component-level keyboard
 * contracts jsdom can pin: payloads, editor opening, and focus restoration.
 */
function setup(seed: FilterList = TWO_FILTERS) {
  return renderFilter({
    initialFilters: { combinator: 'and', conditions: seed },
  });
}

describe('token focus and traversal', () => {
  it('walks every control in a token and flows out to the following joiner', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('{Backspace}{ArrowLeft}{ArrowLeft}'); // focus first token
    const first = screen.getByRole('group', { name: 'Name starts with M' });
    expect(first).toHaveFocus();
    await user.keyboard('{Enter}'); // into field segment
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}'); // operator, value, remove
    expect(
      within(first).getByRole('button', {
        name: 'Remove Name starts with M filter',
      }),
    ).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // past the last control → the joiner
    expect(
      screen.getByRole('button', {
        name: 'Joined by and. Switch to or — grouping adjusts automatically.',
      }),
    ).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // and on to the next token root
    expect(screen.getByRole('group', { name: 'Deal value greater than 100' })).toHaveFocus();
  });

  it('ArrowDown on a segment opens that segment’s editor', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('{Backspace}{Enter}'); // last token → field segment
    await user.keyboard('{ArrowRight}'); // operator segment
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('dialog', { name: 'Deal value' })).toBeInTheDocument();
  });
});

describe('joiner stops', () => {
  const THREE_FILTERS: FilterList = [
    ...TWO_FILTERS,
    {
      fieldKey: 'stage',
      type: 'enum',
      operator: 'in',
      value: ['Lead'],
    },
  ];

  it('Enter flips the focused joiner and keeps focus on it', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('{ArrowLeft}{ArrowLeft}'); // last chip → joiner
    const joiner = screen.getByRole('button', {
      name: 'Joined by and. Switch to or — grouping adjusts automatically.',
    });
    expect(joiner).toHaveFocus();
    await user.keyboard('{Enter}');
    const flipped = screen.getByRole('button', {
      name: 'Joined by or. Switch to and — grouping adjusts automatically.',
    });
    expect(flipped).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'or',
        conditions: [
          expect.objectContaining({ fieldKey: 'name' }),
          expect.objectContaining({ fieldKey: 'dealValue' }),
        ],
      },
      expect.any(AbortController),
    );
  });

  it('flipping one gap leaves every other joiner label unchanged', async () => {
    const { user, addFilterInput } = setup(THREE_FILTERS);
    await user.click(addFilterInput);
    await user.keyboard('{ArrowLeft}{ArrowLeft}{Enter}'); // flip the last gap
    // The flipped gap reads or; the untouched first gap still reads and.
    expect(
      screen.getByRole('button', {
        name: 'Joined by or. Switch to and — grouping adjusts automatically.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Joined by and. Switch to or — grouping adjusts automatically.',
      }),
    ).toBeInTheDocument();
  });
});

describe('destructive-control safety', () => {
  it('ArrowDown on the remove button does not delete the token', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('{Backspace}{Enter}'); // token root → field segment
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}'); // → remove
    await user.keyboard('{ArrowDown}');
    expect(queryTokens()).toHaveLength(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('focus restoration', () => {
  it('Escape returns focus to the exact pill that opened the value editor', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}'); // field: Stage
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // is any of
    await user.keyboard(' {ArrowDown} {Enter}'); // Lead + Contacted, commit
    const secondPill = screen.getByRole('button', { name: 'Contacted' });
    await user.click(secondPill);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(secondPill).toHaveFocus();
  });

  it('Shift+Tab in the field search keeps its native meaning', async () => {
    const { user } = setup();
    const token = screen.getByRole('group', { name: 'Name starts with M' });
    await user.click(within(token).getByTitle('Change field'));
    await user.keyboard('deal');
    await user.tab({ shift: true });
    expect(screen.queryByRole('dialog', { name: 'Deal value' })).not.toBeInTheDocument();
  });

  it('removing a token focuses a sensible neighbor, or the addFilterInput when none remain', async () => {
    const { user, addFilterInput } = setup();
    const first = screen.getByRole('group', { name: 'Name starts with M' });
    await user.click(
      within(first).getByRole('button', {
        name: 'Remove Name starts with M filter',
      }),
    );
    const remaining = screen.getByRole('group', {
      name: 'Deal value greater than 100',
    });
    expect(remaining).toHaveFocus();
    await user.click(
      within(remaining).getByRole('button', {
        name: 'Remove Deal value greater than 100 filter',
      }),
    );
    expect(addFilterInput).toHaveFocus();
  });

  it('Escape in the value editor returns focus to the value segment', async () => {
    const { user } = setup();
    const token = screen.getByRole('group', { name: 'Name starts with M' });
    const valueSegment = within(token).getByTitle('Change value');
    await user.click(valueSegment);
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(valueSegment).toHaveFocus();
  });

  it('swaps popovers when another segment is clicked', async () => {
    const showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover');

    try {
      const { user } = setup();
      const token = screen.getByRole('group', {
        name: 'Deal value greater than 100',
      });
      const operator = within(token).getByTitle('Change operator');
      const value = within(token).getByTitle('Change value');

      await user.click(operator);
      expect(screen.getByRole('dialog', { name: 'Deal value' })).toBeInTheDocument();
      expect(showPopover).toHaveBeenLastCalledWith({ source: operator });

      fireEvent.click(value);
      expect(screen.getByRole('dialog', { name: 'Deal value greater than' })).toBeInTheDocument();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(showPopover).toHaveBeenLastCalledWith({ source: value });
    } finally {
      showPopover.mockRestore();
    }
  });
});
