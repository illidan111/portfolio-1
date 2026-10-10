import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Run only against a frozen production build, with other test browsers closed:
// node scripts/measure-modes.mjs --url=http://127.0.0.1:4323 --label=modes-final
// Add --mobile --cpu=4 for a separate touch/CPU-throttled comparison.
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const at = argument.indexOf('=');
  return at < 0 ? [argument.replace(/^--/, ''), true] : [argument.slice(0, at).replace(/^--/, ''), argument.slice(at + 1)];
}));
const root = fileURLToPath(new URL('../', import.meta.url));
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor !== 22 || nodeMinor < 12) throw new Error(`Use Node 22.12+ in the 22.x series; received ${process.version}.`);
const baseURL = new URL(String(args.url || 'http://127.0.0.1:4323'));
if (!['http:', 'https:'].includes(baseURL.protocol)) throw new Error('Use an HTTP(S) base URL.');
const label = String(args.label || 'modes-current');
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Label must contain only letters, numbers, underscores, or hyphens.');
const outDir = path.join(root, 'artifacts/performance', label);
const temp = path.join(root, 'artifacts/performance/tmp');
await Promise.all([mkdir(outDir, { recursive: true }), mkdir(temp, { recursive: true })]);
Object.assign(process.env, { TEMP: temp, TMP: temp, TMPDIR: temp });
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(value => value && existsSync(value));
const cpuThrottle = Number(args.cpu || 1);
const sampleMs = Number(args.duration || 4000);
if (!(cpuThrottle >= 1 && cpuThrottle <= 20) || !(sampleMs >= 1000 && sampleMs <= 30000)) throw new Error('CPU must be 1–20 and duration 1000–30000 ms.');
const mobile = Boolean(args.mobile);
const baselineExternal = 24887;
const baselineInline = 121;
const allowance = 5000;
const forbiddenChunk = /\/(?:game(?:-engine)?|bootstrap|world|settings|voxel|three(?:-core|-runtime)?)\.[^/]+\.js(?:\?|$)/i;
const reports = [];

for (const mode of ['game', 'classic']) {
  // A new on-disk profile per mode avoids warm caches and stored preferences.
  const context = await chromium.launchPersistentContext(path.join(outDir, `profile-${mode}-${Date.now()}`), {
    ...(executablePath ? { executablePath } : {}), headless: true,
    viewport: mobile ? { width: 360, height: 800 } : { width: 1440, height: 1000 },
    screen: mobile ? { width: 360, height: 800 } : { width: 1440, height: 1000 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    reducedMotion: 'no-preference', serviceWorkers: 'block',
    env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp },
  });
  const page = await context.newPage();
  const report = { mode, url: '', status: null, scripts: [], errors: [], consoleErrors: [], failedRequests: [], failedResponses: [], collectionErrors: [] };
  const scripts = new Map();
  const pending = [];
  let initial = true;
  try {
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (cpuThrottle !== 1) await session.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    await page.addInitScript(() => {
      window.__modeAudit = { lcpMs: null, cls: 0, cumulativeLayoutShift: 0, shifts: [], longTasks: [], sessionStart: 0, sessionLast: 0, sessionValue: 0 };
      const data = window.__modeAudit;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) data.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          if (!data.shifts.length || entry.startTime - data.sessionLast > 1000 || entry.startTime - data.sessionStart > 5000) {
            data.sessionStart = entry.startTime;
            data.sessionValue = 0;
          }
          data.sessionLast = entry.startTime;
          data.sessionValue += entry.value;
          data.cumulativeLayoutShift += entry.value;
          data.cls = Math.max(data.cls, data.sessionValue);
          data.shifts.push({ at: entry.startTime, value: entry.value });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) data.longTasks.push({ at: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('response', response => {
      if (response.status() >= 400) report.failedResponses.push({ url: response.url(), status: response.status() });
      const type = response.headers()['content-type'] || '';
      if (response.request().resourceType() !== 'script' && !/javascript|ecmascript/i.test(type)) return;
      const wasInitial = initial;
      pending.push((async () => {
        const body = await response.body();
        scripts.set(response.url(), {
          url: response.url(), initial: wasInitial, status: response.status(), resourceType: response.request().resourceType(),
          rawBytes: body.length, gzipBytes: gzipSync(body).length, sha256: createHash('sha256').update(body).digest('hex'),
          serverEncoding: response.headers()['content-encoding'] || null,
        });
      })().catch(error => report.collectionErrors.push({ url: response.url(), error: String(error) })));
    });
    const url = new URL('/', baseURL);
    url.searchParams.set('mode', mode);
    const response = await page.goto(url.href, { waitUntil: 'networkidle' });
    report.status = response?.status() ?? null;
    report.documentSHA256 = response ? createHash('sha256').update(await response.body()).digest('hex') : null;
    report.url = page.url();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    initial = false;
    const inline = await page.locator('script:not([src])').evaluateAll(elements => elements
      .filter(element => ['', 'module', 'text/javascript', 'application/javascript'].includes((element.getAttribute('type') || '').toLowerCase()))
      .map(element => ({ text: element.textContent || '', type: element.getAttribute('type') || 'classic' })));
    report.inlineScripts = inline.map(({ text, type }) => ({ type, rawBytes: Buffer.byteLength(text), gzipBytes: gzipSync(text).length, sha256: createHash('sha256').update(text).digest('hex') }));
    report.documentEntries = await page.evaluate(() => ({
      scripts: [...document.querySelectorAll('script[src]')].map(element => element.src),
      modulePreloads: [...document.querySelectorAll('link[rel="modulepreload"]')].map(element => element.href),
    }));
    await page.waitForTimeout(sampleMs);
    for (let index = 0; index < pending.length; index++) await pending[index];
    report.scripts = [...scripts.values()];
    report.performance = await page.evaluate(() => ({ ...window.__modeAudit,
      resolvedMode: document.documentElement.dataset.mode || null,
      runningEngines: document.querySelectorAll('[data-engine-running="true"]').length,
      visibleGameCanvases: [...document.querySelectorAll('[data-world] canvas, [data-voxel] canvas')]
        .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden').length,
    }));
    const initialScripts = report.scripts.filter(script => script.initial);
    const externalGzipBytes = initialScripts.reduce((sum, script) => sum + script.gzipBytes, 0);
    const inlineGzipBytes = report.inlineScripts.reduce((sum, script) => sum + script.gzipBytes, 0);
    report.initialJS = { externalGzipBytes, inlineGzipBytes, totalGzipBytes: externalGzipBytes + inlineGzipBytes, files: initialScripts.length };
    report.allObservedJS = { externalGzipBytes: report.scripts.reduce((sum, script) => sum + script.gzipBytes, 0), files: report.scripts.length };
    report.forbiddenRequests = report.scripts.filter(script => forbiddenChunk.test(new URL(script.url).pathname));
  } catch (error) {
    report.errors.push(String(error));
  } finally {
    await context.close();
    reports.push(report);
  }
}

const game = reports.find(report => report.mode === 'game');
const classic = reports.find(report => report.mode === 'classic');
const checks = {
  requestsComplete: reports.every(report => report.status === 200 && report.scripts.length > 0 && !report.collectionErrors.length),
  correctModes: reports.every(report => report.performance?.resolvedMode === report.mode),
  noBrowserOrNetworkErrors: reports.every(report => !report.errors.length && !report.consoleErrors.length && !report.failedRequests.length && !report.failedResponses.length),
  gameExternalBudget: (game.initialJS?.externalGzipBytes ?? Infinity) <= baselineExternal + allowance,
  // Stricter than the original external-only baseline: inline JS also fits under 29,887.
  gameInclusiveBudget: (game.initialJS?.totalGzipBytes ?? Infinity) <= baselineExternal + allowance,
  classicIsLighter: (classic.initialJS?.totalGzipBytes ?? Infinity) < (game.initialJS?.totalGzipBytes ?? 0),
  classicHasNoGameRequests: classic.forbiddenRequests?.length === 0,
  classicHasNoRunningEngine: classic.performance?.runningEngines === 0 && classic.performance?.visibleGameCanvases === 0,
  gamePositiveControl: game.forbiddenRequests?.some(script => /\/(?:game(?:-engine)?|bootstrap)\./.test(new URL(script.url).pathname)) === true,
  cls: reports.every(report => (report.performance?.cls ?? Infinity) < 0.05),
  observedLcp: reports.every(report => report.performance?.lcpMs > 0 && report.performance.lcpMs < 2500),
};
const output = {
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', timestamp: new Date().toISOString(), baseURL: baseURL.href,
  node: process.version, browser: executablePath || 'Playwright Chromium', mobile, cpuThrottle, observationMs: sampleMs, checks,
  budget: { baselineExternalGzipBytes: baselineExternal, baselineInlineGzipBytes: baselineInline, allowanceBytes: allowance,
    strictInclusiveCeilingBytes: baselineExternal + allowance,
    externalDeltaBytes: game.initialJS ? game.initialJS.externalGzipBytes - baselineExternal : null,
    likeForLikeTotalDeltaBytes: game.initialJS ? game.initialJS.totalGzipBytes - baselineExternal - baselineInline : null },
  methodology: 'Fresh profile and disabled cache for each explicit URL. Unique decoded JS responses are gzip-compressed separately using Node zlib defaults; these are reproducible gzip equivalents, not observed network transfer bytes. Initial means network idle plus 1 second; later requests remain in the graph. Inline executable scripts are included separately, excluding JSON-LD/data. CLS uses maximum session windows. LCP/CLS are native observations without Lighthouse network simulation; use the separate Lighthouse reports for its mobile gate. Chromium touch/CPU emulation does not prove physical-device performance. Filename exclusions depend on the stable game-engine and lazy graphics chunk names and need the build graph review/Classic functional test as corroboration.',
  reports,
};
const outputPath = path.join(outDir, 'mode-measurements.json');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, status: output.status, checks, budget: output.budget, modes: reports.map(({ mode, initialJS, performance }) => ({ mode, initialJS, lcpMs: performance?.lcpMs, cls: performance?.cls })) }, null, 2));
if (output.status !== 'passed') process.exitCode = 1;
