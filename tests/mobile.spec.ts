import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Locator, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] }, reducedMotion: 'no-preference' });

const phones = [
  { name: 'iphone-13', device: devices['iPhone 13'] },
  { name: 'pixel-7', device: devices['Pixel 7'] },
  { name: 'android-small', device: { ...devices['Pixel 7'], viewport: { width: 360, height: 640 }, screen: { width: 360, height: 640 }, deviceScaleFactor: 2 } },
];
function emulation(device: (typeof phones)[number]['device']) {
  const { defaultBrowserType: _browser, ...context } = device;
  return context;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off', boss: false }));
    localStorage.setItem('pixel-view-notice', 'seen');
  });
});

async function ready(page: Page, mode: 'classic' | 'game'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
  await expect(page.locator('[data-view-link="toggle"]')).toHaveText(mode === 'game' ? 'Classic view' : 'Game view');
  if (mode === 'game') await expect(page.locator('html')).toHaveAttribute('data-quality', /^(high|low)$/);
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function targetsAtLeast44(page: Page, root = 'body'): Promise<void> {
  const small = await page.evaluate(selector => {
    const root = document.querySelector(selector)!;
    return [...root.querySelectorAll<HTMLElement>('a[href], button, summary, select, input, [role="button"], [tabindex="0"]')].flatMap(element => {
      if (element.matches(':disabled, [aria-disabled="true"], .skip-link')) return [];
      const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
      if (!element.getClientRects().length || style.visibility === 'hidden' || style.display === 'none') return [];
      const clipped = element.closest('.sr-only');
      if (clipped && clipped.getBoundingClientRect().width <= 1) return [];
      return bounds.width >= 43.9 && bounds.height >= 43.9 ? [] : [{
        name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 55),
        tag: element.tagName, width: bounds.width, height: bounds.height,
      }];
    });
  }, root);
  expect(small, 'Every exposed mobile target needs at least 44 × 44 CSS pixels').toEqual([]);
}

async function fits(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(size.page).toBeLessThanOrEqual(size.viewport);
  expect(size.body).toBeLessThanOrEqual(size.viewport);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
}

async function tooltipVisible(tip: Locator, visible: boolean): Promise<void> {
  await expect.poll(() => tip.evaluate(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  })).toBe(visible);
}

for (const phone of phones) {
  for (const orientation of ['portrait', 'landscape']) {
    const portrait = phone.device.viewport;
    const viewport = orientation === 'portrait' ? portrait : { width: portrait.height, height: portrait.width };
    test.describe(`${phone.name} ${orientation}`, () => {
      test.use({ ...emulation(phone.device), viewport, reducedMotion: 'no-preference', storageState: { cookies: [], origins: [] } });
      for (const mode of ['game', 'classic'] as const) {
        test(`${mode} has usable targets and clean day/night layouts`, async ({ page }) => {
          test.setTimeout(60_000);
          const errors: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(`/?mode=${mode}`);
          await ready(page, mode);
          await fits(page);
          await targetsAtLeast44(page);
          if (mode === 'game') {
            await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
            await expect(page.locator('.touch-controls')).toBeVisible();
            const overlaps = await page.evaluate(() => {
              const controls = document.querySelector('.touch-controls')!.getBoundingClientRect();
              return [...document.querySelectorAll('.hero-actions a, .hero-actions button, .hotbar')].some(element => {
                const bounds = element.getBoundingClientRect();
                return bounds.width > 0 && controls.left < bounds.right && controls.right > bounds.left && controls.top < bounds.bottom && controls.bottom > bounds.top;
              });
            });
            expect(overlaps).toBe(false);
            const hintGap = await page.locator('[data-game-controls]').evaluate(element => {
              const hint = element.getBoundingClientRect();
              const biome = document.querySelector('.biome-strip')!.getBoundingClientRect();
              return biome.top - hint.bottom;
            });
            expect(hintGap, 'Controls hint must clear the biome strip in both orientations').toBeGreaterThanOrEqual(8);
          } else await expect(page.locator('.touch-controls')).toBeHidden();
          await mkdir('artifacts/screenshots', { recursive: true });
          for (const theme of ['day', 'night']) {
            if (await page.locator('html').getAttribute('data-theme') !== theme) {
              await page.getByRole('button', { name: `Switch to ${theme}` }).tap();
            }
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await expect(page.locator('#achievement-toast')).toBeHidden();
            await fits(page);
            const nameFits = await page.locator('.brand').evaluate(element => {
              const name = element.querySelector('span')!.firstChild!;
              const range = document.createRange();
              range.selectNodeContents(name);
              const text = range.getBoundingClientRect();
              const header = element.closest('.header-inner')!.getBoundingClientRect();
              const neighbors = [...document.querySelectorAll('.hotbar, .world-controls')].map(neighbor => neighbor.getBoundingClientRect());
              const overlaps = neighbors.some(neighbor => text.left < neighbor.right && text.right > neighbor.left && text.top < neighbor.bottom && text.bottom > neighbor.top);
              // Flex items can shrink while their visible text safely uses the gap.
              return text.left >= header.left - .5 && text.right <= header.right + .5 && !overlaps;
            });
            expect(nameFits, 'Akzhol must fit the header without overlapping navigation or world controls').toBe(true);
            const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
            expect(axe.violations, `${phone.name} ${orientation} ${mode} ${theme}`).toEqual([]);
            await page.screenshot({ path: `artifacts/screenshots/mobile-${phone.name}-${orientation}-${mode}-${theme}.png` });
          }
          await page.locator('[data-nav="skills"]').tap();
          await expect(page).toHaveURL(/#skills$/);
          await expect.poll(() => page.locator('#skills-title').evaluate(element => {
            const header = document.querySelector('header')!;
            return element.getBoundingClientRect().top - Math.max(0, header.getBoundingClientRect().bottom);
          })).toBeGreaterThanOrEqual(0);
          expect(errors).toEqual([]);
        });
      }
    });
  }

  test.describe(`${phone.name} orientation changes`, () => {
    test.use({ ...emulation(phone.device), reducedMotion: 'no-preference', storageState: { cookies: [], origins: [] } });
    test('short landscape falls back to Classic while explicit Game remains available', async ({ page }) => {
      await page.goto('/');
      await ready(page, 'game');
      await page.setViewportSize({ width: phone.device.viewport.height, height: phone.device.viewport.width });
      await ready(page, 'classic');
      await expect(page.locator('[data-view-notice]')).toBeVisible();
      await expect(page.locator('[data-view-notice]')).toContainText('landscape');
      await fits(page);
      await page.goto('/?mode=game');
      await ready(page, 'game');
      await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
      await page.setViewportSize(phone.device.viewport);
      await ready(page, 'game');
      await page.setViewportSize({ width: phone.device.viewport.height, height: phone.device.viewport.width });
      await ready(page, 'game');
      await fits(page);
    });
  });
}

test.describe('small-phone touch interactions', () => {
  test.use({ ...emulation(phones[2].device), reducedMotion: 'no-preference', storageState: { cookies: [], origins: [] } });

  test('buff, skill, and recipe tooltips open by tap and dismiss without hijacking links', async ({ page }) => {
    await page.goto('/?mode=game#skills');
    await ready(page, 'game');
    for (const buff of await page.locator('.buff').all()) {
      await buff.tap();
      const tip = buff.locator('[role="tooltip"]');
      await tooltipVisible(tip, true);
      const bounds = (await tip.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.locator('.inventory-header').tap();
      await tooltipVisible(tip, false);
    }

    const skill = page.getByRole('button', { name: 'Inspect CSS', exact: true });
    await skill.tap();
    await expect(page.locator('#skill-name')).toHaveText('CSS');
    await tooltipVisible(skill.locator('[role="tooltip"]'), true);
    await page.locator('#skill-name').tap();
    await tooltipVisible(skill.locator('[role="tooltip"]'), false);

    const info = page.locator('[data-recipe-result="astana-explorer"] [data-recipe-info]');
    const tip = page.locator('#recipe-tooltip-astana-explorer');
    await info.tap();
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    await tooltipVisible(tip, true);
    await page.locator('#crafting-title').tap();
    await tooltipVisible(tip, false);
    await info.focus();
    await page.keyboard.press('Enter');
    await tooltipVisible(tip, true);
    await page.keyboard.press('Escape');
    await tooltipVisible(tip, false);
    await expect(info).toBeFocused();
    await page.getByRole('link', { name: 'Open Astana Explorer recipe result', exact: true }).tap();
    await expect(page).toHaveURL(/\/projects\/astana-explorer\/$/);
    await expect(page.getByRole('heading', { name: 'Astana Explorer', exact: true })).toBeVisible();
  });

  test('page swipes scroll normally, settings fit, and expanded map targets remain inside the map', async ({ page }) => {
    await page.goto('/?mode=game');
    await ready(page, 'game');
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 560 }] });
    for (const y of [520, 480, 440, 400, 360]) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(40);
    // A native fling consumes taps while decelerating; wait for scrolling to settle.
    await expect.poll(() => page.evaluate(async () => {
      const before = scrollY;
      await new Promise(resolve => setTimeout(resolve, 150));
      return scrollY === before;
    })).toBe(true);
    await page.locator('[data-open-settings]').tap();
    const dialog = page.getByRole('dialog', { name: 'World settings' });
    await expect(dialog).toBeVisible();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(360);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(640);
    await targetsAtLeast44(page, '#settings-dialog');
    await page.locator('[data-close-settings]').tap();
    await page.locator('[data-minimap] summary').tap();
    const clipped = await page.locator('.map-landscape').evaluate(map => {
      const bounds = map.getBoundingClientRect();
      return [...map.querySelectorAll('[data-map-landmark]')].some(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom;
      });
    });
    expect(clipped).toBe(false);
    await targetsAtLeast44(page);
    await fits(page);
  });
});

test('all coarse pointers start Auto on Low, retain static project art, and allow manual High', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const heavy: string[] = [];
  page.on('request', request => { if (/\/(?:three-core|three-runtime)[.-]/.test(new URL(request.url()).pathname)) heavy.push(request.url()); });
  await page.goto('/?mode=game');
  await ready(page, 'game');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
  const density = await page.locator('[data-effects]').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    return canvas.width / canvas.getBoundingClientRect().width;
  });
  expect(density).toBeLessThanOrEqual(1);
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
  await page.getByRole('link', { name: 'Explore Astana Explorer', exact: true }).tap();
  await expect(page).toHaveURL(/\/projects\/astana-explorer\/$/);
  await ready(page, 'game');
  await expect(page.locator('[data-voxel-state]')).toHaveAttribute('data-voxel-state', 'static');
  await expect(page.locator('[data-voxel-fallback]')).toBeVisible();
  expect(heavy).toEqual([]);
  await page.locator('[data-open-settings]').tap();
  await page.getByLabel('Quality', { exact: true }).selectOption('high');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'high');
  await page.getByLabel('Quality', { exact: true }).selectOption('auto');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
  await page.locator('[data-close-settings]').tap();
  await page.reload();
  await ready(page, 'game');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
  await context.close();
});

test('narrow screens with a fine pointer do not display touch game controls', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 360, height: 640 }, hasTouch: false, isMobile: false, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/?mode=game');
  await ready(page, 'game');
  await expect(page.locator('.touch-controls')).toBeHidden();
  await context.close();
});
