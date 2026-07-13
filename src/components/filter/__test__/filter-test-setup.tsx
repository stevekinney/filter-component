import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Filter } from '../filter.tsx';
import type { FilterFieldDefinition } from '@/types/filter.ts';

export const FIELDS: FilterFieldDefinition[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'dealValue', label: 'Deal value', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  {
    key: 'stage',
    label: 'Stage',
    type: 'enum',
    options: ['Lead', 'Contacted', 'Closed won'],
  },
  { key: 'closeDate', label: 'Close date', type: 'date' },
  { key: 'lastEmailed', label: 'Last emailed', type: 'date' },
];

export function setup(props: Partial<Parameters<typeof Filter>[0]> = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const view = render(<Filter fields={FIELDS} onChange={onChange} {...props} />);
  const addFilterInput = screen.getByRole('combobox', { name: 'Add filter' });

  return { onChange, user, view, addFilterInput };
}

/** Committed tokens only — scoped to the row so the fieldset's group role is excluded. */
export function queryTokens() {
  return within(screen.getByRole('list', { name: 'Active filters' })).queryAllByRole('group');
}

export async function addStringFilter(
  user: ReturnType<typeof userEvent.setup>,
  addFilterInput: HTMLElement,
  value = 'Maria',
) {
  await user.click(addFilterInput);
  await user.keyboard('na{Enter}'); // field: Name
  await user.keyboard('{Enter}'); // operator: is (equals)
  await user.keyboard(`${value}{Enter}`); // value
}
