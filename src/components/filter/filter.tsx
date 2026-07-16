import clsx from 'clsx';
import { useId, useMemo, useRef, useState } from 'react';

import type { FilterFieldDefinition, FilterProps } from '@/types/filter.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { searchFields } from '@/utilities/filter/field-search.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { TokenSegment } from '@/utilities/filter/validation.ts';
import { clampIndex, stepIndex } from '@/utilities/list-navigation.ts';
import { localSavedViewsStorage } from '@/utilities/storage/local-storage.ts';

import { AddFilterCombobox } from './add-filter-combobox.tsx';
import { FilterRail } from './filter-action-rail.tsx';
import { FilterDraftPreview, IncompleteDraftChip } from './filter-draft-chips.tsx';
import { activeEditorSegment, findEditingFilter } from './filter-editor-state.ts';
import type { FilterEditorState } from './filter-editor-state.ts';
import { FilterPopover } from './filter-popover.tsx';
import { FilterTokenList } from './filter-token-list.tsx';
import { useFilterEditor } from './use-filter-editor.ts';
import { useFilterFocus } from './use-filter-focus.ts';
import { useFilterHistory } from './use-filter-history.ts';
import { useSavedViews } from './use-saved-views.ts';

const NO_FIELD_RESULTS: readonly FilterFieldDefinition[] = [];

function useFilterFieldSelection(
  editorState: FilterEditorState,
  fields: readonly FilterFieldDefinition[],
) {
  const isChoosingFilterField = editorState.stage === 'field';
  const isChoosingNewFilterField = isChoosingFilterField && editorState.filterId === null;
  const fieldQuery = isChoosingFilterField ? editorState.query : null;

  const fieldResults = useMemo(
    () => (fieldQuery === null ? NO_FIELD_RESULTS : searchFields(fields, fieldQuery)),
    [fieldQuery, fields],
  );

  const matchingFields = isChoosingNewFilterField ? fieldResults : NO_FIELD_RESULTS;
  const activeFieldIndex = isChoosingNewFilterField
    ? clampIndex(editorState.activeIndex, matchingFields.length)
    : 0;

  let inputQuery = '';

  if (isChoosingNewFilterField && editorState.stage === 'field') {
    inputQuery = editorState.query;
  }

  return {
    activeFieldIndex,
    canFocusTokens: editorState.stage === 'idle' || editorState.filterId === null,
    fieldResults,
    inputQuery,
    isChoosingNewFilterField,
    matchingFields,
  };
}

function getEditorPresentation(
  editorState: FilterEditorState,
  filters: readonly FilterEntry[],
  findFilterField: (key: string) => FilterFieldDefinition | undefined,
): {
  activeDraftField: FilterFieldDefinition | undefined;
  editingFilter: FilterEntry | null;
  editingFilterId: string | null;
  editingSegment: TokenSegment | null;
} {
  const editingFilter = findEditingFilter(editorState, filters);

  if (editorState.stage === 'idle') {
    return {
      activeDraftField: undefined,
      editingFilter,
      editingFilterId: null,
      editingSegment: null,
    };
  }

  return {
    activeDraftField:
      editorState.stage === 'field' ? undefined : findFilterField(editorState.fieldKey),
    editingFilter,
    editingFilterId: editorState.filterId,
    editingSegment: editorState.filterId === null ? null : activeEditorSegment(editorState),
  };
}

/**
 * Dependency-injected filter editor. Committed changes emit a canonical group
 * and abort the previous change controller; applying the group remains the
 * parent's responsibility.
 */
export function Filter(properties: FilterProps) {
  const {
    fields,
    onChange,
    onSubmit,
    disabled: disabledProperty,
    initialFilters,
    savedViewsStorage: savedViewsStorageProperty,
    'aria-label': ariaLabelProperty,
    className,
    ...formProps
  } = properties;
  const disabled = disabledProperty ?? false;
  const savedViewsStorage = savedViewsStorageProperty ?? localSavedViewsStorage;
  const ariaLabel = ariaLabelProperty ?? 'Filters';
  const idPrefix = useId();
  const filterIdCounterRef = useRef(0);
  const createConditionId = () => `${idPrefix}-filter-${++filterIdCounterRef.current}`;
  const fieldRegistry = useMemo(() => createFilterFieldRegistry(fields), [fields]);
  const validatedFields = fieldRegistry.fields;
  const { history, getCurrentHistory, applyFilterHistoryAction, getCurrentValidGroup } =
    useFilterHistory(fieldRegistry, onChange, initialFilters, createConditionId);
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
    setLiveRegionMessage((previous) => (previous === message ? `${message}\u200B` : message));

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
    const draftPreview =
      filterFieldsetRef.current?.querySelector<HTMLElement>('[data-draft-preview]');

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

  const {
    activeFieldIndex,
    canFocusTokens,
    fieldResults,
    inputQuery,
    isChoosingNewFilterField,
    matchingFields,
  } = useFilterFieldSelection(editorState, validatedFields);

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

  const { activeDraftField, editingFilter, editingFilterId, editingSegment } =
    getEditorPresentation(editorState, filters, findFilterField);
  const incompleteDraftField = incompleteDraft
    ? findFilterField(incompleteDraft.fieldKey)
    : undefined;
  const lastFilterId = filters.at(-1)?.id ?? null;

  return (
    <form
      {...formProps}
      className={clsx('filter', className)}
      aria-label={ariaLabel}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(getCurrentValidGroup());
      }}
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
            editingFilterId={editingFilterId}
            editingSegment={editingSegment}
            onOpenSegment={openTokenSegment}
            onRemove={removeFilter}
            onRemoveEnumValue={removeEnumValue}
            onFlipJoiner={flipJoiner}
            onMoveFocusFromToken={moveFocusFromToken}
            onMoveFocusFromJoiner={moveFocusFromJoiner}
          />

          <FilterDraftPreview editorState={editorState} field={activeDraftField} />

          <IncompleteDraftChip
            incompleteDraft={incompleteDraft}
            field={incompleteDraftField}
            visible={editorState.stage === 'idle'}
            disabled={disabled}
            onResume={resumeIncompleteDraft}
            onDiscard={discardIncompleteDraft}
          />

          {/* Keep the input and action rail together when the token row wraps. */}
          <div className="filter-composer">
            <AddFilterCombobox
              inputRef={addFilterInputRef}
              idPrefix={idPrefix}
              disabled={disabled}
              lastFilterId={lastFilterId}
              open={isChoosingNewFilterField}
              query={inputQuery}
              results={matchingFields}
              activeIndex={activeFieldIndex}
              canFocusTokens={canFocusTokens}
              onOpenMenu={openNewFilterFieldPicker}
              onQueryChange={changeQuery}
              onNavigate={(delta) =>
                changeActiveIndex(stepIndex(activeFieldIndex, delta, matchingFields.length))
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
          fieldResults={fieldResults}
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

      {persistenceNotice && <p className="filter-storage-notice">{persistenceNotice}</p>}

      <span aria-live="polite" className="filter-visually-hidden">
        {liveRegionMessage}
      </span>
    </form>
  );
}
