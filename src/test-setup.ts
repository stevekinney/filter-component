import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

let unexpectedConsoleCalls: string[] = [];
let restoreConsoleSpies: (() => void)[] = [];

const formatConsoleArgument = (argument: unknown): string => {
  if (argument instanceof Error) return argument.stack ?? argument.message;
  if (typeof argument === 'string') return argument;

  try {
    return JSON.stringify(argument) ?? String(argument);
  } catch {
    return String(argument);
  }
};

beforeEach(() => {
  unexpectedConsoleCalls = [];
  const warningSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
    unexpectedConsoleCalls.push(`console.warn: ${args.map(formatConsoleArgument).join(' ')}`);
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    unexpectedConsoleCalls.push(`console.error: ${args.map(formatConsoleArgument).join(' ')}`);
  });

  restoreConsoleSpies = [() => warningSpy.mockRestore(), () => errorSpy.mockRestore()];
});

afterEach(() => {
  // Testing Library only registers its own cleanup when `globals: true`
  // exposes `afterEach`; this project keeps globals off.
  cleanup();

  for (const restore of restoreConsoleSpies) restore();
  restoreConsoleSpies = [];

  if (unexpectedConsoleCalls.length > 0) {
    throw new Error(`Unexpected console output:\n${unexpectedConsoleCalls.join('\n')}`);
  }
});

/**
 * Minimal Popover API shim for jsdom, which lacks showPopover/hidePopover:
 * beforetoggle + toggle lifecycle events and pointerdown-outside light
 * dismissal for `popover="auto"` (clicks on the invoker passed as
 * `showPopover({ source })` don't dismiss, matching the browser). It makes
 * no claims about layout, collision handling, top-layer stacking, or focus —
 * those are verified in the real-Chrome Playwright suite.
 */
if (typeof HTMLElement.prototype.showPopover !== 'function') {
  const openPopovers = new WeakSet<HTMLElement>();
  const dismissListeners = new WeakMap<HTMLElement, (e: Event) => void>();

  const fireToggle = (
    element: HTMLElement,
    type: 'beforetoggle' | 'toggle',
    oldState: 'open' | 'closed',
    newState: 'open' | 'closed',
  ) => {
    const event = new Event(type, { cancelable: type === 'beforetoggle' });

    Object.assign(event, { oldState, newState });
    element.dispatchEvent(event);
  };

  const hide = (element: HTMLElement) => {
    if (!openPopovers.has(element)) return;
    openPopovers.delete(element);
    const listener = dismissListeners.get(element);

    if (listener) {
      document.removeEventListener('pointerdown', listener);
      dismissListeners.delete(element);
    }
    fireToggle(element, 'beforetoggle', 'open', 'closed');
    fireToggle(element, 'toggle', 'open', 'closed');
  };

  HTMLElement.prototype.showPopover = function (options?: { source?: HTMLElement }) {
    if (openPopovers.has(this)) {
      throw new DOMException('Popover is already open', 'InvalidStateError');
    }
    fireToggle(this, 'beforetoggle', 'closed', 'open');
    openPopovers.add(this);
    fireToggle(this, 'toggle', 'closed', 'open');
    if (this.getAttribute('popover') === 'auto') {
      const source = options?.source ?? null;
      const listener = (event: Event) => {
        if (!this.isConnected) {
          hide(this);
          return;
        }
        const target = event.target instanceof Node ? event.target : null;

        if (!target) return;
        if (this.contains(target)) return;
        if (source?.contains(target)) return;
        hide(this);
      };

      document.addEventListener('pointerdown', listener);
      dismissListeners.set(this, listener);
    }
  };

  HTMLElement.prototype.hidePopover = function () {
    hide(this);
  };
}

// jsdom has no layout engine, so it does not provide this standard scrolling
// primitive.
if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  HTMLElement.prototype.scrollIntoView = function () {};
}

// jsdom's UA stylesheet has `[popover]:not(:popover-open) { display: none }`
// but never matches `:popover-open`, so shown popovers stay invisible to
// Testing Library. Component CSS isn't loaded under vitest, so override with
// an author rule — the component only mounts the popover element while it is
// logically open. `!important` is required because jsdom's cascade doesn't
// let a plain author rule beat its popover UA rule; this is test-shim CSS,
// not component CSS.
const popoverShimStyle = document.createElement('style');

popoverShimStyle.textContent = '[popover] { display: block !important; }';
document.head.appendChild(popoverShimStyle);
