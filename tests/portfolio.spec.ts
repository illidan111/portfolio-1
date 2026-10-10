import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openHome(page: Page): Promise<void> {
  await page.goto('/?mode=game');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
  await expect(page.getByRole('button', { name: 'Switch to night' })).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function checkOverflow(page: Page): Promise<void> {
  const measurements = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(measurements.document, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.viewport);
  expect(measurements.body, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.viewport);
}

for (const width of [360, 390, 768, 1440]) {
  test(`pages and dialog fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openHome(page);
    await checkOverflow(page);
    await page.getByRole('button', { name: 'Say hello', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await checkOverflow(page);
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Explore Fieldnotes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Fieldnotes', exact: true })).toBeVisible();
    await checkOverflow(page);
  });
}

test('inventory filters show the right projects and announce the count', async ({ page }) => {
  await openHome(page);
  const visibleCards = page.locator('[data-project]:visible');
  await expect(visibleCards).toHaveCount(3);
  await page.getByRole('button', { name: 'Web apps', exact: true }).click();
  await expect(visibleCards).toHaveCount(2);
  await expect(page.locator('#project-count')).toHaveText('2 items');
  await expect(visibleCards.getByRole('heading', { level: 3 })).toHaveText(['Fieldnotes', 'Orbit']);
  await expect(page.getByRole('button', { name: 'Web apps', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Creative tools', exact: true }).click();
  await expect(visibleCards).toHaveCount(1);
  await expect(visibleCards.getByRole('heading', { level: 3 })).toHaveText(['Pixel Forge']);
  await expect(page.locator('#project-count')).toHaveText('1 item');
  await page.getByRole('button', { name: 'All items', exact: true }).click();
  await expect(visibleCards).toHaveCount(3);
});

test('skills can be inspected with mouse and keyboard', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: 'Inspect Accessibility', exact: true }).click();
  await expect(page.locator('#skill-name')).toHaveText('Accessibility');
  await expect(page.locator('#skill-description')).toContainText('Keyboard-friendly');
  await expect(page.locator('#skill-category')).toHaveText('Design');
  const cssSkill = page.getByRole('button', { name: 'Inspect CSS', exact: true });
  await cssSkill.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#skill-name')).toHaveText('CSS');
  await expect(page.locator('#skill-rarity')).toHaveText('Legendary');
  await expect(page.locator('[data-skill][aria-pressed="true"]')).toHaveCount(1);
});

test('night preference survives reloads and client router navigation', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to day' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Explore Orbit', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/orbit\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('link', { name: 'Back to inventory' }).click();
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('button', { name: 'Switch to day' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
});

test('NPC dialog traps focus, changes dialogue, and returns focus on Escape', async ({ page }) => {
  await openHome(page);
  const opener = page.getByRole('button', { name: 'Say hello', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Pixel the Wanderer' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'What does Alex build?' }).click();
  await expect(page.locator('#npc-message')).toContainText('Orbit, Fieldnotes, and Pixel Forge');
  await page.getByRole('button', { name: 'Tell me about Alex' }).click();
  await expect(page.locator('#npc-message')).toContainText('illustrative developer');
  await page.getByRole('button', { name: 'Let’s work together' }).click();
  await expect(page.locator('#npc-message')).toContainText('no personal contact address');
  await page.keyboard.press('Tab');
  // Native dialogs permit a stop in browser chrome before wrapping into the page.
  if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close conversation' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Let’s work together' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('hotbar shortcuts visit all five sections and earn the exploration achievement', async ({ page }) => {
  await openHome(page);
  await expect(page.locator('[data-achievement="explorer"] [data-achievement-state]')).toHaveText('Locked');
  const destinations = ['home', 'projects', 'skills', 'about', 'contact'];
  for (const [index, destination] of destinations.entries()) {
    await page.keyboard.press(String(index + 1));
    await expect(page).toHaveURL(new RegExp(`#${destination}$`));
    await expect(page.locator(`[data-nav="${destination}"]`)).toHaveAttribute('aria-current', 'location');
  }
  await expect(page.locator('[data-achievement="explorer"] [data-achievement-state]')).toHaveText('Unlocked');
  await expect(page.locator('#achievement-count')).toHaveText('1 / 3 unlocked');
});

test('achievements reflect actions and remain unlocked after reload', async ({ page }) => {
  await openHome(page);
  await expect(page.locator('#achievement-count')).toHaveText('0 / 3 unlocked');
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('[data-achievement="night"] [data-achievement-state]')).toHaveText('Unlocked');
  await page.getByRole('button', { name: 'Say hello', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-achievement="friend"] [data-achievement-state]')).toHaveText('Unlocked');
  await expect(page.locator('#achievement-count')).toHaveText('2 / 3 unlocked');
  await page.reload();
  await expect(page.locator('#achievement-count')).toHaveText('2 / 3 unlocked');
});

test('router round trips keep interactions active without duplicate handlers', async ({ page }) => {
  await openHome(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => { (window as Window & { portfolioTestMarker?: string }).portfolioTestMarker = 'same-document'; });
  for (let trip = 0; trip < 2; trip += 1) {
    await page.getByRole('link', { name: 'Explore Pixel Forge', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pixel Forge', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to inventory' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
    await page.getByRole('button', { name: 'Switch to night' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.getByRole('button', { name: 'Switch to day' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  }
  expect(await page.evaluate(() => (window as Window & { portfolioTestMarker?: string }).portfolioTestMarker)).toBe('same-document');
  await page.getByRole('button', { name: 'Creative tools', exact: true }).click();
  await expect(page.locator('[data-project]:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'Inspect Git', exact: true }).click();
  await expect(page.locator('#skill-name')).toHaveText('Git');
  expect(errors).toEqual([]);
});

test('day and night cycle pauses offscreen and respects reduced motion', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
  await page.clock.fastForward(90_100);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.clock.fastForward(90_100);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'false');
  await page.clock.fastForward(180_100);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await page.locator('#home').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-world]')).toHaveAttribute('data-engine-running', 'true');
  await page.clock.fastForward(90_100);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('button', { name: 'Switch to day' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.fastForward(180_100);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
});

test('corrupt saved achievements do not prevent interaction', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pixel-achievements', '{invalid-json');
    localStorage.setItem('pixel-theme', 'unexpected-theme');
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openHome(page);
  await expect(page.locator('#achievement-count')).toHaveText('0 / 3 unlocked');
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('#achievement-count')).toHaveText('1 / 3 unlocked');
  expect(errors).toEqual([]);
});

test('unavailable local storage preserves this visit’s interactions', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage unavailable', 'SecurityError'); },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openHome(page);
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('button', { name: 'Say hello', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#achievement-count')).toHaveText('2 / 3 unlocked');
  expect(errors).toEqual([]);
});

test('fonts, images, navigation, and interactions make only local requests', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalRequests.push(request.url());
    }
  });
  await openHome(page);
  await page.getByRole('link', { name: 'Explore Fieldnotes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Concept', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to inventory' }).click();
  await page.getByRole('button', { name: 'Say hello', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Let’s work together' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(externalRequests).toEqual([]);
});

test('homepage, NPC dialog, and case study pass axe WCAG A and AA checks', async ({ page }) => {
  await openHome(page);
  const scan = async () => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  };
  await scan();
  await page.getByRole('button', { name: 'Say hello', exact: true }).click();
  await scan();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Explore Fieldnotes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Concept', exact: true })).toBeVisible();
  await scan();
});

test('static content and case study links remain usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(baseURL ?? 'http://127.0.0.1:4323/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
  await expect(page.locator('[data-project]:visible')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'A builder at heart.', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Explore Fieldnotes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fieldnotes', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Design decisions', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to inventory' }).click();
  await expect(page).toHaveURL(/\/#projects$/);
  await context.close();
});

test('capture desktop, mobile, night, project, and dialog review screenshots', async ({ page }) => {
  await mkdir('artifacts/screenshots', { recursive: true });
  await openHome(page);
  await page.screenshot({ path: 'artifacts/screenshots/desktop-home-day.png' });
  await page.screenshot({ path: 'artifacts/screenshots/desktop-home-full.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to night' }).click();
  await expect(page.locator('#achievement-toast')).toBeHidden();
  await page.screenshot({ path: 'artifacts/screenshots/desktop-home-night.png' });
  await page.getByRole('button', { name: 'Switch to day' }).click();
  await page.getByRole('button', { name: 'Say hello', exact: true }).click();
  await expect(page.locator('#achievement-toast')).toBeHidden();
  await page.screenshot({ path: 'artifacts/screenshots/npc-dialog.png' });
  await page.keyboard.press('Escape');
  // Direct loading avoids capturing a View Transition snapshot during full-page resizing.
  await page.goto('/projects/fieldnotes/');
  await expect(page.getByRole('heading', { name: 'Fieldnotes', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await page.screenshot({ path: 'artifacts/screenshots/fieldnotes-case-study.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: 'artifacts/screenshots/mobile-home.png' });
  await page.screenshot({ path: 'artifacts/screenshots/mobile-home-full.png', fullPage: true });
});
