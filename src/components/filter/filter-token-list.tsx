import { describeAndRuns } from '@/utilities/filter/expression.ts';
import { findField } from '@/utilities/filter/operators.ts';
import { getFilterValidationIssue } from '@/utilities/filter/validation.ts';
import { FilterBracket, FilterJoiner } from './filter-expression-controls.tsx';
import { FilterToken } from './filter-token.tsx';
import type { TokenSegment } from '@/utilities/filter/validation.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

type FilterTokenListProps = {
  expression: FilterExpression;
  fields: readonly FilterFieldDefinition[];
  disabled: boolean;
  /** Segment whose editor popover is open for the given token, if any. */
  editingSegmentFor: (id: string) => TokenSegment | null;
  onOpenSegment: (
    filter: FilterEntry,
    segment: TokenSegment,
    anchor: HTMLElement,
  ) => void;
  onRemove: (id: string) => void;
  onRemoveEnumValue: (id: string, value: string) => void;
  onFlipJoiner: (index: number) => void;
  onMoveFocusFromToken: (index: number, direction: -1 | 1) => void;
  onMoveFocusFromJoiner: (id: string) => void;
};

/**
 * The committed chips with the smart-joiners furniture between them: each
 * list slot carries the chip's leading joiner word (gap `index - 1`), the
 * opening bracket when the chip starts a ≥2-member and-run, and the closing
 * bracket when it ends one. Brackets derive from the joiner sequence and
 * appear only once an `or` joiner exists — the joiner flip is the only
 * structural gesture, so nothing here manages groups.
 */
export function FilterTokenList({
  expression,
  fields,
  disabled,
  editingSegmentFor,
  onOpenSegment,
  onRemove,
  onRemoveEnumValue,
  onFlipJoiner,
  onMoveFocusFromToken,
  onMoveFocusFromJoiner,
}: FilterTokenListProps) {
  const { conditions, joiners } = expression;
  const runMarkers = describeAndRuns(expression);

  return (
    /* `display: contents` keeps the tokens as flex children of the row while
       giving the list only listitem children, as its role requires — the
       add-filter input and row actions are not list items. */
    <div role="list" aria-label="Active filters" className="filter-token-list">
      {conditions.map((filter, index) => {
        const leadingJoiner = joiners[index - 1];
        const previousFilter = conditions[index - 1];
        const marker = runMarkers[index];
        return (
          <div key={filter.id} role="listitem" className="filter-token-item">
            {leadingJoiner !== undefined && previousFilter !== undefined && (
              <FilterJoiner
                index={index - 1}
                joiner={leadingJoiner}
                disabled={disabled}
                onFlip={() => onFlipJoiner(index - 1)}
                onMoveFocus={(direction) =>
                  onMoveFocusFromJoiner(
                    direction === 1 ? filter.id : previousFilter.id,
                  )
                }
              />
            )}
            {marker?.opensRun && <FilterBracket glyph="(" />}
            <FilterToken
              filter={filter}
              field={findField(fields, filter.fieldKey)}
              validationIssue={getFilterValidationIssue(filter, fields)}
              editingSegment={editingSegmentFor(filter.id)}
              inAndRun={marker?.inRun ?? false}
              disabled={disabled}
              onOpenSegment={(segment, anchorElement) =>
                onOpenSegment(filter, segment, anchorElement)
              }
              onRemove={() => onRemove(filter.id)}
              onRemoveEnumValue={(value) => onRemoveEnumValue(filter.id, value)}
              onMoveFocus={(direction) =>
                onMoveFocusFromToken(index, direction)
              }
            />
            {marker?.closesRun && <FilterBracket glyph=")" />}
          </div>
        );
      })}
    </div>
  );
}
