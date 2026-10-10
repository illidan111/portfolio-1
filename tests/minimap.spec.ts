import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { features } from '../src/site.config';

test.skip(!features.minimap, 'The minimap is disabled at build time.');
test.use({ reducedMotion: 'no-preference' });

test('visiting a section removes its fog, persists after reload, and unlocks its map link', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('[data-minimap]');
  await expect(map).toHaveAttribute('open');
  await expect(map.locator('[data-map-landmark="home"]')).toHaveAttribute('data-visited', 'true');
  const skills = map.locator('[data-map-landmark="skills"]');
  await expect(skills).toHaveAttribute('aria-disabled', 'true');
  await expect(skills).toHaveAttribute('data-visited', 'false');
  await page.locator('#skills').scrollIntoViewIfNeeded();
  await expect(skills).toHaveAttribute('data-visited', 'true');
  await expect(skills).not.toHaveAttribute('aria-disabled');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pixel-map-visited') ?? '[]'))).toContain('skills');
  await page.reload();
  await expect(skills).toHaveAttribute('data-visited', 'true');
  await expect(map.locator('[data-map-state="skills"]')).toHaveText(' — visited');
  await map.locator('[data-map-landmark="home"]').click();
  await expect(page).toHaveURL(/#home$/);
  await skills.click();
  await expect(page).toHaveURL(/#skills$/);
});

test('project routes reveal Projects and expose equivalent links with visited state', async ({ page }) => {
  await page.goto('/projects/fieldnotes/');
  const map = page.locator('[data-minimap]');
  await expect(map.locator('[data-map-landmark="projects"]')).toHaveAttribute('data-visited', 'true');
  const equivalent = page.getByRole('navigation', { name: 'All landmarks and exploration status' });
  await expect(equivalent.getByRole('link')).toHaveCount(5);
  const contact = equivalent.getByRole('link', { name: 'Contact — unvisited' });
  await contact.focus();
  await expect(contact).toBeFocused();
  await expect(equivalent).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(map.locator('[data-map-landmark="contact"]')).toHaveAttribute('data-visited', 'true');
});

test('mobile minimap starts collapsed, opens by keyboard, fits the viewport, and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/');
  const map = page.locator('[data-minimap]');
  await expect(map).not.toHaveAttribute('open');
  const toggle = map.locator('summary');
  const bounds = await toggle.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(48);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(map).toHaveAttribute('open');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const results = await new AxeBuilder({ page }).include('.minimap').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: 'artifacts/screenshots/minimap-mobile-day.png' });
  await page.getByRole('button', { name: 'Switch to night' }).click();
  const toast = page.locator('#achievement-toast');
  await expect(toast).toBeVisible();
  await expect.poll(async () => {
    const mapBounds = await page.locator('.minimap').boundingBox();
    const toastBounds = await toast.boundingBox();
    return mapBounds && toastBounds ? toastBounds.y - (mapBounds.y + mapBounds.height) : -1;
  }).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: 'artifacts/screenshots/minimap-mobile-night.png' });
  await toggle.focus();
  await page.keyboard.press('Escape');
  await expect(map).not.toHaveAttribute('open');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await map.locator('[data-map-landmark="home"]').click();
  await expect(map).not.toHaveAttribute('open');
});

test('corrupt stored map entries are ignored and Reduced Motion does not animate fog', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('pixel-map-visited', JSON.stringify(['skills', null, 42, 'unknown']));
    localStorage.setItem('pixel-settings', JSON.stringify({ motion: 'reduced' }));
  });
  await page.goto('/');
  const map = page.locator('[data-minimap]');
  await expect(map.locator('[data-map-landmark="skills"]')).toHaveAttribute('data-visited', 'true');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(map.locator('[data-map-landmark="contact"]')).toHaveAttribute('data-visited', 'true');
  await expect(map.locator('[data-revealing="true"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('blocked localStorage still allows this visit to reveal map landmarks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  await page.goto('/');
  await page.locator('#skills').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-map-landmark="skills"]')).toHaveAttribute('data-visited', 'true');
  expect(errors).toEqual([]);
});
