import { describe, expect, it } from 'vitest';
import { stableSerialize } from './stable-serialize.ts';

describe('stableSerialize', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(
      stableSerialize({
        z: [{ b: 2, a: 1 }],
        a: true,
        ignored: undefined,
      }),
    ).toBe('{"a":true,"z":[{"a":1,"b":2}]}');
  });

  it('serializes null, scalar, and undefined values', () => {
    expect(stableSerialize(null)).toBe('null');
    expect(stableSerialize('value')).toBe('"value"');
    expect(stableSerialize(undefined)).toBe('undefined');
  });
});
