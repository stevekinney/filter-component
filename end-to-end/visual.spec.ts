import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  applyValue,
  filterToken,
  joinerButton,
  openReadyDemo,
  pickField,
  pickOption,
  popover,
} from './helpers.ts';

/**
 * Visual regression coverage: pixel snapshots of the filter row and every
 * popover stage, so unintentional styling changes fail the suite. Baselines
 * live next to this file; refresh intentional changes with
 * `bun run test:e2e:update-snapshots`.
 */

const filterForm = (page: Page) => page.locator('form.filter');
const popoverBox = (page: Page) => page.locator('.filter-popover');

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
    await page.evaluate(() => document.fonts.ready);
  });

  test('filter row with the seeded token', async ({ page }) => {
    await expect(filterForm(page)).toHaveScreenshot('row-idle.png');
  });

  test('filter row with tokens of several types', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    await pickOption(page, 'Lead');
    await pickOption(page, 'Negotiation');
    await applyValue(page);
    await expect(
      filterToken(page, 'Stage is any of Lead, Negotiation'),
    ).toBeVisible();
    await expect(filterForm(page)).toHaveScreenshot('row-mixed-chips.png');
  });

  test('filter row with a bracketed and-run', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await addSingleValueFilter(page, 'Deal value', 'greater than', '10');
    // Flip the last gap: the first two chips become a bracketed and-run.
    await joinerButton(page, 'and').last().click();
    await expect(
      filterToken(page, /^Active is true \(in a group matching all\)/),
    ).toBeVisible();
    await expect(filterForm(page)).toHaveScreenshot('row-grouped-chips.png');
  });

  test('filter row with an invalid token', async ({ page }) => {
    // ?invalid seeds a token whose field is not in the schema (see the demo's
    // initialFilterGroup); it renders flagged without any user action.
    await page.goto('/?invalid');
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole('button', { name: /Fix invalid filter/ }),
    ).toBeVisible();
    await expect(filterForm(page)).toHaveScreenshot('row-invalid-chip.png');
  });

  test('filter row with an incomplete draft', async ({ page }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'contains');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await expect(
      page.getByRole('group', { name: 'Incomplete filter: Name' }),
    ).toBeVisible();
    await expect(filterForm(page)).toHaveScreenshot(
      'row-incomplete-draft-token.png',
    );
  });

  test('filter row while disabled', async ({ page }) => {
    await page.getByLabel('Disabled', { exact: true }).check();
    await expect(addFilterInput(page)).toBeDisabled();
    await expect(filterForm(page)).toHaveScreenshot('row-disabled.png');
  });

  test('filter row with a focused token', async ({ page }) => {
    await addFilterInput(page).click();
    await page.keyboard.press('Backspace');
    await expect(filterToken(page, 'Active is true')).toBeFocused();
    await expect(filterForm(page)).toHaveScreenshot('row-chip-focused.png');
  });

  test('save-view flow', async ({ page }) => {
    await page.getByRole('button', { name: 'Saved views' }).click();
    await popover(page)
      .getByRole('button', { name: 'Save current filters…' })
      .click();
    await popover(page).getByLabel('View name').fill('Active deals');
    await expect(popoverBox(page)).toHaveScreenshot('popover-save-view.png');
  });

  test('saved-views menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Saved views' }).click();
    await popover(page)
      .getByRole('button', { name: 'Save current filters…' })
      .click();
    await popover(page).getByLabel('View name').fill('Active deals');
    await popover(page)
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await page.getByRole('button', { name: 'Saved views' }).click();
    await expect(
      popover(page).getByRole('button', { name: 'Active deals', exact: true }),
    ).toBeVisible();
    await expect(popoverBox(page)).toHaveScreenshot('popover-saved-views.png');
  });

  test('field suggestion menu', async ({ page }) => {
    await addFilterInput(page).click();
    await page.keyboard.press('ArrowDown');
    await expect(popoverBox(page)).toBeVisible();
    await expect(popoverBox(page)).toHaveScreenshot('popover-field-menu.png');
  });

  test('field search while editing a token', async ({ page }) => {
    await filterToken(page, 'Active is true')
      .getByTitle('Change field')
      .click();
    await popover(page).getByLabel('Search fields').fill('date');
    await expect(popoverBox(page)).toHaveScreenshot('popover-field-search.png');
  });

  test('operator list', async ({ page }) => {
    await pickField(page, 'Name');
    await expect(popoverBox(page)).toHaveScreenshot(
      'popover-operator-list.png',
    );
  });

  test('boolean collapsed list with the current choice checked', async ({
    page,
  }) => {
    await filterToken(page, 'Active is true')
      .getByTitle('Change value')
      .click();
    await expect(popoverBox(page)).toHaveScreenshot('popover-boolean-list.png');
  });

  test('text value editor', async ({ page }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'contains');
    await popover(page).getByLabel('Value').fill('corp');
    await expect(popoverBox(page)).toHaveScreenshot('popover-value-text.png');
  });

  test('value editor with a validation error', async ({ page }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'is');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toBeVisible();
    await expect(popoverBox(page)).toHaveScreenshot('popover-value-error.png');
  });

  test('number range editor', async ({ page }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'between');
    await popover(page).getByLabel('From').fill('10000');
    await popover(page).getByLabel('To').fill('70000');
    await expect(popoverBox(page)).toHaveScreenshot('popover-number-range.png');
  });

  test('enum multi-select with selections', async ({ page }) => {
    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    await pickOption(page, 'Lead');
    await pickOption(page, 'Negotiation');
    await expect(popoverBox(page)).toHaveScreenshot('popover-enum-multi.png');
  });

  test('date value editor', async ({ page }) => {
    await pickField(page, 'Close date');
    await pickOption(page, 'is before');
    await popover(page).getByLabel('Value').fill('2026-06-01');
    await expect(popoverBox(page)).toHaveScreenshot('popover-date.png');
  });

  test('duration editor for within-last', async ({ page }) => {
    await pickField(page, 'Last emailed');
    await pickOption(page, 'within last');
    await popover(page).getByLabel('Amount').fill('30');
    await expect(popoverBox(page)).toHaveScreenshot('popover-duration.png');
  });
});
