import { describe, expect, it } from 'vitest';

import type { FilterCondition, FilterGroup } from '@/components/filter/index.ts';

import { applyFilters } from './apply-filters.ts';
import { ASSIGNEE_OPTIONS, DEALS, PEOPLE } from './records.ts';

function groupWith(condition: FilterCondition): FilterGroup {
  return { combinator: 'and', conditions: [condition] };
}

function matchingDealNames(condition: FilterCondition): string[] {
  return applyFilters(DEALS, groupWith(condition)).map((deal) => deal.name);
}

describe('assigned-to enum filters', () => {
  it('maps source people to the canonical enum option shape', () => {
    expect(ASSIGNEE_OPTIONS).toEqual([
      { value: 'person-ada', label: 'Ada Lovelace' },
      { value: 'person-grace', label: 'Grace Hopper' },
      { value: 'person-katherine', label: 'Katherine Johnson' },
    ]);
  });

  it('matches a deal assigned to any selected person', () => {
    expect(
      matchingDealNames({
        fieldKey: 'assignedTo',
        type: 'enum',
        operator: 'containsAny',
        value: [PEOPLE[0].id, PEOPLE[1].id],
      }),
    ).toEqual([
      'Acme Corp renewal',
      'Maria Vega pilot',
      'Globex onboarding',
      'Initech migration',
      'Stark Industries POC',
      'Wayne Enterprises audit',
      'Umbrella Health trial',
    ]);
  });

  it('matches a deal assigned to every selected person', () => {
    expect(
      matchingDealNames({
        fieldKey: 'assignedTo',
        type: 'enum',
        operator: 'containsAll',
        value: [PEOPLE[0].id, PEOPLE[1].id],
      }),
    ).toEqual(['Acme Corp renewal', 'Umbrella Health trial']);
  });

  it('matches a deal assigned to none of the selected people, including empty arrays', () => {
    expect(
      matchingDealNames({
        fieldKey: 'assignedTo',
        type: 'enum',
        operator: 'containsNone',
        value: [PEOPLE[0].id, PEOPLE[1].id],
      }),
    ).toEqual([
      'Northwind expansion',
      'Momentum Labs intro',
      'Marigold Bakery starter',
      'Monsters Inc supply',
      'Sirius Cybernetics deal',
    ]);
  });

  it('treats an empty assignee array as empty', () => {
    expect(
      matchingDealNames({
        fieldKey: 'assignedTo',
        type: 'enum',
        operator: 'isEmpty',
      }),
    ).toEqual(['Momentum Labs intro', 'Marigold Bakery starter', 'Sirius Cybernetics deal']);
  });
});
