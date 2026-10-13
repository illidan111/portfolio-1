import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] }, reducedMotion: 'no-preference' });

function gameResource(url: string): boolean {
  const path = new URL(url).pathname;
  return /\/(?:game(?:-engine)?|voxel|three(?:-core|-runtime)?)[.-][^/]*\.js$/i.test(path)
    || /\/src\/scripts\/(?:engine\/|game\.ts)/.test(path);
}

function trackGameRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', request => { if (gameResource(request.url())) requests.push(new URL(request.url()).pathname); });
  return requests;
}

async function expectView(page: Page, mode: 'classic' | 'game'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
  await expect(page.locator('[data-view-link="toggle"]')).toHaveText(mode === 'classic' ? 'Game view' : 'Classic view');
}

async function contentSnapshot(page: Page): Promise<unknown> {
  return page.evaluate(() => ({
    projects: [...document.querySelectorAll('[data-project] h3')].map(element => element.textContent?.trim()),
    skills: [...document.querySelectorAll<HTMLElement>('[data-skill]')].map(element => ({ name: element.dataset.name, description: element.dataset.description })),
    experience: [...document.querySelectorAll('.quest-log li')].map(element => element.textContent?.trim()),
  }));
}

test('fresh Classic navigation requests no game, engine, voxel, or three chunks; Game is the positive control', async ({ page }) => {
  const requests = trackGameRequests(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mode=classic');
  await expectView(page, 'classic');
  await expect(page.locator('[data-world]')).not.toHaveAttribute('data-engine-running');
  await expect(page.locator('[data-effects]')).toBeHidden();
  await expect(page.locator('.world-tools')).toBeHidden();
  await page.getByRole('link', { name: 'Explore Astana Explorer' }).click();
  await expect(page).toHaveURL(/\/projects\/astana-explorer\/$/);
  await expect(page.getByRole('heading', { name: 'Astana Explorer', exact: true })).toBeVisible();
  await expectView(page, 'classic');
  await page.reload();
  await expectView(page, 'classic');
  await expect(page.locator('[data-voxel-canvas]')).toBeHidden();
  await expect(page.locator('[data-voxel]')).toHaveAttribute('data-voxel-state', 'static');
  await expect(page.locator('[data-voxel-fallback]')).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);

  await page.goto('/?mode=game');
  await expectView(page, 'game');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
  expect(requests.some(path => /\/game\./.test(path))).toBe(true);
  expect(requests.some(path => /\/game-engine\./.test(path))).toBe(true);
});

for (const mode of ['classic', 'game'] as const) {
  test(`explicit ${mode} query wins over the opposite stored preference`, async ({ page }) => {
    await page.addInitScript(mode => localStorage.setItem('pixel-view', mode === 'classic' ? 'game' : 'classic'), mode);
    await page.goto(`/?mode=${mode}`);
    await expectView(page, mode);
    expect(await page.evaluate(() => localStorage.getItem('pixel-view'))).toBe(mode);
  });
}

test('the header switch reloads the document, preserves URL context, and persists both modes', async ({ page }) => {
  await page.goto('/?mode=classic&ref=portfolio');
  await expectView(page, 'classic');
  for (const next of ['game', 'classic'] as const) {
    await page.evaluate(() => { (window as Window & { viewTestMarker?: string }).viewTestMarker = 'old-document'; });
    await page.locator('[data-view-link="toggle"]').click();
    await expectView(page, next);
    const url = new URL(page.url());
    expect(url.searchParams.get('mode')).toBe(next);
    expect(url.searchParams.get('ref')).toBe('portfolio');
    expect(await page.evaluate(() => (window as Window & { viewTestMarker?: string }).viewTestMarker)).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem('pixel-view'))).toBe(next);
  }
  await page.goto('/');
  await expectView(page, 'classic');
  await page.locator('[data-view-link="toggle"]').click();
  await expectView(page, 'game');
  await page.goto('/');
  await expectView(page, 'game');
});

test('Reduced Motion defaults to Classic, keeps its first notice visible, and respects explicit Game', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = trackGameRequests(page);
  await page.goto('/');
  await expectView(page, 'classic');
  await page.evaluate(async () => { await document.fonts.ready; });
  const notice = page.locator('[data-view-notice]');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('data-shown', 'true');
  await page.getByRole('button', { name: 'Dismiss view suggestion' }).click();
  await expect(notice).toBeHidden();
  await page.reload();
  await expectView(page, 'classic');
  await expect(notice).toBeHidden();
  expect(requests).toEqual([]);
  await page.goto('/?mode=game');
  await expectView(page, 'game');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-reduced', 'true');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
});

test('Save-Data defaults to Classic and an explicit Game query overrides it', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }); });
  const requests = trackGameRequests(page);
  await page.goto('/');
  await expectView(page, 'classic');
  expect(requests).toEqual([]);
  await page.goto('/?mode=game');
  await expectView(page, 'game');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
});

test('the first-visit suggestion appears only once across client navigation and reload', async ({ page }) => {
  await page.goto('/?mode=classic');
  await expectView(page, 'classic');
  await expect(page.locator('[data-view-notice]')).toBeVisible();
  await page.getByRole('link', { name: 'Explore Job Tracker' }).click();
  await expect(page).toHaveURL(/\/projects\/job-tracker\/$/);
  await expect(page.getByRole('heading', { name: 'Job Tracker', exact: true })).toBeVisible();
  await expect(page.locator('[data-view-notice]')).toBeHidden();
  await page.reload();
  await expectView(page, 'classic');
  await expect(page.locator('[data-view-notice]')).toBeHidden();
});

test('blocked storage keeps explicit Classic, the theme button, and project navigation working', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = trackGameRequests(page);
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  await page.goto('/?mode=classic');
  await expectView(page, 'classic');
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('link', { name: 'Explore Astana Explorer' }).click();
  await expect(page.getByRole('heading', { name: 'Astana Explorer', exact: true })).toBeVisible();
  await expectView(page, 'classic');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('an invalid stored mode falls back safely and an explicit mode remains usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('pixel-view', '{broken-json'));
  await page.goto('/');
  await expectView(page, 'game');
  await page.goto('/?mode=classic');
  await expectView(page, 'classic');
  expect(errors).toEqual([]);
});

test('Classic retains the same projects, skills, experience, filters, and case-study navigation', async ({ page }) => {
  const requests = trackGameRequests(page);
  await page.goto('/?mode=classic');
  await expectView(page, 'classic');
  const original = await contentSnapshot(page);
  const cards = page.locator('[data-project]:visible');
  await expect(cards).toHaveCount(3);
  await page.getByRole('button', { name: 'Web apps', exact: true }).click();
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Astana Explorer', 'Job Tracker']);
  await expect(page.locator('#project-count')).toHaveText('2 items');
  await page.getByRole('button', { name: 'Creative tools', exact: true }).click();
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Pixel Portfolio']);
  await page.getByRole('button', { name: 'All items', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Accessibility', exact: true }).click();
  await expect(page.locator('#skill-name')).toHaveText('Accessibility');
  await expect(page.locator('#skill-description')).toContainText('Keyboard-friendly');
  await page.getByRole('button', { name: 'Inspect CSS', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#skill-name')).toHaveText('CSS');
  await expect(page.locator('[data-skill][aria-pressed="true"]')).toHaveCount(1);
  for (const title of ['Astana Explorer', 'Job Tracker', 'Pixel Portfolio']) {
    await page.getByRole('link', { name: `Explore ${title}` }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('main h1')).toBeFocused();
    await expectView(page, 'classic');
    await expect(page.locator('.prose')).toBeVisible();
    await page.getByRole('link', { name: 'Back to inventory' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
    await expectView(page, 'classic');
  }
  expect(requests).toEqual([]);
  await page.goto('/?mode=game');
  await expectView(page, 'game');
  expect(await contentSnapshot(page)).toEqual(original);
});

for (const width of [360, 1440]) {
  test(`Classic is accessible and fits ${width}px in day and night`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?mode=classic');
    await expectView(page, 'classic');
    await page.evaluate(async () => { await document.fonts.ready; });
    await mkdir('artifacts/screenshots', { recursive: true });
    for (const theme of ['day', 'night']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.getByRole('button', { name: theme === 'day' ? 'Switch to day' : 'Switch to night' }).click();
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const paragraph = await page.locator('.hero-copy > p').evaluate(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, fontSize: Number.parseFloat(style.fontSize) };
      });
      expect(paragraph.background).toBe('rgba(0, 0, 0, 0)');
      expect(paragraph.fontSize).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations, `${width}px ${theme}`).toEqual([]);
      await page.screenshot({ path: `artifacts/screenshots/classic-${width}-${theme}.png`, fullPage: true });
      await page.screenshot({ path: `artifacts/screenshots/classic-${width}-${theme}-top.png` });
    }
  });
}
