import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { TokenSegment } from '@filter/utilities/validation.ts';

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

function resolveFocusTarget(root: ParentNode, target: FocusTarget): HTMLElement | null {
  switch (target.type) {
    case 'addInput':
      return root.querySelector<HTMLElement>('[data-add-filter-input]');
    case 'autofocus':
      return root.querySelector<HTMLElement>('[data-autofocus]');
    case 'token':
      return elementWithDataValue(root, 'data-token', target.id);
    case 'segment': {
      const token = elementWithDataValue(root, 'data-token', target.id);
      return token ? elementWithDataValue(token, 'data-token-segment', target.segment) : null;
    }
    case 'joiner':
      return elementWithDataValue(root, 'data-joiner', String(target.index));
    case 'savedViewsTrigger':
      return root.querySelector<HTMLElement>('[data-saved-views-button]');
    case 'savedView':
      return elementWithDataValue(root, 'data-saved-view-item', String(target.index));
    case 'element':
      return target.element.isConnected ? target.element : null;
  }
}

/** Resolves semantic focus targets after React commits the DOM that creates them. */
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
