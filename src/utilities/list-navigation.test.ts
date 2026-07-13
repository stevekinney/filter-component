import { describe, expect, it } from 'vitest';
import { clampIndex } from './list-navigation.ts';

describe('clampIndex', () => {
  it('clamps indices to the available range', () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(3, 3)).toBe(2);
  });

  it('returns zero for empty lists', () => {
    expect(clampIndex(-1, 0)).toBe(0);
    expect(clampIndex(1, 0)).toBe(0);
  });
});
