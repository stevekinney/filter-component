import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterHistory } from './use-filter-history.ts';
import { useSavedViews } from './use-saved-views.ts';
import type { FocusTarget } from './use-filter-focus.ts';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { EMPTY_FILTER_EXPRESSION } from '@/utilities/filter/expression.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import type { FilterHistoryAction } from '@/utilities/filter/history.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';

const nameEntry = (value: string, id = value): FilterExpression => ({
  conditions: [
    createFilterEntry(
      {
        fieldKey: 'name',
        type: 'string',
        operator: 'equals',
        value,
      },
      id,
    ),
  ],
  joiners: [],
});

describe('useFilterHistory', () => {
  const registry = createFilterFieldRegistry([{ key: 'name', type: 'string' }]);

  it('returns false for no-ops and tolerates a missing onChange callback', () => {
    const { result, unmount } = renderHook(() =>
      useFilterHistory(registry, undefined, undefined, () => 'new'),
    );
    expect(result.current.applyFilterHistoryAction({ type: 'clear' })).toBe(
      false,
    );
    act(() => {
      expect(
        result.current.applyFilterHistoryAction({
          type: 'add',
          filter: nameEntry('Maria').conditions[0]!,
        }),
      ).toBe(true);
    });
    expect(result.current.history.present.conditions).toHaveLength(1);
    unmount();
  });

  it('uses the latest callback without rebuilding committed state', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ onChange }: { onChange: typeof first }) =>
        useFilterHistory(registry, onChange, undefined, () => 'new'),
      { initialProps: { onChange: first } },
    );
    rerender({ onChange: second });

    act(() => {
      result.current.applyFilterHistoryAction({
        type: 'add',
        filter: nameEntry('Maria').conditions[0]!,
      });
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('re-emits only when a field-schema change changes the valid public group', () => {
    const onChange = vi.fn();
    const initialFilters = {
      combinator: 'and' as const,
      conditions: [
        {
          fieldKey: 'name',
          type: 'string' as const,
          operator: 'equals' as const,
          value: 'Maria',
        },
      ],
    };
    const { rerender } = renderHook(
      ({ currentRegistry }) =>
        useFilterHistory(
          currentRegistry,
          onChange,
          initialFilters,
          () => 'seed',
        ),
      { initialProps: { currentRegistry: registry } },
    );
    expect(onChange).not.toHaveBeenCalled();

    const withoutName = createFilterFieldRegistry([
      { key: 'active', type: 'boolean' },
    ]);
    rerender({ currentRegistry: withoutName });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0]).toEqual({
      combinator: 'and',
      conditions: [],
    });

    const stillWithoutName = createFilterFieldRegistry([
      { key: 'active', label: 'Active', type: 'boolean' },
    ]);
    rerender({ currentRegistry: stillWithoutName });
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender({ currentRegistry: registry });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall?.[0].conditions).toHaveLength(1);
  });
});

describe('useSavedViews', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function setupSavedViews(expression: FilterExpression) {
    const applyFilterHistoryAction = vi.fn<
      (action: FilterHistoryAction) => boolean
    >(() => true);
    const resetEditor = vi.fn<() => void>();
    const announce = vi.fn<(message: string) => void>();
    const scheduleFocus = vi.fn<(target: FocusTarget) => void>();
    let nextId = 0;
    const hook = renderHook(() =>
      useSavedViews({
        expression,
        applyFilterHistoryAction,
        createConditionId: () => `restored-${++nextId}`,
        resetEditor,
        announce,
        scheduleFocus,
      }),
    );
    return {
      ...hook,
      applyFilterHistoryAction,
      resetEditor,
      announce,
      scheduleFocus,
    };
  }

  it('saves, overwrites, and keeps failed writes in memory', () => {
    const hook = setupSavedViews(nameEntry('Maria'));
    expect(hook.result.current.canSaveCurrentGroup).toBe(true);
    act(() => hook.result.current.saveCurrentView('Primary'));
    expect(hook.result.current.savedViews).toHaveLength(1);
    expect(hook.scheduleFocus).toHaveBeenCalledWith({
      type: 'savedViewsTrigger',
    });
    expect(hook.announce).toHaveBeenCalledWith('View saved: Primary');
    expect(hook.result.current.canSaveCurrentGroup).toBe(false);

    act(() => hook.result.current.saveCurrentView('Secondary'));
    act(() => hook.result.current.saveCurrentView('Primary'));
    expect(hook.result.current.savedViews.map((view) => view.name)).toEqual([
      'Primary',
      'Secondary',
    ]);

    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
    act(() => hook.result.current.saveCurrentView('Session'));
    expect(
      hook.result.current.savedViews.some((view) => view.name === 'Session'),
    ).toBe(true);
    expect(hook.announce).toHaveBeenLastCalledWith(
      'View saved for this session only: storage is unavailable',
    );
    expect(hook.result.current.persistenceNotice).toBe(
      '“Session” is saved for this session only because browser storage is unavailable.',
    );
    setItemSpy.mockRestore();
  });

  it('loads a different view and treats the current one as a no-op', () => {
    const hook = setupSavedViews(nameEntry('Maria'));
    const current: SavedView = {
      name: 'Current',
      group: {
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
    };
    act(() => hook.result.current.loadSavedView(current));
    expect(hook.resetEditor).toHaveBeenCalled();
    expect(hook.applyFilterHistoryAction).not.toHaveBeenCalled();
    expect(hook.announce).toHaveBeenCalledWith('View already applied: Current');

    const other: SavedView = {
      ...current,
      name: 'Other',
      group: {
        combinator: 'and',
        conditions: [
          {
            fieldKey: 'name',
            type: 'string',
            operator: 'equals',
            value: 'Nadia',
          },
        ],
      },
    };
    act(() => hook.result.current.loadSavedView(other));
    expect(hook.applyFilterHistoryAction).toHaveBeenCalledWith({
      type: 'replace',
      expression: {
        conditions: [
          expect.objectContaining({ id: 'restored-1', value: 'Nadia' }),
        ],
        joiners: [],
      },
    });
    expect(hook.announce).toHaveBeenLastCalledWith('View loaded: Other');
  });

  it('focuses a remaining neighbor when removing a saved view', () => {
    const hook = setupSavedViews(nameEntry('Maria'));
    act(() => hook.result.current.saveCurrentView('One'));
    act(() => hook.result.current.saveCurrentView('Two'));
    act(() => hook.result.current.removeSavedView('One'));
    expect(hook.result.current.savedViews.map((view) => view.name)).toEqual([
      'Two',
    ]);
    expect(hook.scheduleFocus).toHaveBeenLastCalledWith({
      type: 'savedView',
      index: 0,
    });
    expect(hook.announce).toHaveBeenLastCalledWith('View removed: One');
  });

  it('focuses the surviving trigger or add input after the final removal', () => {
    const nonempty = setupSavedViews(nameEntry('Maria'));
    act(() => nonempty.result.current.saveCurrentView('Only'));
    act(() => nonempty.result.current.removeSavedView('Only'));
    expect(nonempty.scheduleFocus).toHaveBeenLastCalledWith({
      type: 'savedViewsTrigger',
    });

    window.localStorage.clear();
    const empty = setupSavedViews(EMPTY_FILTER_EXPRESSION);
    act(() => empty.result.current.removeSavedView('Missing'));
    expect(empty.scheduleFocus).toHaveBeenLastCalledWith({ type: 'addInput' });
  });

  it('announces a session-only removal when storage rejects the write', () => {
    const hook = setupSavedViews(nameEntry('Maria'));
    act(() => hook.result.current.saveCurrentView('Only'));
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
    act(() => hook.result.current.removeSavedView('Only'));
    expect(hook.result.current.savedViews).toHaveLength(0);
    expect(hook.announce).toHaveBeenLastCalledWith(
      'View removed for this session only: storage is unavailable',
    );
    expect(hook.result.current.persistenceNotice).toBe(
      '“Only” was removed for this session only because browser storage is unavailable.',
    );
    setItemSpy.mockRestore();
  });
});
