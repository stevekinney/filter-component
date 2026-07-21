import { memo } from 'react';
import type { KeyboardEvent } from 'react';

import { useActiveOptionScroll } from '@/utilities/hooks/use-active-option-scroll.ts';

import type { FilterFieldDefinition } from '@filter/types.ts';
import { fieldLabel } from '@filter/utilities/formatting.ts';
import { clampIndex, stepIndex } from '@filter/utilities/list-navigation.ts';

import type { ActiveFilterEditorState, FilterPopoverProps } from './filter-popover.tsx';

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
