import { expect, test } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  filterToken,
  onChangePayloadPane,
  openReadyDemo,
  resultCount,
} from './helpers.ts';

test.describe('integration with the demo parent', () => {
  test('the initialized seed filter renders and applies on mount', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(filterToken(page, 'Active is true')).toBeVisible();
    const payload = onChangePayloadPane(page);
    await expect(payload).toContainText('"fieldKey": "active"');
    await expect(payload).not.toContainText('"id"');
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
  });

  test('applies a committed change to the in-memory results', async ({
    page,
  }) => {
    await openReadyDemo(page);
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await expect(resultCount(page)).toHaveText('1 of 12 deals');
  });

  test('disabling the component makes every control inert', async ({
    page,
  }) => {
    await openReadyDemo(page);
    await page.getByLabel('Disabled', { exact: true }).check();
    await expect(addFilterInput(page)).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Clear all filters' }),
    ).toBeDisabled();
    const token = filterToken(page, 'Active is true');
    await expect(token).toHaveAttribute('tabindex', '-1');
    await expect(token.getByTitle('Change field')).toBeDisabled();
    await expect(
      token.getByRole('button', { name: 'Remove Active is true filter' }),
    ).toBeDisabled();

    await page.getByLabel('Disabled', { exact: true }).uncheck();
    await expect(addFilterInput(page)).toBeEnabled();
    await expect(token).toHaveAttribute('tabindex', '0');
  });
});
