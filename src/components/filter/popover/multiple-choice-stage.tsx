import { Check, Square, SquareCheck, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { useActiveOptionScroll } from '@/utilities/hooks/use-active-option-scroll.ts';

import type { FilterFieldDefinition } from '@filter/types.ts';
import { enumOptionsForField } from '@filter/utilities/field-registry.ts';
import { clampIndex, stepIndex } from '@filter/utilities/list-navigation.ts';

import { PopoverValidationError } from './filter-popover-error.tsx';
import type { ActiveFilterEditorState, FilterPopoverProps } from './filter-popover.tsx';

function ChoiceCheckbox({ checked }: { checked: boolean }) {
  const Icon = checked ? SquareCheck : Square;

  return <Icon aria-hidden="true" size={15} className="filter-popover-checkbox" />;
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
  const options = field.type === 'enum' ? enumOptionsForField(field) : [];
  const selectedOptionValues =
    state.draft.kind === 'multiSelection' ? state.draft.selectedOptionValues : [];
  const activeIndex = clampIndex(state.activeIndex, options.length);
  const activeOptionKey = options[activeIndex]?.value;
  const listRef = useActiveOptionScroll(activeIndex, activeOptionKey);
  const errorId = `${idPrefix}-error`;
  const describedBy = state.error ? errorId : undefined;

  const toggleChoice = (optionValue: string) => {
    const nextSelectedOptionValues = selectedOptionValues.includes(optionValue)
      ? selectedOptionValues.filter((candidate) => candidate !== optionValue)
      : [...selectedOptionValues, optionValue];

    onChangeDraft({
      kind: 'multiSelection',
      selectedOptionValues: nextSelectedOptionValues,
    });

    onChangeActiveIndex(options.findIndex((option) => option.value === optionValue));
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

      if (active !== undefined) toggleChoice(active.value);
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
        aria-describedby={describedBy}
        className="filter-popover-list"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${idPrefix}-option-${index}`}
            role="option"
            aria-selected={selectedOptionValues.includes(option.value)}
            data-active={index === activeIndex ? '' : undefined}
            className="filter-popover-option"
            onClick={() => toggleChoice(option.value)}
            onMouseEnter={() => onChangeActiveIndex(index)}
          >
            <ChoiceCheckbox checked={selectedOptionValues.includes(option.value)} />
            <span className="filter-popover-option-label">{option.label}</span>
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
      <PopoverValidationError error={state.error} id={errorId} />
    </>
  );
}
