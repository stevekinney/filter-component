import { memo } from 'react';
import { describeAndRuns } from '@/utilities/filter/expression.ts';
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
  editingFilterId: string | null;
  editingSegment: TokenSegment | null;
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

type FilterTokenListItemProps = Omit<
  FilterTokenListProps,
  'expression' | 'editingFilterId'
> & {
  filter: FilterEntry;
  index: number;
  leadingJoiner: FilterExpression['joiners'][number] | undefined;
  previousFilterId: string | null;
  opensRun: boolean;
  closesRun: boolean;
  inAndRun: boolean;
};

/** Memoized so structurally shared conditions do not rerender. */
const FilterTokenListItem = memo(function FilterTokenListItem({
  filter,
  index,
  leadingJoiner,
  previousFilterId,
  opensRun,
  closesRun,
  inAndRun,
  fields,
  disabled,
  editingSegment,
  onOpenSegment,
  onRemove,
  onRemoveEnumValue,
  onFlipJoiner,
  onMoveFocusFromToken,
  onMoveFocusFromJoiner,
}: FilterTokenListItemProps) {
  return (
    <div role="listitem" className="filter-token-item">
      {leadingJoiner !== undefined && previousFilterId !== null && (
        <FilterJoiner
          index={index - 1}
          joiner={leadingJoiner}
          disabled={disabled}
          onFlip={() => onFlipJoiner(index - 1)}
          onMoveFocus={(direction) =>
            onMoveFocusFromJoiner(
              direction === 1 ? filter.id : previousFilterId,
            )
          }
        />
      )}
      {opensRun && <FilterBracket glyph="(" />}
      <FilterToken
        filter={filter}
        field={fields.find((candidate) => candidate.key === filter.fieldKey)}
        validationIssue={getFilterValidationIssue(filter, fields)}
        editingSegment={editingSegment}
        inAndRun={inAndRun}
        disabled={disabled}
        onOpenSegment={(segment, anchorElement) =>
          onOpenSegment(filter, segment, anchorElement)
        }
        onRemove={() => onRemove(filter.id)}
        onRemoveEnumValue={(value) => onRemoveEnumValue(filter.id, value)}
        onMoveFocus={(direction) => onMoveFocusFromToken(index, direction)}
      />
      {closesRun && <FilterBracket glyph=")" />}
    </div>
  );
});

/**
 * Renders committed conditions as list items; joiners and brackets are derived
 * from the flat joiner sequence.
 */
export function FilterTokenList({
  expression,
  fields,
  disabled,
  editingFilterId,
  editingSegment,
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
        const previousFilterId = previousFilter ? previousFilter.id : null;
        const opensRun = marker ? marker.opensRun : false;
        const closesRun = marker ? marker.closesRun : false;
        const inAndRun = marker ? marker.inRun : false;
        return (
          <FilterTokenListItem
            key={filter.id}
            filter={filter}
            index={index}
            leadingJoiner={leadingJoiner}
            previousFilterId={previousFilterId}
            opensRun={opensRun}
            closesRun={closesRun}
            inAndRun={inAndRun}
            fields={fields}
            disabled={disabled}
            editingSegment={
              editingFilterId === filter.id ? editingSegment : null
            }
            onOpenSegment={onOpenSegment}
            onRemove={onRemove}
            onRemoveEnumValue={onRemoveEnumValue}
            onFlipJoiner={onFlipJoiner}
            onMoveFocusFromToken={onMoveFocusFromToken}
            onMoveFocusFromJoiner={onMoveFocusFromJoiner}
          />
        );
      })}
    </div>
  );
}
