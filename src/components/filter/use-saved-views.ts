import { useEffect, useRef, useState } from 'react';
import type { FocusTarget } from './use-filter-focus.ts';
import {
  fromFilterGroup,
  toFilterGroup,
} from '@/utilities/filter/expression.ts';
import {
  parseSavedViews,
  savedViewKey,
} from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import type { FilterHistoryAction } from '@/utilities/filter/history.ts';
import type { SavedViewsStorage } from '@/utilities/storage/saved-views-storage.ts';

type UseSavedViewsOptions = {
  /** The committed expression (`history.present`), the thing a view snapshots. */
  expression: FilterExpression;
  applyFilterHistoryAction: (action: FilterHistoryAction) => boolean;
  /** Mints a condition id unique within this component instance. */
  createConditionId: () => string;
  /** Returns the editor to idle before a load replaces the row. */
  resetEditor: () => void;
  announce: (message: string) => void;
  scheduleFocus: (target: FocusTarget) => void;
  savedViewsStorage: SavedViewsStorage;
};

type UseSavedViewsResult = {
  savedViews: SavedView[];
  /** Visible fallback when browser storage rejects a save or removal. */
  persistenceNotice: string | null;
  /** Whether the row is non-empty and not already saved as a view. */
  canSaveCurrentGroup: boolean;
  /** Identity key of the current group; a view with this key is the active one. */
  currentGroupKey: string;
  saveCurrentView: (name: string) => void;
  loadSavedView: (view: SavedView) => void;
  removeSavedView: (name: string) => void;
};

/**
 * Owns the saved-views collection. The injected store is read once on mount;
 * every mutation updates session state immediately and writes the full
 * collection back in order. Saving under an existing name overwrites that
 * view. Loading dispatches a `replace` history action, so it is committed,
 * reported through `onChange`, and undoable like any other change — except
 * when the view already matches the current expression, which loads as a
 * no-op. Views persist the canonical nested group without condition ids;
 * loading assigns fresh ones and linearizes back into the joiner model.
 */
export function useSavedViews({
  expression,
  applyFilterHistoryAction,
  createConditionId,
  resetEditor,
  announce,
  scheduleFocus,
  savedViewsStorage,
}: UseSavedViewsOptions): UseSavedViewsResult {
  const [storage] = useState(() => savedViewsStorage);
  const [initialRead] = useState(() => {
    let stored: ReturnType<SavedViewsStorage['getSavedViews']>;
    try {
      stored = storage.getSavedViews();
    } catch {
      return { pending: null, savedViews: [] };
    }
    return stored instanceof Promise
      ? { pending: stored, savedViews: [] }
      : { pending: null, savedViews: parseSavedViews(stored) };
  });
  const [savedViews, setSavedViews] = useState<SavedView[]>(
    initialRead.savedViews,
  );
  const [isStorageReady, setIsStorageReady] = useState(
    initialRead.pending === null,
  );
  const [persistenceNotice, setPersistenceNotice] = useState<string | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const pendingWriteRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    if (initialRead.pending) {
      void initialRead.pending.then(
        (stored) => {
          if (!isMountedRef.current) return;
          setSavedViews(parseSavedViews(stored));
          setIsStorageReady(true);
        },
        () => {
          if (isMountedRef.current) setIsStorageReady(true);
        },
      );
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [initialRead]);

  const trackWrite = (
    operation: Promise<void>,
    onSuccess: () => void,
    onFailure: () => void,
  ) => {
    pendingWriteRef.current = operation;
    void operation.then(
      () => {
        if (isMountedRef.current) onSuccess();
        if (pendingWriteRef.current === operation) {
          pendingWriteRef.current = null;
        }
      },
      () => {
        if (isMountedRef.current) onFailure();
        if (pendingWriteRef.current === operation) {
          pendingWriteRef.current = null;
        }
      },
    );
  };

  const persist = (
    next: SavedView[],
    onSuccess: () => void,
    onFailure: () => void,
  ) => {
    setSavedViews(next);
    const pendingWrite = pendingWriteRef.current;
    if (pendingWrite) {
      const operation = pendingWrite
        .catch(() => undefined)
        .then(() => storage.saveSavedViews(next));
      trackWrite(operation, onSuccess, onFailure);
      return;
    }

    try {
      const result = storage.saveSavedViews(next);
      if (result instanceof Promise) {
        trackWrite(result, onSuccess, onFailure);
      } else {
        onSuccess();
      }
    } catch {
      onFailure();
    }
  };

  // Views snapshot the whole expression — invalid conditions included, so a
  // view restores exactly what the row showed, not just what was emitted.
  const currentGroup = toFilterGroup(expression);
  const currentGroupKey = savedViewKey(currentGroup);
  const isCurrentGroupSaved = savedViews.some(
    (view) => savedViewKey(view.group) === currentGroupKey,
  );

  const saveCurrentView = (name: string) => {
    const view: SavedView = { name, group: currentGroup };
    const exists = savedViews.some((candidate) => candidate.name === name);
    const next = exists
      ? savedViews.map((candidate) =>
          candidate.name === name ? view : candidate,
        )
      : [...savedViews, view];
    persist(
      next,
      () => {
        setPersistenceNotice(null);
        announce(`View saved: ${name}`);
      },
      () => {
        setPersistenceNotice(
          `“${name}” is saved for this session only because browser storage is unavailable.`,
        );
        announce(`View saved for this session only: storage is unavailable`);
      },
    );
    // The save action gives way to the saved row once the group is saved;
    // focus the trigger, which stays mounted now that a view exists.
    scheduleFocus({ type: 'savedViewsTrigger' });
  };

  const loadSavedView = (view: SavedView) => {
    resetEditor();
    scheduleFocus({ type: 'savedViewsTrigger' });
    // The sole no-op check for loads: the reducer's `replace` always commits,
    // and this id-ignoring key is the only equality that can spot a match
    // (restored conditions get fresh ids).
    if (savedViewKey(view.group) === currentGroupKey) {
      announce(`View already applied: ${view.name}`);
      return;
    }
    applyFilterHistoryAction({
      type: 'replace',
      expression: fromFilterGroup(view.group, createConditionId),
    });
    announce(`View loaded: ${view.name}`);
  };

  const removeSavedView = (name: string) => {
    const index = savedViews.findIndex((candidate) => candidate.name === name);
    const remaining = savedViews.filter((candidate) => candidate.name !== name);
    persist(
      remaining,
      () => {
        setPersistenceNotice(null);
        announce(`View removed: ${name}`);
      },
      () => {
        setPersistenceNotice(
          `“${name}” was removed for this session only because browser storage is unavailable.`,
        );
        announce(`View removed for this session only: storage is unavailable`);
      },
    );
    if (remaining.length > 0) {
      // The removed row unmounts; land on its neighbor — the view now at the
      // removed position, or the new last view (same rule as removeFilter).
      scheduleFocus({
        type: 'savedView',
        index: Math.min(index, remaining.length - 1),
      });
    } else {
      // The last view is gone. The trigger survives only while the group is
      // still savable (non-empty, and nothing saved matches it now), where it
      // keeps the in-menu save action alive; otherwise it unmounts and focus
      // lands on the add-filter input.
      scheduleFocus(
        expression.conditions.length > 0
          ? { type: 'savedViewsTrigger' }
          : { type: 'addInput' },
      );
    }
  };

  return {
    savedViews,
    persistenceNotice,
    canSaveCurrentGroup:
      isStorageReady &&
      expression.conditions.length > 0 &&
      !isCurrentGroupSaved,
    currentGroupKey,
    saveCurrentView,
    loadSavedView,
    removeSavedView,
  };
}
