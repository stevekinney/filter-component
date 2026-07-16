import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  addFilterInput,
  addSingleValueFilter,
  applyValue,
  clearAllFilters,
  filterToken,
  filterTokenList,
  joinerButton,
  liveRegion,
  openReadyDemo,
  pickField,
  pickOption,
  popover,
} from './helpers.ts';

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).include('form.filter').analyze();
  expect(results.violations).toEqual([]);
}

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
  });

  test('the idle component has no axe violations', async ({ page }) => {
    await expectNoAxeViolations(page);
  });

  test('the field menu has no axe violations', async ({ page }) => {
    await addFilterInput(page).click();
    await addFilterInput(page).fill('a');
    await expect(popover(page)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the value editor has no axe violations', async ({ page }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'contains');
    await expect(popover(page).getByLabel('Value')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the multi-select editor has no axe violations', async ({ page }) => {
    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    await expect(popover(page).getByRole('listbox')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('committed enum pills have no axe violations', async ({ page }) => {
    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    await pickOption(page, 'Lead');
    await pickOption(page, 'Negotiation');
    await applyValue(page);
    await expect(filterToken(page, 'Stage is any of Lead, Negotiation')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the in-menu save flow has no axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Saved views' }).click();
    await popover(page).getByRole('button', { name: 'Save current filters…' }).click();
    await expect(popover(page).getByLabel('View name')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the saved-views menu has no axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Saved views' }).click();
    await popover(page).getByRole('button', { name: 'Save current filters…' }).click();
    await popover(page).getByLabel('View name').fill('Active deals');
    await popover(page).getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Saved views' }).click();
    await expect(
      popover(page).getByRole('button', { name: 'Active deals', exact: true }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a grouped row with joiners and brackets has no axe violations', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await addSingleValueFilter(page, 'Deal value', 'greater than', '10');
    await joinerButton(page, 'and').last().click();
    await expect(filterToken(page, /^Active is true \(in a group matching all\)/)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('joiners are reachable stops with self-describing names, outside the Tab order', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    const joiner = joinerButton(page, 'and');
    await expect(joiner).toHaveAttribute('tabindex', '-1');
    await addFilterInput(page).click();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(joiner).toBeFocused();
  });

  test('an invalid token has no axe violations', async ({ page }) => {
    // ?invalid seeds a token whose field is not in the schema, so it renders
    // flagged on load (see the demo's initialFilterGroup).
    await page.goto('/?invalid');
    await expect(page.getByRole('button', { name: /Fix invalid filter/ })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a token exposes its full phrase as the accessible name', async ({ page }) => {
    await addSingleValueFilter(page, 'Deal value', 'at least', '10000');
    await expect(page.getByRole('group', { name: 'Deal value at least 10000' })).toBeVisible();
  });

  test('the token row is a labelled list with one item per filter', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await expect(filterTokenList(page)).toBeVisible();
    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(2);
  });

  test('every token is a tab stop', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await expect(page.locator('[data-token][tabindex="0"]')).toHaveCount(2);
    await expect(page.locator('[data-token][tabindex="-1"]')).toHaveCount(0);
  });

  test('the add-filter combobox wires aria-expanded and aria-activedescendant', async ({
    page,
  }) => {
    const input = addFilterInput(page);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await input.click();
    await input.fill('name');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const activeDescendant = await input.getAttribute('aria-activedescendant');
    if (activeDescendant === null) {
      throw new Error('Expected the open combobox to identify an active option');
    }
    expect(activeDescendant).not.toMatch(/\s/);
    await expect(page.locator(`[id=${JSON.stringify(activeDescendant)}]`)).toHaveRole('option');
  });

  test('changes are announced through the live region', async ({ page }) => {
    await clearAllFilters(page);
    await expect(liveRegion(page)).toHaveText('All filters cleared');

    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await expect(liveRegion(page)).toHaveText('Filter added: Name contains corp');

    await filterToken(page, 'Name contains corp').getByTitle('Change value').click();
    await popover(page).getByLabel('Value').fill('labs');
    await applyValue(page);
    await expect(liveRegion(page)).toHaveText('Filter updated: Name contains labs');

    await page.getByRole('button', { name: 'Remove Name contains labs filter' }).click();
    await expect(liveRegion(page)).toHaveText('Filter removed: Name');

    await page.getByRole('button', { name: 'Undo filter change' }).click();
    await expect(liveRegion(page)).toHaveText('Undid last filter change');

    await page.getByRole('button', { name: 'Redo filter change' }).click();
    await expect(liveRegion(page)).toHaveText('Redid filter change');
  });

  test('abandoning and discarding a draft is announced', async ({ page }) => {
    await pickField(page, 'Name');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await expect(liveRegion(page)).toHaveText('Filter incomplete — kept for later');
    await page.getByRole('button', { name: 'Discard incomplete filter' }).click();
    await expect(liveRegion(page)).toHaveText('Incomplete filter discarded');
  });

  test('validation errors are exposed as alerts tied to the input', async ({ page }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'is');
    await applyValue(page);
    const error = popover(page).getByRole('alert');
    await expect(error).toHaveText('Enter a number');
    const errorId = await error.getAttribute('id');
    await expect(popover(page).getByLabel('Value')).toHaveAttribute(
      'aria-describedby',
      errorId ?? '',
    );
  });
});
