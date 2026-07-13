import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addSingleValueFilter,
  filterToken,
  filterTokenList,
  liveRegion,
  onChangePayloadPane,
  openReadyDemo,
  popover,
  resultCount,
} from './helpers.ts';

const savedViewsButton = (page: Page) => page.getByRole('button', { name: 'Saved views' });

const saveAction = (page: Page) =>
  popover(page).getByRole('button', { name: 'Save current filters…' });

async function saveCurrentViewAs(page: Page, name: string): Promise<void> {
  await savedViewsButton(page).click();
  await saveAction(page).click();
  await popover(page).getByLabel('View name').fill(name);
  await popover(page).getByRole('button', { name: 'Save', exact: true }).click();
}

test.describe('saved views', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
  });

  test('saving a view persists it across a reload', async ({ page }) => {
    // The seeded "Active is true" group is unsaved, so the trigger is present
    // for its save action even before any view exists.
    await expect(savedViewsButton(page)).toBeVisible();

    await saveCurrentViewAs(page, 'Active deals');
    await expect(liveRegion(page)).toHaveText('View saved: Active deals');

    // Saving closes the menu and returns focus to the (still-mounted) trigger.
    await expect(popover(page)).not.toBeVisible();
    await expect(savedViewsButton(page)).toBeFocused();

    await page.reload();
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
    await expect(savedViewsButton(page)).toBeVisible();
    await savedViewsButton(page).click();
    await expect(
      popover(page).getByRole('button', { name: 'Active deals', exact: true }),
    ).toBeVisible();
  });

  test('loading a view replaces the row and undo/redo walk across it', async ({ page }) => {
    await saveCurrentViewAs(page, 'Active deals');
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await expect(resultCount(page)).toHaveText('1 of 12 deals');

    await savedViewsButton(page).click();
    await popover(page).getByRole('button', { name: 'Active deals', exact: true }).click();
    await expect(liveRegion(page)).toHaveText('View loaded: Active deals');

    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(1);
    await expect(filterToken(page, 'Active is true')).toBeVisible();
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
    await expect(onChangePayloadPane(page)).toContainText('"active"');

    await page.getByRole('button', { name: 'Undo filter change' }).click();
    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(2);
    await expect(resultCount(page)).toHaveText('1 of 12 deals');

    await page.getByRole('button', { name: 'Redo filter change' }).click();
    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(1);
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
  });

  test('removing the last view keeps the still-savable trigger alive', async ({ page }) => {
    await saveCurrentViewAs(page, 'Active deals');
    await savedViewsButton(page).click();

    await popover(page).getByRole('button', { name: 'Remove view: Active deals' }).click();
    await expect(liveRegion(page)).toHaveText('View removed: Active deals');

    await expect(popover(page)).not.toBeVisible();
    // The group no longer matches any view but is still savable, so the trigger
    // survives (for its save action) and holds focus.
    await expect(savedViewsButton(page)).toBeVisible();
    await expect(savedViewsButton(page)).toBeFocused();
    await savedViewsButton(page).click();
    await expect(saveAction(page)).toBeVisible();
  });

  test('removing one of several views keeps the menu open on the next view', async ({ page }) => {
    await saveCurrentViewAs(page, 'Active deals');
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await saveCurrentViewAs(page, 'Corp deals');

    await savedViewsButton(page).click();
    await popover(page).getByRole('button', { name: 'Remove view: Active deals' }).click();

    await expect(popover(page)).toBeVisible();
    const remaining = popover(page).getByRole('button', {
      name: 'Corp deals',
      exact: true,
    });
    await expect(remaining).toBeVisible();
    await expect(remaining).toBeFocused();
  });

  test('the saved-views menu is fully keyboard operable', async ({ page }) => {
    await saveCurrentViewAs(page, 'Active deals');
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await saveCurrentViewAs(page, 'Corp deals');
    // Saving lands focus on the trigger; ArrowDown opens onto the first view.
    await expect(savedViewsButton(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const activeDeals = popover(page).getByRole('button', {
      name: 'Active deals',
      exact: true,
    });
    const corpDeals = popover(page).getByRole('button', {
      name: 'Corp deals',
      exact: true,
    });
    await expect(activeDeals).toBeFocused();
    const activeDealsRow = activeDeals.locator('..');
    await expect
      .poll(() => activeDealsRow.evaluate((row) => getComputedStyle(row).outlineStyle))
      .toBe('solid');
    await expect
      .poll(() => activeDeals.evaluate((button) => getComputedStyle(button).outlineStyle))
      .toBe('none');

    // Arrows wrap; Home/End jump; ArrowRight/ArrowLeft reach the trash button.
    await page.keyboard.press('ArrowDown');
    await expect(corpDeals).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(activeDeals).toBeFocused();
    await page.keyboard.press('End');
    await expect(corpDeals).toBeFocused();
    await page.keyboard.press('Home');
    await expect(activeDeals).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const removeActiveDeals = popover(page).getByRole('button', {
      name: 'Remove view: Active deals',
    });
    await expect(removeActiveDeals).toBeFocused();
    await expect
      .poll(() =>
        removeActiveDeals.evaluate((button) => {
          const style = getComputedStyle(button);
          return {
            borderRadius: style.borderRadius,
            outlineStyle: style.outlineStyle,
          };
        }),
      )
      .toEqual({ borderRadius: '50%', outlineStyle: 'solid' });
    await expect
      .poll(() => activeDealsRow.evaluate((row) => getComputedStyle(row).outlineStyle))
      .toBe('none');
    await page.keyboard.press('ArrowLeft');
    await expect(activeDeals).toBeFocused();

    // Delete removes the focused view; its neighbor receives focus.
    await page.keyboard.press('Delete');
    await expect(liveRegion(page)).toHaveText('View removed: Active deals');
    await expect(corpDeals).toBeFocused();

    // Enter loads the focused view (already applied → announced as such) and
    // the menu closes back to the trigger.
    await page.keyboard.press('Enter');
    await expect(liveRegion(page)).toHaveText('View already applied: Corp deals');
    await expect(popover(page)).not.toBeVisible();
    await expect(savedViewsButton(page)).toBeFocused();

    // ArrowUp opens the menu onto the last view.
    await page.keyboard.press('ArrowUp');
    await expect(corpDeals).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(savedViewsButton(page)).toBeFocused();
  });

  test('an empty name is rejected inline', async ({ page }) => {
    await savedViewsButton(page).click();
    await saveAction(page).click();
    await popover(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popover(page).getByRole('alert')).toHaveText('Enter a name');
    const errorId = await popover(page).getByRole('alert').getAttribute('id');
    await expect(popover(page).getByLabel('View name')).toHaveAttribute(
      'aria-describedby',
      errorId ?? '',
    );
  });

  test('Escape closes the save flow and refocuses the trigger', async ({ page }) => {
    await savedViewsButton(page).click();
    await saveAction(page).click();
    await expect(popover(page).getByLabel('View name')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(popover(page)).not.toBeVisible();
    await expect(savedViewsButton(page)).toBeFocused();
  });

  test('corrupted stored views are ignored', async ({ page }) => {
    await page.evaluate(() => window.localStorage.setItem('filter.saved-views', '{corrupted'));
    await page.reload();
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
    await expect(savedViewsButton(page)).toBeVisible();
    await savedViewsButton(page).click();
    await expect(saveAction(page)).toBeVisible();
  });
});
