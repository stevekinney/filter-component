import { expect, test } from '@playwright/test';

import { clearAllFilters, openReadyDemo, pickField, pickOption, popover } from './helpers.ts';

declare global {
  interface Window {
    __submitFired?: boolean;
  }
}

test.describe('form submission', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
    await clearAllFilters(page);
  });

  test('an external submit button fires the form submit event even while an open draft violates native input constraints', async ({
    page,
  }) => {
    await pickField(page, 'Last emailed');
    await pickOption(page, 'within last');
    // The amount input has `min={1}`, so this leaves the popover open on an
    // input real browsers consider invalid.
    await popover(page).getByLabel('Amount').fill('0');

    // Simulate a consumer's external submit control (`<button type="submit"
    // form="...">`) reached by keyboard, not a mouse click — a click would
    // start with a pointerdown outside the popover, which light-dismisses it
    // and removes the invalid input from the form before submission runs.
    // Reaching the button without a pointerdown (e.g. arriving by Tab, or a
    // JS-focused control) leaves the invalid draft mounted, so this is the
    // path that actually exercises native constraint validation.
    await page.evaluate(() => {
      const form = document.querySelector('form.filter') as HTMLFormElement;

      form.id = 'e2e-filter-form';
      window.__submitFired = false;
      form.addEventListener('submit', () => {
        window.__submitFired = true;
      });

      const button = document.createElement('button');

      button.type = 'submit';
      button.setAttribute('form', 'e2e-filter-form');
      document.body.appendChild(button);
      button.focus();
    });

    await expect(popover(page)).toBeVisible();
    await page.keyboard.press('Enter');

    expect(await page.evaluate(() => window.__submitFired)).toBe(true);
  });
});
