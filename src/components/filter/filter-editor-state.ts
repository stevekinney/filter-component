import type { FilterFieldType, FilterOperator } from '@/types/filter.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { TokenSegment } from '@/utilities/filter/validation.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';

/**
 * Transient editor state. Creation progresses field → operator → value;
 * boolean fields collapse operator and value into one stage. Committed filters
 * live in history, not here.
 */
export type FilterEditorState =
  | { stage: 'idle' }
  | {
      stage: 'field';
      filterId: string | null;
      query: string;
      activeIndex: number;
    }
  | {
      stage: 'operator';
      filterId: string | null;
      fieldKey: string;
      fieldType: FilterFieldType;
      activeIndex: number;
      /** Segment that opened a collapsed boolean editor, used to restore focus. */
      sourceSegment?: 'operator' | 'value';
    }
  | {
      stage: 'value';
      filterId: string | null;
      fieldKey: string;
      fieldType: FilterFieldType;
      operator: FilterOperator;
      draft: ValueDraft;
      error: string | null;
      activeIndex: number;
    };

export const IDLE_FILTER_EDITOR_STATE: FilterEditorState = { stage: 'idle' };

/** Returns the segment that owns active styling and close-time focus. */
export function activeEditorSegment(
  state: Exclude<FilterEditorState, { stage: 'idle' }>,
): TokenSegment {
  if (state.stage === 'field') return 'field';
  if (state.stage === 'operator') return state.sourceSegment ?? 'operator';
  return 'value';
}

export function findEditingFilter(
  state: FilterEditorState,
  filters: readonly FilterEntry[],
): FilterEntry | null {
  if (state.stage === 'idle' || state.filterId === null) return null;
  return filters.find((candidate) => candidate.id === state.filterId) ?? null;
}

/**
 * Dismissed composition state that is resumable but never emitted or recorded
 * in history.
 */
export type IncompleteDraft =
  | {
      stage: 'operator';
      fieldKey: string;
      fieldType: FilterFieldType;
    }
  | {
      stage: 'value';
      fieldKey: string;
      fieldType: FilterFieldType;
      operator: FilterOperator;
      draft: ValueDraft;
    };
