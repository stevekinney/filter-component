import { CircleDashed, X } from 'lucide-react';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import { OPERATOR_LABELS } from '@/utilities/filter/operators.ts';
import type { FilterEditorState, IncompleteDraft } from './filter-editor-state.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

function formatDraftPreview(state: FilterEditorState): string {
  if (state.stage !== 'value') return '…';
  const { draft } = state;

  switch (draft.kind) {
    case 'scalar':
      return draft.input || '…';
    case 'range':
      return [draft.fromInput, draft.toInput].filter(Boolean).join(' and ') || '…';
    case 'duration':
      return draft.amountInput === '' ? '…' : `${draft.amountInput} ${draft.unit}`;
    case 'multiSelection':
      return draft.selectedOptions.join(', ') || '…';
  }
}

/** Aria-hidden preview used as the popover anchor while composing a new condition. */
export function FilterDraftPreview({
  editorState,
  field,
}: {
  editorState: FilterEditorState;
  field: FilterFieldDefinition | undefined;
}) {
  const isActiveDraft =
    editorState.stage !== 'idle' && editorState.stage !== 'field' && editorState.filterId === null;

  if (!isActiveDraft || !field) return null;
  return (
    <div aria-hidden="true" className="filter-chip filter-draft-preview" data-draft-preview="1">
      <span className="filter-draft-preview-field">{fieldLabel(field)}</span>
      <span className="filter-draft-preview-divider" />
      <span className="filter-draft-preview-operator">
        {editorState.stage === 'value' ? OPERATOR_LABELS[editorState.operator] : '…'}
      </span>
      <span className="filter-draft-preview-divider" />
      <span className="filter-draft-preview-value">{formatDraftPreview(editorState)}</span>
    </div>
  );
}

/** Resumable, uncommitted draft shown only while the editor is closed. */
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
  onResume: (anchor: HTMLButtonElement) => void;
  onDiscard: () => void;
}) {
  if (!incompleteDraft || !visible) return null;
  const label = field ? fieldLabel(field) : incompleteDraft.fieldKey;

  return (
    <div
      role="group"
      aria-label={`Incomplete filter: ${label}`}
      className="filter-chip filter-incomplete-draft-chip"
    >
      <button
        type="button"
        disabled={disabled}
        className="filter-incomplete-draft-resume"
        title="Finish this filter"
        onClick={(event) => onResume(event.currentTarget)}
      >
        <CircleDashed aria-hidden="true" size={13} />
        <span className="filter-incomplete-draft-field">{label}</span>
        <span className="filter-incomplete-draft-operator">
          {incompleteDraft.stage === 'value' ? OPERATOR_LABELS[incompleteDraft.operator] : '…'}
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
