import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNativePopover } from './use-native-popover.ts';

type NativePopoverHarnessProps = {
  anchor: HTMLElement | null;
  autofocusOnOpen?: boolean;
  includeAutofocus?: boolean;
  onBrowserDismiss: () => void;
  onEscape: () => void;
  resolveAnchor?: (currentAnchor: HTMLElement | null) => HTMLElement | null;
};

function returnCurrentAnchor(currentAnchor: HTMLElement | null) {
  return currentAnchor;
}

function NativePopoverHarness(properties: NativePopoverHarnessProps) {
  const {
    anchor,
    autofocusOnOpen,
    includeAutofocus: includeAutofocusOption,
    onBrowserDismiss,
    onEscape,
    resolveAnchor: resolveAnchorOption,
  } = properties;
  const includeAutofocus = includeAutofocusOption ?? true;
  const resolveAnchor = resolveAnchorOption ?? returnCurrentAnchor;

  const { popoverRef, handleBeforeToggle, handleKeyDown } = useNativePopover({
    anchorKey: anchor,
    resolveAnchor: () => resolveAnchor(anchor),
    onBrowserDismiss,
    onEscape,
    ...(autofocusOnOpen === undefined ? {} : { autofocusOnOpen }),
  });
  return (
    <div
      ref={popoverRef}
      popover="auto"
      role="dialog"
      aria-label="Native popover harness"
      data-testid="native-popover"
      onBeforeToggle={handleBeforeToggle}
      onKeyDown={handleKeyDown}
    >
      {includeAutofocus && <button data-autofocus="1">First</button>}
    </div>
  );
}

describe('useNativePopover lifecycle', () => {
  it('shows without an anchor, ignores non-Escape keys, and translates dismissal', () => {
    const onBrowserDismiss = vi.fn();
    const onEscape = vi.fn();
    render(
      <NativePopoverHarness
        anchor={null}
        onBrowserDismiss={onBrowserDismiss}
        onEscape={onEscape}
      />,
    );
    const popover = screen.getByTestId('native-popover');
    fireEvent.keyDown(popover, { key: 'Enter' });
    expect(onEscape).not.toHaveBeenCalled();
    fireEvent.keyDown(popover, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
    fireEvent.pointerDown(document.body);
    expect(onBrowserDismiss).toHaveBeenCalledOnce();
  });

  it('autofocuses, keeps the same anchor, and reanchors an open popover', () => {
    const firstAnchor = document.createElement('button');
    const secondAnchor = document.createElement('button');
    document.body.append(firstAnchor, secondAnchor);
    const onBrowserDismiss = vi.fn();
    const resolveAnchor = vi.fn(
      (currentAnchor: HTMLElement | null) => currentAnchor,
    );
    const props = {
      autofocusOnOpen: true,
      includeAutofocus: true,
      onBrowserDismiss,
      onEscape: vi.fn(),
      resolveAnchor,
    };
    const view = render(
      <NativePopoverHarness {...props} anchor={firstAnchor} />,
    );
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    expect(resolveAnchor).toHaveBeenCalledOnce();
    view.rerender(<NativePopoverHarness {...props} anchor={firstAnchor} />);
    expect(resolveAnchor).toHaveBeenCalledOnce();
    view.rerender(<NativePopoverHarness {...props} anchor={secondAnchor} />);
    expect(resolveAnchor).toHaveBeenCalledTimes(2);
    expect(onBrowserDismiss).not.toHaveBeenCalled();
    view.rerender(
      <NativePopoverHarness
        {...props}
        anchor={secondAnchor}
        includeAutofocus={false}
      />,
    );
  });

  it('returns safely when the hook ref is never attached', () => {
    renderHook(
      ({ anchor }: { anchor: HTMLElement | null }) =>
        useNativePopover({
          resolveAnchor: () => anchor,
          onBrowserDismiss: vi.fn(),
          onEscape: vi.fn(),
        }),
      { initialProps: { anchor: null } },
    );
  });
});
