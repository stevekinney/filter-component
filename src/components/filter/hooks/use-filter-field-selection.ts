import { useMemo } from 'react';

import type { FilterEditorState } from '@filter/hooks/use-filter-editor/index.ts';
import type { FilterFieldDefinition } from '@filter/types.ts';
import { searchFields } from '@filter/utilities/field-search.ts';
import { clampIndex } from '@filter/utilities/list-navigation.ts';

const NO_FIELD_RESULTS: readonly FilterFieldDefinition[] = [];

/**
 * Derives presentation state for field selection: the memoized search results,
 * the clamped active index, and whether the add-filter combobox owns the menu.
 */
export function useFilterFieldSelection(
  editorState: FilterEditorState,
  fields: readonly FilterFieldDefinition[],
) {
  const isChoosingFilterField = editorState.stage === 'field';
  const isChoosingNewFilterField = isChoosingFilterField && editorState.filterId === null;
  const fieldQuery = isChoosingFilterField ? editorState.query : null;

  const fieldResults = useMemo(
    () => (fieldQuery === null ? NO_FIELD_RESULTS : searchFields(fields, fieldQuery)),
    [fieldQuery, fields],
  );

  const matchingFields = isChoosingNewFilterField ? fieldResults : NO_FIELD_RESULTS;
  const activeFieldIndex = isChoosingNewFilterField
    ? clampIndex(editorState.activeIndex, matchingFields.length)
    : 0;

  let inputQuery = '';

  if (isChoosingNewFilterField && editorState.stage === 'field') {
    inputQuery = editorState.query;
  }

  return {
    activeFieldIndex,
    canFocusTokens: editorState.stage === 'idle' || editorState.filterId === null,
    fieldResults,
    inputQuery,
    isChoosingNewFilterField,
    matchingFields,
  };
}
