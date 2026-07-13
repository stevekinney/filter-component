import clsx from 'clsx';
import { Bookmark, Check, Plus, X } from 'lucide-react';
import { useEffect, useId, useReducer, useRef } from 'react';
import type { Dispatch, KeyboardEvent, ReactNode, RefObject } from 'react';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import { clampIndex } from '@/utilities/list-navigation.ts';
import { PopoverValidationError } from './filter-popover-error.tsx';
import { SavedViewsList } from './filter-saved-views-list.tsx';
import { useNativePopover } from './use-native-popover.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

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

function SavedViewSaveControl({
  menuState,
  viewsLength,
  autofocusIndex,
  nameInputRef,
  errorId,
  dispatchMenu,
  submitName,
  handleNameKeyDown,
}: {
  menuState: Exclude<SavedViewsMenuState, { stage: 'closed' }>;
  viewsLength: number;
  autofocusIndex: number;
  nameInputRef: RefObject<HTMLInputElement | null>;
  errorId: string;
  dispatchMenu: Dispatch<SavedViewsMenuAction>;
  submitName: (
    namingState: Extract<SavedViewsMenuState, { stage: 'naming' }>,
  ) => void;
  handleNameKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    namingState: Extract<SavedViewsMenuState, { stage: 'naming' }>,
  ) => void;
}) {
  if (menuState.stage === 'naming') {
    return (
      <div className="filter-saved-views-save">
        <div className="filter-value-editor-controls">
          <input
            ref={nameInputRef}
            type="text"
            aria-label="View name"
            aria-describedby={menuState.nameError ? errorId : undefined}
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
        <PopoverValidationError error={menuState.nameError} id={errorId} />
      </div>
    );
  }

  return (
    <div className="filter-saved-views-save">
      <button
        type="button"
        data-autofocus={viewsLength === 0 ? '1' : undefined}
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
    </div>
  );
}

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
        className={clsx('filter-icon-button', {
          'is-open': menuState.stage !== 'closed',
        })}
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
            <SavedViewSaveControl
              menuState={menuState}
              viewsLength={views.length}
              autofocusIndex={autofocusIndex}
              nameInputRef={nameInputRef}
              errorId={errorId}
              dispatchMenu={dispatchMenu}
              submitName={submitName}
              handleNameKeyDown={handleNameKeyDown}
            />
          )}

          {canSaveCurrentGroup && views.length > 0 && (
            <div className="filter-popover-divider" aria-hidden="true" />
          )}

          {views.length > 0 && (
            <SavedViewsList
              fields={fields}
              views={views}
              currentGroupKey={currentGroupKey}
              autofocusIndex={autofocusIndex}
              dispatchMenu={dispatchMenu}
              onLoadView={onLoadView}
              onRemoveView={onRemoveView}
            />
          )}
        </SavedViewsPopover>
      )}
    </>
  );
}
