import { FilterX, Redo2, Undo2 } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { SavedViewsControls } from './filter-saved-views.tsx';
import type { SavedView } from '@/utilities/filter/saved-views.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

/** A round icon button in the filter row; renders nothing while unavailable. */
function RowActionButton(properties: {
  visible: boolean;
  disabled: boolean;
  destructive?: boolean;
  label: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const {
    visible,
    disabled,
    destructive: destructiveOption,
    label,
    title,
    onClick,
    children,
  } = properties;
  const destructive = destructiveOption ?? false;

  if (!visible) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      className={
        destructive ? 'filter-icon-button is-destructive' : 'filter-icon-button'
      }
      aria-label={label}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** The history cluster: undo and redo, each rendered only while available. */
function HistoryControls({
  canUndo,
  canRedo,
  disabled,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <>
      <RowActionButton
        visible={canUndo}
        disabled={disabled}
        label="Undo filter change"
        title="Undo"
        onClick={onUndo}
      >
        <Undo2 aria-hidden="true" size={18} />
      </RowActionButton>
      <RowActionButton
        visible={canRedo}
        disabled={disabled}
        label="Redo filter change"
        title="Redo"
        onClick={onRedo}
      >
        <Redo2 aria-hidden="true" size={18} />
      </RowActionButton>
    </>
  );
}

type FilterRailProps = {
  disabled: boolean;
  fields: readonly FilterFieldDefinition[];
  savedViews: SavedView[];
  canSaveCurrentGroup: boolean;
  currentGroupKey: string;
  onSaveView: (name: string) => void;
  onLoadView: (view: SavedView) => void;
  onRemoveView: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasFilters: boolean;
  onClearAll: () => void;
};

/**
 * The right-side action rail, pinned to the bottom-right of the control. Its
 * three clusters — saved views, history (undo/redo), and the destructive
 * clear — each appear only while available, ordered by how tightly they bind
 * to the query. (How conditions combine is no rail concern: the joiner words
 * between the chips own that.) A hairline divider precedes a cluster only
 * when an earlier cluster is also visible, so the divider count is always one
 * less than the number of visible clusters (a lone Clear shows none). The
 * rail never wraps internally: on a narrow row the input shrinks first while
 * the rail keeps its size.
 */
export function FilterRail({
  disabled,
  fields,
  savedViews,
  canSaveCurrentGroup,
  currentGroupKey,
  onSaveView,
  onLoadView,
  onRemoveView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasFilters,
  onClearAll,
}: FilterRailProps) {
  const viewsVisible = savedViews.length > 0 || canSaveCurrentGroup;
  const historyVisible = canUndo || canRedo;

  const clusters: ReactNode[] = [];
  if (viewsVisible) {
    clusters.push(
      <SavedViewsControls
        fields={fields}
        views={savedViews}
        canSaveCurrentGroup={canSaveCurrentGroup}
        currentGroupKey={currentGroupKey}
        disabled={disabled}
        onSaveView={onSaveView}
        onLoadView={onLoadView}
        onRemoveView={onRemoveView}
      />,
    );
  }
  if (historyVisible) {
    clusters.push(
      <HistoryControls
        canUndo={canUndo}
        canRedo={canRedo}
        disabled={disabled}
        onUndo={onUndo}
        onRedo={onRedo}
      />,
    );
  }
  if (hasFilters) {
    clusters.push(
      <RowActionButton
        visible
        disabled={disabled}
        destructive
        label="Clear all filters"
        title="Clear all filters"
        onClick={onClearAll}
      >
        <FilterX aria-hidden="true" size={18} />
      </RowActionButton>,
    );
  }

  if (clusters.length === 0) return null;

  return (
    <div className="filter-rail">
      {clusters.map((cluster, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="filter-rail-divider" aria-hidden="true" />
          )}
          {cluster}
        </Fragment>
      ))}
    </div>
  );
}
