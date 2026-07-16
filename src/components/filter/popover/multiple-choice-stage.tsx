import { Check, Square, SquareCheck, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { useActiveOptionScroll } from '@/utilities/hooks/use-active-option-scroll.ts';

import type { FilterFieldDefinition } from '@filter/types.ts';
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
