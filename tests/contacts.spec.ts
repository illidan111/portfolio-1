import { expect, test } from '@playwright/test';
import { profile } from '../src/site.config';

const routes = ['/', '/projects/fieldnotes/', '/projects/orbit/', '/projects/pixel-forge/'];
const subtitle = [profile.role, profile.experience, profile.coreStack.join(' / '), profile.availability].join(' · ');

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pixel-view-notice', 'seen');
    localStorage.setItem('pixel-settings', JSON.stringify({ weather: 'off', boss: false, quality: 'low' }));
  });
});

for (const mode of ['classic', 'game'] as const) {
  test(`persistent Email/CV actions and Person metadata match config on every ${mode} route`, async ({ page }) => {
    test.setTimeout(60_000);
    for (const route of routes) {
      await test.step(route, async () => {
        const response = await page.goto(`${route}?mode=${mode}`);
        expect(response?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
        await expect(page).toHaveTitle(/Akzhol/);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Akzhol/);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Akzhol/);
        await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /Akzhol/);

        const header = page.getByRole('banner');
        const email = header.getByRole('link', { name: 'Email', exact: true });
        const cv = header.getByRole('link', { name: 'CV', exact: true });
        await expect(email).toBeVisible();
        await expect(email).toHaveAttribute('href', `mailto:${profile.email}`);
        await expect(cv).toBeVisible();
        await expect(cv).toHaveAttribute('href', profile.cv);
        await expect(cv).toHaveAttribute('download', 'cv.pdf');
        await email.focus();
        await expect(email).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(cv).toBeFocused();

        const structuredData = page.locator('head script[type="application/ld+json"]');
        await expect(structuredData).toHaveCount(1);
        const person = await structuredData.evaluate(element => JSON.parse(element.textContent ?? '{}') as Record<string, unknown>);
        expect(person).toMatchObject({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: profile.name,
          jobTitle: profile.role,
          description: profile.summary,
          email: profile.email,
          knowsAbout: profile.coreStack,
          sameAs: [profile.github],
        });
        await expect(page.locator('head link[rel~="me"]')).toHaveAttribute('href', profile.github);

        await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
        await expect(email).toBeInViewport();
        await expect(cv).toBeInViewport();
      });
    }
  });

  test(`${mode} shows the factual hero subtitle and ordinary contact links without a game interaction`, async ({ page }) => {
    await page.goto(`/?mode=${mode}`);
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
    await expect(page.locator('.profile-line')).toBeVisible();
    await expect(page.locator('.profile-line')).toHaveText(subtitle);

    const contact = page.getByRole('region', { name: 'Good things start with a hello.', exact: true });
    await contact.scrollIntoViewIfNeeded();
    const email = contact.getByRole('link', { name: 'Email me', exact: true });
    const cv = contact.getByRole('link', { name: 'Download CV', exact: true });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('href', `mailto:${profile.email}`);
    await expect(cv).toBeVisible();
    await expect(cv).toHaveAttribute('href', profile.cv);
    await expect(cv).toHaveAttribute('download', 'cv.pdf');
    await expect(contact.getByRole('link', { name: 'GitHub ↗', exact: true })).toHaveAttribute('href', profile.github);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });
}

test('the configured CV URL serves a downloadable PDF document', async ({ request }) => {
  expect(profile.cv).toBe('/cv.pdf');
  const response = await request.get(profile.cv);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/pdf(?:;|$)/i);
  const body = await response.body();
  expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(body.toString('latin1')).toMatch(/%%EOF\s*$/);
});
