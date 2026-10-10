import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const edgeInstalled = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].some(existsSync);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]],
  outputDir: 'artifacts/test-results',
  use: {
    baseURL: process.env.PORTFOLIO_TEST_URL ?? 'http://127.0.0.1:4323',
    // Existing mechanics tests explicitly choose Game; Classic tests reset this state.
    storageState: { cookies: [], origins: [{ origin: new URL(process.env.PORTFOLIO_TEST_URL ?? 'http://127.0.0.1:4323').origin, localStorage: [{ name: 'pixel-view', value: 'game' }, { name: 'pixel-view-notice', value: 'seen' }] }] },
    channel: edgeInstalled ? 'msedge' : 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
