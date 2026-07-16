/**
 * Presentation state for the saved-views menu: closed, listing views, or
 * naming a new view. This is deliberately separate from saved-view data so a
 * persistence failure cannot corrupt menu presentation, and vice versa.
 */
export type SavedViewsMenuState =
  | { stage: 'closed' }
  | { stage: 'list'; autofocusIndex: number }
  | {
      stage: 'naming';
      autofocusIndex: number;
      nameDraft: string;
      nameError: string | null;
    };

export type SavedViewsMenuAction =
  | { type: 'open'; autofocusIndex: number }
  | { type: 'close' }
  | { type: 'beginNaming'; autofocusIndex: number }
  | { type: 'changeName'; autofocusIndex: number; name: string }
  | {
      type: 'rejectName';
      autofocusIndex: number;
      name: string;
      message: string;
    };

export const CLOSED_SAVED_VIEWS_MENU: SavedViewsMenuState = { stage: 'closed' };

export function savedViewsMenuReducer(
  _state: SavedViewsMenuState,
  action: SavedViewsMenuAction,
): SavedViewsMenuState {
  switch (action.type) {
    case 'open':
      return { stage: 'list', autofocusIndex: action.autofocusIndex };
    case 'close':
      return CLOSED_SAVED_VIEWS_MENU;
    case 'beginNaming':
      return {
        stage: 'naming',
        autofocusIndex: action.autofocusIndex,
        nameDraft: '',
        nameError: null,
      };
    case 'changeName':
      return {
        stage: 'naming',
        autofocusIndex: action.autofocusIndex,
        nameDraft: action.name,
        nameError: null,
      };
    case 'rejectName':
      return {
        stage: 'naming',
        autofocusIndex: action.autofocusIndex,
        nameDraft: action.name,
        nameError: action.message,
      };
  }
}
