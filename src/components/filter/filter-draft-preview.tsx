import type { FilterEditorState } from '@filter/hooks/use-filter-editor/index.ts';
import type { FilterFieldDefinition } from '@filter/types.ts';
import { fieldLabel } from '@filter/utilities/formatting.ts';
import { OPERATOR_LABELS } from '@filter/utilities/operators.ts';

function isActiveDraft(editorState: FilterEditorState): boolean {
  return (
    editorState.stage !== 'idle' && editorState.stage !== 'field' && editorState.filterId === null
  );
}

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
  if (!isActiveDraft(editorState) || !field) return null;

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
