import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

async function openWorld(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function coordinate(page: Page, axis: 'x' | 'y'): Promise<number> {
  return Number(await page.locator('[data-player]').getAttribute(`data-${axis}`));
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press('6');
  await expect(page.getByRole('dialog', { name: 'World settings' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('pixel-settings')) localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off' }));
  });
});

test('hero moves and jumps only with world focus, and Escape releases control', async ({ page }) => {
  await openWorld(page);
  const initialX = await coordinate(page, 'x');
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  expect(await coordinate(page, 'x')).toBe(initialX);

  const input = page.locator('[data-game-input]');
  await input.focus();
  await expect(input).toBeFocused();
  await page.keyboard.down('a');
  await expect.poll(() => coordinate(page, 'x')).toBeLessThan(initialX - 30);
  await page.keyboard.up('a');
  const groundY = await coordinate(page, 'y');
  await page.keyboard.press('Space');
  await expect.poll(() => coordinate(page, 'y'), { intervals: [20, 30, 50] }).toBeLessThan(groundY - 12);
  await expect(page.locator('[data-player]')).toHaveAttribute('data-grounded', 'true');
  await page.keyboard.press('Escape');
  await expect(input).not.toBeFocused();
  await expect(page.locator('[data-world]')).toHaveAttribute('data-controlling', 'false');
  const releasedX = await coordinate(page, 'x');
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  expect(await coordinate(page, 'x')).toBe(releasedX);
});

test('hero collides with the fence, jumps past obstacles, and enters the house with E', async ({ page }) => {
  await openWorld(page);
  await page.locator('[data-game-input]').focus();
  await page.keyboard.down('d');
  await expect.poll(() => coordinate(page, 'x')).toBeGreaterThanOrEqual(827);
  await page.waitForTimeout(150);
  expect(await coordinate(page, 'x')).toBeLessThanOrEqual(828);
  await page.keyboard.press('Space');
  await expect.poll(() => coordinate(page, 'x'), { intervals: [30, 50, 80] }).toBeGreaterThanOrEqual(950);
  await page.keyboard.up('d');
  await expect(page.locator('[data-player]')).toHaveAttribute('data-grounded', 'true');
  await page.keyboard.press('Space');
  await page.keyboard.down('d');
  await expect(page.locator('[data-house-door]')).toHaveAttribute('data-near', 'true');
  await page.keyboard.up('d');
  await page.keyboard.press('e');
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.getByRole('heading', { name: 'Good things start with a hello.' })).toBeVisible();
});

test('all six hotbar shortcuts remain available while playing', async ({ page }) => {
  await openWorld(page);
  await page.locator('[data-game-input]').focus();
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/#projects$/);
  await page.keyboard.press('3');
  await expect(page).toHaveURL(/#skills$/);
  await page.keyboard.press('4');
  await expect(page).toHaveURL(/#about$/);
  await page.keyboard.press('5');
  await expect(page).toHaveURL(/#contact$/);
  await page.keyboard.press('1');
  await expect(page).toHaveURL(/#home$/);
  await page.locator('[data-game-input]').focus();
  await openSettings(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'World settings' })).toBeHidden();
});

test('shared world loop pauses outside the viewport and resumes on return', async ({ page }) => {
  await openWorld(page);
  const world = page.locator('[data-world]');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(world).toHaveAttribute('data-engine-running', 'false');
  const initialX = await coordinate(page, 'x');
  await page.waitForTimeout(150);
  expect(await coordinate(page, 'x')).toBe(initialX);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(world).toHaveAttribute('data-engine-running', 'true');
});

test('settings persist Low quality and manual Reduced Motion, then restore play', async ({ page }) => {
  await openWorld(page);
  await openSettings(page);
  await page.getByLabel('Quality', { exact: true }).selectOption('low');
  await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
  await page.getByLabel('Controls hint', { exact: true }).selectOption('false');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-reduced', 'true');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-quality', 'low');
  await expect(page.locator('[data-game-input]')).toBeHidden();
  await expect(page.locator('[data-game-controls]')).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
  await openSettings(page);
  await expect(page.getByLabel('Quality', { exact: true })).toHaveValue('low');
  await expect(page.getByLabel('Motion', { exact: true })).toHaveValue('reduced');
  await expect(page.getByLabel('Controls hint', { exact: true })).toHaveValue('false');
  await page.getByLabel('Quality', { exact: true }).selectOption('high');
  await page.getByLabel('Motion', { exact: true }).selectOption('auto');
  await page.getByLabel('Controls hint', { exact: true }).selectOption('true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
  await expect(page.locator('[data-game-input]')).toBeVisible();
  await expect(page.locator('[data-game-controls]')).toBeVisible();
});

test('device Reduced Motion keeps a static hero and ordinary house link', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-reduced', 'true');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
  await expect(page.locator('[data-game-input]')).toBeHidden();
  await expect(page.locator('[data-game-controls]')).toBeHidden();
  const y = await coordinate(page, 'y');
  await page.keyboard.press('w');
  await page.waitForTimeout(100);
  expect(await coordinate(page, 'y')).toBe(y);
  await page.getByRole('link', { name: 'Enter the house — go to Contact', exact: true }).click();
  await expect(page).toHaveURL(/#contact$/);
});

test('home and its Skills section never request three.js', async ({ page }) => {
  const graphicsRequests: string[] = [];
  page.on('request', request => {
    if (/\/(?:three|voxel)[.-]/i.test(new URL(request.url()).pathname)) graphicsRequests.push(request.url());
  });
  await openWorld(page);
  await page.keyboard.press('3');
  await expect(page).toHaveURL(/#skills$/);
  await page.waitForTimeout(250);
  expect(graphicsRequests).toEqual([]);
});

test('visible project voxel runs at low resolution and falls back for Low quality', async ({ page }) => {
  await page.goto('/projects/fieldnotes/');
  const voxel = page.locator('[data-voxel]');
  test.skip(await voxel.count() === 0, 'Voxel feature flag is disabled in this build.');
  await expect(voxel).toHaveAttribute('data-voxel-state', 'active');
  await expect(voxel.locator('canvas')).toBeVisible();
  const buffer = await voxel.locator('canvas').evaluate(canvas => ({ width: (canvas as HTMLCanvasElement).width, cssWidth: canvas.clientWidth }));
  expect(buffer.width * 4).toBe(buffer.cssWidth);
  await voxel.hover({ position: { x: 8, y: 8 } });
  await expect(voxel).toHaveAttribute('data-engine-running', 'true');
  await openSettings(page);
  await page.getByLabel('Quality', { exact: true }).selectOption('low');
  await page.keyboard.press('Escape');
  await expect(voxel).toHaveAttribute('data-voxel-state', 'static');
  await expect(voxel.locator('[data-voxel-fallback]')).toBeVisible();
  await expect(voxel.locator('canvas')).toBeHidden();
  await openSettings(page);
  await page.getByLabel('Quality', { exact: true }).selectOption('high');
  await page.keyboard.press('Escape');
  await expect(voxel).toHaveAttribute('data-voxel-state', 'active');
  await page.getByRole('link', { name: 'Back to inventory' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(page.locator('[data-voxel]')).toHaveCount(0);
});

test('reduced-motion project retains its SVG without requesting three.js', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const graphicsRequests: string[] = [];
  page.on('request', request => {
    if (/\/three[.-]/i.test(new URL(request.url()).pathname)) graphicsRequests.push(request.url());
  });
  await page.goto('/projects/orbit/');
  await expect(page.getByRole('heading', { name: 'Orbit', exact: true })).toBeVisible();
  await expect(page.locator('[data-voxel-fallback]')).toBeVisible();
  await expect(page.locator('[data-voxel-canvas]')).toBeHidden();
  await page.waitForTimeout(200);
  expect(graphicsRequests).toEqual([]);
});

test('a denied WebGL context keeps the SVG and never downloads three.js', async ({ page }) => {
  const graphicsRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => {
    if (/\/three[.-]/i.test(new URL(request.url()).pathname)) graphicsRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, kind: string, ...options: unknown[]) {
        if (kind === 'webgl2') {
          const observed = window as Window & { deniedWebGLCalls?: number };
          observed.deniedWebGLCalls = (observed.deniedWebGLCalls ?? 0) + 1;
          return null;
        }
        return Reflect.apply(getContext, this, [kind, ...options]);
      },
    });
  });
  await page.goto('/projects/fieldnotes/');
  const voxel = page.locator('[data-voxel]');
  test.skip(await voxel.count() === 0, 'Voxel feature flag is disabled in this build.');
  await expect.poll(() => page.evaluate(() => (window as Window & { deniedWebGLCalls?: number }).deniedWebGLCalls ?? 0)).toBeGreaterThan(0);
  await expect(voxel).toHaveAttribute('data-voxel-state', 'static');
  await expect(voxel.locator('[data-voxel-fallback] svg')).toBeVisible();
  await expect(voxel.locator('canvas')).toBeHidden();
  expect(graphicsRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('desktop playable-world screenshots in day and night', async ({ page }) => {
  await mkdir('artifacts/screenshots', { recursive: true });
  await openWorld(page);
  await page.screenshot({ path: 'artifacts/screenshots/feature1-desktop-day.png' });
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('#achievement-toast')).toBeHidden();
  await page.screenshot({ path: 'artifacts/screenshots/feature1-desktop-night.png' });
});

test('night lightmap brightens the moving hero while leaving the interface unchanged', async ({ page }) => {
  await openWorld(page);
  const canvas = page.locator('[data-effects]');
  const action = page.getByRole('link', { name: 'Explore my work' });
  const buttonInDay = await action.screenshot({ animations: 'disabled' });
  const dayAlpha = await canvas.evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(8, 8, 1, 1).data[3]);
  expect(dayAlpha).toBe(0);
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect.poll(async () => canvas.evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(8, 8, 1, 1).data[3])).toBeGreaterThan(100);
  const buttonAtNight = await action.screenshot({ animations: 'disabled' });
  expect(buttonAtNight.equals(buttonInDay)).toBe(true);
  const initialLight = await page.evaluate(() => {
    const surface = document.querySelector<HTMLCanvasElement>('[data-effects]')!;
    const bounds = surface.getBoundingClientRect();
    const hero = document.querySelector('[data-player]')!.getBoundingClientRect();
    const x = Math.floor((hero.left + hero.width / 2 - bounds.left) / bounds.width * surface.width);
    const y = Math.floor((hero.top + hero.height / 2 - bounds.top) / bounds.height * surface.height);
    return { x, y, alpha: surface.getContext('2d')!.getImageData(x, y, 1, 1).data[3] };
  });
  expect(initialLight.alpha).toBeLessThan(130);
  const initialX = await coordinate(page, 'x');
  await page.locator('[data-game-input]').focus();
  await page.keyboard.down('a');
  await expect.poll(() => coordinate(page, 'x')).toBeLessThan(initialX - 110);
  await page.keyboard.up('a');
  await page.keyboard.press('Escape');
  await expect.poll(async () => canvas.evaluate((element, point) => (element as HTMLCanvasElement).getContext('2d')!.getImageData(point.x, point.y, 1, 1).data[3], initialLight)).toBeGreaterThan(initialLight.alpha + 20);
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: 'artifacts/screenshots/feature2-desktop-night.png' });
});

test('cursor light responds across the open sky without dimming navigation', async ({ page }) => {
  await openWorld(page);
  await page.getByRole('button', { name: 'Switch to night' }).click();
  const canvas = page.locator('[data-effects]');
  const bounds = (await canvas.boundingBox())!;
  const point = { x: bounds.width * 0.6, y: bounds.height * 0.3 };
  const alphaAtCursor = async () => canvas.evaluate((element, point) => {
    const surface = element as HTMLCanvasElement;
    return surface.getContext('2d')!.getImageData(Math.floor(point.x / surface.clientWidth * surface.width), Math.floor(point.y / surface.clientHeight * surface.height), 1, 1).data[3];
  }, point);
  await expect.poll(alphaAtCursor).toBeGreaterThan(100);
  const before = await alphaAtCursor();
  await page.mouse.move(bounds.x + point.x, bounds.y + point.y);
  await expect.poll(alphaAtCursor).toBeLessThan(before - 20);
  await expect(page.locator('[data-nav="home"]')).toBeVisible();
});

test('lighting quality reduces canvas resolution and respects particle and motion limits', async ({ page }) => {
  await openWorld(page);
  await openSettings(page);
  await page.getByLabel('Weather', { exact: true }).selectOption('clear');
  await page.getByLabel('Quality', { exact: true }).selectOption('high');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to night' }).click();
  const canvas = page.locator('[data-effects]');
  const particleCount = async () => Number(await canvas.getAttribute('data-particle-count'));
  await expect.poll(particleCount).toBeGreaterThan(0);
  expect(await particleCount()).toBeLessThanOrEqual(150);
  const high = await canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, cssWidth: element.clientWidth }));
  expect(high.width).toBe(Math.ceil(high.cssWidth / 4));
  await expect(canvas).toHaveAttribute('data-lightmap-width', String(high.width));
  await openSettings(page);
  await page.getByLabel('Quality', { exact: true }).selectOption('low');
  await page.keyboard.press('Escape');
  const low = await canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, cssWidth: element.clientWidth }));
  expect(low.width).toBe(Math.ceil(low.cssWidth / 8));
  await expect(canvas).toHaveAttribute('data-lightmap-width', String(low.width));
  expect(await particleCount()).toBeLessThanOrEqual(50);
  await openSettings(page);
  await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
  await page.keyboard.press('Escape');
  await expect(canvas).toHaveAttribute('data-particle-count', '0');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
  const staticPixels = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(600);
  expect(await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(staticPixels);
});

test('every portfolio page passes axe in day and night with lighting enabled', async ({ page }) => {
  test.setTimeout(90_000);
  for (const route of ['/', '/projects/fieldnotes/', '/projects/orbit/', '/projects/pixel-forge/']) {
    await page.goto(route);
    await page.evaluate(async () => { await document.fonts.ready; });
    for (const theme of ['day', 'night']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.getByRole('button', { name: theme === 'day' ? 'Switch to day' : 'Switch to night' }).click();
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations, `${route} in ${theme}`).toEqual([]);
    }
  }
});

test.describe('coarse-pointer mobile world', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

  test('mobile voxel starts with a download-free Low fallback and follows manual motion settings', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pixel-settings', JSON.stringify({ quality: 'low', weather: 'off' })));
    const graphicsRequests: string[] = [];
    page.on('request', request => {
      if (/\/three[.-]/i.test(new URL(request.url()).pathname)) graphicsRequests.push(request.url());
    });
    await page.goto('/projects/pixel-forge/');
    const voxel = page.locator('[data-voxel]');
    test.skip(await voxel.count() === 0, 'Voxel feature flag is disabled in this build.');
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
    await expect(voxel.locator('[data-voxel-fallback] svg')).toBeVisible();
    await page.waitForTimeout(200);
    expect(graphicsRequests).toEqual([]);
    await openSettings(page);
    await page.getByLabel('Quality', { exact: true }).selectOption('high');
    await page.keyboard.press('Escape');
    await expect(voxel).toHaveAttribute('data-voxel-state', 'active');
    const resolution = await voxel.locator('canvas').evaluate(canvas => ({ width: (canvas as HTMLCanvasElement).width, cssWidth: canvas.clientWidth }));
    expect(resolution).toEqual({ width: 18, cssWidth: 72 });
    await openSettings(page);
    await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
    await page.keyboard.press('Escape');
    await expect(voxel).toHaveAttribute('data-voxel-state', 'static');
    await expect(voxel.locator('canvas')).toBeHidden();
    await expect(voxel.locator('[data-voxel-fallback] svg')).toBeVisible();
    await expect(voxel).toHaveAttribute('data-engine-running', 'false');
  });

  test('48px touch controls move and jump, and hide under Reduced Motion', async ({ page }) => {
    await openWorld(page);
    const right = page.getByRole('button', { name: 'Move right', exact: true });
    const left = page.getByRole('button', { name: 'Move left', exact: true });
    const jump = page.getByRole('button', { name: 'Jump', exact: true });
    for (const control of [left, right, jump]) {
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(48);
      expect(bounds?.height).toBeGreaterThanOrEqual(48);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    }
    const startX = await coordinate(page, 'x');
    const bounds = (await right.boundingBox())!;
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
    await expect.poll(() => coordinate(page, 'x'), { intervals: [30, 50] }).toBeGreaterThan(startX + 24);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
    const groundY = await coordinate(page, 'y');
    await jump.tap();
    await expect.poll(() => coordinate(page, 'y'), { intervals: [20, 30] }).toBeLessThan(groundY - 12);
    await expect(page.locator('[data-player]')).toHaveAttribute('data-grounded', 'true');
    const overlaps = await page.evaluate(() => {
      const overlaps = (first: string, second: string) => {
        const a = document.querySelector(first)!.getBoundingClientRect();
        const b = document.querySelector(second)!.getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      };
      return {
        hintCoversHero: overlaps('[data-game-controls]', '[data-player]'),
        npcCoversJump: overlaps('.wanderer', '[data-move="jump"]'),
      };
    });
    expect(overlaps).toEqual({ hintCoversHero: false, npcCoversJump: false });
    await mkdir('artifacts/screenshots', { recursive: true });
    await page.screenshot({ path: 'artifacts/screenshots/feature1-mobile-day.png' });
    await page.getByRole('button', { name: 'Switch to night' }).tap();
    await expect(page.locator('#achievement-toast')).toBeHidden();
    await page.screenshot({ path: 'artifacts/screenshots/feature1-mobile-night.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(right).toBeHidden();
    await expect(left).toBeHidden();
    await expect(jump).toBeHidden();
    await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
  });

  test('390px mobile controls stay clear of the longer hero heading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openWorld(page);
    const layout = await page.evaluate(() => {
      const bounds = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const hint = bounds('[data-game-controls]');
      const actions = bounds('.hero-actions');
      const hero = bounds('[data-player]');
      const jump = bounds('[data-move="jump"]');
      const npc = bounds('.wanderer');
      return {
        hintBelowActions: hint.top >= actions.bottom,
        hintAboveHero: hint.bottom <= hero.top,
        jumpClearOfNpc: jump.right <= npc.left || jump.left >= npc.right || jump.bottom <= npc.top || jump.top >= npc.bottom,
        width: document.documentElement.scrollWidth,
      };
    });
    expect(layout).toEqual({ hintBelowActions: true, hintAboveHero: true, jumpClearOfNpc: true, width: 390 });
    await mkdir('artifacts/screenshots', { recursive: true });
    await page.screenshot({ path: 'artifacts/screenshots/feature1-mobile390-day.png' });
    await page.getByRole('button', { name: 'Switch to night' }).tap();
    await expect(page.locator('#achievement-toast')).toBeHidden();
    await page.screenshot({ path: 'artifacts/screenshots/feature1-mobile390-night.png' });
  });
});
