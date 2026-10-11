import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { features } from '../src/site.config';

test.use({ reducedMotion: 'no-preference' });

async function settingsPanel(page: Page): Promise<void> {
  await page.keyboard.press('6');
  await expect(page.getByRole('dialog', { name: 'World settings' })).toBeVisible();
}

async function setWeather(page: Page, weather: string): Promise<void> {
  await settingsPanel(page);
  await page.getByLabel('Weather', { exact: true }).selectOption(weather);
  await page.keyboard.press('Escape');
}

async function particles(page: Page): Promise<number> {
  return Number(await page.locator('[data-effects]').getAttribute('data-particle-count'));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('pixel-settings')) localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off', quality: 'high' }));
  });
});

test.describe('block discoveries', () => {
  test.skip(!features.digging, 'Block digging is disabled in this build.');

  test('keyboard digging announces loot, regrows offscreen, and preserves the counter across reloads and routes', async ({ page }) => {
    await page.goto('/');
    const block = page.locator('[data-dig-block]:not([data-easter-egg])').first();
    const count = page.locator('[data-loot-count]').first();
    await expect(count).toHaveText('0');
    await block.focus();
    await page.keyboard.press('Enter');
    await expect(block).toBeDisabled();
    await expect(block).toHaveAttribute('data-broken', 'true');
    await expect(count).toHaveText('1');
    await expect(page.locator('[data-loot-status]')).toContainText('1 block collected.');
    await expect(page.locator('[data-loot-status]')).toHaveAttribute('aria-live', 'polite');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(block).toBeEnabled({ timeout: 8_000 });
    await expect(block).not.toHaveAttribute('data-broken');
    await expect(page.locator('[data-loot-flight]')).toHaveCount(0);
    await page.reload();
    await expect(count).toHaveText('1');
    await page.getByRole('link', { name: 'Explore Astana Explorer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Astana Explorer', exact: true })).toBeVisible();
    await expect(page.locator('[data-loot-count]').first()).toHaveText('1');
    await page.getByRole('link', { name: 'Back to inventory' }).click();
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator('[data-loot-count]').first()).toHaveText('1');
  });

  test('four seeded secrets retain their positions and reveal useful accessible content', async ({ page }) => {
    await page.goto('/');
    const secrets = page.locator('[data-dig-block][data-easter-egg]');
    await expect(secrets).toHaveCount(4);
    const positions = await secrets.evaluateAll(elements => elements.map(element => ({ index: (element as HTMLElement).dataset.digBlock, secret: (element as HTMLElement).dataset.easterEgg })));
    expect(positions.map(position => position.secret).sort()).toEqual(['cv', 'fact', 'github', 'golden']);
    await page.reload();
    await expect(secrets).toHaveCount(4);
    expect(await secrets.evaluateAll(elements => elements.map(element => ({ index: (element as HTMLElement).dataset.digBlock, secret: (element as HTMLElement).dataset.easterEgg })))).toEqual(positions);
    const panel = page.locator('[data-secret-panel]');
    for (const secret of ['cv', 'github', 'fact', 'golden']) {
      await page.locator(`[data-easter-egg="${secret}"]`).click();
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-secret', secret);
      const link = panel.locator('[data-secret-link]');
      if (secret === 'cv') {
        await expect(panel.locator('[data-secret-title]')).toHaveText('A well-travelled chest');
        await expect(link).toHaveAttribute('download', '');
        await expect(link).toHaveAttribute('href', /\/cv\.pdf$/);
        await expect(link).toContainText('Download');
        await mkdir('artifacts/screenshots', { recursive: true });
        await page.screenshot({ path: 'artifacts/screenshots/feature4-desktop-discovery.png' });
      } else if (secret === 'github') {
        await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\/[^/]+\/?$/);
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      } else {
        await expect(link).toBeHidden();
        await expect(panel.locator('[data-secret-body]')).toContainText(secret === 'fact' ? 'original artwork' : 'A rare find');
      }
      await panel.getByRole('button', { name: 'Close discovery' }).click();
      await expect(panel).toBeHidden();
      await expect(page.locator('[data-dig-block]:focus')).toHaveCount(1);
    }
    await expect(page.locator('[data-loot-count]').first()).toHaveText('4');
    await expect(page.locator('[data-loot-status]')).toContainText('The golden block!');
  });

  test('reduced-motion digging works without particles or flying loot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const block = page.locator('[data-easter-egg="cv"]');
    await block.click();
    await expect(block).toHaveAttribute('data-broken', 'true');
    await expect(page.locator('[data-loot-count]').first()).toHaveText('1');
    await expect(page.locator('[data-secret-panel]')).toBeVisible();
    await expect(page.locator('[data-loot-flight]')).toHaveCount(0);
    await expect(page.locator('[data-effects]')).toHaveAttribute('data-particle-count', '0');
    await page.locator('[data-close-secret]').click();
    await page.getByText('Field notes · little things to discover', { exact: true }).click();
    await page.getByRole('button', { name: /Celebrate a golden find/ }).click();
    await expect(page.locator('[data-guide-status]')).toContainText('Golden block found!');
    await expect(page.locator('[data-effects]')).toHaveAttribute('data-particle-count', '0');
  });

  test('the ordinary discovery links remain available without JavaScript', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce', baseURL: testInfo.project.use.baseURL });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByText('Field notes · little things to discover', { exact: true }).click();
    const guide = page.locator('.field-guide');
    await expect(guide.getByRole('link', { name: 'Download the placeholder profile / CV' })).toBeVisible();
    await expect(guide.getByRole('link', { name: /Visit the developer’s GitHub/ })).toBeVisible();
    await expect(guide).toContainText('Every tree, tile, and creature');
    await context.close();
  });

  test('mobile touch can discover a chest without clipping the panel or links', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 900 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference', baseURL: testInfo.project.use.baseURL });
    const page = await context.newPage();
    await page.goto('/');
    const chest = page.locator('[data-easter-egg="cv"]');
    await chest.tap();
    const panel = page.locator('[data-secret-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-secret-link]')).toBeVisible();
    const bounds = (await panel.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    await mkdir('artifacts/screenshots', { recursive: true });
    await page.screenshot({ path: 'artifacts/screenshots/feature4-mobile-discovery.png' });
    await context.close();
  });
});

test.describe('weather and seasons', () => {
  test.skip(!features.weather, 'Weather is disabled in this build.');

  test('locked weather persists and each weather choice updates the world', async ({ page }) => {
    await page.goto('/');
    const world = page.locator('[data-world]');
    await setWeather(page, 'rain');
    await expect(world).toHaveAttribute('data-weather', 'rain');
    await expect(page.locator('[data-weather-label]')).toHaveText('A little woodland rain');
    await expect.poll(() => particles(page)).toBeGreaterThan(0);
    await page.reload();
    await expect(world).toHaveAttribute('data-weather', 'rain');
    await settingsPanel(page);
    await expect(page.getByLabel('Weather', { exact: true })).toHaveValue('rain');
    await page.keyboard.press('Escape');
    for (const weather of ['snow', 'fog', 'leaves', 'clear', 'off']) {
      await setWeather(page, weather);
      await expect(world).toHaveAttribute('data-weather', weather);
    }
    await setWeather(page, 'blood-moon');
    await expect(world).toHaveAttribute('data-weather', 'clear');
    await page.getByRole('button', { name: 'Switch to night' }).click();
    await expect(world).toHaveAttribute('data-weather', 'blood-moon');
    await expect(page.locator('[data-weather-label]')).toHaveText('Blood moon · It’s just a phase.');
  });

  test('seasonal Auto selects winter snow, spring rain, summer clear, and autumn leaves', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'auto', quality: 'high' }));
      sessionStorage.setItem('pixel-weather-visit', '0.5');
    });
    for (const [date, weather] of [['2026-01-15T12:00:00Z', 'snow'], ['2026-04-15T12:00:00Z', 'rain'], ['2026-07-15T12:00:00Z', 'clear'], ['2026-10-15T12:00:00Z', 'leaves']]) {
      await page.clock.setFixedTime(new Date(date));
      await page.goto('/');
      await expect(page.locator('[data-world]')).toHaveAttribute('data-weather', weather);
    }
  });

  test('Low quality keeps weather static, Reduced Motion removes particles, and Off clears the effect', async ({ page }) => {
    await page.goto('/');
    await setWeather(page, 'rain');
    await expect.poll(() => particles(page)).toBeGreaterThan(5);
    expect(await particles(page)).toBeLessThanOrEqual(150);
    await settingsPanel(page);
    await page.getByLabel('Quality', { exact: true }).selectOption('low');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-world]')).toHaveAttribute('data-weather', 'rain');
    await expect(page.locator('[data-effects]')).toHaveAttribute('data-particle-count', '0');
    const tint = await page.locator('[data-effects]').evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(8, 8, 1, 1).data[3]);
    expect(tint).toBeGreaterThan(0);
    await settingsPanel(page);
    await page.getByLabel('Quality', { exact: true }).selectOption('high');
    await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-effects]')).toHaveAttribute('data-particle-count', '0');
    await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
    await settingsPanel(page);
    await page.getByLabel('Motion', { exact: true }).selectOption('auto');
    await page.getByLabel('Weather', { exact: true }).selectOption('off');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-world]')).toHaveAttribute('data-weather', 'off');
    await expect(page.locator('[data-effects]')).toHaveAttribute('data-particle-count', '0');
    const clear = await page.locator('[data-effects]').evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(8, 8, 1, 1).data[3]);
    expect(clear).toBe(0);
  });

  test('all routes remain accessible in rain by day and night', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await setWeather(page, 'rain');
    for (const route of ['/', '/projects/astana-explorer/', '/projects/job-tracker/', '/projects/pixel-portfolio/']) {
      await page.goto(route);
      await page.evaluate(async () => { await document.fonts.ready; });
      for (const theme of ['day', 'night']) {
        if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'day' ? 'Switch to day' : 'Switch to night' }).click();
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(result.violations, `${route}, rain, ${theme}`).toEqual([]);
      }
    }
  });

  test('review rain and snow across desktop, tablet, and mobile in day and night', async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    await mkdir('artifacts/screenshots', { recursive: true });
    for (const width of [1440, 768, 360]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width <= 768, isMobile: width <= 768, reducedMotion: 'no-preference', baseURL: testInfo.project.use.baseURL });
      await context.addInitScript(() => localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off', quality: 'high' })));
      const page = await context.newPage();
      await page.goto('/');
      await page.evaluate(async () => { await document.fonts.ready; });
      if (width === 768) {
        const doorPromptOverlapsDialogue = await page.evaluate(() => {
          const prompt = document.querySelector('[data-house-door] > span:first-child')!.getBoundingClientRect();
          const dialogue = document.querySelector('.speech-bubble')!.getBoundingClientRect();
          return prompt.left < dialogue.right && prompt.right > dialogue.left && prompt.top < dialogue.bottom && prompt.bottom > dialogue.top;
        });
        expect(doorPromptOverlapsDialogue).toBe(false);
      }
      for (const weather of ['rain', 'snow']) {
        await setWeather(page, weather);
        await expect(page.locator('[data-world]')).toHaveAttribute('data-weather', weather);
        await expect.poll(() => particles(page)).toBeGreaterThan(5);
        for (const theme of ['day', 'night']) {
          if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'day' ? 'Switch to day' : 'Switch to night' }).click();
          await expect(page.locator('#achievement-toast')).toBeHidden();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
          await page.screenshot({ path: `artifacts/screenshots/feature5-${width}-${theme}-${weather}.png` });
        }
      }
      await context.close();
    }
  });
});
