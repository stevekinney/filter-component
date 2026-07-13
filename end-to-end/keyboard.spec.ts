import { expect, test } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  clearAllFilters,
  filterToken,
  joinerButton,
  liveRegion,
  openReadyDemo,
  popover,
  resultCount,
} from './helpers.ts';

test.describe('keyboard interaction', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
  });

  test('a filter can be composed entirely with the keyboard', async ({ page }) => {
    await clearAllFilters(page);
    await addFilterInput(page).click();
    await page.keyboard.type('deal');
    await expect(addFilterInput(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter'); // accept "Deal value"
    // Operator list receives focus; equals → notEquals → greaterThan.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); // "greater than"
    await page.keyboard.type('50000');
    await page.keyboard.press('Enter');
    await expect(filterToken(page, 'Deal value greater than 50000')).toBeVisible();
    await expect(resultCount(page)).toHaveText('5 of 12 deals');
    await expect(addFilterInput(page)).toBeFocused();
  });

  test('ArrowDown opens the field menu and ArrowUp wraps to the last field', async ({ page }) => {
    await addFilterInput(page).click();
    await expect(addFilterInput(page)).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowDown');
    await expect(addFilterInput(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(popover(page).getByRole('option', { name: 'Name' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowUp');
    await expect(popover(page).getByRole('option', { name: 'Last emailed' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('Escape first clears the query, then closes the menu', async ({ page }) => {
    await addFilterInput(page).click();
    await addFilterInput(page).fill('na');
    await page.keyboard.press('Escape');
    await expect(addFilterInput(page)).toHaveValue('');
    await expect(addFilterInput(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(addFilterInput(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('Tab accepts the highlighted field suggestion once a query is typed', async ({ page }) => {
    await addFilterInput(page).click();
    await addFilterInput(page).fill('sta');
    await page.keyboard.press('Tab');
    await expect(popover(page)).toHaveAttribute('aria-label', 'Stage');
  });

  test('Backspace in the empty add-filter input focuses the last token; Delete removes it', async ({
    page,
  }) => {
    await addFilterInput(page).click();
    await page.keyboard.press('Backspace');
    await expect(filterToken(page, 'Active is true')).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(filterToken(page, 'Active is true')).toBeHidden();
    await expect(addFilterInput(page)).toBeFocused();
    await expect(resultCount(page)).toHaveText('12 of 12 deals');
  });

  test('Enter drills into a token, arrows traverse segments, Escape returns to the root', async ({
    page,
  }) => {
    const token = filterToken(page, 'Active is true');
    await addFilterInput(page).click();
    await page.keyboard.press('Backspace'); // focus the token root
    await page.keyboard.press('Enter');
    await expect(token.getByTitle('Change field')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(token.getByTitle('Change operator')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(token).toBeFocused();
    await page.keyboard.press('ArrowDown'); // re-enter from the root
    await expect(token.getByTitle('Change field')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(token).toBeFocused();
  });

  test('Delete on a segment refocuses the token root before a second press removes it', async ({
    page,
  }) => {
    const token = filterToken(page, 'Active is true');
    await addFilterInput(page).click();
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter'); // onto the field segment
    await page.keyboard.press('Delete');
    await expect(token).toBeVisible();
    await expect(token).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(token).toBeHidden();
  });

  test('Tab visits every token in order and then the add-filter input', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await addSingleValueFilter(page, 'Deal value', 'greater than', '10');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await page.keyboard.press('Tab');
    await expect(filterToken(page, 'Active is true')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(filterToken(page, 'Name contains corp')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(filterToken(page, 'Deal value greater than 10')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(addFilterInput(page)).toBeFocused();
  });

  test('arrow keys sequence chip → joiner → chip and back to the add-filter input', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await addFilterInput(page).click();
    await page.keyboard.press('ArrowLeft');
    await expect(filterToken(page, 'Name contains corp')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(joinerButton(page, 'and')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(filterToken(page, 'Active is true')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // already the first chip — stays put
    await expect(filterToken(page, 'Active is true')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(joinerButton(page, 'and')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(filterToken(page, 'Name contains corp')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(addFilterInput(page)).toBeFocused();
  });

  test('Enter flips the focused joiner, keeps focus, and announces the change', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await addFilterInput(page).click();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(joinerButton(page, 'and')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(joinerButton(page, 'or')).toBeFocused();
    await expect(liveRegion(page)).toHaveText(/Filters combined with or; grouping updated/);
    await page.keyboard.press(' ');
    await expect(joinerButton(page, 'and')).toBeFocused();
    await expect(liveRegion(page)).toHaveText(/Filters combined with and; grouping updated/);
  });

  test('Escape in an edit popover returns focus to the segment that opened it', async ({
    page,
  }) => {
    const operatorSegment = filterToken(page, 'Active is true').getByTitle('Change operator');
    await operatorSegment.click();
    await expect(popover(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover(page)).toBeHidden();
    await expect(operatorSegment).toBeFocused();
  });

  test('keyboard focus is indicated on the active option in choice lists', async ({ page }) => {
    await clearAllFilters(page);
    await addFilterInput(page).click();
    await page.keyboard.type('name');
    await page.keyboard.press('Enter'); // operator list receives focus
    const activeOption = popover(page).locator('[data-active]');
    await expect(activeOption).toHaveCSS('outline-style', 'solid');
    // The ring follows the active option as arrows move it.
    await page.keyboard.press('ArrowDown');
    await expect(popover(page).getByRole('option', { name: 'is not', exact: true })).toHaveCSS(
      'outline-style',
      'solid',
    );
  });

  test('multi-select supports Space to toggle and Enter to apply', async ({ page }) => {
    await clearAllFilters(page);
    await addFilterInput(page).click();
    await page.keyboard.type('stage');
    await page.keyboard.press('Enter'); // field: Stage
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // equals → notEquals → in
    await page.keyboard.press('Enter'); // "is any of"
    await page.keyboard.press('Space'); // toggle "Lead"
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space'); // toggle "Contacted"
    await page.keyboard.press('Enter');
    await expect(filterToken(page, 'Stage is any of Lead, Contacted')).toBeVisible();
    await expect(resultCount(page)).toHaveText('4 of 12 deals');
  });
});
