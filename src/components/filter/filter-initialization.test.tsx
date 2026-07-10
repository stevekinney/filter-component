import { act, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Filter } from './filter.tsx';
import { useFilterHistory } from './use-filter-history.ts';
import { addStringFilter, FIELDS, setup } from './filter-test-setup.tsx';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import type { FilterList } from '@/types/filter.ts';

describe('onChange cancellation', () => {
  it('composes two synchronous actions and emits each resulting ID-free group', () => {
    const onChange = vi.fn();
    const registry = createFilterFieldRegistry(FIELDS);
    const { result } = renderHook(() =>
      useFilterHistory(registry, onChange, undefined, () => 'unused'),
    );

    act(() => {
      result.current.applyFilterHistoryAction({
        type: 'add',
        filter: createFilterEntry(
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Maria',
          },
          'first',
        ),
      });
      result.current.applyFilterHistoryAction({
        type: 'add',
        filter: createFilterEntry(
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Nadia',
          },
          'second',
        ),
      });
    });

    expect(result.current.history.present.conditions).toHaveLength(2);
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      {
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
      expect.any(AbortController),
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      {
        combinator: 'and',
        conditions: [
          expect.objectContaining({ value: 'Maria' }),
          expect.objectContaining({ value: 'Nadia' }),
        ],
      },
      expect.any(AbortController),
    );
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty('conditions.0.id');
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty('conditions.1.id');
  });

  it('aborts the previous AbortController when filters change again', async () => {
    const { onChange, user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    const firstController = onChange.mock.calls[0]?.[1] as AbortController;
    expect(firstController.signal.aborted).toBe(false);

    await addStringFilter(user, addFilterInput, 'Nadia');
    const secondController = onChange.mock.calls[1]?.[1] as AbortController;
    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(false);
  });

  it('aborts the latest AbortController when the component unmounts', () => {
    const onChange = vi.fn();
    const registry = createFilterFieldRegistry(FIELDS);
    const { result, unmount } = renderHook(() =>
      useFilterHistory(registry, onChange, undefined, () => 'unused'),
    );
    act(() => {
      result.current.applyFilterHistoryAction({
        type: 'add',
        filter: createFilterEntry(
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Maria',
          },
          'first',
        ),
      });
    });
    const controller = onChange.mock.lastCall?.[1] as AbortController;
    expect(controller.signal.aborted).toBe(false);

    unmount();

    expect(controller.signal.aborted).toBe(true);
  });
});

describe('disabled and initialFilters', () => {
  it('seeds filters through initialFilters without emitting onChange or history entries', async () => {
    const seed: FilterList = [
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'contains',
        value: 'corp',
      },
    ];
    const { onChange } = setup({
      initialFilters: { combinator: 'and', conditions: seed },
    });
    expect(
      await screen.findByRole('group', { name: 'Name contains corp' }),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Undo filter change' }),
    ).not.toBeInTheDocument();
  });

  it('reads initialFilters only on mount', () => {
    const { onChange, view } = setup({
      initialFilters: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'contains',
            value: 'corp',
          },
        ],
      },
    });

    view.rerender(
      <Filter
        fields={FIELDS}
        onChange={onChange}
        initialFilters={{
          combinator: 'and',
          conditions: [
            {
              fieldKey: 'active',
              type: 'boolean',
              operator: 'equals',
              value: true,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole('group', { name: 'Name contains corp' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Active is true' }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
