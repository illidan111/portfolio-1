import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const split = arg.indexOf('=');
  return split < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(0, split).replace(/^--/, ''), arg.slice(split + 1)];
}));
const scenarios = {
  'high-day': { theme: 'day', quality: 'high', weather: 'clear' },
  'high-night': { theme: 'night', quality: 'high', weather: 'rain' },
  'low-mobile-day': { theme: 'day', quality: 'low', weather: 'clear', mobile: true, cpu: 4 },
  'low-mobile-night': { theme: 'night', quality: 'low', weather: 'snow', mobile: true, cpu: 4 },
};
if (args.matrix) {
  const baseLabel = String(args.label || 'current');
  const forwarded = process.argv.slice(2).filter((arg) => !/^--(matrix|label|scenario)(=|$)/.test(arg));
  for (const scenario of Object.keys(scenarios)) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [process.argv[1], ...forwarded, `--label=${baseLabel}-${scenario}`, `--scenario=${scenario}`], { stdio: 'inherit', shell: false });
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${scenario} exited ${code}`)));
    });
  }
  process.exit(0);
}
if (args.scenario && !(String(args.scenario) in scenarios)) throw new Error(`Unknown scenario: ${args.scenario}`);
const scenario = args.scenario ? scenarios[String(args.scenario)] : {};
const baseURL = String(args.url || 'http://127.0.0.1:4323');
const label = String(args.label || 'current');
const outDir = path.resolve('artifacts/performance', label);
const profile = path.join(outDir, `profile-${Date.now()}`);
const temp = path.resolve('artifacts/performance/tmp');
await mkdir(outDir, { recursive: true });
await mkdir(temp, { recursive: true });
const mobile = Boolean(args.mobile || scenario.mobile);
const cpuThrottle = Number(args.cpu || scenario.cpu || 1);
const storage = args.storage ? JSON.parse(await readFile(String(args.storage), 'utf8')) : {};
if (args.scenario || args.theme) storage['pixel-theme'] = String(args.theme || storage['pixel-theme'] || scenario.theme);
if (args.scenario || args.quality || args.weather) {
  const existing = JSON.parse(storage['pixel-settings'] || '{}');
  storage['pixel-settings'] = JSON.stringify({
    motion: 'auto', sound: false, volume: 0.08, boss: true, controlsHint: true,
    quality: scenario.quality || 'auto', weather: scenario.weather || 'auto',
    ...existing,
    ...(args.quality ? { quality: String(args.quality) } : {}),
    ...(args.weather ? { weather: String(args.weather) } : {}),
  });
}
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
    if (cpuThrottle !== 1) await session.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
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
      const engineSamples = [];
      let sampledAt = -Infinity;
      let previous;
      const readEngines = () => [...document.querySelectorAll('[data-engine-running]')].map((element, index) => ({
        id: element.id || `engine-${index}`,
        running: element.dataset.engineRunning === 'true',
        reduced: element.dataset.engineReduced === 'true',
        quality: element.dataset.engineQuality,
        // These counters describe the capped game render loop, not monitor rAF cadence.
        fps: element.dataset.engineFps ? Number(element.dataset.engineFps) : null,
        lifetimeMaxWorkMs: element.dataset.engineMaxWork ? Number(element.dataset.engineMaxWork) : null,
        weather: element.dataset.weather || null,
        lighting: element.dataset.lighting || null,
      }));
      await new Promise((resolve) => {
        const frame = (now) => {
          if (previous !== undefined) times.push(now - previous);
          previous = now;
          if (now - sampledAt >= 500) {
            engineSamples.push({ elapsedMs: Math.round(now - start), engines: readEngines() });
            sampledAt = now;
          }
          if (now - start >= duration) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const sorted = [...times].sort((a, b) => a - b);
      return {
        sampleMs: duration,
        frameCount: times.length,
        averageFps: 1000 / (times.reduce((sum, n) => sum + n, 0) / times.length),
        p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
        maxFrameMs: Math.max(...times),
        framesAbove33ms: times.filter((n) => n > 33.4).length,
        engineFinal: readEngines(),
        engineSamples,
        presentation: { theme: document.documentElement.dataset.theme, motion: document.documentElement.dataset.motion, quality: document.documentElement.dataset.quality },
        particles: [...document.querySelectorAll('[data-particle-count]')].map((element) => ({ count: Number(element.dataset.particleCount), lightmapWidth: Number(element.dataset.lightmapWidth || 0) })),
      };
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
const report = { timestamp: new Date().toISOString(), browser: executablePath || 'playwright chromium', baseURL, scenario: args.scenario || null, mobile, cpuThrottle, reducedMotion: Boolean(args.reduced), storage, note: 'Monitor rAF intervals and the game engine render counters are separate. Engine FPS is cumulative while running, capped at 60 Hz; its max-work counter covers the engine lifetime including load. Samples use real headless Edge on this Windows host; CPU throttling and viewport emulation do not establish physical-device performance. Skills is a home-page anchor, not a separate route.', reports };
await writeFile(path.join(outDir, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: path.join(outDir, 'measurements.json'), reports: reports.map(({ route, initialJS, frames, cls, idleLongTasksOver100ms, errors }) => ({ route, initialJSgzipBytes: initialJS.gzipBytes, inlineJSgzipBytes: initialJS.inlineGzipBytes, frames: { ...frames, engineSamples: undefined }, cls, idleLongTasksOver100ms, errors })) }, null, 2));
