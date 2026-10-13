import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390]) {
  for (const mode of ['game', 'classic']) {
    test(`header name stays clear at ${width}px in ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/?mode=${mode}`);
      await page.evaluate(() => document.fonts.ready);
      const bounds = await page.locator('.brand').evaluate(brand => {
        const range = document.createRange();
        range.selectNodeContents(brand.querySelector('span')!.firstChild!);
        const text = range.getBoundingClientRect();
        const header = brand.closest('.header-inner')!.getBoundingClientRect();
        const neighbors = [...document.querySelectorAll('.life, .world-controls, .hotbar')].map(element => element.getBoundingClientRect());
        return { fits: text.left >= header.left && text.right <= header.right, overlap: neighbors.some(rect => rect.width > 0 && text.left < rect.right && text.right > rect.left && text.top < rect.bottom && text.bottom > rect.top) };
      });
      expect(bounds).toEqual({ fits: true, overlap: false });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}
