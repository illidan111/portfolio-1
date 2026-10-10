import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { features } from '../src/site.config';

test.describe('original sky visitor', () => {
  test.skip(!features.boss, 'Boss disabled.');
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pixel-theme', 'night');
      if (!localStorage.getItem('pixel-settings')) localStorage.setItem('pixel-settings', JSON.stringify({ quality: 'high', weather: 'rain' }));
    });
  });
  test('five deliberate hits earn a persistent trophy and keep the original achievements intact', async ({ page }) => {
    await page.goto('/');
    const hit = page.locator('[data-boss-hit]');
    await expect(hit).toBeVisible({ timeout: 12_000 });
    for (let remaining = 5; remaining > 0; remaining--) {
      await expect(hit).toHaveAccessibleName(new RegExp(`${remaining} hit`));
      await hit.click();
      if (remaining > 1) await page.waitForTimeout(550);
    }
    await expect(page.locator('[data-boss]')).toBeHidden();
    await expect(page.locator('[data-boss-status]')).toContainText('Achievement earned: An eye for detail!');
    await expect(page.locator('[data-boss-shelf]')).toHaveAttribute('data-earned', 'true');
    await expect(page.locator('[data-trophy-state]')).toHaveText('Achievement earned');
    expect(await page.evaluate(() => localStorage.getItem('pixel-boss-trophy'))).toBe('earned');
    await expect(page.locator('#achievement-count')).toContainText('/ 3 unlocked');
    await page.reload();
    await expect(page.locator('[data-boss-shelf]')).toHaveAttribute('data-earned', 'true');
  });
  test('reduced motion is static and one click, boss settings persist, and dismiss leaves ordinary controls usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-boss-hit]')).toHaveAccessibleName(/1 hit remaining/);
    await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
    await page.locator('[data-boss-hit]').click();
    await expect(page.locator('[data-boss-shelf]')).toHaveAttribute('data-earned', 'true');
    await page.reload();
    await page.locator('[data-boss-dismiss]').click();
    await expect(page.locator('[data-boss]')).toBeHidden();
    await page.keyboard.press('6');
    await page.getByLabel('Boss encounters', { exact: true }).selectOption('false');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('[data-boss]')).toBeHidden();
    await page.keyboard.press('2');
    await expect(page).toHaveURL(/#projects$/);
  });
  test('secret sequence recolors the lightmap and presents a dismissible unique discovery', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const before = await page.locator('[data-effects]').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    for (const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']) await page.keyboard.press(key);
    await expect(page.locator('[data-world]')).toHaveAttribute('data-rainbow', 'true');
    await expect(page.locator('[data-boss-status]')).toContainText('Prismatic curiosity');
    const after = await page.locator('[data-effects]').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    expect(after).not.toBe(before);
    await page.locator('[data-boss-message-close]').click();
    await expect(page.locator('[data-boss-message]')).toBeHidden();
  });
  test('visitor and trophy are accessible and fit desktop, tablet and touch sky', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mkdir('artifacts/screenshots', { recursive: true });
    for (const width of [1440, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const boss = page.locator('[data-boss]');
      await expect(boss).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bounds = await boss.boundingBox();
      for (const selector of ['#hero-title', '.hero-copy > p', '.hero-actions a', '.hero-actions button', '.biome-strip']) {
        const other = await page.locator(selector).evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); const rect = range.getBoundingClientRect(); return { x:rect.x, y:rect.y, width:rect.width, height:rect.height }; });
        expect(bounds && other && bounds.x < other.x + other.width && bounds.x + bounds.width > other.x && bounds.y < other.y + other.height && bounds.y + bounds.height > other.y, selector).toBe(false);
      }
      await page.screenshot({ path: `artifacts/screenshots/feature7-night-${width}.png` });
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
