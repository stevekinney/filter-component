import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFilterHistory } from './use-filter-history.ts';
import { useSavedViews } from './use-saved-views.ts';
import type { FocusTarget } from './use-filter-focus.ts';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { EMPTY_FILTER_EXPRESSION } from '@/utilities/filter/expression.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import type { FilterHistoryAction } from '@/utilities/filter/history.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import type { SavedViewsStorage } from '@/utilities/storage/saved-views-storage.ts';

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
  function createMemoryStorage(
    initial: ReturnType<SavedViewsStorage['getSavedViews']> = [],
  ) {
    return {
      getSavedViews: vi.fn<SavedViewsStorage['getSavedViews']>(() => initial),
      saveSavedViews: vi.fn<SavedViewsStorage['saveSavedViews']>(
        () => undefined,
      ),
    };
  }

  function setupSavedViews(
    expression: FilterExpression,
    savedViewsStorage: SavedViewsStorage = createMemoryStorage(),
  ) {
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
        savedViewsStorage,
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
    const storage = createMemoryStorage();
    const hook = setupSavedViews(nameEntry('Maria'), storage);
    expect(hook.result.current.canSaveCurrentGroup).toBe(true);
    act(() => hook.result.current.saveCurrentView('Primary'));
    expect(hook.result.current.savedViews).toHaveLength(1);
    expect(hook.scheduleFocus).toHaveBeenCalledWith({
      type: 'savedViewsTrigger',
    });
    expect(hook.announce).toHaveBeenCalledWith('View saved: Primary');
    expect(storage.saveSavedViews).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'Primary' }),
    ]);
    expect(hook.result.current.canSaveCurrentGroup).toBe(false);

    act(() => hook.result.current.saveCurrentView('Secondary'));
    act(() => hook.result.current.saveCurrentView('Primary'));
    expect(hook.result.current.savedViews.map((view) => view.name)).toEqual([
      'Primary',
      'Secondary',
    ]);

    storage.saveSavedViews.mockImplementation(() => {
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
  });

  it('hydrates from an asynchronous reader before enabling saves', async () => {
    let resolveRead: (stored: unknown) => void = () => undefined;
    const storage = createMemoryStorage();
    storage.getSavedViews.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const storedView: SavedView = {
      name: 'Stored',
      group: { combinator: 'and', conditions: [] },
    };
    const hook = setupSavedViews(nameEntry('Maria'), storage);

    expect(hook.result.current.canSaveCurrentGroup).toBe(false);
    act(() => resolveRead([storedView, { invalid: true }]));

    await waitFor(() => {
      expect(hook.result.current.savedViews).toEqual([storedView]);
      expect(hook.result.current.canSaveCurrentGroup).toBe(true);
    });
    expect(storage.getSavedViews).toHaveBeenCalledTimes(1);
  });

  it('treats synchronous and asynchronous read failures as no saved views', async () => {
    const synchronousFailure = createMemoryStorage();
    synchronousFailure.getSavedViews.mockImplementation(() => {
      throw new Error('blocked');
    });
    const synchronousHook = setupSavedViews(
      nameEntry('Maria'),
      synchronousFailure,
    );
    expect(synchronousHook.result.current.savedViews).toEqual([]);
    expect(synchronousHook.result.current.canSaveCurrentGroup).toBe(true);

    const asynchronousFailure = createMemoryStorage();
    asynchronousFailure.getSavedViews.mockRejectedValue(new Error('offline'));
    const asynchronousHook = setupSavedViews(
      nameEntry('Maria'),
      asynchronousFailure,
    );
    expect(asynchronousHook.result.current.canSaveCurrentGroup).toBe(false);
    await waitFor(() => {
      expect(asynchronousHook.result.current.canSaveCurrentGroup).toBe(true);
    });
    expect(asynchronousHook.result.current.savedViews).toEqual([]);
  });

  it('ignores asynchronous read settlement after unmount', async () => {
    let resolveRead: (stored: unknown) => void = () => undefined;
    let rejectRead: (reason: Error) => void = () => undefined;
    const successfulRead = createMemoryStorage();
    successfulRead.getSavedViews.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const successfulHook = setupSavedViews(nameEntry('Maria'), successfulRead);
    successfulHook.unmount();
    await act(async () => {
      resolveRead([]);
      await Promise.resolve();
    });

    const failedRead = createMemoryStorage();
    failedRead.getSavedViews.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        }),
    );
    const failedHook = setupSavedViews(nameEntry('Maria'), failedRead);
    failedHook.unmount();
    await act(async () => {
      rejectRead(new Error('offline'));
      await Promise.resolve();
    });
  });

  it('serializes asynchronous writes in action order', async () => {
    let resolveFirstWrite: () => void = () => undefined;
    const storage = createMemoryStorage();
    storage.saveSavedViews.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstWrite = resolve;
        }),
    );
    const hook = setupSavedViews(nameEntry('Maria'), storage);

    act(() => hook.result.current.saveCurrentView('One'));
    act(() => hook.result.current.saveCurrentView('Two'));
    expect(storage.saveSavedViews).toHaveBeenCalledTimes(1);

    act(() => resolveFirstWrite());
    await waitFor(() => {
      expect(storage.saveSavedViews).toHaveBeenCalledTimes(2);
    });
    expect(storage.saveSavedViews).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'One' }),
      expect.objectContaining({ name: 'Two' }),
    ]);
  });

  it('continues the write queue after an earlier write rejects', async () => {
    let rejectFirstWrite: (reason: Error) => void = () => undefined;
    const storage = createMemoryStorage();
    storage.saveSavedViews.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirstWrite = reject;
        }),
    );
    const hook = setupSavedViews(nameEntry('Maria'), storage);

    act(() => hook.result.current.saveCurrentView('One'));
    act(() => hook.result.current.saveCurrentView('Two'));
    act(() => rejectFirstWrite(new Error('offline')));

    await waitFor(() => {
      expect(storage.saveSavedViews).toHaveBeenCalledTimes(2);
      expect(hook.announce).toHaveBeenLastCalledWith('View saved: Two');
    });
  });

  it('keeps optimistic state when an asynchronous write rejects', async () => {
    const storage = createMemoryStorage();
    storage.saveSavedViews.mockRejectedValue(new Error('offline'));
    const hook = setupSavedViews(nameEntry('Maria'), storage);

    act(() => hook.result.current.saveCurrentView('Session'));
    expect(hook.result.current.savedViews).toHaveLength(1);
    await waitFor(() => {
      expect(hook.result.current.persistenceNotice).toBe(
        '“Session” is saved for this session only because browser storage is unavailable.',
      );
    });
    expect(hook.announce).toHaveBeenLastCalledWith(
      'View saved for this session only: storage is unavailable',
    );
  });

  it('ignores asynchronous write settlement after unmount', async () => {
    let resolveWrite: () => void = () => undefined;
    let rejectWrite: (reason: Error) => void = () => undefined;
    const successfulWrite = createMemoryStorage();
    successfulWrite.saveSavedViews.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const successfulHook = setupSavedViews(nameEntry('Maria'), successfulWrite);
    act(() => successfulHook.result.current.saveCurrentView('Saved'));
    successfulHook.unmount();
    await act(async () => {
      resolveWrite();
      await Promise.resolve();
    });

    const failedWrite = createMemoryStorage();
    failedWrite.saveSavedViews.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectWrite = reject;
        }),
    );
    const failedHook = setupSavedViews(nameEntry('Maria'), failedWrite);
    act(() => failedHook.result.current.saveCurrentView('Saved'));
    failedHook.unmount();
    await act(async () => {
      rejectWrite(new Error('offline'));
      await Promise.resolve();
    });
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

    const empty = setupSavedViews(EMPTY_FILTER_EXPRESSION);
    act(() => empty.result.current.removeSavedView('Missing'));
    expect(empty.scheduleFocus).toHaveBeenLastCalledWith({ type: 'addInput' });
  });

  it('announces a session-only removal when storage rejects the write', () => {
    const storage = createMemoryStorage();
    const hook = setupSavedViews(nameEntry('Maria'), storage);
    act(() => hook.result.current.saveCurrentView('Only'));
    storage.saveSavedViews.mockImplementation(() => {
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
  });
});
