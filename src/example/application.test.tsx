import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Application from './application.tsx';
import { DEALS } from '@/example/records.ts';

describe('Application (demo parent)', () => {
  it('applies the initial filter to the in-memory array on mount', () => {
    render(<Application />);
    expect(
      screen.getByRole('group', { name: 'Active is true' }),
    ).toBeInTheDocument();
    const activeDeals = DEALS.filter((deal) => deal.active === true);
    // The count is split across a <strong> and a text node, so match on the
    // container's full text content rather than a single node.
    expect(screen.getByText(/of \d+ deals/)).toHaveTextContent(
      `${activeDeals.length} of ${DEALS.length} deals`,
    );
    expect(screen.getByText('Acme Corp renewal')).toBeInTheDocument();
    expect(screen.queryByText('Globex onboarding')).not.toBeInTheDocument();
  });

  it('disables the filter component from the harness', async () => {
    const user = userEvent.setup();
    render(<Application />);
    await user.click(screen.getByRole('checkbox', { name: 'Disabled' }));
    expect(screen.getByRole('combobox', { name: 'Add filter' })).toBeDisabled();
    const form = screen.getByRole('form', { name: 'Filters' });
    expect(form.querySelector('fieldset')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('logs onChange payloads in the harness event log', async () => {
    const user = userEvent.setup();
    render(<Application />);
    await user.click(
      screen.getByRole('button', { name: 'Remove Active is true filter' }),
    );
    const eventPane = screen.getByText('Event log')
      .parentElement as HTMLElement;
    expect(
      within(eventPane).getByText(/onChange\(0 filters, AND\)/),
    ).toBeInTheDocument();
  });
});
