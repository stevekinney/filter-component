import clsx from 'clsx';
import { useId, useRef, useState } from 'react';
import {
  activeEditorSegment,
  findEditingFilter,
} from './filter-editor-state.ts';
import { DRAFT_PREVIEW_SELECTOR } from '@/utilities/filter/dom-selectors.ts';
import { searchFields } from '@/utilities/filter/field-search.ts';
import {
  FilterDraftPreview,
  IncompleteDraftChip,
} from './filter-draft-chips.tsx';
import { FilterRail } from './filter-action-rail.tsx';
import { AddFilterCombobox } from './add-filter-combobox.tsx';
import { FilterPopover } from './filter-popover.tsx';
import { FilterTokenList } from './filter-token-list.tsx';
import { useFilterHistory } from './use-filter-history.ts';
import { useFilterEditor } from './use-filter-editor.ts';
import { useSavedViews } from './use-saved-views.ts';
import { clampIndex, stepIndex } from '@/utilities/list-navigation.ts';
import type { TokenSegment } from '@/utilities/filter/validation.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { useFilterFocus } from './use-filter-focus.ts';
import { localSavedViewsStorage } from '@/utilities/storage/local-storage.ts';
import type { FilterFieldDefinition, FilterProps } from '@/types/filter.ts';

/**
 * Dependency-injected filter-token builder. The parent supplies the `fields`
 * and receives the full valid-only filter group — canonical two-level
 * disjunctive-normal form, derived from the joiner words between the chips —
 * through `onChange` after every committed change (add, edit, remove, clear,
 * joiner flip, undo, redo), along with an `AbortController` that is aborted
 * by the next change. The component never fetches, never touches URL state,
 * and never assumes a data source — applying the filters is entirely the
 * parent's business.
 */
export function Filter({
  fields,
  onChange,
  disabled = false,
  initialFilters,
  savedViewsStorage = localSavedViewsStorage,
  className,
  ...formProps
}: FilterProps) {
  const idPrefix = useId();
  const filterIdCounterRef = useRef(0);
  const createConditionId = () =>
    `${idPrefix}-filter-${++filterIdCounterRef.current}`;
  const fieldRegistry = createFilterFieldRegistry(fields);
  const validatedFields = fieldRegistry.fields;
  const { history, getCurrentHistory, applyFilterHistoryAction } =
    useFilterHistory(
      fieldRegistry,
      onChange,
      initialFilters,
      createConditionId,
    );
  const [liveRegionMessage, setLiveRegionMessage] = useState('');

  const filterFieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const addFilterInputRef = useRef<HTMLInputElement | null>(null);
  // The element that invoked the popover, tracked outside the serializable
  // editor state. `showPopover({ source })` anchors the popover to it.
  const popoverAnchorRef = useRef<HTMLElement | null>(null);
  const { scheduleFocus, focus } = useFilterFocus(filterFieldsetRef);
  const { conditions: filters } = history.present;
  const findFilterField = (key: string): FilterFieldDefinition | undefined =>
    fieldRegistry.byKey.get(key);

  // Setting identical text twice leaves the DOM unchanged, so screen readers
  // stay silent on the repeat (two undos in a row, for example); a zero-width
  // space forces a mutation without visible or spoken output.
  const announce = (message: string) =>
    setLiveRegionMessage((previous) =>
      previous === message ? `${message}\u200B` : message,
    );
  const {
    editorState,
    incompleteDraft,
    resetEditor,
    cancel,
    browserDismiss,
    openNewFieldPicker,
    openTokenSegment,
    selectField,
    selectOperator,
    selectBooleanChoice,
    changeQuery,
    changeActiveIndex,
    changeDraft,
    pickSingleValue,
    commitDraft,
    resumeIncompleteDraft,
    discardIncompleteDraft,
    removeFilter,
    removeEnumValue,
    clearAll,
    undo,
    redo,
    flipJoiner,
  } = useFilterEditor({
    fieldRegistry,
    filterFieldsetRef,
    popoverAnchorRef,
    getCurrentHistory,
    applyFilterHistoryAction,
    createConditionId,
    disabled,
    announce,
    scheduleFocus,
  });

  // While a new condition is mid-composition its draft preview is what the
  // popover describes, so the popover anchors there (the preview only exists
  // past the field stage). Otherwise the popover anchors to the element that
  // invoked it — a token segment or the add-filter input — falling back to
  // the input when the invoker left the DOM (the incomplete-draft chip
  // unmounts on resume).
  const resolvePopoverAnchor = (): HTMLElement | null => {
    const draftPreview = filterFieldsetRef.current?.querySelector<HTMLElement>(
      DRAFT_PREVIEW_SELECTOR,
    );
    if (draftPreview) return draftPreview;
    const captured = popoverAnchorRef.current;
    if (captured?.isConnected) return captured;
    return addFilterInputRef.current;
  };

  const {
    savedViews,
    persistenceNotice,
    canSaveCurrentGroup,
    currentGroupKey,
    saveCurrentView,
    loadSavedView,
    removeSavedView,
  } = useSavedViews({
    expression: history.present,
    applyFilterHistoryAction,
    createConditionId,
    resetEditor,
    announce,
    scheduleFocus,
    savedViewsStorage,
  });

  const isChoosingNewFilterField =
    editorState.stage === 'field' && editorState.filterId === null;
  const matchingFields = isChoosingNewFilterField
    ? searchFields(validatedFields, editorState.query)
    : [];
  const activeFieldIndex = isChoosingNewFilterField
    ? clampIndex(editorState.activeIndex, matchingFields.length)
    : 0;

  const openNewFilterFieldPicker = (query: string) => {
    popoverAnchorRef.current = addFilterInputRef.current;
    openNewFieldPicker(query);
  };

  const focusLastFilterToken = (id: string) => {
    resetEditor();
    // Focus directly: when the editor is already idle, no state changes, so a
    // deferred request would wait on a render that never comes.
    focus({ type: 'token', id });
  };

  // The row's roving ←/→ sequence reads chip → joiner → chip …, with the
  // add-filter input after the last chip. Joiners are stops of their own but
  // never Tab stops, so the Tab order stays chips-then-input.
  const moveFocusFromToken = (index: number, direction: -1 | 1) => {
    if (direction === 1 && index >= filters.length - 1) {
      addFilterInputRef.current?.focus();
      return;
    }
    const joinerIndex = direction === 1 ? index : index - 1;
    if (joinerIndex < 0) return;
    focus({ type: 'joiner', index: joinerIndex });
  };

  const moveFocusFromJoiner = (id: string) => focus({ type: 'token', id });

  const editingFilter = findEditingFilter(editorState, filters);
  const getEditingSegment = (id: string): TokenSegment | null =>
    editorState.stage !== 'idle' && editorState.filterId === id
      ? activeEditorSegment(editorState)
      : null;

  const activeDraftField =
    editorState.stage !== 'idle' && editorState.stage !== 'field'
      ? findFilterField(editorState.fieldKey)
      : undefined;

  return (
    <form
      {...formProps}
      className={clsx('filter', className)}
      aria-label={formProps['aria-label'] ?? 'Filters'}
      onSubmit={(event) => event.preventDefault()}
    >
      {/* A natively disabled fieldset makes every control inside inert;
          aria-disabled is valid on its implicit group role. */}
      <fieldset
        ref={filterFieldsetRef}
        className="filter-controls"
        disabled={disabled}
        aria-disabled={disabled || undefined}
      >
        <div className="filter-row">
          <FilterTokenList
            expression={history.present}
            fields={validatedFields}
            disabled={disabled}
            editingSegmentFor={getEditingSegment}
            onOpenSegment={openTokenSegment}
            onRemove={removeFilter}
            onRemoveEnumValue={removeEnumValue}
            onFlipJoiner={flipJoiner}
            onMoveFocusFromToken={moveFocusFromToken}
            onMoveFocusFromJoiner={moveFocusFromJoiner}
          />

          <FilterDraftPreview
            editorState={editorState}
            field={activeDraftField}
          />

          <IncompleteDraftChip
            incompleteDraft={incompleteDraft}
            field={
              incompleteDraft
                ? findFilterField(incompleteDraft.fieldKey)
                : undefined
            }
            visible={editorState.stage === 'idle'}
            disabled={disabled}
            onResume={resumeIncompleteDraft}
            onDiscard={discardIncompleteDraft}
          />

          {/* Input and rail travel together as one flex item so they wrap to
              the last line as a unit — the input grows to fill it and the rail
              stays pinned to the bottom-right in every layout. */}
          <div className="filter-composer">
            <AddFilterCombobox
              inputRef={addFilterInputRef}
              idPrefix={idPrefix}
              disabled={disabled}
              lastFilterId={filters.at(-1)?.id ?? null}
              open={isChoosingNewFilterField}
              query={
                isChoosingNewFilterField && editorState.stage === 'field'
                  ? editorState.query
                  : ''
              }
              results={matchingFields}
              activeIndex={activeFieldIndex}
              canFocusTokens={
                editorState.stage === 'idle' || editorState.filterId === null
              }
              onOpenMenu={openNewFilterFieldPicker}
              onQueryChange={changeQuery}
              onNavigate={(delta) =>
                changeActiveIndex(
                  stepIndex(activeFieldIndex, delta, matchingFields.length),
                )
              }
              onSelectActive={(field) => selectField(field.key)}
              onCloseMenu={resetEditor}
              onFocusLastToken={focusLastFilterToken}
            />

            <FilterRail
              disabled={disabled}
              fields={validatedFields}
              savedViews={savedViews}
              canSaveCurrentGroup={canSaveCurrentGroup}
              currentGroupKey={currentGroupKey}
              onSaveView={saveCurrentView}
              onLoadView={loadSavedView}
              onRemoveView={removeSavedView}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              hasFilters={filters.length > 0}
              onClearAll={clearAll}
            />
          </div>
        </div>

        <FilterPopover
          state={editorState}
          fields={validatedFields}
          editingFilter={editingFilter}
          idPrefix={idPrefix}
          resolveAnchor={resolvePopoverAnchor}
          onBrowserDismiss={browserDismiss}
          onChangeQuery={changeQuery}
          onChangeActiveIndex={changeActiveIndex}
          onChangeDraft={changeDraft}
          onSelectField={selectField}
          onSelectOperator={selectOperator}
          onPickBoolean={selectBooleanChoice}
          onPickSingleValue={pickSingleValue}
          onCommitValue={commitDraft}
          onCancel={cancel}
        />
      </fieldset>

      {persistenceNotice && (
        <p className="filter-storage-notice">{persistenceNotice}</p>
      )}

      <span aria-live="polite" className="filter-visually-hidden">
        {liveRegionMessage}
      </span>
    </form>
  );
}
