import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { features } from '../src/site.config';

test.skip(!features.audio, 'Synthesized audio is disabled at build time.');

interface AudioProbe { contexts: AudioContext[]; oscillators: number; }
type ProbeWindow = Window & { audioProbe: AudioProbe };

async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: AudioProbe = { contexts: [], oscillators: 0 };
    (window as unknown as ProbeWindow).audioProbe = probe;
    const NativeAudioContext = window.AudioContext;
    // This records real browser audio objects; synthesis and resume are native.
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }
      override createOscillator(): OscillatorNode {
        probe.oscillators++;
        return super.createOscillator();
      }
    };
  });
}

async function audioSnapshot(page: Page): Promise<{ count: number; states: AudioContextState[]; oscillators: number }> {
  return page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).audioProbe;
    return { count: probe.contexts.length, states: probe.contexts.map(context => context.state), oscillators: probe.oscillators };
  });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press('6');
  await expect(page.getByRole('dialog', { name: 'World settings' })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await instrument(page); });

test('sound defaults Off and ignores synthetic activation without audio requests', async ({ page }) => {
  const mediaRequests: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'media' || /\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(request.url())) mediaRequests.push(request.url());
  });
  await page.goto('/?mode=game');
  await openSettings(page);
  await expect(page.locator('[data-sound-toggle]')).toHaveText('Sound: Off');
  await expect(page.getByLabel('Master volume')).toHaveValue('0.08');
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-sound-toggle]')!.click();
    window.dispatchEvent(new CustomEvent('pixel:sound-gesture'));
    document.dispatchEvent(new CustomEvent('pixel:sound', { detail: 'jump' }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'off');
  expect(await audioSnapshot(page)).toEqual({ count: 0, states: [], oscillators: 0 });
  expect(mediaRequests).toEqual([]);
});

test('trusted enable starts native synthesis, caps voices and saves master volume', async ({ page }) => {
  const mediaRequests: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'media') mediaRequests.push(request.url()); });
  await page.goto('/?mode=game');
  await openSettings(page);
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  expect((await audioSnapshot(page)).states).toEqual(['running']);
  const volume = page.getByLabel('Master volume');
  await volume.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue('0.12');
  await expect(page.locator('[data-volume-output]')).toHaveText('12%');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pixel-settings')!));
  expect(stored.sound).toBe(true);
  expect(stored.volume).toBe(0.12);
  await page.waitForTimeout(120);
  const burst = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).audioProbe;
    const before = probe.oscillators;
    for (const name of ['click', 'hover', 'jump', 'land', 'block', 'loot', 'craft', 'boss-hit', 'boss-defeated', 'page-dig']) {
      document.dispatchEvent(new CustomEvent('pixel:sound', { detail: name }));
    }
    return { created: probe.oscillators - before, voices: Number(document.documentElement.dataset.audioVoices) };
  });
  expect(burst.created).toBe(10);
  expect(burst.voices).toBeLessThanOrEqual(8);
  await expect(page.locator('html')).toHaveAttribute('data-audio-voices', '0');
  expect(mediaRequests).toEqual([]);
});

test('saved On reload remains silent until one Resume sound click, then Off stops audio', async ({ page }) => {
  await page.goto('/?mode=game');
  await openSettings(page);
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'locked');
  expect((await audioSnapshot(page)).count).toBe(0);
  await openSettings(page);
  await expect(page.locator('[data-sound-toggle]')).toHaveText('Resume sound');
  await expect(page.locator('[data-sound-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  expect((await audioSnapshot(page)).count).toBe(1);
  await expect(page.locator('[data-sound-toggle]')).toHaveText('Sound: On');
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'off');
  await expect(page.locator('html')).toHaveAttribute('data-audio-voices', '0');
  await expect.poll(async () => (await audioSnapshot(page)).states).toEqual(['suspended']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pixel-settings')!).sound)).toBe(false);
});

test('audio manager and native context survive Astro page changes without duplicate listeners', async ({ page }) => {
  await page.goto('/?mode=game');
  await openSettings(page);
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Explore Fieldnotes', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/fieldnotes\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  expect((await audioSnapshot(page)).count).toBe(1);
  await openSettings(page);
  await expect(page.locator('[data-sound-toggle]')).toHaveText('Sound: On');
  const created = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).audioProbe;
    const before = probe.oscillators;
    document.dispatchEvent(new CustomEvent('pixel:sound', { detail: 'craft' }));
    return probe.oscillators - before;
  });
  expect(created).toBe(1);
});

test('visibility suspension stops voices and offers an explicit resume', async ({ page }) => {
  await page.goto('/?mode=game');
  await openSettings(page);
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pixel:sound', { detail: 'boss-defeated' }));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await audioSnapshot(page)).states).toEqual(['suspended']);
  await expect(page.locator('html')).toHaveAttribute('data-audio-voices', '0');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-sound-toggle]')).toHaveText('Resume sound');
  await page.locator('[data-sound-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state', 'running');
  expect((await audioSnapshot(page)).count).toBe(1);
});

test('mobile speaker and pixel volume control work in both themes and motion modes', async ({ browser }, testInfo) => {
  await mkdir('artifacts/screenshots', { recursive:true });
  for (const reducedMotion of ['reduce','no-preference'] as const) {
    const context = await browser.newContext({ baseURL:testInfo.project.use.baseURL, viewport:{ width:360, height:900 }, hasTouch:true, isMobile:true, reducedMotion });
    const page = await context.newPage();
    await instrument(page);
    await page.goto('/?mode=game');
    for (const theme of ['day','night']) {
      if (theme === 'night') await page.locator('#day-toggle').tap();
      await page.locator('[data-open-settings]').tap();
      const sound = page.locator('[data-sound-toggle]');
      await sound.tap();
      await expect(page.locator('html')).toHaveAttribute('data-audio-state','running');
      await sound.tap();
      await expect(page.locator('html')).toHaveAttribute('data-audio-state','off');
      expect((await new AxeBuilder({ page }).include('#settings-dialog').analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
      await page.screenshot({ path:`artifacts/screenshots/feature10-settings-${theme}-${reducedMotion}.png` });
      await page.keyboard.press('Escape');
    }
    await context.close();
  }
});

