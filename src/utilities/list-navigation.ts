export function clampIndex(index: number, length: number): number {
  return Math.min(index, Math.max(0, length - 1));
}

/** Steps with wraparound; callers must pass a positive `length`. */
export function stepIndex(index: number, delta: number, length: number): number {
  return (index + delta + length) % length;
}
