import type { FilterFieldType, FilterOperator } from '@/types/filter.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { TokenSegment } from '@/utilities/filter/validation.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';

/**
 * The filter editor's state machine. Explicit stages instead of boolean
 * flags: `field` → `operator` → `value` while creating a condition, and the
 * same stages with a non-null `filterId` while editing an existing token's
 * segment.
 * Everything here is transient — none of it enters the undoable history, and
 * no transition can commit an invalid filter (commits go through
 * `validateDraft` first).
 *
 * Positioning is not modelled here: the popover anchors to the invoking
 * element through the native Popover API (`showPopover({ source })`), and the
 * invoker is tracked as an element reference outside this serializable state.
 *
 * Boolean fields collapse `operator` + `value` into a single list rendered at
 * the `operator` stage (is true / is false / is empty / is not empty).
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
      /**
       * Which token segment opened this stage. Boolean fields collapse both
       * the operator and value segments into this one list, so focus must
       * return to whichever segment the user actually came from.
       */
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

/**
 * The token segment an active editor stage points at — where focus should
 * land when the popover closes, and which segment renders as being edited.
 * Boolean fields collapse operator + value into the operator stage, so the
 * stage alone is not enough; `sourceSegment` breaks the tie.
 */
export function activeEditorSegment(
  state: Exclude<FilterEditorState, { stage: 'idle' }>,
): TokenSegment {
  if (state.stage === 'field') return 'field';
  if (state.stage === 'operator') return state.sourceSegment ?? 'operator';
  return 'value';
}

/**
 * The committed condition an active editor stage is editing, or null while
 * idle or composing a new condition (`filterId === null`).
 */
export function findEditingFilter(
  state: FilterEditorState,
  filters: readonly FilterEntry[],
): FilterEntry | null {
  if (state.stage === 'idle' || state.filterId === null) return null;
  return filters.find((candidate) => candidate.id === state.filterId) ?? null;
}

/**
 * A mid-composition draft abandoned by clicking away: kept as a dismissible
 * incomplete-draft chip rather than silently discarded. Never emitted through
 * `onChange` and never entered into history.
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
