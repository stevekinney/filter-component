import { expect, test } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  applyValue,
  clearAllFilters,
  filterToken,
  joinerButton,
  onChangePayloadPane,
  openReadyDemo,
  pickField,
  pickOption,
  popover,
  resultCount,
} from './helpers.ts';

test.describe('composing new filters', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
    await clearAllFilters(page);
  });

  test('string: contains commits a token and narrows results', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'corp');
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
    await expect(resultCount(page)).toHaveText('1 of 12 deals');
    await expect(page.locator('.example-table tbody tr')).toHaveText([
      /Acme Corp renewal/,
    ]);
    await expect(onChangePayloadPane(page)).toContainText(
      '"operator": "contains"',
    );
  });

  test('string: committing with Enter works like the apply button', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'starts with');
    await popover(page).getByLabel('Value').fill('m');
    await popover(page).getByLabel('Value').press('Enter');
    await expect(filterToken(page, 'Name starts with m')).toBeVisible();
    // Maria Vega pilot, Momentum Labs intro, Marigold Bakery, Monsters Inc.
    await expect(resultCount(page)).toHaveText('4 of 12 deals');
  });

  test('string: empty text value surfaces inline validation', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'contains');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toHaveText('Enter a value');
    await expect(popover(page)).toBeVisible();
    await popover(page).getByLabel('Value').fill('acme');
    await applyValue(page);
    await expect(filterToken(page, 'Name contains acme')).toBeVisible();
  });

  test('valueless operator commits immediately without a value editor', async ({
    page,
  }) => {
    await pickField(page, 'Name');
    await pickOption(page, 'is empty');
    await expect(popover(page)).toBeHidden();
    await expect(filterToken(page, 'Name is empty')).toBeVisible();
    await expect(resultCount(page)).toHaveText('0 of 12 deals');
  });

  test('isEmpty matches null record values', async ({ page }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'is empty');
    await expect(resultCount(page)).toHaveText('1 of 12 deals');
    await expect(page.locator('.example-table tbody tr')).toHaveText([
      /Momentum Labs intro/,
    ]);
  });

  test('number: greater than', async ({ page }) => {
    await addSingleValueFilter(page, 'Deal value', 'greater than', '50000');
    await expect(
      filterToken(page, 'Deal value greater than 50000'),
    ).toBeVisible();
    await expect(resultCount(page)).toHaveText('5 of 12 deals');
  });

  test('number: non-numeric input is rejected', async ({ page }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'is');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toHaveText('Enter a number');
  });

  test('number: between commits a range value', async ({ page }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'between');
    await popover(page).getByLabel('From').fill('10000');
    await popover(page).getByLabel('To').fill('70000');
    await applyValue(page);
    await expect(
      filterToken(page, 'Deal value between 10000 and 70000'),
    ).toBeVisible();
    await expect(resultCount(page)).toHaveText('5 of 12 deals');
  });

  test('number: inverted range surfaces validation and recovers', async ({
    page,
  }) => {
    await pickField(page, 'Deal value');
    await pickOption(page, 'between');
    await popover(page).getByLabel('From').fill('70000');
    await popover(page).getByLabel('To').fill('10000');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toHaveText(
      'First value must not exceed the second',
    );
    await popover(page).getByLabel('To').fill('90000');
    await applyValue(page);
    await expect(
      filterToken(page, 'Deal value between 70000 and 90000'),
    ).toBeVisible();
  });

  test('boolean: collapsed single-pick list commits in one step', async ({
    page,
  }) => {
    await pickField(page, 'Active');
    await expect(
      popover(page).getByRole('option', { name: 'is true' }),
    ).toBeVisible();
    await pickOption(page, 'is false');
    await expect(filterToken(page, 'Active is false')).toBeVisible();
    await expect(resultCount(page)).toHaveText('3 of 12 deals');
    await expect(onChangePayloadPane(page)).toContainText('"value": false');
  });

  test('boolean: a narrowed field shows only its allowed choices', async ({
    page,
  }) => {
    await page.goto('/?narrowBoolean');
    await expect(resultCount(page)).toHaveText('8 of 12 deals');
    await clearAllFilters(page);
    await pickField(page, 'Active');
    await expect(popover(page).getByRole('option')).toHaveText([
      'is true',
      'is false',
    ]);
  });

  test('boolean: is empty matches the null record', async ({ page }) => {
    await pickField(page, 'Active');
    await pickOption(page, 'is empty');
    await expect(filterToken(page, 'Active is empty')).toBeVisible();
    await expect(resultCount(page)).toHaveText('1 of 12 deals');
  });

  test('enum: single select commits from the options list', async ({
    page,
  }) => {
    await pickField(page, 'Stage');
    await pickOption(page, 'is');
    await pickOption(page, 'Negotiation');
    await expect(filterToken(page, 'Stage is Negotiation')).toBeVisible();
    await expect(resultCount(page)).toHaveText('2 of 12 deals');
  });

  test('enum: multi select renders value pills and applies as one filter', async ({
    page,
  }) => {
    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    await pickOption(page, 'Lead');
    await pickOption(page, 'Negotiation');
    await applyValue(page);
    const token = filterToken(page, 'Stage is any of Lead, Negotiation');
    await expect(token).toBeVisible();
    await expect(token.locator('.filter-token-pill')).toHaveCount(2);
    await expect(resultCount(page)).toHaveText('4 of 12 deals');
  });

  test('enum: multi select with nothing chosen is rejected', async ({
    page,
  }) => {
    await pickField(page, 'Stage');
    await pickOption(page, 'is none of');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toHaveText(
      'Choose at least one option',
    );
  });

  test('date: before a chosen day', async ({ page }) => {
    await pickField(page, 'Close date');
    await pickOption(page, 'is before');
    await popover(page).getByLabel('Value').fill('2026-06-01');
    await applyValue(page);
    await expect(
      filterToken(page, 'Close date is before 2026-06-01'),
    ).toBeVisible();
    await expect(resultCount(page)).toHaveText('3 of 12 deals');
  });

  test('date: between two days', async ({ page }) => {
    await pickField(page, 'Close date');
    await pickOption(page, 'between');
    await popover(page).getByLabel('From').fill('2026-07-01');
    await popover(page).getByLabel('To').fill('2026-08-31');
    await applyValue(page);
    await expect(resultCount(page)).toHaveText('5 of 12 deals');
  });

  test('date: missing range end is rejected', async ({ page }) => {
    await pickField(page, 'Close date');
    await pickOption(page, 'between');
    await popover(page).getByLabel('From').fill('2026-07-01');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toHaveText(
      'Choose both dates',
    );
  });

  test('date: after a specific day', async ({ page }) => {
    await pickField(page, 'Last emailed');
    await pickOption(page, 'is after');
    await popover(page).getByLabel('Value').fill('2026-07-01');
    await applyValue(page);
    await expect(
      filterToken(page, 'Last emailed is after 2026-07-01'),
    ).toBeVisible();
    await expect(resultCount(page)).toHaveText('6 of 12 deals');
  });

  test('date: within last commits a structured duration', async ({ page }) => {
    await pickField(page, 'Last emailed');
    await pickOption(page, 'within last');
    await popover(page).getByLabel('Amount').fill('30');
    await popover(page).getByLabel('Unit').selectOption('days');
    await applyValue(page);
    await expect(
      filterToken(page, 'Last emailed within last 30 days'),
    ).toBeVisible();
    await expect(onChangePayloadPane(page)).toContainText('"amount": 30');
    await expect(onChangePayloadPane(page)).toContainText('"unit": "days"');
  });

  test('date: duration must be a positive whole number', async ({ page }) => {
    await pickField(page, 'Last emailed');
    await pickOption(page, 'within last');
    await popover(page).getByLabel('Amount').fill('0');
    await applyValue(page);
    await expect(popover(page).getByRole('alert')).toHaveText(
      'Enter a positive whole number',
    );
  });

  test('joiner: flipping to or broadens results and back to and narrows them', async ({
    page,
  }) => {
    await pickField(page, 'Active');
    await pickOption(page, 'is false'); // 3 deals
    await pickField(page, 'Stage');
    await pickOption(page, 'is');
    await pickOption(page, 'Lead'); // and with "Active is false" → 0 deals
    await expect(resultCount(page)).toHaveText('0 of 12 deals');
    await expect(onChangePayloadPane(page)).toContainText(
      '"combinator": "and"',
    );

    await joinerButton(page, 'and').click();
    await expect(resultCount(page)).toHaveText('5 of 12 deals');
    await expect(onChangePayloadPane(page)).toContainText('"combinator": "or"');

    await joinerButton(page, 'or').click();
    await expect(resultCount(page)).toHaveText('0 of 12 deals');
  });

  test('joiner: appears only between chips, so it needs two filters', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: /^Joined by/ })).toBeHidden();
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await expect(page.getByRole('button', { name: /^Joined by/ })).toBeHidden();
    await addSingleValueFilter(page, 'Deal value', 'greater than', '10');
    await expect(joinerButton(page, 'and')).toBeVisible();
  });

  test('joiner: derives brackets around the and-run', async ({ page }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await addSingleValueFilter(page, 'Deal value', 'greater than', '10');
    await pickField(page, 'Active');
    await pickOption(page, 'is false');
    // Flip the second gap: the first two chips become a bracketed and-run.
    await joinerButton(page, 'and').last().click();
    await expect(
      filterToken(page, 'Name contains a (in a group matching all)'),
    ).toBeVisible();
    await expect(onChangePayloadPane(page)).toContainText('"combinator": "or"');

    // Flip it back: brackets dissolve and the run context disappears.
    await joinerButton(page, 'or').click();
    await expect(filterToken(page, 'Name contains a')).toBeVisible();
  });

  test('joiner: stays usable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await pickField(page, 'Active');
    await pickOption(page, 'is false');
    const joiner = joinerButton(page, 'and');
    await expect(joiner).toBeVisible();
    // The wrapped filter row must fit the narrow viewport.
    const formBox = await page.locator('form.filter').boundingBox();
    expect(formBox).not.toBeNull();
    if (formBox) expect(formBox.x + formBox.width).toBeLessThanOrEqual(375);
    await joiner.click();
    await expect(joinerButton(page, 'or')).toBeVisible();
  });

  test('multiple filters combine with AND', async ({ page }) => {
    await pickField(page, 'Active');
    await pickOption(page, 'is true');
    await pickField(page, 'Stage');
    await pickOption(page, 'is');
    await pickOption(page, 'Negotiation');
    await expect(resultCount(page)).toHaveText('2 of 12 deals');
    await expect(onChangePayloadPane(page)).toContainText(
      '"fieldKey": "active"',
    );
    await expect(onChangePayloadPane(page)).toContainText(
      '"fieldKey": "stage"',
    );
  });

  test('the add-filter input regains focus after committing so composition can chain', async ({
    page,
  }) => {
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await expect(addFilterInput(page)).toBeFocused();
  });
});
