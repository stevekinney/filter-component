import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, ToggleEvent } from 'react';
import { AUTOFOCUS_SELECTOR } from '@/utilities/filter/dom-selectors.ts';

type NativePopoverOptions = {
  resolveAnchor: () => HTMLElement | null;
  onBrowserDismiss: () => void;
  onEscape: () => void;
  autofocusOnOpen?: boolean;
};

/**
 * Keeps a mounted native popover open and anchored while translating browser
 * dismissal and Escape into the owning state domain's semantic commands.
 */
export function useNativePopover({
  resolveAnchor,
  onBrowserDismiss,
  onEscape,
  autofocusOnOpen = false,
}: NativePopoverOptions) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const isPopoverOpenRef = useRef(false);
  const currentAnchorRef = useRef<HTMLElement | null>(null);
  const isReanchoringRef = useRef(false);

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const anchor = resolveAnchor();
    if (isPopoverOpenRef.current && currentAnchorRef.current === anchor) return;

    isReanchoringRef.current = true;
    try {
      if (isPopoverOpenRef.current) popover.hidePopover();
      popover.showPopover(anchor ? { source: anchor } : undefined);
      if (autofocusOnOpen) {
        popover.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR)?.focus();
      }
    } finally {
      isReanchoringRef.current = false;
    }
    currentAnchorRef.current = anchor;
  });

  const handleBeforeToggle = (event: ToggleEvent<HTMLDivElement>) => {
    isPopoverOpenRef.current = event.newState === 'open';
    if (event.newState === 'closed' && !isReanchoringRef.current) {
      onBrowserDismiss();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;

    // The browser's close watcher does not know the product's focus and draft
    // semantics, so the state owner performs the close deliberately.
    event.preventDefault();
    event.stopPropagation();
    onEscape();
  };

  return { popoverRef, handleBeforeToggle, handleKeyDown };
}
