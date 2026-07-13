import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  EMPTY_FILTER_EXPRESSION,
  filterExpression,
  fromFilterGroup,
  toFilterGroup,
} from '@/utilities/filter/expression.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import { filterHistoryReducer } from '@/utilities/filter/history.ts';
import type { FilterHistory, FilterHistoryAction } from '@/utilities/filter/history.ts';
import { parseFilterGroup } from '@/utilities/filter/filter-schema.ts';
import { stableSerialize } from '@/utilities/filter/stable-serialize.ts';
import { getFilterValidationIssue } from '@/utilities/filter/validation.ts';
import type { FilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import type { FilterGroup } from '@/types/filter.ts';

type UseFilterHistoryResult = {
  history: FilterHistory;
  getCurrentHistory: () => FilterHistory;
  applyFilterHistoryAction: (action: FilterHistoryAction) => boolean;
};

function deriveValidGroup(
  expression: FilterExpression,
  fields: FilterFieldRegistry['fields'],
): FilterGroup {
  return toFilterGroup(
    filterExpression(
      expression,
      (condition) => getFilterValidationIssue(condition, fields) === null,
    ),
  );
}

export function useFilterHistory(
  fieldRegistry: FilterFieldRegistry,
  onChange: ((filters: FilterGroup, abortController: AbortController) => void) | undefined,
  initialFilters: FilterGroup | undefined,
  createConditionId: () => string,
): UseFilterHistoryResult {
  const [history, setHistory] = useState<FilterHistory>(() => {
    const present = initialFilters
      ? fromFilterGroup(parseFilterGroup(initialFilters, 'initialFilters'), createConditionId)
      : EMPTY_FILTER_EXPRESSION;

    return { past: [], present, future: [] };
  });

  const historyRef = useRef(history);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onChangeRef = useRef(onChange);
  const fieldsRef = useRef(fieldRegistry.fields);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    fieldsRef.current = fieldRegistry.fields;
  }, [fieldRegistry, onChange]);

  const [initialNotifiedGroupKey] = useState(() =>
    stableSerialize(deriveValidGroup(history.present, fieldRegistry.fields)),
  );

  const lastNotifiedGroupKeyRef = useRef(initialNotifiedGroupKey);

  const notifyFiltersChange = (validGroup: FilterGroup) => {
    lastNotifiedGroupKeyRef.current = stableSerialize(validGroup);
    abortControllerRef.current?.abort();
    const abortController = new AbortController();

    abortControllerRef.current = abortController;
    onChangeRef.current?.(validGroup, abortController);
  };

  const applyFilterHistoryAction = (action: FilterHistoryAction): boolean => {
    const current = historyRef.current;
    const next = filterHistoryReducer(current, action);

    if (next === current) return false;
    historyRef.current = next;
    setHistory(next);
    notifyFiltersChange(deriveValidGroup(next.present, fieldsRef.current));

    return true;
  };

  useEffect(() => {
    const validGroup = deriveValidGroup(historyRef.current.present, fieldsRef.current);
    if (stableSerialize(validGroup) === lastNotifiedGroupKeyRef.current) return;

    notifyFiltersChange(validGroup);
  }, [fieldRegistry.signature]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  return {
    history,
    getCurrentHistory: () => historyRef.current,
    applyFilterHistoryAction,
  };
}
