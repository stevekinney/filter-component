import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Filter } from './filter.tsx';
import {
  addStringFilter,
  FIELDS,
  queryTokens,
  setup,
} from './filter-test-setup.tsx';

describe('incomplete drafts', () => {
  it('keeps an abandoned mid-composition draft as a resumable incomplete-draft chip', async () => {
    const { onChange, user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}'); // field chosen, operator stage open
    await user.click(document.body);
    const incompleteDraftChip = screen.getByRole('group', {
      name: 'Incomplete filter: Name',
    });
    expect(incompleteDraftChip).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(
      within(incompleteDraftChip).getByTitle('Finish this filter'),
    );
    expect(screen.getByRole('dialog', { name: 'Name' })).toBeInTheDocument();
    await user.keyboard('{Enter}Maria{Enter}');
    expect(
      screen.getByRole('group', { name: 'Name is Maria' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Incomplete filter: Name' }),
    ).not.toBeInTheDocument();
  });

  it('discards the incomplete draft from its × control', async () => {
    const { user, addFilterInput } = setup();
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}');
    await user.click(document.body);
    await user.click(
      screen.getByRole('button', { name: 'Discard incomplete filter' }),
    );
    expect(queryTokens()).toHaveLength(0);
    expect(addFilterInput).toHaveFocus();
  });
});

describe('disabled and initialFilters', () => {
  it('disables the whole component', async () => {
    const { user, addFilterInput, view } = setup({ disabled: true });
    // The native fieldset disables every control inside it.
    expect(view.container.querySelector('fieldset')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(addFilterInput).toBeDisabled();
    await user.tab();
    expect(addFilterInput).not.toHaveFocus();
  });

  it('ignores chip keyboard actions on a still-focused chip after disabling', async () => {
    const { user, addFilterInput, onChange, view } = setup();
    await addStringFilter(user, addFilterInput);
    expect(onChange).toHaveBeenCalledTimes(1);

    const token = queryTokens()[0]!;
    token.focus();
    // Disabling flips the chip root's tabIndex to -1, but a tabindex change
    // never blurs an already-focused element — the chip is a div, so neither
    // the fieldset's native `disabled` nor pointer-events reaches it. Its
    // keyboard path has to go dead on its own. Raw dispatch, because a real
    // browser delivers keydown to a focused div inside a disabled fieldset
    // (only form controls go inert) while user-event redirects it away.
    view.rerender(<Filter fields={FIELDS} onChange={onChange} disabled />);
    expect(token).toHaveFocus();

    fireEvent.keyDown(token, { key: 'Delete' });
    expect(queryTokens()).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('accessibility plumbing', () => {
  it('announces committed changes through the polite live region', async () => {
    const { user, addFilterInput, view } = setup();
    await addStringFilter(user, addFilterInput);
    const liveRegion = view.container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toHaveTextContent('Filter added: Name is');
  });

  it('labels every icon-only button', async () => {
    const { user, addFilterInput } = setup();
    await addStringFilter(user, addFilterInput);
    expect(
      screen.getByRole('button', { name: 'Remove Name is Maria filter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Undo filter change' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear all filters' }),
    ).toBeInTheDocument();
  });

  it('re-announces identical consecutive messages so repeats are not lost', async () => {
    const { user, addFilterInput, view } = setup();
    await addStringFilter(user, addFilterInput);
    await addStringFilter(user, addFilterInput, 'Nadia');
    const liveRegion = view.container.querySelector('[aria-live="polite"]');

    await user.click(
      screen.getByRole('button', { name: 'Remove Name is Maria filter' }),
    );
    const firstAnnouncement = liveRegion?.textContent;
    await user.click(
      screen.getByRole('button', { name: 'Remove Name is Nadia filter' }),
    );
    // The text must mutate (a zero-width suffix) or screen readers would
    // stay silent on the identical repeat.
    expect(liveRegion?.textContent).not.toBe(firstAnnouncement);
    expect(liveRegion?.textContent).toContain('Filter removed: Name');
  });

  it('prevents native form submission', async () => {
    const onSubmitCapture = vi.fn((event: Event) => {
      expect((event as SubmitEvent).defaultPrevented).toBe(true);
    });
    const { user, addFilterInput, view } = setup();
    const form = view.container.querySelector('form');
    form?.addEventListener('submit', (event) => onSubmitCapture(event));
    await user.click(addFilterInput);
    await user.keyboard('{Enter}');
    // Enter with no menu open must not submit the form (submit is prevented
    // and nothing listens for it) — nothing to observe beyond no crash and no
    // navigation; the handler above asserts defaultPrevented if it ever fires.
    expect(onSubmitCapture).not.toHaveBeenCalled();
  });
});
