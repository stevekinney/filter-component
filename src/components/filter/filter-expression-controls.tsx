import type { FilterCombinator } from '@/types/filter.ts';

/**
 * The joiner word between two adjacent chips — the only structural gesture
 * in the smart-joiners model. Clicking (or Enter/Space while focused) flips
 * this one gap between `and` and `or`; grouping re-derives from the joiner
 * sequence, so the button promises exactly that in its accessible name.
 * A roving stop: reachable with ←/→ from the neighboring chips, never a
 * Tab stop of its own.
 */
export function FilterJoiner({
  index,
  joiner,
  disabled,
  onFlip,
  onMoveFocus,
}: {
  /** Gap position: sits between condition `index` and `index + 1`. */
  index: number;
  joiner: FilterCombinator;
  disabled: boolean;
  onFlip: () => void;
  /** Move focus to the chip on either side; the parent resolves the target. */
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

/**
 * A read-only precedence indicator around a ≥2-member and-run. Rendered only
 * while an `or` joiner exists somewhere in the expression — mixed
 * combinators never appear without brackets, and an all-`and` bar never
 * shows any.
 */
export function FilterBracket({ glyph }: { glyph: '(' | ')' }) {
  return (
    <span aria-hidden="true" className="filter-bracket">
      {glyph}
    </span>
  );
}
