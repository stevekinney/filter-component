import { Bookmark, Check, Plus, X } from 'lucide-react';
import { useEffect, useId, useReducer, useRef } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import {
  SAVED_VIEW_ITEM_SELECTOR,
  SAVED_VIEW_REMOVE_SELECTOR,
} from '@/utilities/filter/dom-selectors.ts';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import { findField } from '@/utilities/filter/operators.ts';
import { savedViewKey } from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import { clampIndex, stepIndex } from '@/utilities/list-navigation.ts';
import { PopoverValidationError } from './filter-popover-error.tsx';
import { useNativePopover } from './use-native-popover.ts';
import type {
  FilterCondition,
  FilterFieldDefinition,
  FilterGroup,
} from '@/types/filter.ts';

function leafConditions(group: FilterGroup): FilterCondition[] {
  return group.conditions.flatMap((member) =>
    'combinator' in member ? leafConditions(member) : [member],
  );
}

/**
 * A `popover="auto"` dialog for the saved-views controls, mounted only while
 * open — the same contract as `FilterPopover`: showing happens once after
 * mount, anchored to the trigger via `showPopover({ source })`; unmounting
 * hides without lifecycle events; a browser-driven close (light dismissal)
 * syncs back through `onBrowserDismiss`; Escape closes with focus returned
 * to the trigger.
 */
function SavedViewsPopover({
  triggerRef,
  onBrowserDismiss,
  onEscape,
  children,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  onBrowserDismiss: () => void;
  onEscape: () => void;
  children: ReactNode;
}) {
  const { popoverRef, handleBeforeToggle, handleKeyDown } = useNativePopover({
    resolveAnchor: () => triggerRef.current,
    onBrowserDismiss,
    onEscape,
    autofocusOnOpen: true,
  });

  return (
    <div
      ref={popoverRef}
      popover="auto"
      role="dialog"
      aria-label="Saved views"
      className="filter-popover filter-saved-views-popover"
      onBeforeToggle={handleBeforeToggle}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

/**
 * The subline under a saved view's name: leaf-condition count, the root
 * combinator word (only when more than one condition makes it meaningful —
 * an `or` root reads "Any" even when some branches are and-groups), and the
 * distinct field labels across every nesting level. A field no longer in
 * the schema falls back to its raw key.
 */
function savedViewSummary(
  view: SavedView,
  fields: readonly FilterFieldDefinition[],
): string {
  const { combinator } = view.group;
  const leaves = leafConditions(view.group);
  const labels: string[] = [];
  for (const condition of leaves) {
    const field = findField(fields, condition.fieldKey);
    const label = field ? fieldLabel(field) : condition.fieldKey;
    if (!labels.includes(label)) labels.push(label);
  }
  const count = leaves.length;
  const parts = [`${count} filter${count === 1 ? '' : 's'}`];
  if (count > 1) parts.push(combinator === 'or' ? 'Any' : 'All');
  if (labels.length > 0) parts.push(labels.join(', '));
  return parts.join(' · ');
}

type SavedViewsMenuState =
  | { stage: 'closed' }
  | { stage: 'list'; autofocusIndex: number }
  | {
      stage: 'naming';
      autofocusIndex: number;
      nameDraft: string;
      nameError: string | null;
    };

type SavedViewsMenuAction =
  | { type: 'open'; autofocusIndex: number }
  | { type: 'close' }
  | { type: 'beginNaming'; autofocusIndex: number }
  | { type: 'changeName'; autofocusIndex: number; name: string }
  | {
      type: 'rejectName';
      autofocusIndex: number;
      name: string;
      message: string;
    };

const CLOSED_SAVED_VIEWS_MENU: SavedViewsMenuState = { stage: 'closed' };

function savedViewsMenuReducer(
  _state: SavedViewsMenuState,
  action: SavedViewsMenuAction,
): SavedViewsMenuState {
  switch (action.type) {
    case 'open':
      return { stage: 'list', autofocusIndex: action.autofocusIndex };
    case 'close':
      return CLOSED_SAVED_VIEWS_MENU;
    case 'beginNaming':
      return {
        stage: 'naming',
        autofocusIndex: action.autofocusIndex,
        nameDraft: '',
        nameError: null,
      };
    case 'changeName':
      return {
        stage: 'naming',
        autofocusIndex: action.autofocusIndex,
        nameDraft: action.name,
        nameError: null,
      };
    case 'rejectName':
      return {
        stage: 'naming',
        autofocusIndex: action.autofocusIndex,
        nameDraft: action.name,
        nameError: action.message,
      };
  }
}

/**
 * The saved-views control: a single bookmarks button (shown while any views
 * exist or the current group is savable) that opens a complete views surface.
 * The menu carries a save action — a "Save current filters…" button that
 * swaps in place to an inline name field — shown only while the current group
 * is non-empty and not already saved, and one row per saved view. Each row
 * loads its view on click (an undoable, onChange-reported change) and carries
 * a check plus a tinted background while it is the active view; a separate
 * trailing × removes it, kept clear of the load hit-area.
 *
 * Keyboard: ArrowDown on the trigger opens onto the first view, ArrowUp onto
 * the last. Inside the list, ArrowDown/ArrowUp move with wraparound, Home/End
 * jump to the ends, ArrowRight/ArrowLeft step between a view and its × button,
 * and Delete/Backspace remove the view under focus — its neighbor receives
 * focus, mirroring token removal. Enter/Space activate; Escape returns to the
 * trigger.
 */
export function SavedViewsControls({
  fields,
  views,
  canSaveCurrentGroup,
  currentGroupKey,
  disabled,
  onSaveView,
  onLoadView,
  onRemoveView,
}: {
  fields: readonly FilterFieldDefinition[];
  views: SavedView[];
  canSaveCurrentGroup: boolean;
  currentGroupKey: string;
  disabled: boolean;
  onSaveView: (name: string) => void;
  onLoadView: (view: SavedView) => void;
  onRemoveView: (name: string) => void;
}) {
  const [menuState, dispatchMenu] = useReducer(
    savedViewsMenuReducer,
    CLOSED_SAVED_VIEWS_MENU,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const errorId = `${useId()}-view-name-error`;

  // The inline name field appears after the menu is already open, so the
  // popover's mount-time autofocus can't reach it; focus it as it swaps in.
  useEffect(() => {
    if (menuState.stage === 'naming') nameInputRef.current?.focus();
  }, [menuState.stage]);

  useEffect(() => {
    if (disabled && menuState.stage !== 'closed') {
      dispatchMenu({ type: 'close' });
    }
  }, [disabled, menuState.stage]);

  const openMenu = (focusIndex: number) => {
    dispatchMenu({ type: 'open', autofocusIndex: focusIndex });
  };

  const closeMenu = (refocusTrigger: boolean) => {
    dispatchMenu({ type: 'close' });
    if (refocusTrigger) triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (menuState.stage !== 'closed') return;
    event.preventDefault();
    openMenu(event.key === 'ArrowDown' ? 0 : views.length - 1);
  };

  const submitName = (
    namingState: Extract<SavedViewsMenuState, { stage: 'naming' }>,
  ) => {
    const name = namingState.nameDraft.trim();
    if (name === '') {
      dispatchMenu({
        type: 'rejectName',
        autofocusIndex: namingState.autofocusIndex,
        name: namingState.nameDraft,
        message: 'Enter a name',
      });
      return;
    }
    // Saving closes the menu; the group now matches a view, so focus returns
    // to the (still-mounted) trigger via the hook.
    dispatchMenu({ type: 'close' });
    onSaveView(name);
  };

  const handleNameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    namingState: Extract<SavedViewsMenuState, { stage: 'naming' }>,
  ) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitName(namingState);
  };

  const removeView = (view: SavedView) => {
    // Removing the last view closes the menu; its neighbor (or the trigger /
    // add-filter input) is focused by the hook.
    if (views.length === 1) dispatchMenu({ type: 'close' });
    onRemoveView(view.name);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const rows = Array.from(event.currentTarget.children).filter(
      (child): child is HTMLLIElement => child instanceof HTMLLIElement,
    );
    if (rows.length === 0) return;
    // Keyboard events dispatched through this list originate on the list or
    // one of its focusable HTMLElement descendants.
    const target = event.target as HTMLElement;
    const row = target.closest('li');
    const index = Math.max(0, row === null ? 0 : rows.indexOf(row));

    const focusViewAt = (rowIndex: number) =>
      rows[rowIndex]
        ?.querySelector<HTMLElement>(SAVED_VIEW_ITEM_SELECTOR)
        ?.focus();

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        focusViewAt(
          stepIndex(index, event.key === 'ArrowDown' ? 1 : -1, rows.length),
        );
        return;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        focusViewAt(event.key === 'Home' ? 0 : rows.length - 1);
        return;
      }
      case 'ArrowRight': {
        event.preventDefault();
        rows[index]
          ?.querySelector<HTMLElement>(SAVED_VIEW_REMOVE_SELECTOR)
          ?.focus();
        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        focusViewAt(index);
        return;
      }
      case 'Delete':
      case 'Backspace': {
        event.preventDefault();
        const view = views[index];
        if (view !== undefined) removeView(view);
        return;
      }
    }
  };

  // Autofocus a saved view when any exist (ArrowUp/Down decides which end);
  // otherwise the save action is the only landing spot.
  const autofocusIndex = clampIndex(
    menuState.stage === 'closed' ? 0 : menuState.autofocusIndex,
    views.length,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-saved-views-button="1"
        disabled={disabled}
        className={
          menuState.stage === 'closed'
            ? 'filter-icon-button'
            : 'filter-icon-button is-open'
        }
        aria-label="Saved views"
        title="Saved views"
        aria-haspopup="dialog"
        aria-expanded={menuState.stage !== 'closed'}
        onClick={() =>
          menuState.stage === 'closed' ? openMenu(0) : closeMenu(false)
        }
        onKeyDown={handleTriggerKeyDown}
      >
        <Bookmark aria-hidden="true" size={18} />
      </button>

      {menuState.stage !== 'closed' && (
        <SavedViewsPopover
          triggerRef={triggerRef}
          onBrowserDismiss={() => closeMenu(false)}
          onEscape={() => closeMenu(true)}
        >
          <div className="filter-popover-header">
            <div className="filter-popover-heading">Saved views</div>
            <button
              type="button"
              aria-label="Close"
              className="filter-icon-button"
              onClick={() => closeMenu(true)}
            >
              <X aria-hidden="true" size={13} />
            </button>
          </div>

          {canSaveCurrentGroup && (
            <div className="filter-saved-views-save">
              {menuState.stage === 'naming' ? (
                <>
                  <div className="filter-value-editor-controls">
                    <input
                      ref={nameInputRef}
                      type="text"
                      aria-label="View name"
                      aria-describedby={
                        menuState.nameError ? errorId : undefined
                      }
                      placeholder="Name this view"
                      value={menuState.nameDraft}
                      onChange={(event) => {
                        dispatchMenu({
                          type: 'changeName',
                          autofocusIndex: menuState.autofocusIndex,
                          name: event.target.value,
                        });
                      }}
                      onKeyDown={(event) => handleNameKeyDown(event, menuState)}
                    />
                    <button
                      type="button"
                      aria-label="Save"
                      title="Save"
                      className="filter-value-editor-apply"
                      onClick={() => submitName(menuState)}
                    >
                      <Check aria-hidden="true" size={14} />
                    </button>
                  </div>
                  <PopoverValidationError
                    error={menuState.nameError}
                    id={errorId}
                  />
                </>
              ) : (
                <button
                  type="button"
                  data-autofocus={views.length === 0 ? '1' : undefined}
                  className="filter-saved-views-save-action"
                  onClick={() =>
                    dispatchMenu({
                      type: 'beginNaming',
                      autofocusIndex,
                    })
                  }
                >
                  <Plus aria-hidden="true" size={16} />
                  Save current filters…
                </button>
              )}
            </div>
          )}

          {canSaveCurrentGroup && views.length > 0 && (
            <div className="filter-popover-divider" aria-hidden="true" />
          )}

          {views.length > 0 && (
            <ul
              className="filter-popover-list filter-saved-views-list"
              onKeyDown={handleMenuKeyDown}
            >
              {views.map((view, index) => {
                const isActive = savedViewKey(view.group) === currentGroupKey;
                return (
                  <li
                    key={view.name}
                    className={
                      isActive
                        ? 'filter-saved-views-item is-active'
                        : 'filter-saved-views-item'
                    }
                  >
                    <button
                      type="button"
                      data-saved-view-item={index}
                      data-autofocus={
                        index === autofocusIndex ? '1' : undefined
                      }
                      className="filter-saved-views-load"
                      title="Load this view"
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => {
                        dispatchMenu({ type: 'close' });
                        onLoadView(view);
                      }}
                    >
                      <span
                        className="filter-saved-views-check"
                        aria-hidden="true"
                      >
                        {isActive && <Check size={16} />}
                      </span>
                      <span className="filter-saved-views-text">
                        <span className="filter-saved-views-name">
                          {view.name}
                        </span>
                        <span
                          className="filter-saved-views-summary"
                          aria-hidden="true"
                        >
                          {savedViewSummary(view, fields)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      data-saved-view-remove="1"
                      className="filter-saved-views-remove"
                      aria-label={`Remove view: ${view.name}`}
                      title="Remove this view"
                      onClick={() => removeView(view)}
                    >
                      <X aria-hidden="true" size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SavedViewsPopover>
      )}
    </>
  );
}
