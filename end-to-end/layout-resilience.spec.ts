import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addFilterInput,
  addSingleValueFilter,
  applyValue,
  filterToken,
  openReadyDemo,
  pickField,
  pickOption,
} from './helpers.ts';

async function useNarrowFilterContainer(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      .example { max-width: none; padding-inline: 0; }
      form.filter { inline-size: 240px; }
    `,
  });
}

async function expectFilterRowDoesNotOverflow(page: Page): Promise<void> {
  const dimensions = await page.locator('.filter-row').evaluate((row) => ({
    clientWidth: row.clientWidth,
    scrollWidth: row.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test.describe('layout resilience', () => {
  test('the component stylesheet is self-contained inside a Shadow Root', async ({ page }) => {
    await page.goto('/');
    const styles = await page.evaluate(async () => {
      const host = document.createElement('div');
      host.style.display = 'inline-flex';
      document.body.append(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = '/src/components/filter/filter-component.css';
      await new Promise<void>((resolve, reject) => {
        stylesheet.addEventListener('load', () => resolve(), { once: true });
        stylesheet.addEventListener(
          'error',
          () => reject(new Error('The component stylesheet failed to load')),
          { once: true },
        );
        shadowRoot.append(stylesheet);
      });

      const form = document.createElement('form');
      form.className = 'filter';
      form.innerHTML = `
        <fieldset class="filter-controls">
          <div class="filter-row">
            <input class="filter-add-input" placeholder="Add filter" />
            <button class="filter-icon-button" type="button">Action</button>
          </div>
        </fieldset>
      `;
      shadowRoot.append(form);
      const input = shadowRoot.querySelector<HTMLInputElement>('input');
      const row = shadowRoot.querySelector<HTMLElement>('.filter-row');
      if (!input || !row) throw new Error('The Shadow Root fixture is incomplete');
      input.focus();

      const formStyle = getComputedStyle(form);
      const rowStyle = getComputedStyle(row);
      const inputStyle = getComputedStyle(input);
      return {
        borderStyle: rowStyle.borderBlockStartStyle,
        inputFocusStyle: inputStyle.outlineStyle,
        rowFocusStyle: rowStyle.outlineStyle,
        surface: rowStyle.backgroundColor,
        text: formStyle.color,
        resolvedTextToken: formStyle
          .getPropertyValue('--filter-resolved-color-text-primary')
          .trim(),
        width: form.getBoundingClientRect().width,
      };
    });

    expect(styles.borderStyle).toBe('solid');
    expect(styles.inputFocusStyle).toBe('none');
    expect(styles.rowFocusStyle).toBe('solid');
    expect(styles.surface).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.text).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.resolvedTextToken).not.toContain('var(');
    expect(styles.width).toBeGreaterThanOrEqual(120);
  });

  test('semantic color overrides inherit and remain independently addressable', async ({
    page,
  }) => {
    await openReadyDemo(page);
    await page.locator('.example').evaluate((wrapper) => {
      wrapper.style.setProperty('--filter-color-background-primary', 'rgb(240 241 242)');
      wrapper.style.setProperty('--filter-color-text-placeholder', 'rgb(1 2 3)');
      wrapper.style.setProperty('--filter-color-text-secondary', 'rgb(4 5 6)');
      wrapper.style.setProperty('--filter-color-background-action', 'rgb(7 8 9)');
      wrapper.style.setProperty('--filter-color-border-focus', 'rgb(10 11 12)');
    });

    const input = addFilterInput(page);
    await input.click();
    await expect(page.locator('.filter-row')).toHaveCSS('outline-color', 'rgb(10, 11, 12)');
    const placeholderColor = await input.evaluate(
      (element) => getComputedStyle(element, '::placeholder').color,
    );
    expect(placeholderColor).toBe('rgb(1, 2, 3)');

    await page.keyboard.press('ArrowDown');
    const dialog = page.locator('.filter-popover');
    await expect(dialog).toHaveCSS('background-color', 'rgb(240, 241, 242)');
    await expect(dialog.locator('.filter-popover-option-hint').first()).toHaveCSS(
      'color',
      'rgb(4, 5, 6)',
    );

    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    await expect(dialog.getByRole('button', { name: 'Apply' })).toHaveCSS(
      'background-color',
      'rgb(7, 8, 9)',
    );
  });

  test('shared palette colors flow into the filter defaults', async ({ page }) => {
    await openReadyDemo(page);
    await page.locator('.example').evaluate((wrapper) => {
      wrapper.style.setProperty('--neutral-0', 'rgb(230 231 232)');
      wrapper.style.setProperty('--blue-500', 'rgb(20 21 22)');
    });

    const input = addFilterInput(page);
    await input.click();
    await expect(page.locator('.filter-row')).toHaveCSS('background-color', 'rgb(230, 231, 232)');
    await expect(page.locator('.filter-row')).toHaveCSS('outline-color', 'rgb(20, 21, 22)');

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.filter-popover')).toHaveCSS(
      'background-color',
      'rgb(230, 231, 232)',
    );
  });

  test('a 240px container keeps the maximal action rail inside the row', async ({ page }) => {
    await openReadyDemo(page);
    await addSingleValueFilter(page, 'Name', 'contains', 'acme');
    await addSingleValueFilter(page, 'Deal value', 'greater than', '10');
    await page.getByRole('button', { name: 'Undo filter change' }).click();
    await expect(page.getByRole('button', { name: 'Undo filter change' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redo filter change' })).toBeVisible();

    await useNarrowFilterContainer(page);
    await expectFilterRowDoesNotOverflow(page);

    const rowBox = await page.locator('.filter-row').boundingBox();
    const railBox = await page.locator('.filter-rail').boundingBox();
    expect(rowBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    if (!rowBox || !railBox) return;
    expect(railBox.x).toBeGreaterThanOrEqual(rowBox.x);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
  });

  test('long token content truncates visually without changing its accessible name', async ({
    page,
  }) => {
    await openReadyDemo(page);
    const value = 'a-very-long-customer-name-that-must-remain-fully-readable';
    await addSingleValueFilter(page, 'Name', 'contains', value);
    await useNarrowFilterContainer(page);

    await expect(filterToken(page, `Name contains ${value}`)).toBeVisible();
    const valueSegment = filterToken(page, `Name contains ${value}`).getByTitle('Change value');
    const dimensions = await valueSegment.evaluate((segment) => ({
      clientWidth: segment.clientWidth,
      scrollWidth: segment.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    await expectFilterRowDoesNotOverflow(page);
  });

  test('a long injected field label cannot push popover controls out of bounds', async ({
    page,
  }) => {
    const label = 'CustomerRelationshipLifecycleQualificationStatusWithoutBreaks';
    await page.goto('/?longLabel');
    await pickField(page, label);
    await pickOption(page, 'contains');

    const dialog = page.getByRole('dialog', { name: `${label} contains` });
    const heading = dialog.locator('.filter-popover-heading');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeVisible();
    const headingDimensions = await heading.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(headingDimensions.scrollWidth).toBeGreaterThan(headingDimensions.clientWidth);

    const dialogBox = await dialog.boundingBox();
    const cancelBox = await cancel.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(cancelBox).not.toBeNull();
    if (!dialogBox || !cancelBox) {
      throw new Error('Expected visible popover geometry');
    }
    expect(cancelBox.x).toBeGreaterThanOrEqual(dialogBox.x);
    expect(cancelBox.x + cancelBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
  });

  test('many enum selections remain focusable inside a narrow token', async ({ page }) => {
    await openReadyDemo(page);
    const stages = [
      'Lead',
      'Contacted',
      'Demo scheduled',
      'Negotiation',
      'Closed won',
      'Closed lost',
    ];
    await pickField(page, 'Stage');
    await pickOption(page, 'is any of');
    for (const stage of stages) await pickOption(page, stage);
    await applyValue(page);
    await useNarrowFilterContainer(page);

    const stageToken = filterToken(page, `Stage is any of ${stages.join(', ')}`);
    for (const stage of stages) {
      await expect(
        stageToken.getByRole('button', {
          name: `Remove ${stage} from Stage filter`,
        }),
      ).toBeAttached();
    }
    const lastRemove = stageToken.getByRole('button', {
      name: 'Remove Closed lost from Stage filter',
    });
    await lastRemove.focus();
    await expect(lastRemove).toBeFocused();
    const lastRemoveBox = await lastRemove.boundingBox();
    const tokenBox = await stageToken.boundingBox();
    expect(lastRemoveBox).not.toBeNull();
    expect(tokenBox).not.toBeNull();
    if (lastRemoveBox && tokenBox) {
      expect(lastRemoveBox.x).toBeGreaterThanOrEqual(tokenBox.x);
      expect(lastRemoveBox.x + lastRemoveBox.width).toBeLessThanOrEqual(
        tokenBox.x + tokenBox.width,
      );
    }
    await expectFilterRowDoesNotOverflow(page);
  });

  test('the add-filter input indicates keyboard focus on the full row', async ({ page }) => {
    await openReadyDemo(page);
    await addFilterInput(page).focus();
    await expect(addFilterInput(page)).toBeFocused();
    await expect
      .poll(() => page.locator('.filter-row').evaluate((row) => getComputedStyle(row).outlineStyle))
      .toBe('solid');
    await expect
      .poll(() => addFilterInput(page).evaluate((input) => getComputedStyle(input).outlineStyle))
      .toBe('none');
  });

  test('an action button keeps its compact focus ring without activating the row', async ({
    page,
  }) => {
    await openReadyDemo(page);
    const savedViewsButton = page.getByRole('button', { name: 'Saved views' });
    await savedViewsButton.focus();
    await expect(savedViewsButton).toBeFocused();
    await expect
      .poll(() => savedViewsButton.evaluate((button) => getComputedStyle(button).outlineStyle))
      .toBe('solid');
    await expect
      .poll(() => page.locator('.filter-row').evaluate((row) => getComputedStyle(row).outlineStyle))
      .toBe('none');
  });

  test('a destructive draft action keeps its focus ring while hovered', async ({ page }) => {
    await openReadyDemo(page);
    await pickField(page, 'Name');
    await page.getByRole('heading', { name: 'Filter' }).click();
    const discard = page.getByRole('button', {
      name: 'Discard incomplete filter',
    });
    await discard.focus();
    await discard.hover();
    await expect(discard).toBeFocused();
    await expect
      .poll(() => discard.evaluate((button) => getComputedStyle(button).outlineStyle))
      .toBe('solid');
  });
});
