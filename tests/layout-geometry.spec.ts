import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function geometry(page: Page): Promise<Record<string, Box | null>> {
  return page.evaluate(() => {
    const selectors: Record<string, string> = {
      world: '.hero', map: '.minimap', work: '.hero-actions a', hello: '.hero-actions button',
      bubble: '.speech-bubble', player: '[data-player]', door: '[data-house-door]', prompt: '[data-door-prompt]',
      hint: '[data-game-controls]', biome: '.biome-strip',
    };
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) return [name, null];
      const outline = name === 'player' ? 2 : 0;
      return [name, { left: rect.left - outline, top: rect.top - outline, right: rect.right + outline, bottom: rect.bottom + outline, width: rect.width, height: rect.height }];
    }));
  });
}

for (const width of [360, 390, 412, 768, 1024, 1440, 1920]) {
  test.describe(`${width}px layout`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width <= 768, isMobile: width <= 768, reducedMotion: 'no-preference' });

    for (const theme of ['day', 'night']) {
      test(`${theme}: dock, actions, character, and door remain separated`, async ({ page }) => {
        await page.addInitScript(theme => {
          localStorage.setItem('pixel-theme', theme);
          localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off', boss: false }));
        }, theme);
        await page.goto('/?mode=game');
        await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
        await page.evaluate(async () => { await document.fonts.ready; });
        const initial = await geometry(page);
        expect(initial.map!.bottom).toBeLessThanOrEqual(initial.world!.top);
        expect(initial.prompt).toBeNull();
        expect(initial.hint).not.toBeNull();
        expect(initial.hint!.bottom, 'Controls hint must clear the biome strip').toBeLessThanOrEqual(initial.biome!.top - 8);
        for (const name of ['work', 'hello', 'bubble', 'player', 'door']) {
          const bounds = initial[name];
          if (!bounds) continue;
          expect(bounds.left, `${name} left edge`).toBeGreaterThanOrEqual(initial.world!.left);
          expect(bounds.right, `${name} right edge`).toBeLessThanOrEqual(initial.world!.right);
          expect(bounds.top, `${name} top edge`).toBeGreaterThanOrEqual(initial.world!.top);
          expect(bounds.bottom, `${name} bottom edge`).toBeLessThanOrEqual(initial.world!.bottom);
        }
        const controls = ['map', 'work', 'hello', 'bubble', 'player', 'door'];
        for (let i = 0; i < controls.length; i++) {
          for (let j = i + 1; j < controls.length; j++) {
            const a = initial[controls[i]], b = initial[controls[j]];
            if (a && b) expect(intersects(a, b), `${controls[i]} overlaps ${controls[j]}`).toBe(false);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        expect(initial.world!.height).toBeGreaterThanOrEqual(width * 600 / 1600);
        expect(initial.player!.bottom - 2 - initial.world!.top).toBeCloseTo(Math.round(initial.world!.height * 492 / 600), 0);
        const transform = await page.locator('[data-player]').evaluate(element => {
          const matrix = new DOMMatrix(getComputedStyle(element).transform);
          return [matrix.a, matrix.d, matrix.e, matrix.f];
        });
        expect(transform.slice(0, 2)).toEqual([1, 1]);
        expect(transform.slice(2).every(Number.isInteger)).toBe(true);
        const sprite = await page.locator('[data-player] svg').evaluate(element => ({ width: element.getBoundingClientRect().width, filter: getComputedStyle(element).filter }));
        expect(sprite.width).toBe(32);
        expect(sprite.filter).toContain('drop-shadow');
        await mkdir('artifacts/screenshots', { recursive: true });
        await page.screenshot({ path: `artifacts/screenshots/layout-${width}-${theme}.png` });

        const map = page.locator('[data-minimap]');
        await map.locator('summary').click();
        await expect(map).toHaveAttribute('open');
        const expanded = await geometry(page);
        expect(expanded.world!.top).toBeGreaterThan(initial.world!.top);
        expect(expanded.map!.bottom).toBeLessThanOrEqual(expanded.world!.top);
        for (const name of ['work', 'hello', 'bubble', 'player', 'door']) {
          if (expanded[name]) expect(intersects(expanded.map!, expanded[name]!), `expanded map overlaps ${name}`).toBe(false);
        }
        await map.locator('summary').click();

        await page.locator('[data-game-input]').focus();
        await page.keyboard.down('d');
        await expect.poll(async () => Number(await page.locator('[data-player]').getAttribute('data-x'))).toBeGreaterThanOrEqual(827);
        for (let attempt = 0; attempt < 3 && await page.locator('[data-house-door]').getAttribute('data-near') !== 'true'; attempt++) {
          await expect(page.locator('[data-player]')).toHaveAttribute('data-grounded', 'true');
          await page.keyboard.press('Space');
          await page.locator('[data-house-door][data-near="true"]').waitFor({ state: 'attached', timeout: 1100 }).catch(() => {});
        }
        await page.keyboard.up('d');
        await expect(page.locator('[data-house-door]')).toHaveAttribute('data-near', 'true');
        await expect(page.locator('.speech-bubble')).toBeHidden();
        await expect(page.locator('[data-door-prompt]')).toBeVisible();
        await expect(page.locator('[data-game-controls]')).toBeHidden();
        await expect(page.locator('[data-player]')).toHaveAttribute('data-grounded', 'true');
        const near = await geometry(page);
        expect(near.door!.top - near.prompt!.bottom).toBeGreaterThanOrEqual(8);
        expect((near.prompt!.left + near.prompt!.right) / 2).toBeCloseTo((near.door!.left + near.door!.right) / 2, 0);
        expect(near.prompt!.left).toBeGreaterThanOrEqual(near.world!.left);
        expect(near.prompt!.right).toBeLessThanOrEqual(near.world!.right);
        for (const name of ['map', 'work', 'hello', 'door']) expect(intersects(near.prompt!, near[name]!), `door prompt overlaps ${name}`).toBe(false);
        if (theme === 'day' && [360, 768].includes(width)) await page.screenshot({ path: `artifacts/screenshots/layout-near-${width}.png` });
        await page.keyboard.press('Escape');
      });
    }
  });
}
