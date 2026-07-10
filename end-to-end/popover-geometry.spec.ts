import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  filterToken,
  openReadyDemo,
  popover,
} from './helpers.ts';

/**
 * Real-Chrome coverage for what jsdom cannot verify: the native popover's
 * top-layer geometry — CSS anchor positioning, `position-try-fallbacks`
 * collision flipping at the viewport edges, and anchor tracking during
 * scroll. Layout is the subject here, so these tests measure bounding boxes;
 * everything still locates elements through accessible roles and names.
 */

async function expectPopoverWithinViewport(page: Page): Promise<void> {
  const box = await popover(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test.describe('popover geometry', () => {
  test.beforeEach(async ({ page }) => {
    await openReadyDemo(page);
  });

  test('near the top edge the popover opens below its anchor and stays inside the viewport', async ({
    page,
  }) => {
    // The demo's filter row already sits near the top of the page.
    await addFilterInput(page).click();
    await addFilterInput(page).fill('a');
    await expect(popover(page)).toBeVisible();
    const anchor = await addFilterInput(page).boundingBox();
    const box = await popover(page).boundingBox();
    expect(box).not.toBeNull();
    expect(anchor).not.toBeNull();
    if (!box || !anchor) return;
    expect(box.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
    await expectPopoverWithinViewport(page);
  });

  test('composition popovers anchor to the draft preview once a field is chosen', async ({
    page,
  }) => {
    await addFilterInput(page).click();
    await addFilterInput(page).fill('name');
    // While choosing a field there is no draft yet — the menu hangs off the
    // add-filter input.
    const inputBox = await addFilterInput(page).boundingBox();
    let popoverBox = await popover(page).boundingBox();
    expect(inputBox).not.toBeNull();
    expect(popoverBox).not.toBeNull();
    if (!inputBox || !popoverBox) return;
    expect(Math.abs(popoverBox.x - inputBox.x)).toBeLessThanOrEqual(1);

    // Once the field is chosen, the popover describes the draft chip — it
    // must anchor there, not drift to the input further right.
    await popover(page).getByRole('option', { name: 'Name' }).click();
    const draftBox = await page.locator('[data-draft-preview]').boundingBox();
    popoverBox = await popover(page).boundingBox();
    expect(draftBox).not.toBeNull();
    expect(popoverBox).not.toBeNull();
    if (!draftBox || !popoverBox) return;
    expect(Math.abs(popoverBox.x - draftBox.x)).toBeLessThanOrEqual(1);
    expect(popoverBox.y).toBeGreaterThanOrEqual(draftBox.y + draftBox.height);
  });

  test('near the bottom edge the popover flips above its anchor', async ({
    page,
  }) => {
    // Push the filter row toward the bottom of the 800px-tall viewport so
    // the popover has no room below.
    await page.addStyleTag({
      content: 'body { padding-block-start: 620px; }',
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await addFilterInput(page).click();
    await addFilterInput(page).fill('a');
    await expect(popover(page)).toBeVisible();
    const anchor = await addFilterInput(page).boundingBox();
    const box = await popover(page).boundingBox();
    expect(box).not.toBeNull();
    expect(anchor).not.toBeNull();
    if (!box || !anchor) return;
    expect(box.y + box.height).toBeLessThanOrEqual(anchor.y + 1);
    await expectPopoverWithinViewport(page);
  });

  test('near the inline-start edge an edit popover stays inside the viewport', async ({
    page,
  }) => {
    // The seeded filterToken is the first item in the row, close to the viewport's
    // inline-start edge.
    await filterToken(page, 'Active is true')
      .getByTitle('Change field')
      .click();
    await expect(popover(page)).toBeVisible();
    await expectPopoverWithinViewport(page);
  });

  test('near the inline-end edge the popover flips to stay inside the viewport', async ({
    page,
  }) => {
    // Squeeze the filter row against the viewport's inline-end edge so a
    // popover anchored at the add-filter input's inline-start edge would overflow.
    await page.addStyleTag({
      content: '.filter-controls { margin-inline-start: 1000px; }',
    });
    await addFilterInput(page).click();
    await addFilterInput(page).fill('a');
    await expect(popover(page)).toBeVisible();
    await expectPopoverWithinViewport(page);
  });

  test('the popover tracks its anchor while the page scrolls', async ({
    page,
  }) => {
    await page.addStyleTag({
      content: 'body { padding-block-start: 300px; min-block-size: 2400px; }',
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await addFilterInput(page).click();
    await addFilterInput(page).fill('a');
    await expect(popover(page)).toBeVisible();
    const before = await popover(page).boundingBox();
    await page.evaluate(async () => {
      window.scrollBy(0, 120);
      await new Promise(requestAnimationFrame);
    });
    await expect(popover(page)).toBeVisible();
    const after = await popover(page).boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    if (!before || !after) return;
    expect(before.y - after.y).toBeGreaterThan(119);
    expect(before.y - after.y).toBeLessThan(121);
  });

  test('an edit popover renders in the top layer above later page content', async ({
    page,
  }) => {
    // The results table follows the filter row; a popover overlapping it must
    // stay on top (top layer) and receive clicks.
    await addSingleValueFilter(page, 'Name', 'contains', 'a');
    await filterToken(page, 'Name contains a')
      .getByTitle('Change value')
      .click();
    const value = popover(page).getByLabel('Value');
    await expect(value).toBeVisible();
    await value.fill('corp');
    await popover(page).getByRole('button', { name: 'Apply' }).click();
    await expect(filterToken(page, 'Name contains corp')).toBeVisible();
  });

  test('a long option list scrolls within a short viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 240 });
    await addFilterInput(page).click();
    await page.keyboard.press('ArrowDown');
    await expect(popover(page)).toBeVisible();
    await expectPopoverWithinViewport(page);

    const list = popover(page).getByRole('listbox');
    const dimensions = await list.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  });
});
