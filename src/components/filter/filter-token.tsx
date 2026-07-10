import clsx from 'clsx';
import { TriangleAlert, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import {
  segmentAttribute,
  TOKEN_SEGMENT_ATTRIBUTE,
  TOKEN_SEGMENT_SELECTOR,
  TOKEN_SELECTOR,
} from '@/utilities/filter/dom-selectors.ts';
import {
  fieldLabel,
  formatFilterValue,
  isStringArray,
  tokenPhrase,
} from '@/utilities/filter/formatting.ts';
import {
  getValueEditorKind,
  OPERATOR_LABELS,
} from '@/utilities/filter/operators.ts';
import type {
  FilterValidationIssue,
  TokenSegment,
} from '@/utilities/filter/validation.ts';
import type { FilterEntry } from '@/utilities/filter/filter-entry.ts';
import type { FilterFieldDefinition } from '@/types/filter.ts';

type SegmentHandler = (segment: TokenSegment, anchor: HTMLElement) => void;

type FilterTokenProps = {
  filter: FilterEntry;
  field: FilterFieldDefinition | undefined;
  validationIssue: FilterValidationIssue | null;
  /** Segment whose editor popover is currently open, for the active highlight. */
  editingSegment: TokenSegment | null;
  /** Inside a bracketed and-run — adds run context to the accessible name. */
  inAndRun: boolean;
  disabled: boolean;
  onOpenSegment: SegmentHandler;
  onRemove: () => void;
  onRemoveEnumValue: (value: string) => void;
  /** Move token-root focus to a neighbor; the parent resolves the target. */
  onMoveFocus: (direction: -1 | 1) => void;
};

/** The warning affordance on an invalid token; opens the broken segment. */
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
        const tokenElement =
          event.currentTarget.closest<HTMLElement>(TOKEN_SELECTOR);
        onOpenSegment(
          validationIssue.segment,
          tokenElement ?? event.currentTarget,
        );
      }}
    >
      <TriangleAlert aria-hidden="true" size={14} />
    </button>
  );
}

/** Enum multi-values as pills, each with its own remove control. */
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
            data-token-segment={
              index === 0 ? segmentAttribute('value') : undefined
            }
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

/** The value segment: enum pills, a value button, or nothing when valueless. */
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
  const hasValue =
    getValueEditorKind(field?.type ?? filter.type, filter.operator) !== 'none';
  if (!hasValue) return null;

  const enumValues =
    (filter.operator === 'in' || filter.operator === 'notIn') &&
    isStringArray(filter.value)
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
          data-token-segment={segmentAttribute('value')}
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
 * One committed filter condition, rendered as a labelled group of sibling
 * buttons — field / operator / value / remove — so no interactive element
 * nests inside another. Every token root is a tab stop; arrow keys traverse
 * the segment buttons inside it. The caller renders the surrounding
 * listitem, so the joiner word and bracket glyphs can sit beside the chip
 * within the same list slot.
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

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      // Safety step: on a segment, the first press only re-focuses the token
      // root; a second press removes the whole token.
      if (isTokenRootTarget) onRemove();
      else tokenElement.focus();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && isTokenRootTarget) {
      event.preventDefault();
      tokenElement.querySelector('button')?.focus();
      return;
    }
    if (
      (event.key === 'Escape' || event.key === 'ArrowUp') &&
      !isTokenRootTarget
    ) {
      event.preventDefault();
      event.stopPropagation();
      tokenElement.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (isTokenRootTarget) {
        tokenElement.querySelector('button')?.focus();
        return;
      }
      // Only editor-opening controls respond to ArrowDown. The remove
      // buttons are destructive and keep their two-step Delete safety net —
      // ArrowDown must never trigger them.
      const opensAnEditor =
        target.matches(TOKEN_SEGMENT_SELECTOR) &&
        target.getAttribute(TOKEN_SEGMENT_ATTRIBUTE) !==
          segmentAttribute('remove');
      if (opensAnEditor) target.click();
      return;
    }
    const isTraversalKey =
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      (event.key === 'Tab' && !isTokenRootTarget);
    if (!isTraversalKey) return;
    event.preventDefault();
    const direction =
      event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)
        ? -1
        : 1;
    if (isTokenRootTarget) {
      onMoveFocus(direction);
      return;
    }
    // Walk every control inside the token — segments, enum pills, pill removes.
    const tokenButtons = Array.from(tokenElement.querySelectorAll('button'));
    const nextIndex =
      tokenButtons.indexOf(target as HTMLButtonElement) + direction;
    if (nextIndex < 0) {
      tokenElement.focus();
    } else if (nextIndex >= tokenButtons.length) {
      onMoveFocus(1);
    } else {
      tokenButtons[nextIndex]?.focus();
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
        data-token-segment={segmentAttribute('field')}
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
        data-token-segment={segmentAttribute('operator')}
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
        data-token-segment={segmentAttribute('remove')}
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
