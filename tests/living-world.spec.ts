import { mkdir } from 'node:fs/promises';
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

test('desktop playable-world screenshots in day and night', async ({ page }) => {
  await mkdir('artifacts/screenshots', { recursive: true });
  await openWorld(page);
  await page.screenshot({ path: 'artifacts/screenshots/feature1-desktop-day.png' });
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('#achievement-toast')).toBeHidden();
  await page.screenshot({ path: 'artifacts/screenshots/feature1-desktop-night.png' });
});

test.describe('coarse-pointer mobile world', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

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
