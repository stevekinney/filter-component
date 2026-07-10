import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import Application from './application.tsx';

describe('Application schema test flags', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('narrows the Active field to equality choices', async () => {
    window.history.replaceState({}, '', '/?narrowBoolean');
    const user = userEvent.setup();
    render(<Application />);

    const activeToken = screen.getByRole('group', { name: 'Active is true' });
    await user.click(within(activeToken).getByTitle('Change operator'));
    const choices = screen.getByRole('listbox', { name: 'Active' });
    expect(
      within(choices)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['is true', 'is false']);
  });

  it('injects the long field-label fixture for layout checks', async () => {
    window.history.replaceState({}, '', '/?longLabel');
    const user = userEvent.setup();
    render(<Application />);

    const addFilter = screen.getByRole('combobox', { name: 'Add filter' });
    await user.type(addFilter, 'Customer');
    expect(
      screen.getByRole('option', {
        name: /CustomerRelationshipLifecycleQualificationStatusWithoutBreaks/,
      }),
    ).toBeVisible();
  });

  it('adds the flagged invalid seed for browser invalid-state checks', () => {
    window.history.replaceState({}, '', '/?invalid');
    render(<Application />);
    expect(
      screen.getByRole('group', {
        name: /owner contains acme \(invalid: This field is no longer available\)/,
      }),
    ).toBeInTheDocument();
  });

  it('logs a singular leaf count when the only filter is edited', async () => {
    const user = userEvent.setup();
    render(<Application />);
    const activeToken = screen.getByRole('group', { name: 'Active is true' });
    await user.click(within(activeToken).getByTitle('Change value'));
    await user.click(screen.getByRole('option', { name: 'is false' }));

    const eventPane = screen.getByText('Event log')
      .parentElement as HTMLElement;
    expect(
      within(eventPane).getByText(/onChange\(1 filter, AND\)/),
    ).toBeInTheDocument();
  });

  it('counts leaves inside a derived nested group', async () => {
    const user = userEvent.setup();
    render(<Application />);
    const addFilterInput = screen.getByRole('combobox', { name: 'Add filter' });
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}{Enter}Maria{Enter}');
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}{Enter}Nadia{Enter}');
    const joiners = screen.getAllByRole('button', { name: /^Joined by and/ });
    await user.click(joiners[1]!);

    const eventPane = screen.getByText('Event log')
      .parentElement as HTMLElement;
    expect(
      within(eventPane).getByText(/onChange\(3 filters, OR\)/),
    ).toBeInTheDocument();
  });
});
