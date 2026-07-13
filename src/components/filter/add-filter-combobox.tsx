import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import type { FilterFieldDefinition } from '@/types/filter.ts';

type AddFilterComboboxProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  idPrefix: string;
  disabled: boolean;
  lastFilterId: string | null;
  open: boolean;
  query: string;
  results: readonly FilterFieldDefinition[];
  activeIndex: number;
  canFocusTokens: boolean;
  onOpenMenu: (query: string) => void;
  onQueryChange: (query: string) => void;
  onNavigate: (delta: number) => void;
  onSelectActive: (field: FilterFieldDefinition) => void;
  onCloseMenu: () => void;
  onFocusLastToken: (id: string) => void;
};

/**
 * WAI-ARIA combobox for choosing a field. Typing or ArrowUp/ArrowDown opens the
 * popover listbox; focus stays on this input through aria-activedescendant.
 * Focus alone does not open it.
 */
export function AddFilterCombobox({
  inputRef,
  idPrefix,
  disabled,
  lastFilterId,
  open,
  query,
  results,
  activeIndex,
  canFocusTokens,
  onOpenMenu,
  onQueryChange,
  onNavigate,
  onSelectActive,
  onCloseMenu,
  onFocusLastToken,
}: AddFilterComboboxProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.value;
    if (open) onQueryChange(next);
    else onOpenMenu(next);
  };

  const handleNavigationKey = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (!open) {
      onOpenMenu(event.currentTarget.value);
      return;
    }
    if (results.length > 0) {
      onNavigate(event.key === 'ArrowDown' ? 1 : -1);
    }
  };

  const handleEscapeKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    event.preventDefault();
    // First press clears a non-empty query; the second closes the menu.
    if (query !== '') onQueryChange('');
    else onCloseMenu();
  };

  const handleTabKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (query !== '' && activeField) {
      // Tab accepts the highlighted suggestion once a query has been typed.
      event.preventDefault();
      onSelectActive(activeField);
      return;
    }
    onCloseMenu();
  };

  const handleTokenFocusKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.currentTarget.selectionStart !== 0 ||
      event.currentTarget.selectionEnd !== 0 ||
      lastFilterId === null ||
      !canFocusTokens
    ) {
      return;
    }
    event.preventDefault();
    onFocusLastToken(lastFilterId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        handleNavigationKey(event);
        return;
      case 'Enter':
        event.preventDefault();
        if (activeField) onSelectActive(activeField);
        return;
      case 'Escape':
        handleEscapeKey(event);
        return;
      case 'Tab':
        handleTabKey(event);
        return;
      case 'Backspace':
      case 'ArrowLeft':
        handleTokenFocusKey(event);
    }
  };

  const activeField = open ? results[activeIndex] : undefined;

  return (
    <input
      ref={inputRef}
      data-add-filter-input="1"
      role="combobox"
      aria-expanded={open}
      aria-controls={`${idPrefix}-fields`}
      aria-activedescendant={
        activeField ? `${idPrefix}-field-${activeIndex}` : undefined
      }
      aria-autocomplete="list"
      aria-label="Add filter"
      className="filter-add-input"
      placeholder={lastFilterId === null ? 'Filter by field…' : 'Add filter…'}
      value={open ? query : ''}
      disabled={disabled}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        // Option mousedown is prevented in the popover, so a real blur means
        // the user left the input — dismiss the suggestion menu.
        if (open) onCloseMenu();
      }}
    />
  );
}
