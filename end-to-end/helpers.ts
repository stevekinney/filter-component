import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Shared locators and flows for driving the filter component through the
 * demo application. All interactions go through accessible roles and names —
 * the same surface a user (or assistive technology) sees.
 */

export const addFilterInput = (page: Page): Locator =>
  page.getByRole('combobox', { name: 'Add filter' });

export const popover = (page: Page): Locator => page.getByRole('dialog');

export const filterTokenList = (page: Page): Locator =>
  page.getByRole('list', { name: 'Active filters' });

export const filterToken = (page: Page, phrase: string | RegExp): Locator =>
  filterTokenList(page).getByRole('group', { name: phrase });

export const joinerButton = (page: Page, joiner: 'and' | 'or'): Locator =>
  page.getByRole('button', {
    name: `Joined by ${joiner}. Switch to ${
      joiner === 'and' ? 'or' : 'and'
    } — grouping adjusts automatically.`,
  });

export const resultCount = (page: Page): Locator =>
  page.locator('.example-count');

export const liveRegion = (page: Page): Locator =>
  page.locator('.filter [aria-live="polite"]');

export const onChangePayloadPane = (page: Page): Locator =>
  page.locator('.example-panes pre');

/**
 * Load the demo and wait for the seeded "Active is true" filter to apply
 * (8 of the 12 deals are active).
 */
export async function openReadyDemo(page: Page): Promise<void> {
  await page.goto('/');
  await expect(resultCount(page)).toHaveText('8 of 12 deals');
}

export async function clearAllFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(resultCount(page)).toHaveText('12 of 12 deals');
}

export async function pickField(page: Page, label: string): Promise<void> {
  await addFilterInput(page).click();
  await addFilterInput(page).fill(label);
  await popover(page).getByRole('option', { name: label }).click();
}

export async function pickOption(page: Page, label: string): Promise<void> {
  await popover(page).getByRole('option', { name: label, exact: true }).click();
}

export async function applyValue(page: Page): Promise<void> {
  await popover(page).getByRole('button', { name: 'Apply' }).click();
}

export async function addSingleValueFilter(
  page: Page,
  field: string,
  operator: string,
  value: string,
): Promise<void> {
  await pickField(page, field);
  await pickOption(page, operator);
  await popover(page).getByLabel('Value').fill(value);
  await applyValue(page);
}
