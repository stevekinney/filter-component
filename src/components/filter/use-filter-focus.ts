import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  ADD_FILTER_INPUT_SELECTOR,
  AUTOFOCUS_SELECTOR,
  JOINER_ATTRIBUTE,
  SAVED_VIEW_ITEM_ATTRIBUTE,
  SAVED_VIEWS_BUTTON_SELECTOR,
  TOKEN_ATTRIBUTE,
  TOKEN_SEGMENT_ATTRIBUTE,
} from '@/utilities/filter/dom-selectors.ts';
import type { TokenSegment } from '@/utilities/filter/validation.ts';

export type FocusTarget =
  | { type: 'addInput' }
  | { type: 'autofocus' }
  | { type: 'token'; id: string }
  | { type: 'segment'; id: string; segment: TokenSegment | 'remove' }
  | { type: 'joiner'; index: number }
  | { type: 'savedViewsTrigger' }
  | { type: 'savedView'; index: number }
  | { type: 'element'; element: HTMLElement };

function elementWithDataValue(
  root: ParentNode,
  attribute: string,
  value: string,
): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
      (element) => element.getAttribute(attribute) === value,
    ) ?? null
  );
}

function resolveFocusTarget(
  root: ParentNode,
  target: FocusTarget,
): HTMLElement | null {
  switch (target.type) {
    case 'addInput':
      return root.querySelector<HTMLElement>(ADD_FILTER_INPUT_SELECTOR);
    case 'autofocus':
      return root.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR);
    case 'token':
      return elementWithDataValue(root, TOKEN_ATTRIBUTE, target.id);
    case 'segment': {
      const token = elementWithDataValue(root, TOKEN_ATTRIBUTE, target.id);
      return token
        ? elementWithDataValue(token, TOKEN_SEGMENT_ATTRIBUTE, target.segment)
        : null;
    }
    case 'joiner':
      return elementWithDataValue(root, JOINER_ATTRIBUTE, String(target.index));
    case 'savedViewsTrigger':
      return root.querySelector<HTMLElement>(SAVED_VIEWS_BUTTON_SELECTOR);
    case 'savedView':
      return elementWithDataValue(
        root,
        SAVED_VIEW_ITEM_ATTRIBUTE,
        String(target.index),
      );
    case 'element':
      return target.element.isConnected ? target.element : null;
  }
}

/** Defers semantic focus requests until the render that creates their target. */
export function useFilterFocus(rootRef: RefObject<HTMLFieldSetElement | null>) {
  const pendingTargetRef = useRef<FocusTarget | null>(null);

  const focus = (target: FocusTarget): boolean => {
    const root = rootRef.current;
    if (!root) return false;
    const element = resolveFocusTarget(root, target);
    if (!element) return false;
    element.focus();
    return true;
  };

  useEffect(() => {
    const target = pendingTargetRef.current;
    if (!target) return;
    pendingTargetRef.current = null;
    focus(target);
  });

  return {
    scheduleFocus: (target: FocusTarget) => {
      pendingTargetRef.current = target;
    },
    focus,
  };
}
