import { CircleDashed, X } from 'lucide-react';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import { OPERATOR_LABELS } from '@/utilities/filter/operators.ts';
import type {
  FilterEditorState,
  IncompleteDraft,
} from './filter-editor-state.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

/** Preview text for the active draft beside the add-filter input. */
function formatDraftPreview(state: FilterEditorState): string {
  if (state.stage !== 'value') return '…';
  const { draft } = state;
  switch (draft.kind) {
    case 'scalar':
      return draft.input || '…';
    case 'range':
      if (draft.fromInput !== '' && draft.toInput !== '')
        return `${draft.fromInput} and ${draft.toInput}`;
      return draft.fromInput || draft.toInput || '…';
    case 'duration':
      return draft.amountInput === ''
        ? '…'
        : `${draft.amountInput} ${draft.unit}`;
    case 'multiSelection':
      return draft.selectedOptions.length > 0
        ? draft.selectedOptions.join(', ')
        : '…';
  }
}

/**
 * The non-interactive (aria-hidden) preview of the active draft that builds
 * up inline while a new condition is mid-composition; the popover is the
 * interactive surface. Renders nothing until a field has been chosen for a
 * new condition.
 */
export function FilterDraftPreview({
  editorState,
  field,
}: {
  editorState: FilterEditorState;
  field: FilterFieldDefinition | undefined;
}) {
  const isActiveDraft =
    editorState.stage !== 'idle' &&
    editorState.stage !== 'field' &&
    editorState.filterId === null;
  if (!isActiveDraft || !field) return null;
  return (
    <div
      aria-hidden="true"
      className="filter-chip filter-draft-preview"
      data-draft-preview="1"
    >
      <span className="filter-draft-preview-field">{fieldLabel(field)}</span>
      <span className="filter-draft-preview-divider" />
      <span className="filter-draft-preview-operator">
        {editorState.stage === 'value'
          ? OPERATOR_LABELS[editorState.operator]
          : '…'}
      </span>
      <span className="filter-draft-preview-divider" />
      <span className="filter-draft-preview-value">
        {formatDraftPreview(editorState)}
      </span>
    </div>
  );
}

/**
 * An abandoned mid-composition draft, kept as a resumable chip. Renders
 * nothing when there is no preserved draft or while the editor is open.
 */
export function IncompleteDraftChip({
  incompleteDraft,
  field,
  visible,
  disabled,
  onResume,
  onDiscard,
}: {
  incompleteDraft: IncompleteDraft | null;
  field: FilterFieldDefinition | undefined;
  visible: boolean;
  disabled: boolean;
  onResume: () => void;
  onDiscard: () => void;
}) {
  if (!incompleteDraft || !visible) return null;
  const label = field ? fieldLabel(field) : incompleteDraft.fieldKey;
  return (
    <div
      role="group"
      aria-label={`Incomplete filter: ${label}`}
      className="filter-chip filter-incomplete-draft-chip"
      data-incomplete-draft="1"
    >
      <button
        type="button"
        disabled={disabled}
        className="filter-incomplete-draft-resume"
        title="Finish this filter"
        onClick={onResume}
      >
        <CircleDashed aria-hidden="true" size={13} />
        <span className="filter-incomplete-draft-field">{label}</span>
        <span className="filter-incomplete-draft-operator">
          {incompleteDraft.stage === 'value'
            ? OPERATOR_LABELS[incompleteDraft.operator]
            : '…'}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        className="filter-incomplete-draft-discard"
        aria-label="Discard incomplete filter"
        onClick={onDiscard}
      >
        <X aria-hidden="true" size={13} />
      </button>
    </div>
  );
}
