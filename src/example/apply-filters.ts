import type {
  FilterCondition,
  FilterGroup,
  WithinLastUnit,
} from '@/components/filter/index.ts';
import type { Deal } from './records.ts';

const UNIT_MILLISECONDS: Record<WithinLastUnit, number> = {
  days: 86_400_000,
  weeks: 604_800_000,
  months: 2_592_000_000, // The demo treats one month as 30 days.
};

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function matchesString(
  recorded: string,
  filter: Exclude<
    FilterCondition<'string'>,
    { operator: 'isEmpty' | 'isNotEmpty' }
  >,
): boolean {
  const value = filter.value.toLowerCase();
  const candidate = recorded.toLowerCase();
  switch (filter.operator) {
    case 'equals':
      return candidate === value;
    case 'notEquals':
      return candidate !== value;
    case 'contains':
      return candidate.includes(value);
    case 'notContains':
      return !candidate.includes(value);
    case 'startsWith':
      return candidate.startsWith(value);
    case 'endsWith':
      return candidate.endsWith(value);
  }
}

function matchesNumber(
  recorded: number,
  filter: Exclude<
    FilterCondition<'number'>,
    { operator: 'isEmpty' | 'isNotEmpty' }
  >,
): boolean {
  switch (filter.operator) {
    case 'equals':
      return recorded === filter.value;
    case 'notEquals':
      return recorded !== filter.value;
    case 'greaterThan':
      return recorded > filter.value;
    case 'greaterThanOrEqual':
      return recorded >= filter.value;
    case 'lessThan':
      return recorded < filter.value;
    case 'lessThanOrEqual':
      return recorded <= filter.value;
    case 'between':
      return recorded >= filter.value.from && recorded <= filter.value.to;
  }
}

function matchesEnum(
  recorded: string,
  filter: Exclude<
    FilterCondition<'enum'>,
    { operator: 'isEmpty' | 'isNotEmpty' }
  >,
): boolean {
  switch (filter.operator) {
    case 'equals':
      return recorded === filter.value;
    case 'notEquals':
      return recorded !== filter.value;
    case 'in':
      return filter.value.includes(recorded);
    case 'notIn':
      return !filter.value.includes(recorded);
  }
}

/**
 * Compares validated YYYY-MM-DD values lexicographically because that format
 * preserves chronological order.
 */
function matchesDate(
  recorded: string,
  filter: Exclude<
    FilterCondition<'date'>,
    { operator: 'isEmpty' | 'isNotEmpty' }
  >,
  now: Date,
): boolean {
  switch (filter.operator) {
    case 'on':
      return recorded === filter.value;
    case 'notOn':
      return recorded !== filter.value;
    case 'before':
      return recorded < filter.value;
    case 'onOrBefore':
      return recorded <= filter.value;
    case 'after':
      return recorded > filter.value;
    case 'onOrAfter':
      return recorded >= filter.value;
    case 'between':
      return recorded >= filter.value.from && recorded <= filter.value.to;
    case 'withinLast': {
      const cutoff =
        now.getTime() -
        filter.value.amount * UNIT_MILLISECONDS[filter.value.unit];
      const recordedTime = new Date(recorded).getTime();
      return recordedTime >= cutoff && recordedTime <= now.getTime();
    }
  }
}

function matches(deal: Deal, filter: FilterCondition, now: Date): boolean {
  const recorded = deal[filter.fieldKey as keyof Deal];
  if (filter.operator === 'isEmpty') return isEmptyValue(recorded);
  if (filter.operator === 'isNotEmpty') return !isEmptyValue(recorded);
  if (isEmptyValue(recorded)) return false;
  switch (filter.type) {
    case 'string':
      return matchesString(String(recorded), filter);
    case 'number':
      return matchesNumber(Number(recorded), filter);
    case 'boolean':
      return recorded === filter.value;
    case 'enum':
      return matchesEnum(String(recorded), filter);
    case 'date':
      return matchesDate(String(recorded), filter, now);
  }
}

function matchesMember(
  deal: Deal,
  member: FilterCondition | FilterGroup,
  now: Date,
): boolean {
  if ('combinator' in member) return matchesGroup(deal, member, now);
  return matches(deal, member, now);
}

function matchesGroup(deal: Deal, group: FilterGroup, now: Date): boolean {
  if (group.conditions.length === 0) return true;
  return group.combinator === 'and'
    ? group.conditions.every((member) => matchesMember(deal, member, now))
    : group.conditions.some((member) => matchesMember(deal, member, now));
}

export function applyFilters(
  deals: Deal[],
  group: FilterGroup,
  now: Date = new Date(),
): Deal[] {
  if (group.conditions.length === 0) return deals;
  return deals.filter((deal) => matchesGroup(deal, group, now));
}
