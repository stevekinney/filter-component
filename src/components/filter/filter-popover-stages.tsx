import { Check, Square, SquareCheck, X } from 'lucide-react';
import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import {
  OPERATOR_LABELS,
  booleanChoicesForField,
  operatorsForField,
} from '@/utilities/filter/operators.ts';
import { clampIndex, stepIndex } from '@/utilities/list-navigation.ts';
import { PopoverValidationError } from './filter-popover-error.tsx';
import type { ActiveFilterEditorState, FilterPopoverProps } from './filter-popover.tsx';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';
import { useActiveOptionScroll } from './use-active-option-scroll.ts';

function buildOperatorOrBooleanChoices(
  field: FilterFieldDefinition,
  editingFilter: FilterEntry | null,
): { value: string; label: string; selected: boolean }[] {
  if (field.type === 'boolean') {
    const selected =
      editingFilter?.operator === 'equals'
        ? String(editingFilter.value)
        : (editingFilter?.operator ?? null);

    return booleanChoicesForField(field).map((choice) => ({
      ...choice,
      selected: choice.value === selected,
    }));
  }

  return operatorsForField(field).map((operator) => ({
    value: operator,
    label: OPERATOR_LABELS[operator],
    selected: editingFilter?.operator === operator && editingFilter.fieldKey === field.key,
  }));
}

function SelectedChoiceCheck({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return <Check aria-hidden="true" size={14} className="filter-popover-check" />;
}

function ChoiceCheckbox({ checked }: { checked: boolean }) {
  const Icon = checked ? SquareCheck : Square;
  return <Icon aria-hidden="true" size={15} className="filter-popover-checkbox" />;
}

function FieldSearchInput({
  state,
  idPrefix,
  activeResult,
  activeIndex,
  onChangeQuery,
  onKeyDown,
}: {
  state: ActiveFilterEditorState & { stage: 'field' };
  idPrefix: string;
  activeResult: FilterFieldDefinition | undefined;
  activeIndex: number;
  onChangeQuery: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  if (state.filterId === null) return null;

  return (
    <div className="filter-popover-search">
      <input
        data-autofocus="1"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${idPrefix}-fields`}
        aria-activedescendant={activeResult ? `${idPrefix}-field-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-label="Search fields"
        placeholder="Search fields"
        value={state.query}
        onChange={(event) => onChangeQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

type FieldOptionRowProps = {
  field: FilterFieldDefinition;
  index: number;
  idPrefix: string;
  active: boolean;
  onChangeActiveIndex: (index: number) => void;
  onSelectField: (key: string) => void;
};

/** Memoized so navigation rerenders only rows whose active state changes. */
const FieldOptionRow = memo(function FieldOptionRow({
  field,
  index,
  idPrefix,
  active,
  onChangeActiveIndex,
  onSelectField,
}: FieldOptionRowProps) {
  return (
    <div
      id={`${idPrefix}-field-${index}`}
      role="option"
      aria-selected={active}
      data-active={active ? '' : undefined}
      className="filter-popover-option"
      onClick={() => onSelectField(field.key)}
      onMouseEnter={() => onChangeActiveIndex(index)}
    >
      <span className="filter-popover-option-label">{fieldLabel(field)}</span>
      <span className="filter-popover-option-hint">{field.type}</span>
    </div>
  );
});

export function FieldSelectionStage({
  state,
  fieldResults,
  idPrefix,
  onChangeQuery,
  onChangeActiveIndex,
  onSelectField,
}: FilterPopoverProps & {
  state: ActiveFilterEditorState & { stage: 'field' };
}) {
  const activeIndex = clampIndex(state.activeIndex, fieldResults.length);
  const activeResult = fieldResults[activeIndex];
  const listRef = useActiveOptionScroll(activeIndex, activeResult?.key);

  const handleNavigationKey = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (fieldResults.length === 0) return;
    const delta = event.key === 'ArrowDown' ? 1 : -1;

    onChangeActiveIndex(stepIndex(activeIndex, delta, fieldResults.length));
  };

  const handleTabKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.shiftKey || state.query === '' || !activeResult) return;
    // Tab accepts the highlighted suggestion once a query has been typed;
    // Shift+Tab keeps its native backward-focus meaning.
    event.preventDefault();
    onSelectField(activeResult.key);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        handleNavigationKey(event);
        return;
      case 'Enter':
        event.preventDefault();
        if (activeResult) onSelectField(activeResult.key);
        return;
      case 'Tab':
        handleTabKey(event);
    }
  };

  return (
    <>
      <FieldSearchInput
        state={state}
        idPrefix={idPrefix}
        activeResult={activeResult}
        activeIndex={activeIndex}
        onChangeQuery={onChangeQuery}
        onKeyDown={handleSearchKeyDown}
      />
      <div
        ref={listRef}
        id={`${idPrefix}-fields`}
        role="listbox"
        aria-label="Fields"
        className="filter-popover-list"
        onMouseDown={(event) => event.preventDefault()}
      >
        {fieldResults.map((field, index) => (
          <FieldOptionRow
            key={field.key}
            field={field}
            index={index}
            idPrefix={idPrefix}
            active={index === activeIndex}
            onChangeActiveIndex={onChangeActiveIndex}
            onSelectField={onSelectField}
          />
        ))}
        {fieldResults.length === 0 && (
          <div className="filter-popover-empty">No matching fields</div>
        )}
      </div>
    </>
  );
}

export function SingleChoiceStage(
  props: FilterPopoverProps & {
    state: ActiveFilterEditorState;
    heading: string;
    field: FilterFieldDefinition;
  },
) {
  const { state, field, heading, idPrefix, editingFilter, onChangeActiveIndex } = props;

  const options =
    state.stage === 'value'
      ? (field.options ?? []).map((option) => ({
          value: option,
          label: option,
          selected: state.draft.kind === 'scalar' && state.draft.input === option,
        }))
      : buildOperatorOrBooleanChoices(field, editingFilter);

  const activeIndex = clampIndex(state.activeIndex, options.length);
  const activeOptionKey = options[activeIndex]?.value;
  const listRef = useActiveOptionScroll(activeIndex, activeOptionKey);
  const selectChoice = (value: string) => {
    if (state.stage === 'operator' && field.type === 'boolean') {
      const choice = booleanChoicesForField(field).find((candidate) => candidate.value === value);

      if (choice) props.onPickBoolean(choice.value);
    } else if (state.stage === 'operator') {
      const operator = operatorsForField(field).find((candidate) => candidate === value);

      if (operator) props.onSelectOperator(operator);
    } else {
      props.onPickSingleValue(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      onChangeActiveIndex(stepIndex(activeIndex, delta, options.length));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const active = options[activeIndex];

      if (active) selectChoice(active.value);
    }
  };

  return (
    <>
      <div className="filter-popover-heading">{heading}</div>
      <div
        ref={listRef}
        data-autofocus="1"
        tabIndex={0}
        role="listbox"
        aria-label={heading}
        aria-activedescendant={options.length > 0 ? `${idPrefix}-option-${activeIndex}` : undefined}
        className="filter-popover-list"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${idPrefix}-option-${index}`}
            role="option"
            aria-selected={option.selected}
            data-active={index === activeIndex ? '' : undefined}
            className="filter-popover-option"
            onClick={() => selectChoice(option.value)}
            onMouseEnter={() => onChangeActiveIndex(index)}
          >
            <span className="filter-popover-option-label">{option.label}</span>
            <SelectedChoiceCheck selected={option.selected} />
          </div>
        ))}
      </div>
    </>
  );
}

export function MultipleChoiceStage(
  props: FilterPopoverProps & {
    heading: string;
    field: FilterFieldDefinition;
    state: ActiveFilterEditorState & { stage: 'value' };
  },
) {
  const {
    state,
    field,
    heading,
    idPrefix,
    onChangeDraft,
    onChangeActiveIndex,
    onCommitValue,
    onCancel,
  } = props;
  const options = field.options ?? [];
  const selectedOptions = state.draft.kind === 'multiSelection' ? state.draft.selectedOptions : [];
  const activeIndex = clampIndex(state.activeIndex, options.length);
  const activeOptionKey = options[activeIndex];
  const listRef = useActiveOptionScroll(activeIndex, activeOptionKey);
  const toggleChoice = (option: string) => {
    const nextSelectedOptions = selectedOptions.includes(option)
      ? selectedOptions.filter((candidate) => candidate !== option)
      : [...selectedOptions, option];

    onChangeDraft({
      kind: 'multiSelection',
      selectedOptions: nextSelectedOptions,
    });

    onChangeActiveIndex(options.indexOf(option));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;

      onChangeActiveIndex(stepIndex(activeIndex, delta, options.length));
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      const active = options[activeIndex];

      if (active !== undefined) toggleChoice(active);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onCommitValue();
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
      <div
        ref={listRef}
        data-autofocus="1"
        tabIndex={0}
        role="listbox"
        aria-multiselectable="true"
        aria-label={heading}
        aria-activedescendant={options.length > 0 ? `${idPrefix}-option-${activeIndex}` : undefined}
        className="filter-popover-list"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <div
            key={option}
            id={`${idPrefix}-option-${index}`}
            role="option"
            aria-selected={selectedOptions.includes(option)}
            data-active={index === activeIndex ? '' : undefined}
            className="filter-popover-option"
            onClick={() => toggleChoice(option)}
            onMouseEnter={() => onChangeActiveIndex(index)}
          >
            <ChoiceCheckbox checked={selectedOptions.includes(option)} />
            <span className="filter-popover-option-label">{option}</span>
          </div>
        ))}
      </div>
      <div className="filter-popover-footer">
        <button
          type="button"
          aria-label="Apply"
          title="Apply"
          className="filter-popover-footer-apply"
          onClick={onCommitValue}
        >
          <Check aria-hidden="true" size={14} />
        </button>
      </div>
      <PopoverValidationError error={state.error} />
    </>
  );
}
