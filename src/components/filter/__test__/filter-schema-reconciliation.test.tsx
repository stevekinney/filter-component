import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FilterFieldDefinition } from '@/types/filter.ts';

import { Filter } from '../filter.tsx';
import { addStringFilter, FIELDS, queryTokens, setup } from './filter-test-setup.tsx';

describe('field-definition changes and invalid tokens', () => {
  it('closes the editor when the field being edited disappears', async () => {
    const { onChange, user, addFilterInput, view } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}');
    expect(screen.getByRole('dialog', { name: 'Stage' })).toBeInTheDocument();

    const withoutStage = FIELDS.filter((field) => field.key !== 'stage');
    view.rerender(<Filter fields={withoutStage} onChange={onChange} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(addFilterInput);
    await user.keyboard('na');
    expect(screen.getByRole('listbox', { name: 'Fields' })).toBeInTheDocument();
  });

  it('flags tokens invalid against the current fields, excludes them from onChange, and recovers', async () => {
    const { onChange, user, addFilterInput, view } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}{Enter}');
    await user.click(screen.getByRole('option', { name: 'Lead' }));
    await addStringFilter(user, addFilterInput);
    expect(onChange).toHaveBeenCalledTimes(2);

    const withoutStage = FIELDS.filter((field) => field.key !== 'stage');
    view.rerender(<Filter fields={withoutStage} onChange={onChange} />);

    // The token stays visible, flagged, and excluded from the payload. With
    // the field gone from the fields, its label falls back to the field key.
    const invalid = screen.getByRole('group', {
      name: 'stage is Lead (invalid: This field is no longer available)',
    });
    expect(invalid).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'and',
        conditions: [expect.objectContaining({ fieldKey: 'name' })],
      },
      expect.any(AbortController),
    );

    view.rerender(<Filter fields={FIELDS} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange.mock.lastCall?.[0].conditions).toHaveLength(2);
  });

  it('opens the broken stage from the warning icon', async () => {
    const { onChange, user, addFilterInput, view } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}{Enter}');
    await user.click(screen.getByRole('option', { name: 'Lead' }));
    const narrowed: FilterFieldDefinition[] = FIELDS.map((field) =>
      field.key === 'stage' ? { ...field, operators: ['in', 'notIn'] } : field,
    ) as FilterFieldDefinition[];
    view.rerender(<Filter fields={narrowed} onChange={onChange} />);
    await user.click(
      screen.getByRole('button', {
        name: 'Fix invalid filter: This operator is no longer supported for Stage',
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Stage' })).toBeInTheDocument();
  });

  it('excludes an invalid condition with its adjacent joiner and re-derives the payload', async () => {
    const { onChange, view } = setup({
      initialFilters: {
        combinator: 'or',
        conditions: [
          {
            combinator: 'and',
            conditions: [
              {
                fieldKey: 'stage',
                type: 'enum',
                operator: 'in',
                value: ['Lead'],
              },
              {
                fieldKey: 'name',
                type: 'string',
                operator: 'equals',
                value: 'a',
              },
            ],
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
    expect(await screen.findByRole('group', { name: /Stage/ })).toBeVisible();

    // Dropping the stage field invalidates the first condition. Its leading
    // 'and' goes with it, so the two survivors re-derive as bare or-branches.
    const withoutStage = FIELDS.filter((field) => field.key !== 'stage');
    view.rerender(<Filter fields={withoutStage} onChange={onChange} />);
    expect(onChange).toHaveBeenLastCalledWith(
      {
        combinator: 'or',
        conditions: [
          expect.objectContaining({ value: 'a' }),
          expect.objectContaining({ value: 'b' }),
        ],
      },
      expect.any(AbortController),
    );
    // Internal state keeps the invalid chip — and the brackets it derives.
    expect(queryTokens()).toHaveLength(3);
    expect(view.container.querySelectorAll('.filter-bracket')).toHaveLength(2);
  });

  it('re-notifies when an invalid token is removed', async () => {
    const { onChange, user, addFilterInput, view } = setup();
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}{Enter}');
    await user.click(screen.getByRole('option', { name: 'Lead' }));
    const withoutStage = FIELDS.filter((field) => field.key !== 'stage');
    view.rerender(<Filter fields={withoutStage} onChange={onChange} />);
    onChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Remove stage is Lead filter' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      { combinator: 'and', conditions: [] },
      expect.any(AbortController),
    );
  });
});
