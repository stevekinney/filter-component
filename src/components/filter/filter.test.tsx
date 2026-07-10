import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  addStringFilter,
  FIELDS,
  queryTokens,
  setup,
} from './filter-test-setup.tsx';

describe('add-filter combobox', () => {
  it('shows the empty-state placeholder and does not open the dropdown on focus alone', async () => {
    const { user, addFilterInput } = setup();
    expect(addFilterInput).toHaveAttribute('placeholder', 'Filter by field…');
    await user.click(addFilterInput);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('na');
    expect(screen.getByRole('listbox', { name: 'Fields' })).toBeInTheDocument();
    expect(addFilterInput).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the dropdown with every field on ArrowDown without typing', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('{ArrowDown}');
    const options = within(
      screen.getByRole('listbox', { name: 'Fields' }),
    ).getAllByRole('option');
    expect(options).toHaveLength(FIELDS.length);
  });

  it('ranks prefix matches above contains matches', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('st');
    const options = within(
      screen.getByRole('listbox', { name: 'Fields' }),
    ).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Stageenum',
      'Last emaileddate',
    ]);
  });

  it('shows an empty state for an unmatched query', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('zzz');
    expect(screen.getByText('No matching fields')).toBeInTheDocument();
  });

  it('keeps active-descendant ids valid when a field key contains spaces and punctuation', async () => {
    const { user, addFilterInput } = setup({
      fields: [
        {
          key: 'deal stage/v2',
          label: 'Deal stage',
          type: 'string',
        },
      ],
    });

    await user.type(addFilterInput, 'deal');
    const addOptionId = addFilterInput.getAttribute('aria-activedescendant');
    expect(addOptionId).not.toMatch(/\s/);
    expect(document.getElementById(addOptionId ?? '')).toHaveTextContent(
      'Deal stage',
    );

    await user.keyboard('{Enter}{Enter}Open{Enter}');
    const token = screen.getByRole('group', { name: 'Deal stage is Open' });
    await user.click(within(token).getByTitle('Change field'));
    const searchInput = screen.getByRole('combobox', { name: 'Search fields' });
    const editOptionId = searchInput.getAttribute('aria-activedescendant');
    expect(editOptionId).not.toMatch(/\s/);
    expect(document.getElementById(editOptionId ?? '')).toHaveTextContent(
      'Deal stage',
    );
  });

  it('dismisses the dropdown on blur', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na');
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(addFilterInput).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape first clears a non-empty query, then closes the menu', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na');
    await user.keyboard('{Escape}');
    expect(addFilterInput).toHaveValue('');
    expect(screen.getByRole('listbox', { name: 'Fields' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Tab accepts the highlighted suggestion when a query was typed', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na');
    await user.tab();
    // Field accepted → operator stage opened for Name.
    expect(screen.getByRole('dialog', { name: 'Name' })).toBeInTheDocument();
  });

  it('builds a draft preview inline as stages complete', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}');
    expect(
      screen.getByText('Name', { selector: '.filter-draft-preview-field' }),
    ).toBeInTheDocument();
    await user.keyboard('{Enter}'); // equals
    expect(
      screen.getByText('is', { selector: '.filter-draft-preview-operator' }),
    ).toBeInTheDocument();
  });
});

describe('adding filters', () => {
  it('commits a string filter and reports it through onChange', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    expect(
      screen.getByRole('group', { name: 'Name is Maria' }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Maria',
          }),
        ],
      },
      expect.any(AbortController),
    );
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty('conditions.0.id');
    expect(addFilterInput).toHaveFocus();
  });

  it('commits valueless operators immediately on selection', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}');
    await user.click(screen.getByRole('option', { name: 'is empty' }));
    expect(
      screen.getByRole('group', { name: 'Name is empty' }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [expect.objectContaining({ operator: 'isEmpty' })],
      },
      expect.any(AbortController),
    );
    expect(onChange.mock.lastCall?.[0].conditions[0]).not.toHaveProperty(
      'value',
    );
  });

  it('collapses boolean fields into a single list that commits in one pick', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('act{Enter}');
    const list = screen.getByRole('listbox', { name: 'Active' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['is true', 'is false', 'is empty', 'is not empty']);
    await user.keyboard('{ArrowDown}{Enter}'); // is false
    expect(
      screen.getByRole('group', { name: 'Active is false' }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({
            fieldKey: 'active',
            operator: 'equals',
            value: false,
          }),
        ],
      },
      expect.any(AbortController),
    );
  });

  it('shows only the choices allowed by narrowed boolean operators', async () => {
    const { user, addFilterInput } = setup({
      fields: [
        {
          key: 'active',
          label: 'Active',
          type: 'boolean',
          operators: ['equals', 'isNotEmpty'],
        },
      ],
    });
    await user.click(addFilterInput);
    await user.keyboard('act{Enter}');
    const list = screen.getByRole('listbox', { name: 'Active' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['is true', 'is false', 'is not empty']);
    expect(
      within(list).queryByRole('option', { name: 'is empty' }),
    ).not.toBeInTheDocument();
  });

  it('multi-select enums toggle with Space and commit with Enter', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}'); // Stage
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    const list = screen.getByRole('listbox', { name: 'Stage is any of' });
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
    await user.keyboard(' {ArrowDown} {Enter}'); // toggle Lead, toggle Contacted, commit
    expect(
      screen.getByRole('group', { name: 'Stage is any of Lead, Contacted' }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({
            operator: 'in',
            value: ['Lead', 'Contacted'],
          }),
        ],
      },
      expect.any(AbortController),
    );
  });

  it('commits a withinLast duration', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('last{Enter}');
    await user.click(screen.getByRole('option', { name: 'within last' }));
    await user.keyboard('7{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({
            operator: 'withinLast',
            value: { amount: 7, unit: 'days' },
          }),
        ],
      },
      expect.any(AbortController),
    );
  });

  it('commits zero as a number and never shows it as an empty-state hint', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('deal{Enter}'); // Deal value
    await user.keyboard('{Enter}'); // equals
    // The empty field must not display "0" as a placeholder — 0 is a value
    // a user can commit, so it would look like content that then gets
    // rejected.
    const input = screen.getByRole('spinbutton', { name: 'Value' });
    expect(input).not.toHaveAttribute('placeholder', '0');
    await user.keyboard('0{Enter}');
    expect(
      screen.getByRole('group', { name: 'Deal value is 0' }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [expect.objectContaining({ value: 0 })],
      },
      expect.any(AbortController),
    );
  });

  it('never commits invalid input and explains why inline', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('deal{Enter}'); // Deal value
    await user.keyboard('{Enter}'); // equals
    await user.keyboard('abc{Enter}');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a number');
    expect(screen.getByRole('spinbutton', { name: 'Value' })).toHaveAttribute(
      'aria-describedby',
      alert.id,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(queryTokens()).toHaveLength(0);
  });

  it('rejects inverted ranges', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('deal{Enter}');
    await user.click(screen.getByRole('option', { name: 'between' }));
    await user.type(screen.getByRole('spinbutton', { name: 'From' }), '9');
    await user.type(screen.getByRole('spinbutton', { name: 'To' }), '2');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'First value must not exceed the second',
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('editing tokens', () => {
  it('reopens only the clicked stage and keeps the token in place', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    await user.click(addFilterInput);
    await user.keyboard('deal{Enter}{Enter}42{Enter}');
    const first = screen.getByRole('group', { name: 'Name is Maria' });
    await user.click(within(first).getByTitle('Change value'));
    expect(screen.getByRole('dialog', { name: 'Name is' })).toBeInTheDocument();
    await user.keyboard(
      '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}Nadia{Enter}',
    );
    const groups = queryTokens();
    expect(groups[0]).toHaveAccessibleName('Name is Nadia');
    expect(groups[1]).toHaveAccessibleName('Deal value is 42');
  });

  it('keeps a still-valid value on operator change and commits immediately', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    onChange.mockClear();
    const token = screen.getByRole('group', { name: 'Name is Maria' });
    await user.click(within(token).getByTitle('Change operator'));
    await user.keyboard('{ArrowDown}{Enter}'); // notEquals
    expect(
      screen.getByRole('group', { name: 'Name is not Maria' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({ operator: 'notEquals', value: 'Maria' }),
        ],
      },
      expect.any(AbortController),
    );
  });

  it('carries a single enum value into the multi editor pre-checked', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}{Enter}'); // Stage is
    await user.click(screen.getByRole('option', { name: 'Lead' }));
    const token = screen.getByRole('group', { name: 'Stage is Lead' });
    await user.click(within(token).getByTitle('Change operator'));
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    const multi = screen.getByRole('listbox', { name: 'Stage is any of' });
    expect(within(multi).getByRole('option', { name: 'Lead' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('group', { name: 'Stage is any of Lead' }),
    ).toBeInTheDocument();
  });

  it('re-runs operator selection when the field changes', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    const token = screen.getByRole('group', { name: 'Name is Maria' });
    await user.click(within(token).getByTitle('Change field'));
    const search = screen.getByRole('combobox', { name: 'Search fields' });
    expect(search).toHaveFocus();
    await user.keyboard('deal{Enter}');
    expect(
      screen.getByRole('dialog', { name: 'Deal value' }),
    ).toBeInTheDocument();
    await user.keyboard('{Enter}'); // equals
    await user.keyboard('42{Enter}');
    expect(
      screen.getByRole('group', { name: 'Deal value is 42' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Name is Maria' }),
    ).not.toBeInTheDocument();
  });
});

describe('enum pills', () => {
  it('renders one pill per value with individual removal', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}');
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    await user.keyboard(' {ArrowDown} {Enter}'); // Lead + Contacted
    const token = screen.getByRole('group', {
      name: 'Stage is any of Lead, Contacted',
    });
    await user.click(
      within(token).getByRole('button', {
        name: 'Remove Lead from Stage filter',
      }),
    );
    expect(
      screen.getByRole('group', { name: 'Stage is any of Contacted' }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [expect.objectContaining({ value: ['Contacted'] })],
      },
      expect.any(AbortController),
    );
  });

  it('removes the whole filter when the last value is removed', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}');
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    await user.keyboard(' {Enter}'); // just Lead
    const token = screen.getByRole('group', { name: 'Stage is any of Lead' });
    await user.click(
      within(token).getByRole('button', {
        name: 'Remove Lead from Stage filter',
      }),
    );
    expect(queryTokens()).toHaveLength(0);
    expect(onChange).toHaveBeenLastCalledWith(
      { combinator: 'and', conditions: [] },
      expect.any(AbortController),
    );
  });
});
