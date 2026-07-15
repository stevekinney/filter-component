import { useEffect, useRef } from 'react';

export function useActiveOptionScroll<T extends HTMLElement = HTMLDivElement>(
  activeIndex: number,
  activeOptionKey?: string,
) {
  const listRef = useRef<T | null>(null);

  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeIndex, activeOptionKey]);

  return listRef;
}
