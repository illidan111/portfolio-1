// Test the production metadata and the real deployment response policy.
// Header injection proves browser compatibility; live host checks remain separate.
import { readFile, readdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { features, profile } from '../src/site.config';

const expectedSite = new URL(process.env.PORTFOLIO_SITE_URL || process.env.SITE_URL || 'https://portfolio.example');
const rootFile = (relative: string): URL => new URL(`../${relative}`, import.meta.url);

interface HeaderRule { source: string; headers: Array<{ key: string; value: string }>; }
interface DeploymentConfig { buildCommand: string; outputDirectory: string; trailingSlash: boolean; headers: HeaderRule[]; }
interface PolicyViolation { directive: string; blockedURI: string; disposition: string; documentURI: string; }
interface BrowserAudit {
  violations: PolicyViolation[];
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: Array<{ url: string; error: string | null }>;
  failedResponses: Array<{ url: string; status: number }>;
  scriptRequests: string[];
  protectedResponses: string[];
  headers: Record<string, string>;
}
type AuditWindow = Window & {
  recordDeploymentViolation: (violation: PolicyViolation) => Promise<void>;
  deploymentMarker?: string;
  deploymentContexts?: AudioContext[];
};

test.use({ storageState: { cookies: [], origins: [] }, reducedMotion: 'no-preference' });

async function configuration(): Promise<DeploymentConfig> {
  return JSON.parse(await readFile(rootFile('vercel.json'), 'utf8')) as DeploymentConfig;
}

async function contentRoutes(): Promise<string[]> {
  const entries = await readdir(rootFile('src/content/projects/'), { recursive: true });
  return ['/', ...entries.filter(entry => entry.endsWith('.md')).map(entry => `/projects/${entry.replaceAll('\\', '/').replace(/\.md$/, '')}/`).sort()];
}

function gameResource(url: string): boolean {
  return /\/(?:game(?:-engine)?|voxel|three(?:-core|-runtime)?)[.-][^/]*\.js$/i.test(new URL(url).pathname);
}

async function injectDeploymentHeaders(page: Page, baseURL: string): Promise<BrowserAudit> {
  const config = await configuration();
  const security = config.headers.find(rule => rule.source === '/(.*)');
  expect(security, 'Vercel global security header rule').toBeDefined();
  const headers = Object.fromEntries(security!.headers.map(({ key, value }) => [key.toLowerCase(), value]));
  const audit: BrowserAudit = { violations: [], pageErrors: [], consoleErrors: [], failedRequests: [], failedResponses: [], scriptRequests: [], protectedResponses: [], headers };
  const origin = new URL(baseURL).origin;

  // This enforces the real candidate CSP in the browser, including ClientRouter
  // HTML fetches. It does not claim to emulate Vercel routing or cache behavior.
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== origin) return route.continue();
    const response = await route.fetch({ maxRedirects: 0 });
    if (!/text\/html/i.test(response.headers()['content-type'] || '')) return route.fulfill({ response });
    audit.protectedResponses.push(response.url());
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.exposeFunction('recordDeploymentViolation', (violation: PolicyViolation) => { audit.violations.push(violation); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      void (window as unknown as AuditWindow).recordDeploymentViolation({
        directive: event.effectiveDirective, blockedURI: event.blockedURI,
        disposition: event.disposition, documentURI: event.documentURI,
      });
    });
    localStorage.setItem('pixel-view-notice', 'seen');
    localStorage.setItem('pixel-theme', 'night');
    if (!localStorage.getItem('pixel-settings')) {
      localStorage.setItem('pixel-settings', JSON.stringify({ quality: 'low', weather: 'off', boss: false, sound: false }));
    }
    const contexts: AudioContext[] = [];
    (window as unknown as AuditWindow).deploymentContexts = contexts;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
    };
  });
  page.on('pageerror', error => audit.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') audit.consoleErrors.push(message.text()); });
  page.on('request', request => { if (request.resourceType() === 'script') audit.scriptRequests.push(request.url()); });
  page.on('requestfailed', request => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
  page.on('response', response => { if (response.status() >= 400) audit.failedResponses.push({ url: response.url(), status: response.status() }); });
  return audit;
}

async function assertNoPolicyFailures(page: Page, audit: BrowserAudit): Promise<void> {
  await page.waitForLoadState('networkidle');
  expect(audit.protectedResponses.length).toBeGreaterThan(0);
  expect(audit.violations).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.consoleErrors).toEqual([]);
  expect(audit.failedRequests).toEqual([]);
  expect(audit.failedResponses).toEqual([]);
}

test('Vercel build and security configuration preserves static output and cache boundaries', async () => {
  const config = await configuration();
  expect(config).toMatchObject({ buildCommand: 'npm run build', outputDirectory: 'dist', trailingSlash: true });
  const security = config.headers.find(rule => rule.source === '/(.*)');
  expect(security).toBeDefined();
  const headers = Object.fromEntries(security!.headers.map(({ key, value }) => [key.toLowerCase(), value]));
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()']) expect(headers['permissions-policy']).toContain(feature);
  const csp = headers['content-security-policy'];
  for (const directive of ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "object-src 'none'", "frame-ancestors 'none'"]) expect(csp).toContain(directive);
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).not.toMatch(/https?:\/\//);
  const assets = config.headers.find(rule => rule.source === '/_astro/(.*)');
  expect(assets?.headers.find(header => header.key.toLowerCase() === 'cache-control')?.value).toBe('public, max-age=31536000, immutable');
  expect(security!.headers.find(header => header.key.toLowerCase() === 'cache-control')?.value || '').not.toContain('immutable');
  const packageJSON = JSON.parse(await readFile(rootFile('package.json'), 'utf8')) as { engines: { node: string } };
  const packageLock = JSON.parse(await readFile(rootFile('package-lock.json'), 'utf8')) as { packages: Record<string, { engines?: { node: string } }> };
  expect(packageJSON.engines.node).toBe('>=22.12.0 <23');
  expect(packageLock.packages['']?.engines?.node).toBe(packageJSON.engines.node);
});

for (const mode of ['game', 'classic'] as const) {
  test(`${mode} metadata uses one site origin and canonicalizes presentation URLs`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => localStorage.setItem('pixel-settings', JSON.stringify({ quality: 'low', weather: 'off', boss: false })));
    for (const route of await contentRoutes()) {
      const response = await page.goto(`${route}?mode=${mode}&ref=metadata-audit#main`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
      const canonical = new URL(route, expectedSite).href;
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', canonical);
      await expect(page.locator('head meta[property="og:image"]')).toHaveAttribute('content', new URL('/art/world.svg', expectedSite).href);
      expect(await page.title()).not.toBe('');
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length).toBeGreaterThan(20);
      const person = JSON.parse(await page.locator('head script[type="application/ld+json"]').textContent() || '{}') as Record<string, unknown>;
      expect(person).toMatchObject({ '@type': 'Person', name: profile.name, url: new URL('/', expectedSite).href, sameAs: [profile.github] });
      expect(canonical).not.toMatch(/[?#]/);
    }
  });
}

test('sitemap and robots are generated from the same collection routes and configured origin', async ({ request, page }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/(?:application|text)\/xml/i);
  const source = await response.text();
  const parsed = await page.evaluate(xml => {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    return { errors: document.querySelectorAll('parsererror').length, urls: [...document.querySelectorAll('loc')].map(element => element.textContent) };
  }, source);
  expect(parsed.errors).toBe(0);
  expect(parsed.urls.sort()).toEqual((await contentRoutes()).map(route => new URL(route, expectedSite).href).sort());
  expect(parsed.urls.every(url => url && !/[?#]/.test(url) && !url.includes('/404'))).toBe(true);
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', expectedSite).href}\n`);
});

test('an unknown route serves the original 404 with persistent contacts and recovery navigation', async ({ page }) => {
  const response = await page.goto('/__deployment_missing_page__/?mode=classic');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This path ends here.', exact: true })).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Email', exact: true })).toHaveAttribute('href', `mailto:${profile.email}`);
  await expect(page.getByRole('banner').getByRole('link', { name: 'CV', exact: true })).toHaveAttribute('href', '/cv.pdf');
  await page.getByRole('link', { name: 'Return to the portfolio', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'classic');
});

for (const mode of ['classic', 'game'] as const) {
  test(`${mode} works under the deployment CSP through content controls, router trips, and a CV download`, async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    expect(baseURL).toBeDefined();
    const audit = await injectDeploymentHeaders(page, baseURL!);
    const response = await page.goto(`/?mode=${mode}`);
    expect(response?.headers()['content-security-policy']).toBe(audit.headers['content-security-policy']);
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.getByRole('button', { name: 'Web apps', exact: true }).click();
    await expect(page.locator('[data-project]:visible')).toHaveCount(2);
    await page.getByRole('button', { name: 'All items', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect CSS', exact: true }).click();
    await expect(page.locator('#skill-name')).toHaveText('CSS');
    await page.evaluate(() => { (window as unknown as AuditWindow).deploymentMarker = 'same-document'; });
    for (let trip = 0; trip < 2; trip++) {
      await page.getByRole('link', { name: 'Explore Fieldnotes', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Fieldnotes', exact: true })).toBeFocused();
      await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
      await page.getByRole('link', { name: '← Back to inventory', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Crafting code.');
    }
    expect(await page.evaluate(() => (window as unknown as AuditWindow).deploymentMarker)).toBe('same-document');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('banner').getByRole('link', { name: 'CV', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('cv.pdf');
    expect(await download.failure()).toBeNull();
    if (mode === 'classic') {
      expect(audit.scriptRequests.filter(gameResource)).toEqual([]);
      await expect(page.locator('[data-engine-running="true"]')).toHaveCount(0);
    } else {
      expect(audit.scriptRequests.some(gameResource)).toBe(true);
    }
    await assertNoPolicyFailures(page, audit);
    const next = mode === 'classic' ? 'game' : 'classic';
    await page.locator('[data-view-link="toggle"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', next);
    expect(await page.evaluate(() => (window as unknown as AuditWindow).deploymentMarker)).toBeUndefined();
    await assertNoPolicyFailures(page, audit);
    await test.info().attach('csp-browser-audit', { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });
  });
}

test('deployment CSP permits lazy High graphics and trusted synthesized audio without media requests', async ({ page, baseURL }) => {
  test.skip(!features.voxels || !features.audio, 'Graphics/audio disabled in this build.');
  test.setTimeout(60_000);
  expect(baseURL).toBeDefined();
  const audit = await injectDeploymentHeaders(page, baseURL!);
  const media: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'media') media.push(request.url()); });
  await page.goto('/projects/fieldnotes/?mode=game');
  await page.getByRole('button', { name: 'Settings — shortcut 6', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'World settings' })).toBeVisible();
  await page.getByLabel('Quality', { exact: true }).selectOption('high');
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  expect(await page.evaluate(() => (window as unknown as AuditWindow).deploymentContexts?.map(context => context.state))).toEqual(['running']);
  await page.keyboard.press('Escape');
  const voxel = page.locator('[data-voxel]');
  await voxel.scrollIntoViewIfNeeded();
  await expect(voxel).toHaveAttribute('data-voxel-state', 'active');
  await expect(voxel.locator('canvas')).toBeVisible();
  expect(audit.scriptRequests.some(url => /\/(?:three|voxel)[.-]/.test(new URL(url).pathname))).toBe(true);
  expect(media).toEqual([]);
  await assertNoPolicyFailures(page, audit);
  await test.info().attach('csp-graphics-audio-audit', { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });
});
