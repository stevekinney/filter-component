import { useState } from 'react';
import type { FocusTarget } from './use-filter-focus.ts';
import {
  fromFilterGroup,
  toFilterGroup,
} from '@/utilities/filter/expression.ts';
import {
  readSavedViews,
  savedViewKey,
  writeSavedViews,
} from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import type { FilterHistoryAction } from '@/utilities/filter/history.ts';

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
 * Owns the saved-views collection: state seeded from `localStorage`, every
 * mutation written back through, and the three user actions. Saving under an
 * existing name overwrites that view. Loading dispatches a `replace` history
 * action, so it is committed, reported through `onChange`, and undoable like
 * any other change — except when the view already matches the current
 * expression, which loads as a no-op. Views persist the canonical nested
 * group without condition ids; loading assigns fresh ones and linearizes
 * back into the joiner model.
 */
export function useSavedViews({
  expression,
  applyFilterHistoryAction,
  createConditionId,
  resetEditor,
  announce,
  scheduleFocus,
}: UseSavedViewsOptions): UseSavedViewsResult {
  const [savedViews, setSavedViews] = useState<SavedView[]>(() =>
    readSavedViews(),
  );
  const [persistenceNotice, setPersistenceNotice] = useState<string | null>(
    null,
  );
  const persist = (next: SavedView[]) => {
    setSavedViews(next);
    return writeSavedViews(next);
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
    const persisted = persist(
      exists
        ? savedViews.map((candidate) =>
            candidate.name === name ? view : candidate,
          )
        : [...savedViews, view],
    );
    // The save action gives way to the saved row once the group is saved;
    // focus the trigger, which stays mounted now that a view exists.
    scheduleFocus({ type: 'savedViewsTrigger' });
    setPersistenceNotice(
      persisted
        ? null
        : `“${name}” is saved for this session only because browser storage is unavailable.`,
    );
    announce(
      persisted
        ? `View saved: ${name}`
        : `View saved for this session only: storage is unavailable`,
    );
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
    const persisted = persist(remaining);
    setPersistenceNotice(
      persisted
        ? null
        : `“${name}” was removed for this session only because browser storage is unavailable.`,
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
    announce(
      persisted
        ? `View removed: ${name}`
        : `View removed for this session only: storage is unavailable`,
    );
  };

  return {
    savedViews,
    persistenceNotice,
    canSaveCurrentGroup:
      expression.conditions.length > 0 && !isCurrentGroupSaved,
    currentGroupKey,
    saveCurrentView,
    loadSavedView,
    removeSavedView,
  };
}
