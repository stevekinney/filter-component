import { Check } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { useActiveOptionScroll } from '@/utilities/hooks/use-active-option-scroll.ts';

import type { FilterFieldDefinition } from '@filter/types.ts';
import type { FilterEntry } from '@filter/utilities/filter-entry.ts';
import { clampIndex, stepIndex } from '@filter/utilities/list-navigation.ts';
import {
  booleanChoicesForField,
  OPERATOR_LABELS,
  operatorsForField,
} from '@filter/utilities/operators.ts';

import type { ActiveFilterEditorState, FilterPopoverProps } from './filter-popover.tsx';

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
