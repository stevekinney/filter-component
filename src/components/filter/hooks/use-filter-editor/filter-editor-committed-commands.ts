import type { FilterCondition, FilterOperator } from '@filter/types.ts';
import type { FilterFieldRegistry } from '@filter/utilities/field-registry.ts';
import { createFilterEntry } from '@filter/utilities/filter-entry.ts';
import { filterConditionSchema } from '@filter/utilities/filter-schema.ts';
import { enumValueLabel, fieldLabel, tokenPhrase } from '@filter/utilities/formatting.ts';
import type { FilterHistory, FilterHistoryAction } from '@filter/utilities/history.ts';
import { operatorsForField } from '@filter/utilities/operators.ts';
import { createFilterCondition, getFilterValidationIssue } from '@filter/utilities/validation.ts';

import type { FocusTarget } from '../use-filter-focus.ts';

type FilterEditorCommittedCommandsOptions = {
  getFieldRegistry: () => FilterFieldRegistry;
  getCurrentHistory: () => FilterHistory;
  applyFilterHistoryAction: (action: FilterHistoryAction) => boolean;
  createConditionId: () => string;
  resetEditor: () => void;
  scheduleFocus: (target: FocusTarget) => void;
  announce: (message: string) => void;
};

export function createFilterEditorCommittedCommands({
  getFieldRegistry,
  getCurrentHistory,
  applyFilterHistoryAction,
  createConditionId,
  resetEditor,
  scheduleFocus,
  announce,
}: FilterEditorCommittedCommandsOptions) {
  const commitFilter = (
    fieldKey: string,
    operator: FilterOperator,
    value: FilterCondition['value'],
    filterId: string | null,
  ) => {
    const fieldRegistry = getFieldRegistry();
    const field = fieldRegistry.byKey.get(fieldKey);

    if (!field || !operatorsForField(field).includes(operator)) return;

    const condition = createFilterCondition(field, operator, value);
    const validationEntry = createFilterEntry(condition, filterId ?? 'pending-filter');

    if (getFilterValidationIssue(validationEntry, fieldRegistry.fields)) return;

    resetEditor();

    if (filterId === null) {
      const filter = createFilterEntry(condition, createConditionId());

      scheduleFocus({ type: 'addInput' });
      if (applyFilterHistoryAction({ type: 'add', filter })) {
        announce(`Filter added: ${tokenPhrase(filter, field)}`);
      }
      return;
    }

    const filter = createFilterEntry(condition, filterId);

    scheduleFocus({ type: 'token', id: filterId });
    if (applyFilterHistoryAction({ type: 'update', id: filterId, filter })) {
      announce(`Filter updated: ${tokenPhrase(filter, field)}`);
    }
  };

  const removeFilter = (id: string) => {
    const history = getCurrentHistory();
    const filters = history.present.conditions;
    const index = filters.findIndex((candidate) => candidate.id === id);
    const token = filters[index];

    if (!token) return;

    const remaining = filters.filter((candidate) => candidate.id !== id);
    const neighbor = remaining[Math.min(index, remaining.length - 1)];

    scheduleFocus(neighbor ? { type: 'token', id: neighbor.id } : { type: 'addInput' });
    resetEditor();

    if (!applyFilterHistoryAction({ type: 'remove', id })) return;

    const field = getFieldRegistry().byKey.get(token.fieldKey);
    const label = field ? fieldLabel(field) : token.fieldKey;

    announce(
      history.present.joiners.includes('or')
        ? `Filter removed: ${label}; grouping updated`
        : `Filter removed: ${label}`,
    );
  };

  const removeEnumValue = (id: string, value: string) => {
    const token = getCurrentHistory().present.conditions.find((candidate) => candidate.id === id);

    if (!token || !Array.isArray(token.value)) return;

    const remaining = token.value.filter((candidate) => candidate !== value);

    if (remaining.length === 0) {
      removeFilter(id);
      return;
    }

    const { id: _id, ...publicCondition } = token;
    const parsedCondition = filterConditionSchema.safeParse({
      ...publicCondition,
      value: remaining,
    });

    if (!parsedCondition.success) return;

    const fieldRegistry = getFieldRegistry();
    const field = fieldRegistry.byKey.get(token.fieldKey);

    if (!field || field.type !== token.type || !operatorsForField(field).includes(token.operator)) {
      return;
    }

    const candidate = createFilterEntry(parsedCondition.data, id);

    scheduleFocus({ type: 'token', id });

    if (
      applyFilterHistoryAction({
        type: 'update',
        id,
        filter: candidate,
      })
    ) {
      announce(`${enumValueLabel(field, value)} removed from ${fieldLabel(field)} filter`);
    }
  };

  const clearAll = () => {
    resetEditor();
    scheduleFocus({ type: 'addInput' });

    if (applyFilterHistoryAction({ type: 'clear' })) {
      announce('All filters cleared');
    }
  };

  const undo = () => {
    resetEditor();

    if (getCurrentHistory().past.length === 1) {
      scheduleFocus({ type: 'addInput' });
    }
    if (applyFilterHistoryAction({ type: 'undo' })) {
      announce('Undid last filter change');
    }
  };

  const redo = () => {
    resetEditor();

    if (getCurrentHistory().future.length === 1) {
      scheduleFocus({ type: 'addInput' });
    }
    if (applyFilterHistoryAction({ type: 'redo' })) {
      announce('Redid filter change');
    }
  };

  const flipJoiner = (index: number) => {
    const joiner = getCurrentHistory().present.joiners[index];

    if (joiner === undefined) return;

    if (applyFilterHistoryAction({ type: 'flipJoiner', index })) {
      announce(`Filters combined with ${joiner === 'and' ? 'or' : 'and'}; grouping updated`);
    }
  };

  return {
    commitFilter,
    removeFilter,
    removeEnumValue,
    clearAll,
    undo,
    redo,
    flipJoiner,
  };
}
