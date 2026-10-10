import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const split = arg.indexOf('=');
  return split < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(0, split).replace(/^--/, ''), arg.slice(split + 1)];
}));
const baseURL = String(args.url || 'http://127.0.0.1:4323');
const label = String(args.label || 'current');
const outDir = path.resolve('artifacts/performance', label);
const profile = path.join(outDir, `profile-${Date.now()}`);
const temp = path.resolve('artifacts/performance/tmp');
await mkdir(outDir, { recursive: true });
await mkdir(temp, { recursive: true });
const mobile = Boolean(args.mobile);
const storage = args.storage ? JSON.parse(await readFile(String(args.storage), 'utf8')) : {};
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const context = await chromium.launchPersistentContext(profile, {
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  viewport: mobile ? { width: 360, height: 800 } : { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: args.reduced ? 'reduce' : 'no-preference',
  env: { ...process.env, TEMP: temp, TMP: temp },
});
const routeList = String(args.routes || '/,/projects/fieldnotes/,/#skills').split(',');
const reports = [];
try {
  for (const route of routeList) {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    if (args.cpu) await session.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
    await page.addInitScript((values) => {
      localStorage.clear();
      sessionStorage.clear();
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, String(value));
      window.__measurement = { cls: 0, longTasks: [], frames: [], phase: 'load' };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__measurement.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__measurement.longTasks.push({ startTime: entry.startTime, duration: entry.duration, phase: window.__measurement.phase });
      }).observe({ type: 'longtask', buffered: true });
    }, storage);
    const scripts = new Map();
    const pending = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'script') return;
      pending.push((async () => {
        const body = await response.body();
        scripts.set(response.url(), { url: response.url(), rawBytes: body.length, gzipBytes: gzipSync(body).length });
      })().catch((error) => ({ error: String(error) })));
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await Promise.all(pending);
    const initialScripts = [...scripts.values()];
    const inlineScripts = await page.locator('script:not([src]):not([type="application/json"]):not([type="application/ld+json"])').allTextContents();
    const durationMs = Number(args.duration || 10000);
    const frames = await page.evaluate(async (duration) => {
      window.__measurement.phase = 'idle-gameplay';
      const start = performance.now();
      const times = [];
      let previous;
      await new Promise((resolve) => {
        const frame = (now) => {
          if (previous !== undefined) times.push(now - previous);
          previous = now;
          if (now - start >= duration) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const sorted = [...times].sort((a, b) => a - b);
      return { sampleMs: duration, frameCount: times.length, averageFps: 1000 / (times.reduce((sum, n) => sum + n, 0) / times.length), p95FrameMs: sorted[Math.floor(sorted.length * 0.95)], maxFrameMs: Math.max(...times), framesAbove33ms: times.filter((n) => n > 33.4).length };
    }, durationMs);
    const performance = await page.evaluate(() => window.__measurement);
    const scriptList = [...scripts.values()];
    reports.push({
      route,
      url: page.url(),
      title: await page.title(),
      initialJS: { files: initialScripts, rawBytes: initialScripts.reduce((sum, item) => sum + item.rawBytes, 0), gzipBytes: initialScripts.reduce((sum, item) => sum + item.gzipBytes, 0), inlineGzipBytes: inlineScripts.reduce((sum, item) => sum + gzipSync(item).length, 0) },
      allRequestedJS: scriptList,
      frames,
      cls: performance.cls,
      longTasks: performance.longTasks,
      idleLongTasksOver100ms: performance.longTasks.filter((task) => task.phase === 'idle-gameplay' && task.duration > 100),
      errors,
    });
    await page.close();
  }
} finally {
  await context.close();
}
const report = { timestamp: new Date().toISOString(), browser: executablePath || 'playwright chromium', baseURL, mobile, cpuThrottle: Number(args.cpu || 1), reducedMotion: Boolean(args.reduced), storage, note: 'rAF frame intervals are measured in real headless Edge on this Windows host; CPU throttling and viewport emulation do not establish physical-device performance. Skills is a home-page anchor, not a separate route.', reports };
await writeFile(path.join(outDir, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: path.join(outDir, 'measurements.json'), reports: reports.map(({ route, initialJS, frames, cls, idleLongTasksOver100ms, errors }) => ({ route, initialJSgzipBytes: initialJS.gzipBytes, inlineJSgzipBytes: initialJS.inlineGzipBytes, frames, cls, idleLongTasksOver100ms, errors })) }, null, 2));
