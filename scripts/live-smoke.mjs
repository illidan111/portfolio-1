import { chromium, devices, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Run after deployment (or against local production output):
// node scripts/live-smoke.mjs --url=https://YOUR-SITE.example --label=live
// Optional touch screenshots: --devices --themes=day,night
// The phone matrix is opt-in to avoid duplicating the dedicated mobile suite.
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const at = argument.indexOf('=');
  return at < 0 ? [argument.replace(/^--/, ''), true] : [argument.slice(0, at).replace(/^--/, ''), argument.slice(at + 1)];
}));
if (typeof args.url !== 'string') throw new Error('Supply --url=https://YOUR-DEPLOYED-SITE.');
const base = new URL(args.url);
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Use an HTTP(S) base URL.');
const root = fileURLToPath(new URL('../', import.meta.url));
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor !== 22 || nodeMinor < 12) throw new Error(`Use Node 22.12+ in the 22.x series; received ${process.version}.`);
const label = String(args.label || 'live-smoke');
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Label must contain only letters, numbers, underscores, or hyphens.');
const outDir = path.join(root, 'artifacts/live-smoke', label);
const temp = path.join(root, 'artifacts/tmp');
await Promise.all([mkdir(outDir, { recursive: true }), mkdir(temp, { recursive: true })]);
Object.assign(process.env, { TEMP: temp, TMP: temp, TMPDIR: temp });
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(value => value && existsSync(value));
const themes = String(args.themes || 'day').split(',');
if (themes.some(theme => !['day', 'night'].includes(theme))) throw new Error('Themes must be day and/or night.');
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp } });
const report = { timestamp: new Date().toISOString(), node: process.version, baseURL: base.href, status: 'running', pages: [], missingRoute: null, interactions: [], screenshots: [], errors: [], consoleErrors: [], failedRequests: [], failedResponses: [], failures: [] };
const absolute = (pathname, mode) => {
  const url = new URL(pathname, base);
  if (mode) url.searchParams.set('mode', mode);
  return url.href;
};
function observe(page, description) {
  page.on('pageerror', error => report.errors.push({ page: description, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ page: description, message: message.text() }); });
  page.on('requestfailed', request => report.failedRequests.push({ page: description, url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.failedResponses.push({ page: description, url: response.url(), status: response.status() }); });
}
async function settled(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}
async function capturePage(page, screenshot) {
  // A full-page screenshot alone does not enter lazy-image viewports. Scroll
  // normally first so the artifact contains the same artwork a reader sees.
  const { height, step } = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, step: Math.max(100, Math.floor(innerHeight * 0.75)) }));
  for (let position = 0; position < height; position += step) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), position);
    await page.waitForTimeout(80);
  }
  await page.waitForLoadState('networkidle');
  await page.locator('img').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await settled(page);
  // The scroll pass can naturally unlock the exploration achievement. Let its
  // temporary notification finish so it does not cover the hero in the record.
  await expect(page.locator('#achievement-toast')).toBeHidden({ timeout: 6000 });
  // CSS pixels avoid very tall DPR3 captures exceeding compositor tile limits.
  await page.screenshot({ path: screenshot, fullPage: true, scale: 'css', animations: 'disabled' });
}
async function recordCheck(name, action) {
  try { await action(); report.interactions.push({ name, passed: true }); }
  catch (error) { report.interactions.push({ name, passed: false }); report.failures.push({ name, error: String(error) }); }
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    observe(page, 'page crawl and header navigation');
    const queue = ['/', ...String(args.routes || '').split(',').filter(Boolean)];
    const seen = new Set();
    // Crawl the actual internal page graph, so adding a project does not silently
    // leave the smoke list stale. Asset/download URLs are checked separately.
    while (queue.length) {
      const pathname = new URL(queue.shift(), base).pathname;
      if (seen.has(pathname)) continue;
      if (seen.size >= 50) throw new Error('Page crawl exceeded the portfolio limit of 50 routes.');
      seen.add(pathname);
      await recordCheck(`route ${pathname}`, async () => {
        const response = await page.goto(absolute(pathname, 'game'), { waitUntil: 'networkidle' });
        const headerNames = ['content-type', 'cache-control', 'content-security-policy', 'referrer-policy', 'permissions-policy', 'x-content-type-options', 'strict-transport-security', 'x-vercel-cache'];
        const headers = Object.fromEntries(Object.entries(response?.headers() ?? {}).filter(([name]) => headerNames.includes(name)));
        const result = { pathname, requestedURL: absolute(pathname, 'game'), url: page.url(), status: response?.status() ?? null, title: await page.title(), headers };
        report.pages.push(result);
        expect(result.status).toBe(200);
        expect(new URL(result.url).origin).toBe(base.origin);
        await expect(page.locator('h1')).toBeVisible();
        await settled(page);
        const links = await page.locator('a[href]').evaluateAll(elements => elements.map(element => element.href));
        for (const href of links) {
          const link = new URL(href);
          if (link.origin !== base.origin || /\.[a-z0-9]+$/i.test(link.pathname) || seen.has(link.pathname)) continue;
          queue.push(link.pathname);
        }
      });
    }
    await recordCheck('unknown path returns HTTP 404', async () => {
      const url = absolute('/__portfolio_smoke_missing_route__/');
      // Request-only avoids treating the intentionally missing page as a browser asset failure.
      const response = await context.request.get(url);
      report.missingRoute = { url, status: response.status() };
      expect(response.status()).toBe(404);
    });
    for (const mode of ['game', 'classic']) {
      await recordCheck(`${mode} hotbar visits all sections`, async () => {
        await page.goto(absolute('/', mode), { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
        for (const id of ['home', 'projects', 'skills', 'about', 'contact']) {
          const link = page.locator(`header [data-nav="${id}"]`);
          await expect(link).toBeVisible();
          await link.click();
          await expect.poll(() => new URL(page.url()).hash).toBe(`#${id}`);
          await expect(page.locator(`#${id}`)).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
        }
        await settled(page);
      });
      await recordCheck(`${mode} persistent contact links`, async () => {
        const email = page.locator('header a[href^="mailto:"]').first();
        const cv = page.locator('header a[href="/cv.pdf"]').first();
        await expect(email).toBeVisible();
        await expect(cv).toBeVisible();
        const response = await context.request.get(absolute('/cv.pdf'));
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/pdf');
        const body = await response.body();
        expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      });
      await page.goto(absolute('/', mode), { waitUntil: 'networkidle' });
      await settled(page);
      const screenshot = path.join(outDir, `desktop-${mode}.png`);
      await capturePage(page, screenshot);
      report.screenshots.push({ device: 'desktop', mode, theme: await page.locator('html').getAttribute('data-theme'), path: path.relative(root, screenshot), viewport: page.viewportSize() });
    }
    await recordCheck('Classic header link uses an explicit URL and persists on reload', async () => {
      await page.goto(absolute('/', 'game'), { waitUntil: 'networkidle' });
      const link = page.locator('header a[href*="mode=classic"]').first();
      await expect(link).toBeVisible();
      await link.click();
      await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('classic');
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'classic');
      await settled(page);
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'classic');
    });
    await page.close();
  } finally { await context.close(); }

  if (args.devices) {
    const profiles = [
      { name: 'iphone-13', options: devices['iPhone 13'] },
      { name: 'pixel-7', options: devices['Pixel 7'] },
      { name: 'android-360', options: { viewport: { width: 360, height: 640 }, screen: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    ];
    for (const profile of profiles) for (const orientation of ['portrait', 'landscape']) for (const mode of ['game', 'classic']) for (const theme of themes) {
      if (!profile.options) throw new Error(`Installed Playwright has no ${profile.name} descriptor.`);
      const { defaultBrowserType: _unused, ...options } = profile.options;
      const portrait = options.viewport;
      const viewport = orientation === 'portrait' ? portrait : { width: portrait.height, height: portrait.width };
      const descriptorScreen = options.screen || portrait;
      const screen = orientation === 'portrait' ? descriptorScreen : { width: descriptorScreen.height, height: descriptorScreen.width };
      const context = await browser.newContext({ ...options, viewport, screen, reducedMotion: 'no-preference', serviceWorkers: 'block' });
      try {
        await context.addInitScript(value => { try { localStorage.setItem('pixel-theme', value); } catch {} }, theme);
        const page = await context.newPage();
        const name = `${profile.name}-${orientation}-${mode}-${theme}`;
        observe(page, name);
        await recordCheck(name, async () => {
          const response = await page.goto(absolute('/', mode), { waitUntil: 'networkidle' });
          expect(response?.status()).toBe(200);
          await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await settled(page);
          const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
          expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
          expect(geometry.body).toBeLessThanOrEqual(geometry.viewport);
          const screenshot = path.join(outDir, `${name}.png`);
          await capturePage(page, screenshot);
          report.screenshots.push({ device: profile.name, orientation, mode, theme, viewport, screen, path: path.relative(root, screenshot), geometry });
        });
      } finally { await context.close(); }
    }
  }
} catch (error) { report.failures.push({ name: 'smoke runner', error: String(error) }); }
finally { await browser.close(); }
report.status = [report.errors, report.consoleErrors, report.failedRequests, report.failedResponses, report.failures].every(items => items.length === 0) ? 'passed' : 'failed';
report.methodology = 'Real headless Edge/Chromium against the supplied origin. Route crawl follows internal HTML links; --routes can include intentionally unlinked routes. Intentional missing-route HTTP 404 is checked with a request outside browser error collection. Device screenshots are optional Chromium touch/viewport/UA emulation, including the iPhone descriptor; they are not Safari or physical-phone validation. Captures scroll through the page to load lazy images, return to the top, and use CSS-pixel scale to avoid high-DPR compositor tile artifacts. Screenshots require human visual review. This script records actual response headers but does not claim CSP correctness; use the separate header/CSP verification.';
const output = path.join(outDir, 'smoke.json');
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, status: report.status, pages: report.pages.map(({ pathname, status }) => ({ pathname, status })), missingRoute: report.missingRoute, checks: report.interactions, screenshots: report.screenshots.length, errors: report.errors, consoleErrors: report.consoleErrors, failedRequests: report.failedRequests, failedResponses: report.failedResponses, failures: report.failures }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
