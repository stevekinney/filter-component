import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Filter } from '../filter.tsx';
import { addStringFilter, FIELDS, setup } from './filter-test-setup.tsx';

describe('onSubmit', () => {
  it('invokes onSubmit with an empty canonical group when there are no filters', () => {
    const onSubmit = vi.fn();
    render(<Filter fields={FIELDS} onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByRole('form', { name: 'Filters' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ combinator: 'and', conditions: [] });
  });

  it('invokes onSubmit with the complete valid group for populated filters', async () => {
    const onSubmit = vi.fn();
    const { user, addFilterInput } = setup({ onSubmit });
    await addStringFilter(user, addFilterInput);

    fireEvent.submit(screen.getByRole('form', { name: 'Filters' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      combinator: 'and',
      conditions: [expect.objectContaining({ fieldKey: 'name', value: 'Maria' })],
    });
    expect(onSubmit.mock.lastCall?.[0]).not.toHaveProperty('conditions.0.id');
  });

  it('excludes an incomplete draft from the submitted group', async () => {
    const onSubmit = vi.fn();
    const { user, addFilterInput } = setup({ onSubmit });
    await user.click(addFilterInput);
    await user.keyboard('na{Enter}'); // field: Name
    await user.keyboard('{Enter}'); // operator: is (equals), draft left incomplete

    fireEvent.submit(screen.getByRole('form', { name: 'Filters' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ combinator: 'and', conditions: [] });
  });

  it('excludes a committed condition invalidated by a changed field schema, while it stays visible', async () => {
    const onSubmit = vi.fn();
    const { user, addFilterInput, view } = setup({ onSubmit });
    await user.click(addFilterInput);
    await user.keyboard('sta{Enter}{Enter}');
    await user.click(screen.getByRole('option', { name: 'Lead' }));
    await addStringFilter(user, addFilterInput);

    const withoutStage = FIELDS.filter((field) => field.key !== 'stage');
    view.rerender(<Filter fields={withoutStage} onSubmit={onSubmit} />);

    expect(
      screen.getByRole('group', {
        name: 'stage is Lead (invalid: This field is no longer available)',
      }),
    ).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('form', { name: 'Filters' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      combinator: 'and',
      conditions: [expect.objectContaining({ fieldKey: 'name' })],
    });
  });

  it('does not invoke onSubmit for initialFilters', () => {
    const onSubmit = vi.fn();
    render(
      <Filter
        fields={FIELDS}
        onSubmit={onSubmit}
        initialFilters={{
          combinator: 'and',
          conditions: [{ fieldKey: 'name', type: 'string', operator: 'contains', value: 'corp' }],
        }}
      />,
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not invoke onSubmit merely because a filter was committed', async () => {
    const onSubmit = vi.fn();
    const { user, addFilterInput } = setup({ onSubmit });
    await addStringFilter(user, addFilterInput);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prevents the native submit default action', () => {
    const { view } = setup();

    const submitWasNotPrevented = fireEvent.submit(screen.getByRole('form', { name: 'Filters' }));

    expect(submitWasNotPrevented).toBe(false);
    expect(view.container).toBeInTheDocument();
  });

  it('is triggered by an external submit button using the form attribute', async () => {
    const onSubmit = vi.fn();
    const { user } = setup({ onSubmit, id: 'deal-filters' });
    render(
      <button type="submit" form="deal-filters">
        Apply filters
      </button>,
    );

    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ combinator: 'and', conditions: [] });
  });
});
