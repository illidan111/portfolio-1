import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { features } from '../src/site.config';

test.use({ reducedMotion: 'no-preference' });
test.skip(!features.crafting, 'The crafting table is disabled in this build.');

async function openTable(page: Page): Promise<void> {
  await page.goto('/#skills');
  await expect(page.locator('[data-crafting-table]')).toHaveAttribute('data-ready', 'true');
}

async function addSkill(page: Page, name: string): Promise<void> {
  const inspect = page.getByRole('button', { name: `Inspect ${name}`, exact: true });
  await inspect.focus();
  await page.keyboard.press('Enter');
  const add = page.getByRole('button', { name: `Add ${name}`, exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: `Remove ${name} from recipe`, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off', boss: false })));
});

test('keyboard recipes use AND matching, preserve skill inspection, and announce matching projects', async ({ page }) => {
  // Keep smooth anchor scrolling from moving the pointer between hover assertions.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTable(page);
  const results = page.locator('[data-recipe-result]:visible');
  await addSkill(page, 'TypeScript');
  await expect(results).toHaveCount(2);
  await expect(page.locator('[data-craft-status]')).toContainText('2 projects match this ingredient: TypeScript');
  await addSkill(page, 'Astro');
  await expect(results).toHaveCount(1);
  await expect(results).toHaveAttribute('data-recipe-result', 'pixel-portfolio');
  await expect(page.locator('[data-craft-status]')).toContainText('1 project matches all 2 ingredients: TypeScript, Astro. Pixel Portfolio.');
  await expect(page.locator('[data-project][data-recipe-match="true"]')).toHaveCount(1);
  await expect(page.locator('[data-project-id="pixel-portfolio"]')).toHaveAttribute('data-recipe-match', 'true');
  await expect(page.locator('[data-skill][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#skill-name')).toHaveText('Astro');
  const result = page.getByRole('link', { name: 'Open Pixel Portfolio recipe result', exact: true });
  const tooltip = page.locator('#recipe-tooltip-pixel-portfolio');
  const reset = page.getByRole('button', { name:'Reset recipe', exact:true });
  await reset.focus();
  await result.hover();
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(reset).toBeFocused();
  await page.mouse.move(0,0);
  await result.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Shared ingredients: TypeScript, Astro');
  await result.hover();
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(result).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projects\/pixel-portfolio\/$/);
  await expect(page.getByRole('heading', { name: 'Pixel Portfolio', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to inventory' }).click();
  await expect(page.locator('[data-crafting-table]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-remove-ingredient]')).toHaveCount(0);
  await expect(page.locator('[data-project][data-recipe-match]')).toHaveCount(0);
});

test('three-skill limit, removal, no-match feedback, and Reset remain keyboard accessible', async ({ page }) => {
  await openTable(page);
  await addSkill(page, 'TypeScript');
  await addSkill(page, 'CSS');
  await addSkill(page, 'Accessibility');
  await expect(page.locator('[data-ingredient-count]')).toHaveText('3 / 3 skills');
  await expect(page.locator('[data-recipe-result]:visible')).toHaveCount(2);
  await page.getByRole('button', { name: 'Inspect JavaScript', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recipe full', exact: true })).toBeDisabled();
  const remove = page.getByRole('button', { name: 'Remove CSS from recipe', exact: true });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-remove-ingredient]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Add JavaScript', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reset recipe', exact: true }).click();
  await expect(page.locator('[data-ingredient-count]')).toHaveText('0 / 3 skills');
  await expect(page.locator('[data-craft-status]')).toContainText('Recipe cleared');
  await addSkill(page, 'Astro');
  await addSkill(page, 'React');
  await expect(page.locator('[data-recipe-result]:visible')).toHaveCount(0);
  await expect(page.locator('[data-craft-status]')).toContainText('No project uses all 2 ingredients yet');
  await expect(page.locator('[data-project]:visible')).toHaveCount(3);
  await page.getByRole('button', { name: 'Remove Astro from recipe', exact: true }).click();
  await expect(page.locator('[data-recipe-result]:visible')).toHaveAttribute('data-recipe-result', 'job-tracker');
  await expect(page.locator('[data-craft-status]')).toContainText('1 project matches this ingredient: React. Job Tracker.');
});

test('crafting is static under Reduced Motion and passes axe in both themes', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTable(page);
  await addSkill(page, 'Performance');
  await expect(page.locator('[data-crafting-table]')).not.toHaveAttribute('data-crafting');
  await expect(page.locator('[data-recipe-result]:visible')).toHaveAttribute('data-recipe-result', 'pixel-portfolio');
  await expect(page.locator('[data-craft-status]')).toHaveAttribute('aria-live', 'polite');
  for (const theme of ['day', 'night']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'day' ? 'Switch to day' : 'Switch to night' }).click();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations, `Crafting with Reduced Motion in ${theme}`).toEqual([]);
  }
});

test('crafting table fits desktop and mobile, with useful project links without JavaScript', async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  await mkdir('artifacts/screenshots', { recursive: true });
  for (const width of [1440, 360]) {
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width, height: 900 }, hasTouch: width === 360, isMobile: width === 360, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await openTable(page);
    await addSkill(page, 'JavaScript');
    await expect(page.locator('[data-recipe-result]:visible')).toHaveCount(2);
    const table = page.locator('[data-crafting-table]');
    const bounds = (await table.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(async () => { await document.fonts.ready; });
    await table.screenshot({ path: `artifacts/screenshots/feature9-crafting-${width}.png`, animations: 'disabled' });
    await context.close();
  }
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, javaScriptEnabled: false, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/#skills');
  await expect(page.locator('[data-add-ingredient]')).toBeDisabled();
  await expect(page.locator('[data-crafting-table]')).not.toHaveAttribute('data-ready');
  await expect(page.getByRole('link', { name: 'Open Astana Explorer recipe result', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open Astana Explorer recipe result', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Astana Explorer', exact: true })).toBeVisible();
  await context.close();
});
