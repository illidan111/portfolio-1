import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Run only while other tests/audits are stopped. Always restore the shipping build.
const config = new URL('../src/site.config.ts', import.meta.url);
const original = await readFile(config, 'utf8');
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor !== 22 || nodeMinor < 12) throw new Error(`Run this verification with Node 22.12+ in the 22.x series; received ${process.version}.`);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const astroPackageURL = new URL('../node_modules/astro/package.json', import.meta.url);
const astroPackage = JSON.parse(await readFile(astroPackageURL, 'utf8'));
const astroCLI = fileURLToPath(new URL(astroPackage.bin.astro, astroPackageURL));
const keys = ['hero', 'lighting', 'voxels', 'digging', 'weather', 'transitions', 'boss', 'minimap', 'crafting', 'audio'];
const block = /export const features\b[\s\S]*?=\s*\{([\s\S]*?)\n\};/.exec(original);
if (!block) throw new Error('Could not locate the features object; source remains unchanged.');
const matches = [...block[1].matchAll(/^(\s+)(\w+):\s*(true|false),/gm)];
if (matches.length !== keys.length || keys.some(key => !matches.some(match => match[2] === key))) throw new Error('Expected exactly the ten known feature flags; source remains unchanged.');
const start = block.index + block[0].indexOf(block[1]);
const disabled = block[1].replace(/^(\s+)(\w+):\s*(true|false),/gm, '$1$2: false,');
const disabledConfig = original.slice(0, start) + disabled + original.slice(start + block[1].length);
const baseURL = process.env.PORTFOLIO_TEST_URL ?? 'http://127.0.0.1:4323';
const temporary = fileURLToPath(new URL('../artifacts/tmp/', import.meta.url));
await mkdir(temporary, { recursive:true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
process.env.npm_config_cache = path.join(projectRoot, '.npm-cache');
process.env.PATH = `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}`;
let browser;
let failure;
const report = { passed:false, node:process.version, flags:keys, errors:[], lazyGraphicsRequests:[], ordinaryNavigation:'pending', settings:'pending', sourceRestored:false, shippingBuildRestored:false, placeholderFlagUnchanged:original.match(/isPlaceholder:\s*(true|false)/)?.[1] === disabledConfig.match(/isPlaceholder:\s*(true|false)/)?.[1] };
const build = () => execFileSync(process.execPath, [astroCLI, 'build'], { stdio:'inherit', cwd:projectRoot, env:process.env });
try {
  await writeFile(config, disabledConfig);
  build();
  browser = await chromium.launch({ channel:'msedge', headless:true });
  const page = await browser.newPage({ reducedMotion:'no-preference' });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/three|voxel.*\.js/.test(request.url())) requests.push(request.url()); });
  const home = new URL('/', baseURL);
  home.searchParams.set('mode', 'game');
  await page.goto(home.href);
  await expect(page.locator('h1')).toContainText('Crafting code.');
  for (const selector of ['[data-world]','[data-digging]','[data-boss]','[data-minimap]','[data-crafting-table]','[data-sound-toggle]']) await expect(page.locator(selector)).toHaveCount(0);
  await page.getByRole('link',{ name:'Explore Astana Explorer',exact:true }).click();
  await expect(page).toHaveURL(/\/projects\/astana-explorer\/$/);
  await expect(page.locator('[data-voxel]')).toHaveCount(0);
  await expect(page.locator('[data-voxel-fallback]')).toBeVisible();
  await page.keyboard.press('6');
  await expect(page.getByRole('dialog',{ name:'World settings' })).toBeVisible();
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  Object.assign(report, { errors, lazyGraphicsRequests:requests, ordinaryNavigation:'passed', settings:'passed' });
  console.log('All ten flags off: static content, navigation and Settings passed in Edge.');
} catch (error) {
  failure = error;
  report.errors.push(String(error));
} finally {
  try { await browser?.close(); }
  catch (error) { failure ??= error; report.errors.push(`Browser cleanup: ${error}`); }
  try {
    await writeFile(config, original);
    report.sourceRestored = await readFile(config, 'utf8') === original;
    build();
    report.shippingBuildRestored = true;
  } catch (error) { failure ??= error; report.errors.push(`Shipping restore: ${error}`); }
  report.passed = !failure && report.sourceRestored && report.shippingBuildRestored && report.placeholderFlagUnchanged;
  const directory = path.join(projectRoot, 'artifacts/verification');
  await mkdir(directory, { recursive:true });
  await writeFile(path.join(directory, 'flags-off.json'), `${JSON.stringify(report, null, 2)}\n`);
}
if (failure) throw failure;
