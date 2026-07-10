import { expect, test } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  applyValue,
  filterToken,
  filterTokenList,
  openReadyDemo,
  pickField,
  pickOption,
  popover,
  resultCount,
} from './helpers.ts';

test.describe('undo and redo', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
  });

  test('initialized filters create no history entry', async ({ page }) => {
    await expect(filterToken(page, 'Active is true')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Undo filter change' }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Redo filter change' }),
    ).toBeHidden();
  });

  test('undo reverts the last commit and redo restores it', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await expect(resultCount(page)).toHaveText('1 of 12 deals');

    await page.getByRole('button', { name: 'Undo filter change' }).click();
    await expect(filterToken(page, 'Name contains corp')).toBeHidden();
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
    await expect(
      page.getByRole('button', { name: 'Undo filter change' }),
    ).toBeHidden();

    await page.getByRole('button', { name: 'Redo filter change' }).click();
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
    await expect(resultCount(page)).toHaveText('1 of 12 deals');
    await expect(
      page.getByRole('button', { name: 'Redo filter change' }),
    ).toBeHidden();
  });

  test('a new commit clears the redo future', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await page.getByRole('button', { name: 'Undo filter change' }).click();
    await addSingleValueFilter(page, 'Name', 'contains', 'labs');
    await expect(
      page.getByRole('button', { name: 'Redo filter change' }),
    ).toBeHidden();
  });

  test('clear all removes every filterToken and is undoable', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(0);
    await expect(resultCount(page)).toHaveText('12 of 12 deals');

    await page.getByRole('button', { name: 'Undo filter change' }).click();
    await expect(filterToken(page, 'Active is true')).toBeVisible();
    await expect(filterToken(page, 'Name contains a')).toBeVisible();
  });

  test('repeated undo walks back through every change', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await page
      .getByRole('button', { name: 'Remove Name contains corp filter' })
      .click();
    await page
      .getByRole('button', { name: 'Remove Active is true filter' })
      .click();
    await expect(filterTokenList(page).getByRole('listitem')).toHaveCount(0);

    const undo = page.getByRole('button', { name: 'Undo filter change' });
    await undo.click(); // restore "Active is true"
    await expect(filterToken(page, 'Active is true')).toBeVisible();
    await undo.click(); // restore "Name contains corp"
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
    await undo.click(); // back to the seeded state alone
    await expect(filterToken(page, 'Name contains corp')).toBeHidden();
    await expect(filterToken(page, 'Active is true')).toBeVisible();
    await expect(undo).toBeHidden();
  });
});

test.describe('incomplete drafts', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
  });

  test('clicking away mid-composition keeps the draft as an incomplete-draft chip', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await expect(popover(page)).toBeVisible();
    await page.getByRole('heading', { name: 'Filter' }).click();
    await expect(popover(page)).toBeHidden();
    const incompleteDraftChip = page.getByRole('group', {
      name: 'Incomplete filter: Name',
    });
    await expect(incompleteDraftChip).toBeVisible();
  });

  test('light-dismissing an edit of an existing token discards it without preserving a draft', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await filterToken(page, 'Name contains corp')
      .getByTitle('Change value')
      .click();
    await popover(page).getByLabel('Value').fill('labs');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await expect(popover(page)).toBeHidden();
    // The token keeps its committed value and no incomplete filterToken appears.
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
    await expect(
      page.getByRole('group', { name: /Incomplete filter/ }),
    ).toHaveCount(0);
  });

  test('resuming an incomplete draft reopens the stage it was left at', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'contains');
    await popover(page).getByLabel('Value').fill('acm');
    await page.getByRole('heading', { name: 'Filter' }).click();

    const incompleteDraftChip = page.getByRole('group', {
      name: 'Incomplete filter: Name',
    });
    await expect(incompleteDraftChip).toContainText('contains');
    await incompleteDraftChip.getByTitle('Finish this filter').click();
    // Straight back into the value editor, draft intact.
    await expect(popover(page).getByLabel('Value')).toHaveValue('acm');
    await popover(page).getByLabel('Value').fill('acme');
    await applyValue(page);
    await expect(filterToken(page, 'Name contains acme')).toBeVisible();
    await expect(incompleteDraftChip).toBeHidden();
  });

  test('discarding an incomplete draft removes it and refocuses the add-filter input', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await page
      .getByRole('button', { name: 'Discard incomplete filter' })
      .click();
    await expect(
      page.getByRole('group', { name: 'Incomplete filter: Name' }),
    ).toBeHidden();
    await expect(addFilterInput(page)).toBeFocused();
  });

  test('cancelling with Escape discards the draft without preserving it', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await page.keyboard.press('Escape');
    await expect(popover(page)).toBeHidden();
    await expect(
      page.getByRole('group', { name: 'Incomplete filter: Name' }),
    ).toBeHidden();
  });

  test('an incomplete draft never reaches onChange or the results', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'contains');
    await popover(page).getByLabel('Value').fill('zzz');
    await page.getByRole('heading', { name: 'Filter' }).click();
    // Results still reflect only the committed seed filter.
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
    await expect(page.locator('.demo-harness-panes pre')).not.toContainText(
      'zzz',
    );
  });

  test('starting a new composition replaces the incomplete draft when abandoned again', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await expect(
      page.getByRole('group', { name: 'Incomplete filter: Name' }),
    ).toBeVisible();
    await pickField(page, 'Stage');
    await page.getByRole('heading', { name: 'Filter' }).click();
    await expect(
      page.getByRole('group', { name: 'Incomplete filter: Stage' }),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Incomplete filter: Name' }),
    ).toBeHidden();
  });
});
