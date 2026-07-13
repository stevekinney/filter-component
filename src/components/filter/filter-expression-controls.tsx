import type { FilterCombinator } from '@/types/filter.ts';

/**
 * Roving button between adjacent conditions. Activation flips only this gap;
 * grouping is derived from the resulting joiner sequence.
 */
export function FilterJoiner({
  index,
  joiner,
  disabled,
  onFlip,
  onMoveFocus,
}: {
  index: number;
  joiner: FilterCombinator;
  disabled: boolean;
  onFlip: () => void;
  onMoveFocus: (direction: -1 | 1) => void;
}) {
  const flipped = joiner === 'and' ? 'or' : 'and';
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      className="filter-joiner"
      data-joiner={index}
      aria-label={`Joined by ${joiner}. Switch to ${flipped} — grouping adjusts automatically.`}
      title={`Switch to ${flipped} — grouping adjusts automatically`}
      onClick={onFlip}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          onMoveFocus(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      {joiner}
    </button>
  );
}

/** Read-only parentheses around multi-condition and-runs in a mixed expression. */
export function FilterBracket({ glyph }: { glyph: '(' | ')' }) {
  return (
    <span aria-hidden="true" className="filter-bracket">
      {glyph}
    </span>
  );
}
