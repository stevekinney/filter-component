import clsx from 'clsx';
import { TriangleAlert, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import type { FilterFieldDefinition } from '@filter/types.ts';
import type { FilterEntry } from '@filter/utilities/filter-entry.ts';
import { fieldLabel, formatFilterValue, tokenPhrase } from '@filter/utilities/formatting.ts';
import { getValueEditorKind, OPERATOR_LABELS } from '@filter/utilities/operators.ts';
import type { FilterValidationIssue, TokenSegment } from '@filter/utilities/validation.ts';

type SegmentHandler = (segment: TokenSegment, anchor: HTMLElement) => void;

type FilterTokenProps = {
  filter: FilterEntry;
  field: FilterFieldDefinition | undefined;
  validationIssue: FilterValidationIssue | null;
  editingSegment: TokenSegment | null;
  inAndRun: boolean;
  disabled: boolean;
  onOpenSegment: SegmentHandler;
  onRemove: () => void;
  onRemoveEnumValue: (value: string) => void;
  onMoveFocus: (direction: -1 | 1) => void;
};

function handleTokenArrowDown(
  event: KeyboardEvent<HTMLDivElement>,
  tokenElement: HTMLDivElement,
  target: HTMLElement,
  isTokenRootTarget: boolean,
) {
  event.preventDefault();
  if (isTokenRootTarget) {
    tokenElement.querySelector('button')?.focus();
    return;
  }

  // Only editor-opening controls respond to ArrowDown. The remove
  // buttons are destructive and keep their two-step Delete safety net —
  // ArrowDown must never trigger them.
  const segment = target.dataset['tokenSegment'];
  const opensAnEditor = segment !== undefined && segment !== 'remove';

  if (opensAnEditor) target.click();
}

function moveWithinToken(
  tokenElement: HTMLDivElement,
  target: HTMLElement,
  direction: -1 | 1,
  onMoveFocus: (direction: -1 | 1) => void,
) {
  const tokenButtons = Array.from(tokenElement.querySelectorAll('button'));
  const nextIndex = tokenButtons.indexOf(target as HTMLButtonElement) + direction;

  if (nextIndex < 0) {
    tokenElement.focus();
  } else if (nextIndex >= tokenButtons.length) {
    onMoveFocus(1);
  } else {
    tokenButtons[nextIndex]?.focus();
  }
}

function handleTokenTraversal(
  event: KeyboardEvent<HTMLDivElement>,
  tokenElement: HTMLDivElement,
  target: HTMLElement,
  isTokenRootTarget: boolean,
  onMoveFocus: (direction: -1 | 1) => void,
): boolean {
  if (event.key === 'Tab') {
    if (!isTokenRootTarget) {
      event.preventDefault();
      moveWithinToken(tokenElement, target, event.shiftKey ? -1 : 1, onMoveFocus);
    }

    return true;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;

  event.preventDefault();
  const direction = event.key === 'ArrowLeft' ? -1 : 1;

  if (isTokenRootTarget) {
    onMoveFocus(direction);
  } else {
    moveWithinToken(tokenElement, target, direction, onMoveFocus);
  }

  return true;
}

function ValidationWarningButton({
  validationIssue,
  disabled,
  onOpenSegment,
}: {
  validationIssue: FilterValidationIssue | null;
  disabled: boolean;
  onOpenSegment: SegmentHandler;
}) {
  if (!validationIssue) return null;
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      className="filter-token-warning"
      aria-label={`Fix invalid filter: ${validationIssue.reason}`}
      title={validationIssue.reason}
      onClick={(event) => {
        const tokenElement = event.currentTarget.closest<HTMLElement>('[data-token]');

        onOpenSegment(validationIssue.segment, tokenElement ?? event.currentTarget);
      }}
    >
      <TriangleAlert aria-hidden="true" size={14} />
    </button>
  );
}

function EnumValuePills({
  values,
  fieldLabelText,
  segmentClassName,
  disabled,
  onOpenSegment,
  onRemoveEnumValue,
}: {
  values: string[];
  fieldLabelText: string;
  segmentClassName: string;
  disabled: boolean;
  onOpenSegment: SegmentHandler;
  onRemoveEnumValue: (value: string) => void;
}) {
  return (
    <span className={clsx(segmentClassName, 'filter-token-pills')}>
      {values.map((value, index) => (
        <span key={value} className="filter-token-pill">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="filter-token-pill-label"
            data-token-segment={index === 0 ? 'value' : undefined}
            title="Change values"
            onClick={(event) => onOpenSegment('value', event.currentTarget)}
          >
            {value}
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="filter-token-pill-remove"
            aria-label={`Remove ${value} from ${fieldLabelText} filter`}
            onClick={() => onRemoveEnumValue(value)}
          >
            <X aria-hidden="true" size={11} />
          </button>
        </span>
      ))}
    </span>
  );
}

function TokenValueSegment({
  filter,
  field,
  fieldLabelText,
  segmentClassName,
  disabled,
  onOpenSegment,
  onRemoveEnumValue,
}: {
  filter: FilterEntry;
  field: FilterFieldDefinition | undefined;
  fieldLabelText: string;
  segmentClassName: string;
  disabled: boolean;
  onOpenSegment: SegmentHandler;
  onRemoveEnumValue: (value: string) => void;
}) {
  const hasValue = getValueEditorKind(field?.type ?? filter.type, filter.operator) !== 'none';

  if (!hasValue) return null;

  const enumValues =
    (filter.operator === 'in' || filter.operator === 'notIn') && Array.isArray(filter.value)
      ? filter.value
      : null;

  return (
    <>
      <span aria-hidden="true" className="filter-token-divider" />
      {enumValues ? (
        <EnumValuePills
          values={enumValues}
          fieldLabelText={fieldLabelText}
          segmentClassName={segmentClassName}
          disabled={disabled}
          onOpenSegment={onOpenSegment}
          onRemoveEnumValue={onRemoveEnumValue}
        />
      ) : (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className={clsx(segmentClassName, 'filter-token-value')}
          data-token-segment="value"
          title="Change value"
          onClick={(event) => onOpenSegment('value', event.currentTarget)}
        >
          {formatFilterValue(filter) || '…'}
        </button>
      )}
    </>
  );
}

/**
 * Renders one condition as sibling buttons inside a labelled group, avoiding
 * nested interactive elements while preserving one roving token stop.
 */
export function FilterToken({
  filter,
  field,
  validationIssue,
  editingSegment,
  inAndRun,
  disabled,
  onOpenSegment,
  onRemove,
  onRemoveEnumValue,
  onMoveFocus,
}: FilterTokenProps) {
  const label = field ? fieldLabel(field) : filter.fieldKey;
  const phrase = tokenPhrase(filter, field);
  const accessibleLabel =
    phrase +
    (inAndRun ? ' (in a group matching all)' : '') +
    (validationIssue ? ` (invalid: ${validationIssue.reason})` : '');

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The chip root is a div, so the fieldset's native `disabled` never
    // reaches it — and a chip focused before the disable keeps its focus.
    if (disabled) return;

    const tokenElement = event.currentTarget;
    const target = event.target as HTMLElement;
    const isTokenRootTarget = target === tokenElement;

    if (handleTokenTraversal(event, tokenElement, target, isTokenRootTarget, onMoveFocus)) {
      return;
    }

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        // Safety step: on a segment, the first press only re-focuses the token
        // root; a second press removes the whole token.
        if (isTokenRootTarget) {
          onRemove();
        } else {
          tokenElement.focus();
        }
        return;
      case 'Enter':
      case ' ':
        if (!isTokenRootTarget) return;

        event.preventDefault();
        tokenElement.querySelector('button')?.focus();
        return;
      case 'Escape':
      case 'ArrowUp':
        if (isTokenRootTarget) return;

        event.preventDefault();
        event.stopPropagation();
        tokenElement.focus();
        return;
      case 'ArrowDown':
        handleTokenArrowDown(event, tokenElement, target, isTokenRootTarget);
        return;
    }
  };

  const segmentClassName = (segment: TokenSegment) =>
    clsx('filter-token-segment', {
      'is-editing': editingSegment === segment,
    });

  return (
    <div
      role="group"
      aria-label={accessibleLabel}
      data-invalid={validationIssue ? true : undefined}
      className="filter-chip filter-token"
      tabIndex={disabled ? -1 : 0}
      data-token={filter.id}
      onKeyDown={handleKeyDown}
    >
      <ValidationWarningButton
        validationIssue={validationIssue}
        disabled={disabled}
        onOpenSegment={onOpenSegment}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        className={segmentClassName('field')}
        data-token-segment="field"
        title="Change field"
        onClick={(event) => onOpenSegment('field', event.currentTarget)}
      >
        {label}
      </button>
      <span aria-hidden="true" className="filter-token-divider" />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        className={segmentClassName('operator')}
        data-token-segment="operator"
        title="Change operator"
        onClick={(event) => onOpenSegment('operator', event.currentTarget)}
      >
        {OPERATOR_LABELS[filter.operator]}
      </button>
      <TokenValueSegment
        filter={filter}
        field={field}
        fieldLabelText={label}
        segmentClassName={segmentClassName('value')}
        disabled={disabled}
        onOpenSegment={onOpenSegment}
        onRemoveEnumValue={onRemoveEnumValue}
      />
      <span aria-hidden="true" className="filter-token-divider" />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        className="filter-token-remove"
        data-token-segment="remove"
        // The full phrase, not just the field: two conditions on the same
        // field must stay distinguishable in a screen reader's buttons list.
        aria-label={`Remove ${phrase} filter`}
        onClick={onRemove}
      >
        <X aria-hidden="true" size={13} />
      </button>
    </div>
  );
}
