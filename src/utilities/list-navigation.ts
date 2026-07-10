/** Clamps a remembered active index to a (possibly shrunken) option list. */
export function clampIndex(index: number, length: number): number {
  return Math.min(index, Math.max(0, length - 1));
}

/** Arrow-key navigation: step with wraparound. Callers guard `length > 0`. */
export function stepIndex(
  index: number,
  delta: number,
  length: number,
): number {
  return (index + delta + length) % length;
}
