import type { ReactNode } from 'react';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import {
  findField,
  getValueEditorKind,
  OPERATOR_LABELS,
} from '@/utilities/filter/operators.ts';
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

export type ActiveFilterEditorState = Exclude<
  FilterEditorState,
  { stage: 'idle' }
>;

export type FilterPopoverProps = {
  state: FilterEditorState;
  fields: readonly FilterFieldDefinition[];
  /** The condition being edited, for check-marking its current selection. */
  editingFilter: FilterEntry | null;
  idPrefix: string;
  /** The element the popover anchors to, resolved after each render. */
  resolveAnchor: () => HTMLElement | null;
  /** Browser-driven light dismissal (outside click) — not commit or cancel. */
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
 * The one-at-a-time popover: field suggestions, a single-select list for
 * operators (or boolean's collapsed list and single enum values), a
 * multi-select list with an apply button for `in`/`notIn`, and a compact
 * input group for typed values. A native `popover="auto"` element anchored
 * to the control that opened it via `showPopover({ source })` — the browser
 * owns top-layer display, geometry (CSS anchor positioning), and
 * outside-click light dismissal; editor state stays the single source of
 * truth and browser events sync back into it. Renders nothing while the
 * editor is idle.
 */
export function FilterPopover(props: FilterPopoverProps) {
  if (props.state.stage === 'idle') return null;
  return <OpenFilterPopover {...props} state={props.state} />;
}

function OpenFilterPopover(props: OpenFilterPopoverProps) {
  const { state, resolveAnchor, onBrowserDismiss, onCancel } = props;
  const { popoverRef, handleBeforeToggle, handleKeyDown } = useNativePopover({
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
    const field = findField(props.fields, state.fieldKey);
    if (!field) return null;
    ariaLabel = fieldLabel(field);
    content = (
      <SingleChoiceStage {...props} heading={ariaLabel} field={field} />
    );
  } else {
    const field = findField(props.fields, state.fieldKey);
    if (!field) return null;
    const kind = getValueEditorKind(field.type, state.operator);
    ariaLabel = `${fieldLabel(field)} ${OPERATOR_LABELS[state.operator]}`;
    if (kind === 'enumSingle') {
      content = (
        <SingleChoiceStage {...props} heading={ariaLabel} field={field} />
      );
    } else if (kind === 'enumMulti') {
      content = (
        <MultipleChoiceStage
          {...props}
          heading={ariaLabel}
          field={field}
          state={state}
        />
      );
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
