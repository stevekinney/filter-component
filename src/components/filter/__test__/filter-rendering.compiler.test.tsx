import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Filter } from '../filter.tsx';
import { FIELDS } from './filter-test-setup.tsx';

const renderProbes = vi.hoisted(() => ({
  fieldSearch: vi.fn(),
  fieldRegistry: vi.fn(),
  filterRail: vi.fn(),
  filterToken: vi.fn(),
  filterTokenList: vi.fn(),
}));

vi.mock('@filter/utilities/field-search.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@filter/utilities/field-search.ts')>();

  return {
    ...actual,
    searchFields: (...arguments_: Parameters<typeof actual.searchFields>) => {
      renderProbes.fieldSearch();
      return actual.searchFields(...arguments_);
    },
  };
});

vi.mock('@filter/utilities/field-registry.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@filter/utilities/field-registry.ts')>();

  return {
    ...actual,
    createFilterFieldRegistry: (
      ...arguments_: Parameters<typeof actual.createFilterFieldRegistry>
    ) => {
      renderProbes.fieldRegistry();
      return actual.createFilterFieldRegistry(...arguments_);
    },
  };
});

vi.mock('../filter-action-rail.tsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../filter-action-rail.tsx')>();

  function FilterRailRenderProbe(props: ComponentProps<typeof actual.FilterRail>) {
    renderProbes.filterRail();
    return <actual.FilterRail {...props} />;
  }

  return { ...actual, FilterRail: FilterRailRenderProbe };
});

vi.mock('@filter/tokens/filter-token.tsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@filter/tokens/filter-token.tsx')>();

  function FilterTokenRenderProbe(props: ComponentProps<typeof actual.FilterToken>) {
    renderProbes.filterToken();
    return <actual.FilterToken {...props} />;
  }

  return { ...actual, FilterToken: FilterTokenRenderProbe };
});

vi.mock('@filter/tokens/filter-token-list.tsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@filter/tokens/filter-token-list.tsx')>();

  function FilterTokenListRenderProbe(props: ComponentProps<typeof actual.FilterTokenList>) {
    renderProbes.filterTokenList();
    return <actual.FilterTokenList {...props} />;
  }

  return { ...actual, FilterTokenList: FilterTokenListRenderProbe };
});

describe('compiled Filter render boundaries', () => {
  it('keeps committed tokens and row actions still while a value draft changes', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Filter
          fields={FIELDS}
          onChange={vi.fn()}
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

    const addFilterInput = screen.getByRole('combobox', {
      name: 'Add filter',
    });
    await user.type(addFilterInput, 'na');
    await user.click(screen.getByRole('option', { name: /Name/ }));
    await user.click(screen.getByRole('option', { name: 'is' }));

    const rendersBeforeTyping = {
      fieldRegistry: renderProbes.fieldRegistry.mock.calls.length,
      filterRail: renderProbes.filterRail.mock.calls.length,
      filterToken: renderProbes.filterToken.mock.calls.length,
      filterTokenList: renderProbes.filterTokenList.mock.calls.length,
    };
    expect(Object.values(rendersBeforeTyping).every((count) => count > 0)).toBe(true);

    const valueInput = screen.getByRole('textbox', { name: 'Value' });
    await user.type(valueInput, 'Nadia');

    expect(valueInput).toHaveValue('Nadia');
    expect(renderProbes.fieldRegistry).toHaveBeenCalledTimes(rendersBeforeTyping.fieldRegistry);
    expect(renderProbes.filterRail).toHaveBeenCalledTimes(rendersBeforeTyping.filterRail);
    expect(renderProbes.filterToken).toHaveBeenCalledTimes(rendersBeforeTyping.filterToken);
    expect(renderProbes.filterTokenList).toHaveBeenCalledTimes(rendersBeforeTyping.filterTokenList);
  });

  it('rebuilds field metadata when the field snapshot changes', async () => {
    const user = userEvent.setup();
    const options = ['Lead', 'Won'];
    const fields = [
      {
        key: 'stage',
        label: 'Stage',
        type: 'enum' as const,
        options,
        operators: ['in' as const],
      },
    ];
    const onChange = vi.fn();
    const view = render(<Filter fields={fields} onChange={onChange} />);

    await user.type(screen.getByRole('combobox', { name: 'Add filter' }), 's');
    await user.click(screen.getByRole('option', { name: /Stage/ }));
    await user.click(screen.getByRole('option', { name: 'is any of' }));
    expect(screen.getByRole('option', { name: 'Won' })).toBeVisible();
    const buildsBeforeReplacement = renderProbes.fieldRegistry.mock.calls.length;

    const changedFields = [{ ...fields[0]!, options: ['Lead'] }];
    view.rerender(<Filter fields={changedFields} onChange={onChange} />);

    expect(screen.queryByRole('option', { name: 'Won' })).toBeNull();
    expect(renderProbes.fieldRegistry).toHaveBeenCalledTimes(buildsBeforeReplacement + 1);
  });

  it('reuses field search results while only the active index changes', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Filter fields={FIELDS} onChange={vi.fn()} />
      </StrictMode>,
    );

    const addFilterInput = screen.getByRole('combobox', {
      name: 'Add filter',
    });
    await user.type(addFilterInput, 'e');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
    const searchesBeforeNavigation = renderProbes.fieldSearch.mock.calls.length;

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

    expect(renderProbes.fieldSearch).toHaveBeenCalledTimes(searchesBeforeNavigation);
  });

  it('shares field search results with an existing token editor', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Filter
          fields={FIELDS}
          onChange={vi.fn()}
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

    await user.click(screen.getByTitle('Change field'));
    const searchInput = screen.getByRole('combobox', {
      name: 'Search fields',
    });
    await user.type(searchInput, 'sta');

    expect(searchInput).toHaveValue('sta');
    expect(screen.getByRole('option', { name: /Stage/ })).toBeVisible();
  });
});
