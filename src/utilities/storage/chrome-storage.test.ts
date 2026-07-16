import { describe, expect, it, vi } from 'vitest';

import { SAVED_VIEWS_STORAGE_KEY } from '@/utilities/filter/saved-views.ts';
import type { SavedView } from '@/utilities/filter/saved-views.ts';

import { createChromeSavedViewsStorage } from './chrome-storage.ts';
import type { ChromeStorageArea } from './chrome-storage.ts';

const VIEW: SavedView = {
  name: 'Open deals',
  group: { combinator: 'and', conditions: [] },
};

describe('createChromeSavedViewsStorage', () => {
  it('reads and writes the structured value under the saved-views key', async () => {
    const get = vi.fn<ChromeStorageArea['get']>(async () => ({
      [SAVED_VIEWS_STORAGE_KEY]: [VIEW],
    }));
    const set = vi.fn<ChromeStorageArea['set']>(async () => undefined);
    const storage = createChromeSavedViewsStorage({ get, set });

    await expect(storage.getSavedViews()).resolves.toEqual([VIEW]);
    expect(get).toHaveBeenCalledWith(SAVED_VIEWS_STORAGE_KEY);

    await storage.saveSavedViews([VIEW]);
    expect(set).toHaveBeenCalledWith({ [SAVED_VIEWS_STORAGE_KEY]: [VIEW] });
  });

  it('returns an empty collection when the key is absent', async () => {
    const storage = createChromeSavedViewsStorage({
      get: async () => ({}),
      set: async () => undefined,
    });

    await expect(storage.getSavedViews()).resolves.toEqual([]);
  });

  it('propagates rejected reads and writes', async () => {
    const storage = createChromeSavedViewsStorage({
      get: async () => {
        throw new Error('read failed');
      },
      set: async () => {
        throw new Error('write failed');
      },
    });

    await expect(storage.getSavedViews()).rejects.toThrow('read failed');
    await expect(storage.saveSavedViews([])).rejects.toThrow('write failed');
  });
});
