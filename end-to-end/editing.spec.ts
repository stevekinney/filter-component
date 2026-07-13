import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  applyValue,
  clearAllFilters,
  filterToken,
  filterTokenList,
  openReadyDemo,
  pickField,
  pickOption,
  popover,
  resultCount,
} from './helpers.ts';

async function addStageAnyOf(page: Page): Promise<void> {
  await pickField(page, 'Stage');
  await pickOption(page, 'is any of');
  await pickOption(page, 'Lead');
  await pickOption(page, 'Negotiation');
  await applyValue(page);
}

test.describe('editing committed filters', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
    await clearAllFilters(page);
  });

  test('changing the operator with a compatible value commits without reopening the editor', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await filterToken(page, 'Name contains corp').getByTitle('Change operator').click();
    await pickOption(page, 'starts with');
    await expect(popover(page)).toBeHidden();
    await expect(filterToken(page, 'Name starts with corp')).toBeVisible();
    await expect(resultCount(page)).toHaveText('0 of 12 deals');
  });

  test('changing to a different value shape carries the value into the editor', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Deal value', 'is', '42000');
    await filterToken(page, 'Deal value is 42000').getByTitle('Change operator').click();
    await pickOption(page, 'between');
    await expect(popover(page).getByLabel('From')).toHaveValue('42000');
    await popover(page).getByLabel('To').fill('99000');
    await applyValue(page);
    await expect(filterToken(page, 'Deal value between 42000 and 99000')).toBeVisible();
  });

  test('changing the value pre-fills the editor with the current value', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await filterToken(page, 'Name contains corp').getByTitle('Change value').click();
    await expect(popover(page).getByLabel('Value')).toHaveValue('corp');
    await popover(page).getByLabel('Value').fill('labs');
    await applyValue(page);
    await expect(filterToken(page, 'Name contains labs')).toBeVisible();
    await expect(resultCount(page)).toHaveText('1 of 12 deals');
  });

  test('changing the field restarts operator and value selection', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await filterToken(page, 'Name contains corp').getByTitle('Change field').click();
    const search = popover(page).getByLabel('Search fields');
    await expect(search).toBeFocused();
    await search.fill('stage');
    await popover(page).getByRole('option', { name: 'Stage' }).click();
    await pickOption(page, 'is');
    await pickOption(page, 'Lead');
    await expect(filterToken(page, 'Stage is Lead')).toBeVisible();
    await expect(filterToken(page, 'Name contains corp')).toBeHidden();
  });

  test('re-picking the same field is a no-op edit', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await filterToken(page, 'Name contains corp').getByTitle('Change field').click();
    await popover(page).getByRole('option', { name: 'Name' }).click();
    await expect(popover(page)).toBeHidden();
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
  });

  test('boolean tokens collapse operator and value edits into one list', async ({ page }) => {
    await pickField(page, 'Active');
    await pickOption(page, 'is true');
    const token = filterToken(page, 'Active is true');
    await token.getByTitle('Change value').click();
    await expect(popover(page).getByRole('option', { name: 'is true' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await pickOption(page, 'is false');
    await expect(filterToken(page, 'Active is false')).toBeVisible();
    await expect(resultCount(page)).toHaveText('3 of 12 deals');
  });

  test('editing a multi-select value pre-checks the current selection', async ({ page }) => {
    await addStageAnyOf(page);
    await filterToken(page, 'Stage is any of Lead, Negotiation')
      .getByTitle('Change values')
      .first()
      .click();
    await expect(popover(page).getByRole('option', { name: 'Lead' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(popover(page).getByRole('option', { name: 'Negotiation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(popover(page).getByRole('option', { name: 'Contacted' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await pickOption(page, 'Contacted');
    await applyValue(page);
    await expect(filterToken(page, 'Stage is any of Lead, Negotiation, Contacted')).toBeVisible();
  });

  test('removing one enum pill keeps the rest of the filter', async ({ page }) => {
    await addStageAnyOf(page);
    await page.getByRole('button', { name: 'Remove Lead from Stage filter' }).click();
    await expect(filterToken(page, 'Stage is any of Negotiation')).toBeVisible();
    await expect(resultCount(page)).toHaveText('2 of 12 deals');
  });

  test('removing the last enum pill removes the whole token', async ({ page }) => {
    await addStageAnyOf(page);
    await page.getByRole('button', { name: 'Remove Lead from Stage filter' }).click();
    await page.getByRole('button', { name: 'Remove Negotiation from Stage filter' }).click();
    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(0);
    await expect(resultCount(page)).toHaveText('12 of 12 deals');
  });

  test('long values truncate in the token but stay fully readable in the editor', async ({
    page,
  }) => {
    const longValue = 'an extremely long value that cannot possibly fit inside one token';
    await addSingleValueFilter(page, 'Name', 'contains', longValue);
    const valueButton = filterToken(page, `Name contains ${longValue}`).getByTitle('Change value');
    await expect(valueButton).toHaveCSS('text-overflow', 'ellipsis');
    const isOverflowing = await valueButton.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(isOverflowing).toBe(true);
    await valueButton.click();
    await expect(popover(page).getByLabel('Value')).toHaveValue(longValue);
  });

  test('cancelling an edit with Escape leaves the token untouched', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await filterToken(page, 'Name contains corp').getByTitle('Change value').click();
    await popover(page).getByLabel('Value').fill('something else');
    await page.keyboard.press('Escape');
    await expect(popover(page)).toBeHidden();
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
    await expect(addFilterInput(page)).not.toBeFocused();
  });
});
