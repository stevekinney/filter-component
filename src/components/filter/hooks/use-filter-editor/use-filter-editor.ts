import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { FilterCondition, FilterFieldDefinition, FilterOperator } from '@filter/types.ts';
import type { FilterFieldRegistry } from '@filter/utilities/field-registry.ts';
import type { FilterEntry } from '@filter/utilities/filter-entry.ts';
import type { FilterHistory, FilterHistoryAction } from '@filter/utilities/history.ts';
import {
  getValueEditorKind,
  isValuelessOperator,
  operatorsForField,
} from '@filter/utilities/operators.ts';
import type { BooleanChoice } from '@filter/utilities/operators.ts';
import { validateDraft } from '@filter/utilities/validation.ts';
import type { TokenSegment } from '@filter/utilities/validation.ts';
import type { ValueDraft } from '@filter/utilities/value-drafts.ts';

import type { FocusTarget } from '../use-filter-focus.ts';
import { createFilterEditorCommittedCommands } from './filter-editor-committed-commands.ts';
import {
  editorForTokenSegment,
  enumActiveIndex,
  fieldActiveIndex,
  reconcileFilterEditor,
  reconcileIncompleteDraft,
  resolveOperatorSelection,
} from './filter-editor-reconciliation.ts';
import { filterEditorControllerReducer, incompleteFromEditor } from './filter-editor-reducer.ts';
import type {
  FilterEditorControllerAction,
  FilterEditorControllerState,
} from './filter-editor-reducer.ts';
import { activeEditorSegment, IDLE_FILTER_EDITOR_STATE } from './filter-editor-state.ts';

type UseFilterEditorOptions = {
  fieldRegistry: FilterFieldRegistry;
  popoverAnchorRef: RefObject<HTMLElement | null>;
  getCurrentHistory: () => FilterHistory;
  applyFilterHistoryAction: (action: FilterHistoryAction) => boolean;
  createConditionId: () => string;
  disabled: boolean;
  scheduleFocus: (target: FocusTarget) => void;
  announce: (message: string) => void;
};

export function useFilterEditor({
  fieldRegistry,
  popoverAnchorRef,
  getCurrentHistory,
  applyFilterHistoryAction,
  createConditionId,
  disabled,
  scheduleFocus,
  announce,
}: UseFilterEditorOptions) {
  const [controllerState, setControllerState] = useState<FilterEditorControllerState>(() => ({
    editor: IDLE_FILTER_EDITOR_STATE,
    incompleteDraft: null,
  }));

  const stateRef = useRef(controllerState);
  const registryRef = useRef(fieldRegistry);
  const scheduleFocusRef = useRef(scheduleFocus);
  const announceRef = useRef(announce);
  // Bumped whenever the captured invoker changes, so the popover can tell two
  // opens of the same filter/segment (different pills) apart even though the
  // stage, filterId, and segment are otherwise identical.
  const [anchorInvocation, setAnchorInvocation] = useState(0);

  useLayoutEffect(() => {
    stateRef.current = controllerState;
    registryRef.current = fieldRegistry;
    scheduleFocusRef.current = scheduleFocus;
    announceRef.current = announce;
  }, [announce, controllerState, fieldRegistry, scheduleFocus]);

  const send = (action: FilterEditorControllerAction) => {
    const previousState = stateRef.current;
    const nextState = filterEditorControllerReducer(previousState, action);

    if (nextState === previousState) return;

    stateRef.current = nextState;
    setControllerState(nextState);
  };

  const preserveCurrent = (): boolean => incompleteFromEditor(stateRef.current.editor) !== null;

  const resetEditor = () => send({ type: 'idle', preserveCurrent: false });

  // Construct this group only when a command runs. Passing callbacks that
  // close over the synchronous controller ref during render prevents the
  // React Compiler from optimizing this hook.
  const getCommittedCommands = () =>
    createFilterEditorCommittedCommands({
      getFieldRegistry: () => registryRef.current,
      getCurrentHistory,
      applyFilterHistoryAction,
      createConditionId,
      resetEditor,
      scheduleFocus,
      announce,
    });

  const commitFilter = (
    fieldKey: string,
    operator: FilterOperator,
    value: FilterCondition['value'],
    filterId: string | null,
  ) => getCommittedCommands().commitFilter(fieldKey, operator, value, filterId);

  const cancel = () => {
    const editor = stateRef.current.editor;

    if (editor.stage === 'idle') return;

    send({ type: 'idle', preserveCurrent: false });

    if (editor.filterId === null) {
      scheduleFocus({ type: 'addInput' });
    } else if (popoverAnchorRef.current?.isConnected) {
      scheduleFocus({ type: 'element', element: popoverAnchorRef.current });
    } else {
      scheduleFocus({
        type: 'segment',
        id: editor.filterId,
        segment: activeEditorSegment(editor),
      });
    }
  };

  const browserDismiss = () => {
    const preserved = preserveCurrent();

    send({ type: 'idle', preserveCurrent: true });

    if (preserved) announce('Filter incomplete — kept for later');
  };

  const openNewFieldPicker = (query: string) => {
    const preserved = preserveCurrent();

    send({
      type: 'open',
      preserveCurrent: true,
      editor: { stage: 'field', filterId: null, query, activeIndex: 0 },
    });

    if (preserved) announce('Filter incomplete — kept for later');
  };

  const openValueStage = (
    filterId: string | null,
    field: FilterFieldDefinition,
    operator: FilterOperator,
    draft: ValueDraft,
  ) => {
    const kind = getValueEditorKind(field.type, operator);

    send({
      type: 'open',
      preserveCurrent: false,
      editor: {
        stage: 'value',
        filterId,
        fieldKey: field.key,
        fieldType: field.type,
        operator,
        draft,
        error: null,
        activeIndex: enumActiveIndex(field, draft, kind),
      },
    });
    scheduleFocus({ type: 'autofocus' });
  };

  const selectField = (key: string) => {
    const editor = stateRef.current.editor;

    if (editor.stage !== 'field') return;

    const field = registryRef.current.byKey.get(key);

    if (!field) return;

    if (editor.filterId !== null) {
      const token = getCurrentHistory().present.conditions.find(
        (candidate) => candidate.id === editor.filterId,
      );

      if (token?.fieldKey === key && token.type === field.type) {
        cancel();
        return;
      }
    }
    send({
      type: 'open',
      preserveCurrent: false,
      editor: {
        stage: 'operator',
        filterId: editor.filterId,
        fieldKey: key,
        fieldType: field.type,
        activeIndex: 0,
      },
    });
    scheduleFocus({ type: 'autofocus' });
  };

  const selectOperator = (operator: FilterOperator) => {
    const editor = stateRef.current.editor;

    if (editor.stage !== 'operator') return;

    const field = registryRef.current.byKey.get(editor.fieldKey);

    if (!field || field.type !== editor.fieldType || !operatorsForField(field).includes(operator)) {
      return;
    }

    if (isValuelessOperator(operator)) {
      commitFilter(field.key, operator, undefined, editor.filterId);
      return;
    }

    const token = getCurrentHistory().present.conditions.find(
      (candidate) => candidate.id === editor.filterId,
    );

    const resolution = resolveOperatorSelection(field, operator, token, registryRef.current.fields);

    if (resolution.type === 'commit') {
      commitFilter(field.key, operator, resolution.value, editor.filterId);
      return;
    }

    openValueStage(editor.filterId, field, operator, resolution.draft);
  };

  const selectBooleanChoice = (choice: BooleanChoice) => {
    const editor = stateRef.current.editor;

    if (editor.stage !== 'operator') return;

    const field = registryRef.current.byKey.get(editor.fieldKey);

    if (!field || field.type !== 'boolean' || field.type !== editor.fieldType) return;

    const operator = choice === 'true' || choice === 'false' ? 'equals' : choice;

    if (!operatorsForField(field).includes(operator)) return;

    commitFilter(
      field.key,
      operator,
      operator === 'equals' ? choice === 'true' : undefined,
      editor.filterId,
    );
  };

  const commitValueDraft = (draft: ValueDraft | null) => {
    const editor = stateRef.current.editor;

    if (editor.stage !== 'value' || draft === null) return;

    const field = registryRef.current.byKey.get(editor.fieldKey);

    if (!field || field.type !== editor.fieldType) return;

    const result = validateDraft(field, editor.operator, draft);

    if (!result.ok) {
      send({ type: 'validationError', draft, error: result.error });
      return;
    }

    commitFilter(field.key, editor.operator, result.value, editor.filterId);
  };

  const commitDraft = () => {
    const editor = stateRef.current.editor;

    commitValueDraft(editor.stage === 'value' ? editor.draft : null);
  };

  const openTokenSegment = (token: FilterEntry, segment: TokenSegment, invoker: HTMLElement) => {
    const preserved = preserveCurrent();

    if (popoverAnchorRef.current !== invoker) setAnchorInvocation((count) => count + 1);
    popoverAnchorRef.current = invoker;

    const editor = editorForTokenSegment(token, segment, registryRef.current);

    if (!editor) return;

    send({ type: 'open', editor, preserveCurrent: true });

    if (preserved) announce('Filter incomplete — kept for later');

    scheduleFocus({ type: 'autofocus' });
  };

  const resumeIncompleteDraft = (anchor: HTMLElement) => {
    const incomplete = stateRef.current.incompleteDraft;

    if (!incomplete) return;

    const field = registryRef.current.byKey.get(incomplete.fieldKey);

    send({ type: 'discardIncomplete' });

    if (!field) return;

    popoverAnchorRef.current = anchor;

    if (field.type !== incomplete.fieldType) {
      send({
        type: 'open',
        preserveCurrent: false,
        editor: {
          stage: 'field',
          filterId: null,
          query: '',
          activeIndex: fieldActiveIndex(registryRef.current, incomplete.fieldKey),
        },
      });

      scheduleFocus({ type: 'addInput' });

      return;
    }

    if (
      incomplete.stage === 'operator' ||
      !operatorsForField(field).includes(incomplete.operator)
    ) {
      send({
        type: 'open',
        preserveCurrent: false,
        editor: {
          stage: 'operator',
          filterId: null,
          fieldKey: field.key,
          fieldType: field.type,
          activeIndex: 0,
        },
      });
    } else {
      openValueStage(null, field, incomplete.operator, incomplete.draft);
      return;
    }
    scheduleFocus({ type: 'autofocus' });
  };

  const discardIncompleteDraft = () => {
    send({ type: 'discardIncomplete' });
    announce('Incomplete filter discarded');
    scheduleFocus({ type: 'addInput' });
  };

  const removeFilter = (id: string) => getCommittedCommands().removeFilter(id);
  const removeEnumValue = (id: string, value: string) =>
    getCommittedCommands().removeEnumValue(id, value);
  const clearAll = () => getCommittedCommands().clearAll();
  const undo = () => getCommittedCommands().undo();
  const redo = () => getCommittedCommands().redo();
  const flipJoiner = (index: number) => getCommittedCommands().flipJoiner(index);

  useEffect(() => {
    const current = stateRef.current;
    const nextEditor = reconcileFilterEditor(current.editor, registryRef.current);
    const nextIncomplete = reconcileIncompleteDraft(current.incompleteDraft, registryRef.current);

    if (nextIncomplete !== current.incompleteDraft) {
      send({ type: 'replaceIncomplete', draft: nextIncomplete });
    }

    if (nextEditor === current.editor) return;

    if (nextEditor.stage === 'idle') {
      send({ type: 'idle', preserveCurrent: false });
      scheduleFocusRef.current(
        current.editor.stage !== 'idle' && current.editor.filterId
          ? { type: 'token', id: current.editor.filterId }
          : { type: 'addInput' },
      );
      return;
    }

    send({ type: 'open', preserveCurrent: false, editor: nextEditor });

    if (current.editor.stage !== nextEditor.stage) {
      scheduleFocusRef.current(
        nextEditor.stage === 'field' && nextEditor.filterId === null
          ? { type: 'addInput' }
          : { type: 'autofocus' },
      );
    }
  }, [fieldRegistry.signature]);

  useEffect(() => {
    if (!disabled || stateRef.current.editor.stage === 'idle') return;

    const preserved = preserveCurrent();

    send({ type: 'idle', preserveCurrent: true });

    if (preserved) announceRef.current('Filter incomplete — kept for later');
  }, [disabled]);

  return {
    editorState: controllerState.editor,
    incompleteDraft: controllerState.incompleteDraft,
    anchorInvocation,
    resetEditor,
    cancel,
    browserDismiss,
    openNewFieldPicker,
    openTokenSegment,
    selectField,
    selectOperator,
    selectBooleanChoice,
    changeQuery: (query: string) => send({ type: 'changeQuery', query }),
    changeActiveIndex: (index: number) => send({ type: 'changeActiveIndex', index }),
    changeDraft: (draft: ValueDraft) => send({ type: 'changeDraft', draft }),
    pickSingleValue: (value: string) => commitValueDraft({ kind: 'scalar', input: value }),
    commitDraft,
    resumeIncompleteDraft,
    discardIncompleteDraft,
    removeFilter,
    removeEnumValue,
    clearAll,
    undo,
    redo,
    flipJoiner,
  };
}
