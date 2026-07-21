import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { FilterFieldDefinition } from '@filter/types.ts';

import { Filter } from '../filter.tsx';
import { addStringFilter, FIELDS, setup } from './filter-test-setup.tsx';

describe('controller integration regressions', () => {
  it('keeps initial filters silent and non-undoable in Strict Mode without duplicating commits', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Filter
          fields={FIELDS}
          onChange={onChange}
          initialFilters={{
            combinator: 'and',
            conditions: [
              {
                fieldKey: 'name',
                type: 'string',
                operator: 'equals',
                value: 'Maria',
              },
            ],
          }}
        />
      </StrictMode>,
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Undo filter change' })).toBeNull();

    await addStringFilter(user, screen.getByRole('combobox', { name: 'Add filter' }), 'Nadia');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].conditions).toHaveLength(2);
  });

  it('falls back to the add input when a resumed draft anchor unmounts', async () => {
    const fields: FilterFieldDefinition[] = [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'flexible', label: 'Flexible', type: 'string' },
    ];
    const onChange = vi.fn();
    const { addFilterInput, user, view } = setup({ fields, onChange });
    await user.type(addFilterInput, 'flex');
    await user.click(screen.getByRole('option', { name: /Flexible/ }));
    await user.click(screen.getByRole('option', { name: 'is' }));
    await user.type(screen.getByRole('textbox', { name: 'Value' }), 'draft');
    await user.click(document.body);
    const incomplete = screen.getByRole('group', {
      name: 'Incomplete filter: Flexible',
    });

    const changedFields: FilterFieldDefinition[] = [
      fields[0]!,
      { key: 'flexible', label: 'Flexible', type: 'number' },
    ];
    view.rerender(<Filter fields={changedFields} onChange={onChange} />);
    await user.click(within(incomplete).getByTitle('Finish this filter'));

    expect(screen.getByRole('dialog', { name: 'Choose field' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Fields' })).toBeVisible();
    expect(screen.getByRole('option', { name: /Flexible/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('detects a type change and returns to field selection', async () => {
    const fields: FilterFieldDefinition[] = [
      { key: 'flexible', label: 'Flexible', type: 'string' },
    ];
    const onChange = vi.fn();
    const { user, view, addFilterInput } = setup({ fields, onChange });

    await user.type(addFilterInput, 'flex');
    await user.click(screen.getByRole('option', { name: /Flexible/ }));
    expect(screen.getByRole('dialog', { name: 'Flexible' })).toBeInTheDocument();

    const changedFields: FilterFieldDefinition[] = [
      { key: 'flexible', label: 'Flexible', type: 'number' },
    ];
    view.rerender(<Filter fields={changedFields} onChange={onChange} />);

    expect(await screen.findByRole('dialog', { name: 'Choose field' })).toBeInTheDocument();
    expect(addFilterInput).toHaveFocus();
    expect(screen.getByRole('option', { name: /Flexible/ })).toHaveTextContent('number');
  });

  it('detects an operator removal and backs up to operator selection', async () => {
    const options = ['Lead', 'Won'];
    const fields: FilterFieldDefinition[] = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum',
        options,
        operators: ['equals', 'in'],
      },
    ];
    const onChange = vi.fn();
    const { user, view, addFilterInput } = setup({ fields, onChange });

    await user.type(addFilterInput, 'stage');
    await user.click(screen.getByRole('option', { name: /Stage/ }));
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    expect(screen.getByRole('dialog', { name: 'Stage is any of' })).toBeInTheDocument();

    const changedFields: FilterFieldDefinition[] = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum',
        options,
        operators: ['equals'],
      },
    ];
    view.rerender(<Filter fields={changedFields} onChange={onChange} />);

    const operatorList = await screen.findByRole('listbox', { name: 'Stage' });
    expect(
      within(operatorList)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['is']);
    expect(within(operatorList).getByRole('option', { name: 'is' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('reconciles replaced enum options while the value editor is open', async () => {
    const options = ['Lead', 'Won'];
    const fields: FilterFieldDefinition[] = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum',
        options,
        operators: ['in'],
      },
    ];
    const onChange = vi.fn();
    const { user, view, addFilterInput } = setup({ fields, onChange });

    await user.type(addFilterInput, 'stage');
    await user.click(screen.getByRole('option', { name: /Stage/ }));
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    await user.click(screen.getByRole('option', { name: 'Won' }));
    expect(screen.getByRole('option', { name: 'Won' })).toHaveAttribute('aria-selected', 'true');

    const changedFields: FilterFieldDefinition[] = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum',
        options: ['Lead'],
        operators: ['in'],
      },
    ];
    view.rerender(<Filter fields={changedFields} onChange={onChange} />);

    expect(screen.queryByRole('option', { name: 'Won' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one option');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves a new draft when disabled while its popover is open', async () => {
    const onChange = vi.fn();
    const { user, view, addFilterInput } = setup({ onChange });
    await user.type(addFilterInput, 'name');
    await user.click(screen.getByRole('option', { name: /Name/ }));
    expect(screen.getByRole('dialog', { name: 'Name' })).toBeInTheDocument();

    view.rerender(
      <Filter fields={[{ key: 'name', type: 'string' }]} onChange={onChange} disabled />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('group', { name: 'Incomplete filter: name' }),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cancels an existing token edit when disabled without changing the token', async () => {
    const fields: FilterFieldDefinition[] = [{ key: 'name', label: 'Name', type: 'string' }];
    const onChange = vi.fn();
    const { user, view } = setup({
      fields,
      onChange,
      initialFilters: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Maria',
          },
        ],
      },
    });
    const token = screen.getByRole('group', { name: 'Name is Maria' });
    await user.click(within(token).getByTitle('Change operator'));
    expect(screen.getByRole('dialog', { name: 'Name' })).toBeInTheDocument();

    view.rerender(<Filter fields={fields} onChange={onChange} disabled />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Incomplete filter/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Name is Maria' })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('repairs a non-first same-key token after its field type changes', async () => {
    const fields: FilterFieldDefinition[] = [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'flexible', label: 'Flexible', type: 'number' },
    ];
    const onChange = vi.fn();
    const { user } = setup({
      fields,
      onChange,
      initialFilters: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'flexible',
            type: 'string',
            operator: 'equals',
            value: 'old value',
          },
        ],
      },
    });
    const token = screen.getByRole('group', {
      name: /Flexible is old value \(invalid: Flexible is now a number field\)/,
    });
    await user.click(within(token).getByTitle('Change value'));
    expect(screen.getByRole('dialog', { name: 'Choose field' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Value' })).toBeNull();
    expect(screen.getByRole('option', { name: /Flexible/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.keyboard('{Enter}{Enter}42{Enter}');

    expect(screen.getByRole('group', { name: 'Flexible is 42' })).toBeVisible();
    expect(onChange).toHaveBeenCalledWith(
      {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'flexible',
            type: 'number',
            operator: 'equals',
            value: 42,
          },
        ],
      },
      expect.any(AbortController),
    );
  });

  it.each([
    {
      operator: 'equals' as const,
      value: false,
      tokenName: 'Active is false',
      optionName: 'is false',
      segmentTitle: 'Change value',
    },
    {
      operator: 'isEmpty' as const,
      tokenName: 'Active is empty',
      optionName: 'is empty',
      segmentTitle: 'Change operator',
    },
  ])(
    'keeps $optionName selected when reopening a boolean token',
    async ({ operator, value, tokenName, optionName, segmentTitle }) => {
      const onChange = vi.fn();
      const { user } = setup({
        fields: [{ key: 'active', label: 'Active', type: 'boolean' }],
        onChange,
        initialFilters: {
          combinator: 'and',
          conditions: [
            operator === 'equals'
              ? {
                  fieldKey: 'active',
                  type: 'boolean',
                  operator,
                  value,
                }
              : {
                  fieldKey: 'active',
                  type: 'boolean',
                  operator,
                },
          ],
        },
      });
      const token = screen.getByRole('group', { name: tokenName });

      await user.click(within(token).getByTitle(segmentTitle));

      const selected = screen.getByRole('option', { name: optionName });
      expect(selected).toHaveAttribute('aria-selected', 'true');
      expect(selected).toHaveAttribute('data-active');

      await user.keyboard('{Enter}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('group', { name: tokenName })).toBeVisible();
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('opens a token with a removed operator at current operator selection', async () => {
    const fields: FilterFieldDefinition[] = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum',
        options: ['Lead', 'Won'],
        operators: ['in'],
      },
    ];
    const { user } = setup({
      fields,
      initialFilters: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'stage',
            type: 'enum',
            operator: 'equals',
            value: 'Lead',
          },
        ],
      },
    });
    const token = screen.getByRole('group', {
      name: /Stage is Lead \(invalid: This operator is no longer supported for Stage\)/,
    });
    await user.click(within(token).getByTitle('Change value'));
    const operators = screen.getByRole('listbox', { name: 'Stage' });
    expect(within(operators).getAllByRole('option')).toHaveLength(1);
    expect(within(operators).getByRole('option', { name: 'is any of' })).toBeVisible();
  });

  it('prunes removed enum selections before opening and commits the repair', async () => {
    const fields: FilterFieldDefinition[] = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum',
        options: ['Lead', 'Won'],
        operators: ['in'],
      },
    ];
    const onChange = vi.fn();
    const { user } = setup({
      fields,
      onChange,
      initialFilters: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'stage',
            type: 'enum',
            operator: 'in',
            value: ['Lead', 'Removed'],
          },
        ],
      },
    });
    const token = screen.getByRole('group', {
      name: /Stage is any of Lead, Removed \(invalid: Removed is no longer a valid option\)/,
    });
    await user.click(within(token).getAllByTitle('Change values')[0]!);
    expect(screen.getByRole('option', { name: 'Lead' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Won' })).toHaveAttribute('aria-selected', 'false');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith(
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({
            fieldKey: 'stage',
            operator: 'in',
            value: ['Lead'],
          }),
        ],
      },
      expect.any(AbortController),
    );
  });
});
