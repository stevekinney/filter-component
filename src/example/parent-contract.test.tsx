import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Filter } from '@/components/filter/index.ts';
import type { FilterGroup } from '@/components/filter/index.ts';
import { applyFilters } from '@/example/apply-filters.ts';
import {
  DEAL_FILTER_FIELDS,
  DEALS,
  INITIAL_FILTERS,
} from '@/example/records.ts';

/**
 * The "Pending & failure" requirements are parent-reported: the component
 * only emits `onChange`; a parent applies the group and owns success,
 * failure, and retry. This minimal fixture parent stands in for a real one
 * — no demo chrome — so that contract stays covered independent of the demo
 * harness. (Latency, the pending indicator, and the stale-response guard are
 * covered against the demo itself in `application.test.tsx`.)
 */
function FailableParent() {
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [failNextApply, setFailNextApply] = useState(false);
  const lastGroupRef = useRef<FilterGroup | null>(null);

  const applyGroup = (group: FilterGroup) => {
    lastGroupRef.current = group;
    if (failNextApply) {
      // Previous results stay untouched — only a flag flips.
      setFailed(true);
      return;
    }
    setFailed(false);
    setMatchedCount(applyFilters(DEALS, group).length);
  };

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={failNextApply}
          onChange={(event) => setFailNextApply(event.target.checked)}
        />
        Fail next apply
      </label>
      <Filter
        fields={DEAL_FILTER_FIELDS}
        initialFilters={INITIAL_FILTERS}
        onChange={applyGroup}
      />
      {failed ? (
        <div role="alert">
          Couldn&apos;t update results
          <button
            type="button"
            onClick={() =>
              lastGroupRef.current && applyGroup(lastGroupRef.current)
            }
          >
            Retry
          </button>
        </div>
      ) : null}
      {matchedCount !== null ? <p>{matchedCount} matched</p> : null}
    </div>
  );
}

describe('parent-reported failure and retry', () => {
  it('keeps previous results and stays editable on failure, then recovers on retry', async () => {
    const user = userEvent.setup();
    render(<FailableParent />);
    const addFilterInput = screen.getByRole('combobox', { name: 'Add filter' });

    // A first successful apply establishes a baseline result.
    await user.click(addFilterInput);
    await user.keyboard('deal{Enter}'); // Deal value
    await user.click(screen.getByRole('option', { name: 'greater than' }));
    await user.keyboard('50000{Enter}');
    // The group ANDs the seeded "Active is true" with the new condition.
    const expected = DEALS.filter(
      (deal) =>
        deal.active === true &&
        deal.dealValue !== null &&
        deal.dealValue > 50000,
    ).length;
    expect(screen.getByText(`${expected} matched`)).toBeInTheDocument();

    // Arm failure, then change the filters: the apply fails.
    await user.click(screen.getByRole('checkbox', { name: 'Fail next apply' }));
    await user.click(
      screen.getByRole('button', {
        name: 'Remove Deal value greater than 50000 filter',
      }),
    );

    // Failure is surfaced, the prior result count is still on screen, and the
    // component stays fully editable.
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't update results",
    );
    expect(screen.getByText(`${expected} matched`)).toBeInTheDocument();
    expect(addFilterInput).toBeEnabled();

    // Disarm failure and retry the same expression; it recovers.
    await user.click(screen.getByRole('checkbox', { name: 'Fail next apply' }));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const afterRemoval = DEALS.filter((deal) => deal.active === true).length;
    expect(screen.getByText(`${afterRemoval} matched`)).toBeInTheDocument();

    // Retry never duplicated the surviving token.
    const tokenRow = screen.getByRole('list', { name: 'Active filters' });
    expect(within(tokenRow).getAllByRole('group')).toHaveLength(1);
  });
});

const APPLY_DELAY = 100;

/**
 * A parent whose apply is asynchronous. It shows a loading indicator while a
 * request is in flight and hands each change's `onChange` AbortController to
 * the pending timeout, so a newer change cancels the older request — the
 * "latest result wins" contract, using the AbortController rather than only
 * a sequence guard.
 */
function LatentParent() {
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  const applyGroup = (group: FilterGroup, controller: AbortController) => {
    setPending(true);
    const timeoutId = window.setTimeout(() => {
      setPending(false);
      setMatchedCount(applyFilters(DEALS, group).length);
    }, APPLY_DELAY);
    controller.signal.addEventListener('abort', () => {
      window.clearTimeout(timeoutId);
    });
  };

  return (
    <div>
      <Filter fields={DEAL_FILTER_FIELDS} onChange={applyGroup} />
      {pending ? <p>Updating…</p> : null}
      {matchedCount !== null ? <p>{matchedCount} matched</p> : null}
    </div>
  );
}

describe('parent-reported loading and stale handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Point Testing Library's async wrapper at vitest's fake timers.
    vi.stubGlobal('jest', {
      advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const flush = async (milliseconds = APPLY_DELAY) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(milliseconds);
    });
  };

  const addDealValueOver = async (
    user: ReturnType<typeof userEvent.setup>,
    input: HTMLElement,
  ) => {
    await user.click(input);
    await user.keyboard('deal{Enter}'); // Deal value
    await user.click(screen.getByRole('option', { name: 'greater than' }));
    await user.keyboard('50000{Enter}');
  };

  it('shows a loading indicator while an apply is in flight, then clears it', async () => {
    const user = userEvent.setup({ delay: null });
    render(<LatentParent />);
    const input = screen.getByRole('combobox', { name: 'Add filter' });
    await addDealValueOver(user, input);

    expect(screen.getByText('Updating…')).toBeInTheDocument();
    await flush();
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument();
    const expected = DEALS.filter(
      (deal) => deal.dealValue !== null && deal.dealValue > 50000,
    ).length;
    expect(screen.getByText(`${expected} matched`)).toBeInTheDocument();
  });

  it('cancels a superseded apply so an older result never lands', async () => {
    const user = userEvent.setup({ delay: null });
    render(<LatentParent />);
    const input = screen.getByRole('combobox', { name: 'Add filter' });

    // Start the first apply, but supersede it before it resolves.
    await addDealValueOver(user, input);
    await flush(APPLY_DELAY / 2);
    await user.click(
      screen.getByRole('button', {
        name: 'Remove Deal value greater than 50000 filter',
      }),
    );
    await flush(APPLY_DELAY);

    // Only the newer (empty) group resolved; the first apply was aborted.
    expect(screen.getByText(`${DEALS.length} matched`)).toBeInTheDocument();
    const staleCount = DEALS.filter(
      (deal) => deal.dealValue !== null && deal.dealValue > 50000,
    ).length;
    expect(screen.queryByText(`${staleCount} matched`)).not.toBeInTheDocument();
  });
});
