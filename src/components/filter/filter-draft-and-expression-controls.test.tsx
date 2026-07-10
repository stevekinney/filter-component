import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FilterDraftPreview,
  IncompleteDraftChip,
} from './filter-draft-chips.tsx';
import { FilterBracket, FilterJoiner } from './filter-expression-controls.tsx';
import { PopoverValidationError } from './filter-popover-error.tsx';
import type {
  FilterEditorState,
  IncompleteDraft,
} from './filter-editor-state.ts';
import type { ValueDraft } from '@/utilities/filter/value-drafts.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

const STRING_FIELD = {
  key: 'name',
  label: 'Name',
  type: 'string',
} as const satisfies FilterFieldDefinition;

describe('draft and error rendering branches', () => {
  const valueState = (
    draft: Extract<FilterEditorState, { stage: 'value' }>['draft'],
  ): FilterEditorState => ({
    stage: 'value',
    filterId: null,
    fieldKey: 'name',
    fieldType: 'string',
    operator: 'equals',
    draft,
    error: null,
    activeIndex: 0,
  });

  it('hides previews until a new field has been selected', () => {
    const view = render(
      <FilterDraftPreview
        editorState={{ stage: 'idle' }}
        field={STRING_FIELD}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(
      <FilterDraftPreview
        editorState={{
          stage: 'field',
          filterId: null,
          query: '',
          activeIndex: 0,
        }}
        field={STRING_FIELD}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(
      <FilterDraftPreview
        editorState={{
          stage: 'operator',
          filterId: 'condition-1',
          fieldKey: 'name',
          fieldType: 'string',
          activeIndex: 0,
        }}
        field={STRING_FIELD}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(
      <FilterDraftPreview
        editorState={{
          stage: 'operator',
          filterId: null,
          fieldKey: 'name',
          fieldType: 'string',
          activeIndex: 0,
        }}
        field={undefined}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it.each<[ValueDraft, string]>([
    [{ kind: 'scalar', input: '' }, '…'],
    [{ kind: 'scalar', input: 'Maria' }, 'Maria'],
    [{ kind: 'range', fromInput: '', toInput: '' }, '…'],
    [{ kind: 'range', fromInput: '1', toInput: '' }, '1'],
    [{ kind: 'range', fromInput: '', toInput: '2' }, '2'],
    [{ kind: 'range', fromInput: '1', toInput: '2' }, '1 and 2'],
    [{ kind: 'duration', amountInput: '', unit: 'days' }, '…'],
    [{ kind: 'duration', amountInput: '3', unit: 'weeks' }, '3 weeks'],
    [{ kind: 'multiSelection', selectedOptions: [] }, '…'],
    [
      {
        kind: 'multiSelection',
        selectedOptions: ['Lead', 'Won'],
      },
      'Lead, Won',
    ],
  ])('formats a %s draft preview', (draft, expected) => {
    render(
      <FilterDraftPreview
        editorState={valueState(draft)}
        field={STRING_FIELD}
      />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders the operator-stage preview before a value exists', () => {
    render(
      <FilterDraftPreview
        editorState={{
          stage: 'operator',
          filterId: null,
          fieldKey: 'name',
          fieldType: 'string',
          activeIndex: 0,
        }}
        field={STRING_FIELD}
      />,
    );
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('renders, resumes, discards, disables, and labels incomplete drafts', () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    const operatorDraft: IncompleteDraft = {
      stage: 'operator',
      fieldKey: 'name',
      fieldType: 'string',
    };
    const view = render(
      <IncompleteDraftChip
        incompleteDraft={null}
        field={STRING_FIELD}
        visible
        disabled={false}
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(
      <IncompleteDraftChip
        incompleteDraft={operatorDraft}
        field={STRING_FIELD}
        visible={false}
        disabled={false}
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(
      <IncompleteDraftChip
        incompleteDraft={operatorDraft}
        field={STRING_FIELD}
        visible
        disabled={false}
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );
    fireEvent.click(screen.getByTitle('Finish this filter'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard incomplete filter' }),
    );
    expect(onResume).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(screen.getByRole('group')).toHaveAccessibleName(
      'Incomplete filter: Name',
    );

    const valueDraft: IncompleteDraft = {
      stage: 'value',
      fieldKey: 'missing',
      fieldType: 'string',
      operator: 'contains',
      draft: { kind: 'scalar', input: 'x' },
    };
    view.rerender(
      <IncompleteDraftChip
        incompleteDraft={valueDraft}
        field={undefined}
        visible
        disabled
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByRole('group')).toHaveAccessibleName(
      'Incomplete filter: missing',
    );
    expect(screen.getByText('contains')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toSatisfy((buttons: HTMLElement[]) =>
      buttons.every((button) => button.hasAttribute('disabled')),
    );
  });

  it('renders validation errors only when present', () => {
    const view = render(<PopoverValidationError error={null} />);
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(<PopoverValidationError error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.getByRole('alert')).not.toHaveAttribute('id');
    view.rerender(<PopoverValidationError error="Required" id="error" />);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'error');
  });
});

describe('FilterJoiner and FilterBracket', () => {
  it.each([
    ['and', 'or'],
    ['or', 'and'],
  ] as const)(
    'flips %s and supports horizontal focus movement',
    (joiner, flipped) => {
      const onFlip = vi.fn();
      const onMoveFocus = vi.fn();
      render(
        <FilterJoiner
          index={2}
          joiner={joiner}
          disabled={false}
          onFlip={onFlip}
          onMoveFocus={onMoveFocus}
        />,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName(
        `Joined by ${joiner}. Switch to ${flipped} — grouping adjusts automatically.`,
      );
      fireEvent.click(button);
      fireEvent.keyDown(button, { key: 'ArrowLeft' });
      fireEvent.keyDown(button, { key: 'ArrowRight' });
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onFlip).toHaveBeenCalledOnce();
      expect(onMoveFocus).toHaveBeenNthCalledWith(1, -1);
      expect(onMoveFocus).toHaveBeenNthCalledWith(2, 1);
    },
  );

  it('renders both read-only bracket glyphs', () => {
    const { rerender } = render(<FilterBracket glyph="(" />);
    expect(screen.getByText('(')).toHaveAttribute('aria-hidden', 'true');
    rerender(<FilterBracket glyph=")" />);
    expect(screen.getByText(')')).toBeInTheDocument();
  });
});
