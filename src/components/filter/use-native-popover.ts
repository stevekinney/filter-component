import { useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, RefObject, ToggleEvent } from 'react';
import { AUTOFOCUS_SELECTOR } from '@/utilities/filter/dom-selectors.ts';

type NativePopoverOptions = {
  /**
   * Changes only when resolving again could produce a different anchor. Omit
   * when the hook is mounted for exactly one immutable anchor source.
   */
  anchorKey?: unknown;
  resolveAnchor: () => HTMLElement | null;
  onBrowserDismiss: () => void;
  onEscape: () => void;
  autofocusOnOpen?: boolean;
};

function performPopoverReanchoring(
  isReanchoringRef: RefObject<boolean>,
  reanchor: () => void,
) {
  isReanchoringRef.current = true;
  try {
    reanchor();
  } finally {
    isReanchoringRef.current = false;
  }
}

/**
 * Keeps a mounted native popover open and anchored while translating browser
 * dismissal and Escape into the owning state domain's semantic commands.
 */
export function useNativePopover(options: NativePopoverOptions) {
  const {
    anchorKey,
    resolveAnchor,
    onBrowserDismiss,
    onEscape,
    autofocusOnOpen: autofocusOnOpenOption,
  } = options;
  const autofocusOnOpen = autofocusOnOpenOption ?? false;
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const isPopoverOpenRef = useRef(false);
  const currentAnchorRef = useRef<HTMLElement | null>(null);
  const isReanchoringRef = useRef(false);

  const reanchorPopover = useEffectEvent(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const anchor = resolveAnchor();
    if (isPopoverOpenRef.current && currentAnchorRef.current === anchor) return;

    performPopoverReanchoring(isReanchoringRef, () => {
      if (isPopoverOpenRef.current) popover.hidePopover();
      popover.showPopover(anchor ? { source: anchor } : undefined);
      if (autofocusOnOpen) {
        popover.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR)?.focus();
      }
    });
    currentAnchorRef.current = anchor;
  });

  useLayoutEffect(() => {
    reanchorPopover();
  }, [anchorKey]);

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
