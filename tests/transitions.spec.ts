import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { features } from '../src/site.config';

test.use({ reducedMotion: 'no-preference' });
test.skip(!features.transitions, 'Dig-down transitions are disabled at build time.');

interface TransitionProbe { focused: boolean; announcement: string; frozen: boolean; durations: number[]; }

async function installProbe(page: Page, fallback = false, freeze = false): Promise<void> {
  await page.addInitScript(({ fallback, freeze }) => {
    if (fallback) Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined });
    const probe = { focused: false, announcement: '', frozen: false, durations: [] as number[] };
    (window as Window & { transitionProbe?: typeof probe }).transitionProbe = probe;
    function freezeCurtain(): void {
      const animations = document.getAnimations().filter(animation => animation instanceof CSSAnimation && animation.animationName.startsWith('pixel-'));
      probe.durations = animations.map(animation => Number(animation.effect?.getComputedTiming().duration));
      animations.forEach(animation => { animation.pause(); animation.currentTime = 260; });
      probe.frozen = animations.length > 0;
    }
    document.addEventListener('astro:before-swap', event => {
      if (!freeze || fallback) return;
      const transition = event as Event & { viewTransition: { ready: Promise<void> } };
      void transition.viewTransition.ready.then(freezeCurtain, () => {});
    });
    document.addEventListener('astro:after-swap', () => {
      queueMicrotask(() => {
        probe.focused = document.activeElement === document.querySelector('main h1');
        probe.announcement = document.querySelector('[data-page-announcement]')?.textContent ?? '';
        if (freeze && fallback) freezeCurtain();
      });
    });
  }, { fallback, freeze });
}

async function readProbe(page: Page): Promise<TransitionProbe | undefined> {
  return page.evaluate(() => (window as Window & { transitionProbe?: TransitionProbe }).transitionProbe);
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function checkImmediateNavigation(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/projects\/astana-explorer\/$/);
  await expect(page.getByRole('heading', { name: 'Astana Explorer', exact: true })).toBeFocused();
  const probe = await readProbe(page);
  expect(probe?.focused).toBe(true);
  expect(probe?.announcement).toBe(await page.title());
}

test('native dig transition shows original curtain, lasts 520ms, and focuses without waiting', async ({ page }) => {
  await installProbe(page, false, true);
  await openHome(page);
  await page.getByRole('link', { name: 'Explore Astana Explorer' }).click();
  await page.waitForFunction(() => (window as Window & { transitionProbe?: TransitionProbe }).transitionProbe?.frozen);
  await checkImmediateNavigation(page);
  const probe = await readProbe(page);
  expect(probe!.durations.length).toBeGreaterThanOrEqual(3);
  expect(probe!.durations.every(duration => duration === 520)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-dig-native', 'true');
  await expect(page.locator('[data-dig-curtain]')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition-new(pixel-dig)').animationName)).toBe('pixel-dig-curtain');
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: 'artifacts/screenshots/dig-transition-native-midpoint.png' });
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.play()));
  await expect(page.locator('html')).not.toHaveAttribute('data-dig-native', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-dig-capture', 'true');
  await expect(page.locator('[data-dig-curtain]')).toBeHidden();
});

test('fallback curtain works without native View Transitions and cleans up within 600ms', async ({ page }) => {
  await installProbe(page, true, true);
  await openHome(page);
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.getByRole('link', { name: 'Explore Astana Explorer' }).click();
  await page.waitForFunction(() => (window as Window & { transitionProbe?: TransitionProbe }).transitionProbe?.frozen);
  await checkImmediateNavigation(page);
  const probe = await readProbe(page);
  expect(probe!.durations).toEqual([520, 520]);
  await expect(page.locator('html')).toHaveAttribute('data-dig-fallback', 'true');
  await expect(page.locator('[data-dig-curtain]')).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/dig-transition-fallback-midpoint.png' });
  await expect(page.locator('html')).not.toHaveAttribute('data-dig-fallback', 'true', { timeout: 600 });
  await expect(page.locator('[data-dig-curtain]')).toBeHidden();
});

for (const preference of ['device', 'manual'] as const) {
  test(`${preference} reduced motion skips digging while retaining focus and announcements`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (preference === 'device') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => { localStorage.setItem('pixel-settings', JSON.stringify({ motion: 'reduced' })); });
    await installProbe(page);
    await openHome(page);
    await page.getByRole('link', { name: 'Explore Astana Explorer' }).click();
    await checkImmediateNavigation(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator('html')).not.toHaveAttribute('data-dig-native', 'true');
    await expect(page.locator('html')).not.toHaveAttribute('data-dig-fallback', 'true');
    await expect(page.locator('[data-dig-curtain]')).toBeHidden();
    expect(await page.evaluate(() => document.getAnimations().filter(animation => animation instanceof CSSAnimation && animation.animationName.startsWith('pixel-')).length)).toBe(0);
    expect(errors).toEqual([]);
  });
}
