import type { SavedView } from '@/utilities/filter/saved-views.ts';

/**
 * Persistence boundary for saved views. Reads may return untrusted data so the
 * component can validate local, extension, API, and test stores consistently.
 */
export type SavedViewsStorage = {
  getSavedViews: () => unknown;
  saveSavedViews: (savedViews: readonly SavedView[]) => void | Promise<void>;
};
