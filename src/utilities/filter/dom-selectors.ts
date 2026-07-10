import type { TokenSegment } from './validation.ts';

/**
 * The component's DOM hooks in one place. Focus management works through
 * `querySelector`, so producers (the JSX that sets `data-*` attributes) and
 * consumers agree on names. Focus restoration itself uses semantic targets
 * rather than serializing external values into selectors.
 */

/** Autofocus target inside a freshly opened popover. */
export const AUTOFOCUS_ATTRIBUTE = 'data-autofocus';
export const AUTOFOCUS_SELECTOR = `[${AUTOFOCUS_ATTRIBUTE}]`;

/** The add-filter combobox input. */
export const ADD_FILTER_INPUT_ATTRIBUTE = 'data-add-filter-input';
export const ADD_FILTER_INPUT_SELECTOR = `[${ADD_FILTER_INPUT_ATTRIBUTE}]`;

/** A committed token root. */
export const TOKEN_ATTRIBUTE = 'data-token';
export const TOKEN_SELECTOR = `[${TOKEN_ATTRIBUTE}]`;

/** A semantic field, operator, value, or remove control inside a token. */
export const TOKEN_SEGMENT_ATTRIBUTE = 'data-token-segment';
export const TOKEN_SEGMENT_SELECTOR = `[${TOKEN_SEGMENT_ATTRIBUTE}]`;

/** The joiner button between two adjacent tokens. */
export const JOINER_ATTRIBUTE = 'data-joiner';

/** The incomplete-draft chip. */
export const INCOMPLETE_DRAFT_SELECTOR = '[data-incomplete-draft]';

/** The aria-hidden draft preview that builds up while composing. */
export const DRAFT_PREVIEW_SELECTOR = '[data-draft-preview]';

/** The single bookmarks button that opens the saved-views menu. */
export const SAVED_VIEWS_BUTTON_ATTRIBUTE = 'data-saved-views-button';
export const SAVED_VIEWS_BUTTON_SELECTOR = `[${SAVED_VIEWS_BUTTON_ATTRIBUTE}]`;

/** A saved view's load button; scope queries to one menu row. */
export const SAVED_VIEW_ITEM_ATTRIBUTE = 'data-saved-view-item';
export const SAVED_VIEW_ITEM_SELECTOR = `[${SAVED_VIEW_ITEM_ATTRIBUTE}]`;

/** A saved view's remove button; scope queries to one menu row. */
export const SAVED_VIEW_REMOVE_SELECTOR = '[data-saved-view-remove]';

/** DOM-safe option id; injected field keys never become IDREF tokens. */
export function fieldOptionId(idPrefix: string, index: number): string {
  return `${idPrefix}-field-${index}`;
}

/** The `data-token-segment` attribute value for a segment button. */
export function segmentAttribute(segment: TokenSegment | 'remove'): string {
  return segment;
}
