import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Run only while other tests/audits are stopped. Always restore the shipping build.
const config = new URL('../src/site.config.ts', import.meta.url);
const original = await readFile(config, 'utf8');
const baseURL = process.env.PORTFOLIO_TEST_URL ?? 'http://127.0.0.1:4323';
const temporary = fileURLToPath(new URL('../artifacts/tmp/', import.meta.url));
await mkdir(temporary, { recursive:true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
let browser;
const build = () => execSync('npm run build', { stdio:'inherit', cwd:new URL('..',import.meta.url) });
try {
  await writeFile(config, original.replace(/^(\s+\w+:) true,/gm, '$1 false,'));
  build();
  browser = await chromium.launch({ channel:'msedge', headless:true });
  const page = await browser.newPage({ reducedMotion:'no-preference' });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/three|voxel.*\.js/.test(request.url())) requests.push(request.url()); });
  await page.goto(baseURL);
  await expect(page.locator('h1')).toContainText('Crafting code.');
  for (const selector of ['[data-world]','[data-digging]','[data-boss]','[data-minimap]','[data-crafting-table]','[data-sound-toggle]']) await expect(page.locator(selector)).toHaveCount(0);
  await page.getByRole('link',{ name:'Explore Fieldnotes',exact:true }).click();
  await expect(page).toHaveURL(/\/projects\/fieldnotes\/$/);
  await expect(page.locator('[data-voxel]')).toHaveCount(0);
  await expect(page.locator('[data-voxel-fallback]')).toBeVisible();
  await page.keyboard.press('6');
  await expect(page.getByRole('dialog',{ name:'World settings' })).toBeVisible();
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  await mkdir('artifacts/verification',{ recursive:true });
  await writeFile('artifacts/verification/flags-off.json', JSON.stringify({ passed:true, flags:10, errors, lazyGraphicsRequests:requests, ordinaryNavigation:'passed', settings:'passed' },null,2));
  console.log('All ten flags off: static content, navigation and Settings passed in Edge.');
} finally {
  await browser?.close();
  await writeFile(config, original);
  build();
}
