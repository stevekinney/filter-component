import type { ReactNode } from 'react';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import { OPERATOR_LABELS, getValueEditorKind } from '@/utilities/filter/operators.ts';
import type { BooleanChoice } from '@/utilities/filter/operators.ts';
import { FilterValueEditor } from './filter-value-editor.tsx';
import {
  FieldSelectionStage,
  MultipleChoiceStage,
  SingleChoiceStage,
} from './filter-popover-stages.tsx';
import type { FilterEditorState } from './filter-editor-state.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';
import type { FilterFieldDefinition, FilterOperator } from '@/types/filter.ts';
import { useNativePopover } from './use-native-popover.ts';

export type ActiveFilterEditorState = Exclude<FilterEditorState, { stage: 'idle' }>;

export type FilterPopoverProps = {
  state: FilterEditorState;
  fields: readonly FilterFieldDefinition[];
  fieldResults: readonly FilterFieldDefinition[];
  editingFilter: FilterEntry | null;
  idPrefix: string;
  resolveAnchor: () => HTMLElement | null;
  /** Called only for browser light dismissal, not commit or semantic cancellation. */
  onBrowserDismiss: () => void;
  onChangeQuery: (query: string) => void;
  onChangeActiveIndex: (index: number) => void;
  onChangeDraft: (draft: ValueDraft) => void;
  onSelectField: (key: string) => void;
  onSelectOperator: (operator: FilterOperator) => void;
  onPickBoolean: (choice: BooleanChoice) => void;
  onPickSingleValue: (value: string) => void;
  onCommitValue: () => void;
  onCancel: () => void;
};

type OpenFilterPopoverProps = FilterPopoverProps & {
  state: ActiveFilterEditorState;
};

/**
 * Renders the active editor stage in one native auto popover. The browser owns
 * top-layer placement and light dismissal; editor state remains authoritative.
 */
export function FilterPopover(props: FilterPopoverProps) {
  if (props.state.stage === 'idle') return null;
  return <OpenFilterPopover {...props} state={props.state} />;
}

function OpenFilterPopover(props: OpenFilterPopoverProps) {
  const { state, resolveAnchor, onBrowserDismiss, onCancel } = props;
  const { popoverRef, handleBeforeToggle, handleKeyDown } = useNativePopover({
    anchorKey: state.filterId === null && state.stage !== 'field' ? 'new-draft-preview' : 'invoker',
    resolveAnchor,
    onBrowserDismiss,
    onEscape: onCancel,
  });

  let ariaLabel = 'Edit filter';
  let content: ReactNode = null;

  if (state.stage === 'field') {
    ariaLabel = 'Choose field';
    content = <FieldSelectionStage {...props} state={state} />;
  } else if (state.stage === 'operator') {
    const field = props.fields.find((candidate) => candidate.key === state.fieldKey);

    if (!field) return null;
    ariaLabel = fieldLabel(field);
    content = <SingleChoiceStage {...props} heading={ariaLabel} field={field} />;
  } else {
    const field = props.fields.find((candidate) => candidate.key === state.fieldKey);

    if (!field) return null;
    const kind = getValueEditorKind(field.type, state.operator);

    ariaLabel = `${fieldLabel(field)} ${OPERATOR_LABELS[state.operator]}`;
    if (kind === 'enumSingle') {
      content = <SingleChoiceStage {...props} heading={ariaLabel} field={field} />;
    } else if (kind === 'enumMulti') {
      content = <MultipleChoiceStage {...props} heading={ariaLabel} field={field} state={state} />;
    } else {
      content = (
        <FilterValueEditor
          state={state}
          heading={ariaLabel}
          kind={kind}
          idPrefix={props.idPrefix}
          onDraftChange={props.onChangeDraft}
          onCommitValue={props.onCommitValue}
          onCancel={props.onCancel}
        />
      );
    }
  }

  return (
    <div
      ref={popoverRef}
      popover="auto"
      role="dialog"
      aria-label={ariaLabel}
      className="filter-popover"
      onBeforeToggle={handleBeforeToggle}
      onKeyDown={handleKeyDown}
    >
      {content}
    </div>
  );
}
