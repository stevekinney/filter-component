import type { ReactNode } from 'react';

import { useNativePopover } from '@/utilities/hooks/use-native-popover.ts';

import { activeEditorSegment } from '@filter/hooks/use-filter-editor/index.ts';
import type { FilterEditorState } from '@filter/hooks/use-filter-editor/index.ts';
import type { FilterFieldDefinition, FilterOperator } from '@filter/types.ts';
import type { FilterEntry } from '@filter/utilities/filter-entry.ts';
import { fieldLabel } from '@filter/utilities/formatting.ts';
import { getValueEditorKind, OPERATOR_LABELS } from '@filter/utilities/operators.ts';
import type { BooleanChoice } from '@filter/utilities/operators.ts';
import type { ValueDraft } from '@filter/utilities/value-drafts.ts';

import { FieldSelectionStage } from './field-selection-stage.tsx';
import { FilterValueEditor } from './filter-value-editor.tsx';
import { MultipleChoiceStage } from './multiple-choice-stage.tsx';
import { SingleChoiceStage } from './single-choice-stage.tsx';

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
    anchorKey: `${state.filterId ?? 'new-filter'}:${activeEditorSegment(state)}`,
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
