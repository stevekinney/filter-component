import { createRef } from 'react';
import type { RefObject } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFilterFocus } from '../use-filter-focus.ts';
import type { FocusTarget } from '../use-filter-focus.ts';

function createFocusRoot(): HTMLFieldSetElement {
  const root = document.createElement('fieldset');
  root.innerHTML = `
    <button data-add-filter-input="1">Add</button>
    <button data-autofocus="1">Auto</button>
    <div data-token="condition-1" tabindex="0">
      <button data-token-segment="field">Field</button>
    </div>
    <button data-joiner="0">and</button>
    <button data-saved-views-button="1">Views</button>
    <button data-saved-view-item="2">Third view</button>
  `;
  document.body.appendChild(root);
  return root;
}

describe('useFilterFocus semantic targets', () => {
  it('focuses every semantic target and reports missing or detached targets', () => {
    const root = createFocusRoot();
    const rootRef: RefObject<HTMLFieldSetElement | null> = { current: root };
    const { result } = renderHook(() => useFilterFocus(rootRef));
    const cases: [FocusTarget, string][] = [
      [{ type: 'addInput' }, '[data-add-filter-input]'],
      [{ type: 'autofocus' }, '[data-autofocus]'],
      [{ type: 'token', id: 'condition-1' }, '[data-token]'],
      [{ type: 'segment', id: 'condition-1', segment: 'field' }, '[data-token-segment]'],
      [{ type: 'joiner', index: 0 }, '[data-joiner]'],
      [{ type: 'savedViewsTrigger' }, '[data-saved-views-button]'],
      [{ type: 'savedView', index: 2 }, '[data-saved-view-item]'],
    ];
    for (const [target, selector] of cases) {
      expect(result.current.focus(target)).toBe(true);
      expect(root.querySelector(selector)).toHaveFocus();
    }

    const connected = document.createElement('button');
    root.appendChild(connected);
    expect(result.current.focus({ type: 'element', element: connected })).toBe(true);
    connected.remove();
    expect(result.current.focus({ type: 'element', element: connected })).toBe(false);
    expect(result.current.focus({ type: 'token', id: 'missing' })).toBe(false);
    expect(
      result.current.focus({
        type: 'segment',
        id: 'missing',
        segment: 'value',
      }),
    ).toBe(false);
    expect(
      result.current.focus({
        type: 'segment',
        id: 'condition-1',
        segment: 'value',
      }),
    ).toBe(false);
  });

  it('handles a missing root and resolves a scheduled target after a render', () => {
    const missingRef = createRef<HTMLFieldSetElement>();
    const missing = renderHook(() => useFilterFocus(missingRef));
    expect(missing.result.current.focus({ type: 'addInput' })).toBe(false);

    const root = createFocusRoot();
    const rootRef: RefObject<HTMLFieldSetElement | null> = { current: root };
    const scheduled = renderHook(() => useFilterFocus(rootRef));
    act(() => {
      scheduled.result.current.scheduleFocus({ type: 'savedView', index: 2 });
    });
    scheduled.rerender();
    expect(root.querySelector('[data-saved-view-item]')).toHaveFocus();
    scheduled.rerender();
  });
});
