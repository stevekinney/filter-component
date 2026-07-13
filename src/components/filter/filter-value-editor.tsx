import { Check, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { WITHIN_LAST_UNITS } from '@/utilities/filter/validation.ts';
import { PopoverValidationError } from './filter-popover-error.tsx';
import type { ValueEditorKind } from '@/utilities/filter/operators.ts';
import type { FilterEditorState } from './filter-editor-state.ts';
import type {
  DurationValueDraft,
  RangeValueDraft,
  ScalarValueDraft,
  ValueDraft,
} from '@/utilities/filter/value-drafts.ts';

type ValueEditorState = FilterEditorState & { stage: 'value' };
type InputKeyDownHandler = (event: KeyboardEvent<HTMLElement>) => void;

type FilterValueEditorProps = {
  state: ValueEditorState;
  heading: string;
  kind: ValueEditorKind;
  idPrefix: string;
  onDraftChange: (draft: ValueDraft) => void;
  onCommitValue: () => void;
  onCancel: () => void;
};

function ScalarValueInput({
  kind,
  draft,
  describedBy,
  onDraftChange,
  onKeyDown,
}: {
  kind: 'text' | 'number' | 'date';
  draft: ScalarValueDraft;
  describedBy: string | undefined;
  onDraftChange: (draft: ScalarValueDraft) => void;
  onKeyDown: InputKeyDownHandler;
}) {
  const inputType = kind === 'text' ? 'text' : kind;

  return (
    <input
      data-autofocus="1"
      type={inputType}
      aria-label="Value"
      aria-describedby={describedBy}
      placeholder="Value"
      value={draft.input}
      onChange={(event) => onDraftChange({ ...draft, input: event.target.value })}
      onKeyDown={onKeyDown}
    />
  );
}

function RangeValueInputs({
  kind,
  draft,
  describedBy,
  onDraftChange,
  onKeyDown,
}: {
  kind: 'numberRange' | 'dateRange';
  draft: RangeValueDraft;
  describedBy: string | undefined;
  onDraftChange: (draft: RangeValueDraft) => void;
  onKeyDown: InputKeyDownHandler;
}) {
  const inputType = kind === 'numberRange' ? 'number' : 'date';

  return (
    <>
      <input
        data-autofocus="1"
        type={inputType}
        aria-label="From"
        aria-describedby={describedBy}
        value={draft.fromInput}
        onChange={(event) => onDraftChange({ ...draft, fromInput: event.target.value })}
        onKeyDown={onKeyDown}
      />
      <span aria-hidden="true" className="filter-value-joiner">
        and
      </span>
      <input
        type={inputType}
        aria-label="To"
        aria-describedby={describedBy}
        value={draft.toInput}
        onChange={(event) => onDraftChange({ ...draft, toInput: event.target.value })}
        onKeyDown={onKeyDown}
      />
    </>
  );
}

function DurationValueInputs({
  draft,
  describedBy,
  onDraftChange,
  onKeyDown,
}: {
  draft: DurationValueDraft;
  describedBy: string | undefined;
  onDraftChange: (draft: DurationValueDraft) => void;
  onKeyDown: InputKeyDownHandler;
}) {
  return (
    <>
      <input
        data-autofocus="1"
        type="number"
        min={1}
        aria-label="Amount"
        aria-describedby={describedBy}
        placeholder="7"
        className="filter-value-amount"
        value={draft.amountInput}
        onChange={(event) => onDraftChange({ ...draft, amountInput: event.target.value })}
        onKeyDown={onKeyDown}
      />
      <select
        aria-label="Unit"
        className="filter-value-unit"
        value={draft.unit}
        onChange={(event) => {
          const unit = WITHIN_LAST_UNITS.find((candidate) => candidate === event.target.value);

          if (unit) onDraftChange({ ...draft, unit });
        }}
        onKeyDown={onKeyDown}
      >
        {WITHIN_LAST_UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </>
  );
}

function ValueControls({
  state,
  kind,
  describedBy,
  onDraftChange,
  onKeyDown,
}: Pick<FilterValueEditorProps, 'state' | 'kind' | 'onDraftChange'> & {
  describedBy: string | undefined;
  onKeyDown: InputKeyDownHandler;
}) {
  switch (state.draft.kind) {
    case 'scalar':
      if (kind !== 'text' && kind !== 'number' && kind !== 'date') return null;
      return (
        <ScalarValueInput
          kind={kind}
          draft={state.draft}
          describedBy={describedBy}
          onDraftChange={onDraftChange}
          onKeyDown={onKeyDown}
        />
      );
    case 'range':
      if (kind !== 'numberRange' && kind !== 'dateRange') return null;
      return (
        <RangeValueInputs
          kind={kind}
          draft={state.draft}
          describedBy={describedBy}
          onDraftChange={onDraftChange}
          onKeyDown={onKeyDown}
        />
      );
    case 'duration':
      if (kind !== 'duration') return null;
      return (
        <DurationValueInputs
          draft={state.draft}
          describedBy={describedBy}
          onDraftChange={onDraftChange}
          onKeyDown={onKeyDown}
        />
      );
    case 'multiSelection':
      return null;
  }
}

export function FilterValueEditor({
  state,
  heading,
  kind,
  idPrefix,
  onDraftChange,
  onCommitValue,
  onCancel,
}: FilterValueEditorProps) {
  const errorId = `${idPrefix}-error`;
  const describedBy = state.error ? errorId : undefined;

  const handleInputKeyDown: InputKeyDownHandler = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommitValue();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <>
      <div className="filter-popover-header">
        <div className="filter-popover-heading">{heading}</div>
        <button type="button" aria-label="Cancel" className="filter-icon-button" onClick={onCancel}>
          <X aria-hidden="true" size={13} />
        </button>
      </div>
      <div className="filter-popover-body">
        <div className="filter-value-editor-controls">
          <ValueControls
            state={state}
            kind={kind}
            describedBy={describedBy}
            onDraftChange={onDraftChange}
            onKeyDown={handleInputKeyDown}
          />
          <button
            type="button"
            aria-label="Apply"
            title="Apply"
            className="filter-value-editor-apply"
            onClick={onCommitValue}
          >
            <Check aria-hidden="true" size={14} />
          </button>
        </div>
        <PopoverValidationError error={state.error} id={errorId} />
      </div>
    </>
  );
}
