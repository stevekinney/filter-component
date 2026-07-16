import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_FILTER_EXPRESSION } from '@/utilities/filter/expression.ts';
import type { FilterExpression } from '@/utilities/filter/expression.ts';
import { createFilterFieldRegistry } from '@/utilities/filter/field-registry.ts';
import { createFilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterHistory, FilterHistoryAction } from '@/utilities/filter/history.ts';

import { createFilterEditorCommittedCommands } from '../filter-editor-committed-commands.ts';

const name = createFilterEntry(
  {
    fieldKey: 'name',
    type: 'string',
    operator: 'equals',
    value: 'Maria',
  },
  'name',
);
const secondName = createFilterEntry(
  {
    fieldKey: 'name',
    type: 'string',
    operator: 'equals',
    value: 'Nadia',
  },
  'second',
);
const stage = {
  fieldKey: 'stage',
  type: 'enum',
  operator: 'in',
  value: ['Lead', 'Won'],
  id: 'stage',
} satisfies FilterEntry;

const expression = (
  conditions: FilterEntry[],
  joiners: ('and' | 'or')[] = [],
): FilterExpression => ({ conditions, joiners });

describe('createFilterEditorCommittedCommands', () => {
  const fieldRegistry = createFilterFieldRegistry([
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'stage', label: 'Stage', type: 'enum', options: ['Lead', 'Won'] },
  ]);
  let currentFieldRegistry = fieldRegistry;
  let history: FilterHistory;
  let applyFilterHistoryAction: ReturnType<typeof vi.fn<(action: FilterHistoryAction) => boolean>>;
  let resetEditor: ReturnType<typeof vi.fn<() => void>>;
  let scheduleFocus: ReturnType<typeof vi.fn<(target: { type: string; id?: string }) => void>>;
  let announce: ReturnType<typeof vi.fn<(message: string) => void>>;

  beforeEach(() => {
    history = { past: [], present: EMPTY_FILTER_EXPRESSION, future: [] };
    currentFieldRegistry = fieldRegistry;
    applyFilterHistoryAction = vi.fn(() => true);
    resetEditor = vi.fn<() => void>();
    scheduleFocus = vi.fn<(target: { type: string; id?: string }) => void>();
    announce = vi.fn<(message: string) => void>();
  });

  const commands = () =>
    createFilterEditorCommittedCommands({
      getFieldRegistry: () => currentFieldRegistry,
      getCurrentHistory: () => history,
      applyFilterHistoryAction,
      createConditionId: () => 'created',
      resetEditor,
      scheduleFocus,
      announce,
    });

  it('ignores an unknown removal and focuses the closest surviving token', () => {
    commands().removeFilter('missing');
    expect(applyFilterHistoryAction).not.toHaveBeenCalled();

    history = {
      past: [],
      present: expression([name, secondName], ['or']),
      future: [],
    };
    commands().removeFilter('name');
    expect(scheduleFocus).toHaveBeenCalledWith({
      type: 'token',
      id: 'second',
    });
    expect(resetEditor).toHaveBeenCalled();
    expect(applyFilterHistoryAction).toHaveBeenCalledWith({
      type: 'remove',
      id: 'name',
    });
    expect(announce).toHaveBeenCalledWith('Filter removed: Name; grouping updated');
  });

  it('falls back to the add input and condition key, and skips a no-op announcement', () => {
    const missingField = { ...name, id: 'missing-field', fieldKey: 'removed' };
    history = {
      past: [],
      present: expression([missingField]),
      future: [],
    };
    commands().removeFilter('missing-field');
    expect(scheduleFocus).toHaveBeenCalledWith({ type: 'addInput' });
    expect(announce).toHaveBeenCalledWith('Filter removed: removed');

    applyFilterHistoryAction.mockReturnValue(false);
    announce.mockClear();
    commands().removeFilter('missing-field');
    expect(announce).not.toHaveBeenCalled();
  });

  it('removes one enum choice or the whole condition when none remain', () => {
    history = { past: [], present: expression([stage]), future: [] };
    commands().removeEnumValue('stage', 'Lead');
    expect(scheduleFocus).toHaveBeenCalledWith({
      type: 'token',
      id: 'stage',
    });
    expect(applyFilterHistoryAction).toHaveBeenCalledWith({
      type: 'update',
      id: 'stage',
      filter: expect.objectContaining({ value: ['Won'], id: 'stage' }),
    });
    expect(announce).toHaveBeenCalledWith('Lead removed from Stage filter');

    history = {
      past: [],
      present: expression([{ ...stage, value: ['Lead'] }]),
      future: [],
    };
    applyFilterHistoryAction.mockClear();
    commands().removeEnumValue('stage', 'Lead');
    expect(applyFilterHistoryAction).toHaveBeenCalledWith({
      type: 'remove',
      id: 'stage',
    });
  });

  it('guards non-enum and rejected enum updates', () => {
    history = { past: [], present: expression([name]), future: [] };
    commands().removeEnumValue('missing', 'Lead');
    commands().removeEnumValue('name', 'Lead');
    expect(applyFilterHistoryAction).not.toHaveBeenCalled();

    history = {
      past: [],
      present: expression([{ ...stage, fieldKey: 'removed-stage' }]),
      future: [],
    };
    commands().removeEnumValue('stage', 'Lead');
    expect(applyFilterHistoryAction).not.toHaveBeenCalled();

    history = {
      past: [],
      present: expression([{ ...stage, value: ['Lead', 'Removed'] }]),
      future: [],
    };
    commands().removeEnumValue('stage', 'Lead');
    expect(applyFilterHistoryAction).not.toHaveBeenCalled();

    currentFieldRegistry = createFilterFieldRegistry([
      {
        key: 'stage',
        type: 'enum',
        options: ['Lead', 'Won'],
        operators: ['equals'],
      },
    ]);
    history = { past: [], present: expression([stage]), future: [] };
    commands().removeEnumValue('stage', 'Lead');
    expect(applyFilterHistoryAction).not.toHaveBeenCalled();

    currentFieldRegistry = fieldRegistry;
    history = { past: [], present: expression([stage]), future: [] };
    applyFilterHistoryAction.mockReturnValue(false);
    commands().removeEnumValue('stage', 'Lead');
    expect(announce).not.toHaveBeenCalled();
  });

  it('clears, undoes, and redoes with focus and no-op guards', () => {
    const api = commands();
    api.clearAll();
    expect(resetEditor).toHaveBeenCalled();
    expect(scheduleFocus).toHaveBeenCalledWith({ type: 'addInput' });
    expect(announce).toHaveBeenCalledWith('All filters cleared');

    history = {
      past: [EMPTY_FILTER_EXPRESSION],
      present: expression([name]),
      future: [],
    };
    api.undo();
    expect(scheduleFocus).toHaveBeenCalledWith({ type: 'addInput' });
    expect(announce).toHaveBeenCalledWith('Undid last filter change');

    history = {
      past: [EMPTY_FILTER_EXPRESSION, expression([name])],
      present: expression([name, secondName], ['and']),
      future: [expression([name])],
    };
    api.undo();
    api.redo();
    expect(announce).toHaveBeenCalledWith('Redid filter change');

    history = {
      past: [],
      present: EMPTY_FILTER_EXPRESSION,
      future: [expression([name]), expression([name, secondName], ['and'])],
    };
    api.redo();

    applyFilterHistoryAction.mockReturnValue(false);
    announce.mockClear();
    api.clearAll();
    api.undo();
    api.redo();
    expect(announce).not.toHaveBeenCalled();
  });

  it('flips either joiner and ignores missing or rejected gaps', () => {
    const api = commands();
    api.flipJoiner(0);
    expect(applyFilterHistoryAction).not.toHaveBeenCalled();

    history = {
      past: [],
      present: expression([name, secondName], ['and']),
      future: [],
    };
    api.flipJoiner(0);
    expect(announce).toHaveBeenCalledWith('Filters combined with or; grouping updated');

    history = { ...history, present: expression([name, secondName], ['or']) };
    api.flipJoiner(0);
    expect(announce).toHaveBeenCalledWith('Filters combined with and; grouping updated');

    applyFilterHistoryAction.mockReturnValue(false);
    announce.mockClear();
    api.flipJoiner(0);
    expect(announce).not.toHaveBeenCalled();
  });
});
