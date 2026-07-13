import { SAVED_VIEWS_STORAGE_KEY } from '@/utilities/filter/saved-views.ts';
import type { SavedViewsStorage } from './saved-views-storage.ts';

/** Default saved-view persistence using the page's local storage. */
export const localSavedViewsStorage = {
  getSavedViews() {
    const stored = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);

    return stored === null ? [] : JSON.parse(stored);
  },
  saveSavedViews(savedViews) {
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(savedViews));
  },
} satisfies SavedViewsStorage;
