import { useLayoutEffect, useRef } from 'react';

export function useActiveOptionScroll<T extends HTMLElement = HTMLDivElement>(
  activeIndex: number,
  activeOptionKey?: string,
) {
  const listRef = useRef<T | null>(null);

  useLayoutEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeIndex, activeOptionKey]);

  return listRef;
}
