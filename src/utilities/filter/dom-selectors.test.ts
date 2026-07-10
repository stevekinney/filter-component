import { describe, expect, it } from 'vitest';
import { SAVED_VIEW_ITEM_SELECTOR, segmentAttribute } from './dom-selectors.ts';

describe('DOM selector helpers', () => {
  it('exposes the saved-view item hook without serializing a list position', () => {
    expect(SAVED_VIEW_ITEM_SELECTOR).toBe('[data-saved-view-item]');
  });

  it('uses semantic token segment values unchanged', () => {
    expect(segmentAttribute('field')).toBe('field');
    expect(segmentAttribute('remove')).toBe('remove');
  });
});
