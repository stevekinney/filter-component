import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVED_VIEWS_STORAGE_KEY } from '@/utilities/filter/saved-views.ts';
import { localSavedViewsStorage } from './local-storage.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';

const VIEW: SavedView = {
  name: 'Active deals',
  group: {
    combinator: 'and',
    conditions: [
      {
        fieldKey: 'active',
        type: 'boolean',
        operator: 'equals',
        value: true,
      },
    ],
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('localSavedViewsStorage', () => {
  it('returns an empty collection when no saved views exist', () => {
    expect(localSavedViewsStorage.getSavedViews()).toEqual([]);
  });

  it('round-trips the saved-view collection as JSON', () => {
    localSavedViewsStorage.saveSavedViews([VIEW]);

    expect(localSavedViewsStorage.getSavedViews()).toEqual([VIEW]);
    expect(window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)).toBe(JSON.stringify([VIEW]));
  });

  it('surfaces malformed JSON and denied storage access to the controller', () => {
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, '{malformed');
    expect(() => localSavedViewsStorage.getSavedViews()).toThrow(SyntaxError);

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => localSavedViewsStorage.getSavedViews()).toThrow('denied');
    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => localSavedViewsStorage.saveSavedViews([])).toThrow('quota');
    setItemSpy.mockRestore();
  });
});
