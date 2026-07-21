import { CircleDashed, X } from 'lucide-react';

import type { IncompleteDraft } from '@filter/hooks/use-filter-editor/index.ts';
import type { FilterFieldDefinition } from '@filter/types.ts';
import { fieldLabel } from '@filter/utilities/formatting.ts';
import { OPERATOR_LABELS } from '@filter/utilities/operators.ts';

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
