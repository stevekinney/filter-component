import { Check, Trash2 } from 'lucide-react';
import { memo } from 'react';
import type { Dispatch, KeyboardEvent } from 'react';

import type { FilterCondition, FilterFieldDefinition, FilterGroup } from '@/types/filter.ts';
import { fieldLabel } from '@/utilities/filter/formatting.ts';
import { savedViewKey } from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import { stepIndex } from '@/utilities/list-navigation.ts';

function leafConditions(group: FilterGroup): FilterCondition[] {
  return group.conditions.flatMap((member) =>
    'combinator' in member ? leafConditions(member) : [member],
  );
}

/**
 * Summarizes leaf count, meaningful root combinator, and distinct field labels;
 * missing definitions fall back to field keys.
 */
function savedViewSummary(view: SavedView, fields: readonly FilterFieldDefinition[]): string {
  const { combinator } = view.group;
  const leaves = leafConditions(view.group);
  const labels: string[] = [];

  for (const condition of leaves) {
    const field = fields.find((candidate) => candidate.key === condition.fieldKey);
    const label = field ? fieldLabel(field) : condition.fieldKey;

    if (!labels.includes(label)) labels.push(label);
  }
  const count = leaves.length;
  const parts = [`${count} filter${count === 1 ? '' : 's'}`];

  if (count > 1) parts.push(combinator === 'or' ? 'Any' : 'All');
  if (labels.length > 0) parts.push(labels.join(', '));

  return parts.join(' · ');
}

type CloseSavedViewsMenuAction = { type: 'close' };

type SavedViewsListProps = {
  fields: readonly FilterFieldDefinition[];
  views: readonly SavedView[];
  currentGroupKey: string;
  autofocusIndex: number;
  dispatchMenu: Dispatch<CloseSavedViewsMenuAction>;
  onLoadView: (view: SavedView) => void;
  onRemoveView: (name: string) => void;
};

/** Memoized so editing a save-name draft does not rerender unchanged view rows. */
export const SavedViewsList = memo(function SavedViewsList({
  fields,
  views,
  currentGroupKey,
  autofocusIndex,
  dispatchMenu,
  onLoadView,
  onRemoveView,
}: SavedViewsListProps) {
  const removeView = (view: SavedView) => {
    if (views.length === 1) dispatchMenu({ type: 'close' });
    onRemoveView(view.name);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const rows = Array.from(event.currentTarget.children).filter(
      (child): child is HTMLLIElement => child instanceof HTMLLIElement,
    );

    if (rows.length === 0) return;

    // Keyboard events dispatched through this list originate on the list or
    // one of its focusable HTMLElement descendants.
    const target = event.target as HTMLElement;
    const row = target.closest('li');
    const index = Math.max(0, row === null ? 0 : rows.indexOf(row));

    const focusViewAt = (rowIndex: number) =>
      rows[rowIndex]?.querySelector<HTMLElement>('[data-saved-view-item]')?.focus();

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        focusViewAt(stepIndex(index, event.key === 'ArrowDown' ? 1 : -1, rows.length));
        return;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        focusViewAt(event.key === 'Home' ? 0 : rows.length - 1);
        return;
      }
      case 'ArrowRight': {
        event.preventDefault();
        rows[index]?.querySelector<HTMLElement>('[data-saved-view-remove]')?.focus();
        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        focusViewAt(index);
        return;
      }
      case 'Delete':
      case 'Backspace': {
        event.preventDefault();
        const view = views[index];

        if (view !== undefined) removeView(view);
        return;
      }
    }
  };

  return (
    <ul className="filter-popover-list filter-saved-views-list" onKeyDown={handleMenuKeyDown}>
      {views.map((view, index) => {
        const isActive = savedViewKey(view.group) === currentGroupKey;

        return (
          <li
            key={view.name}
            className={isActive ? 'filter-saved-views-item is-active' : 'filter-saved-views-item'}
          >
            <button
              type="button"
              data-saved-view-item={index}
              data-autofocus={index === autofocusIndex ? '1' : undefined}
              className="filter-saved-views-load"
              title="Load this view"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => {
                dispatchMenu({ type: 'close' });
                onLoadView(view);
              }}
            >
              <span className="filter-saved-views-check" aria-hidden="true">
                {isActive && <Check size={16} />}
              </span>
              <span className="filter-saved-views-text">
                <span className="filter-saved-views-name">{view.name}</span>
                <span className="filter-saved-views-summary" aria-hidden="true">
                  {savedViewSummary(view, fields)}
                </span>
              </span>
            </button>
            <button
              type="button"
              data-saved-view-remove="1"
              className="filter-saved-views-remove"
              aria-label={`Remove view: ${view.name}`}
              title="Remove this view"
              onClick={() => removeView(view)}
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </li>
        );
      })}
    </ul>
  );
});
