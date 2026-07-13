import { SAVED_VIEWS_STORAGE_KEY } from '@/utilities/filter/saved-views.ts';
import type { SavedViewsStorage } from './saved-views-storage.ts';

/** Promise-based subset shared by Chrome's local, sync, and session areas. */
export type ChromeStorageArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

/** Creates saved-view persistence backed by a `chrome.storage` area. */
export function createChromeSavedViewsStorage(storageArea: ChromeStorageArea): SavedViewsStorage {
  return {
    async getSavedViews() {
      const stored = await storageArea.get(SAVED_VIEWS_STORAGE_KEY);

      return stored[SAVED_VIEWS_STORAGE_KEY] ?? [];
    },
    async saveSavedViews(savedViews) {
      await storageArea.set({ [SAVED_VIEWS_STORAGE_KEY]: savedViews });
    },
  };
}
