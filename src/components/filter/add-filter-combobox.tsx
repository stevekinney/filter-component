import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { fieldOptionId } from '@/utilities/filter/dom-selectors.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

type AddFilterComboboxProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  idPrefix: string;
  disabled: boolean;
  lastFilterId: string | null;
  /** Whether the field suggestion menu is open. */
  open: boolean;
  query: string;
  results: readonly FilterFieldDefinition[];
  activeIndex: number;
  /** Whether Backspace/← at position 0 may move focus into the token row. */
  canFocusTokens: boolean;
  onOpenMenu: (query: string) => void;
  onQueryChange: (query: string) => void;
  onNavigate: (delta: number) => void;
  onSelectActive: (field: FilterFieldDefinition) => void;
  onCloseMenu: () => void;
  onFocusLastToken: (id: string) => void;
};

/**
 * The add-filter input — a combobox whose suggestion menu opens on typing or
 * ↑/↓, never on focus alone. The listbox itself renders in the popover; this
 * input drives it through aria-activedescendant and the callbacks here.
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
    onCloseMenu(); // Tab proceeds naturally with the menu closed
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
        activeField ? fieldOptionId(idPrefix, activeIndex) : undefined
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
