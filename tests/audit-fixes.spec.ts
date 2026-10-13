import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
      const headerHeight = await page.locator('header').evaluate(element => element.getBoundingClientRect().height);
      expect(headerHeight).toBeLessThanOrEqual(mode === 'game' ? 192 : 156);
      const smallTargets = await page.locator('header a, header button').evaluateAll(elements => elements.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.width < 44 || rect.height < 44);
      }).map(element => element.textContent));
      expect(smallTargets).toEqual([]);
      const captions = await page.locator('.slot-label, .skill-name, .stack > span, .eyebrow, .contact-footnote, .settings-footnote').evaluateAll(elements => elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
      expect(captions.every(size => size >= 14)).toBe(true);
      const overlaps = await page.locator('.hotbar .slot-label:visible').evaluateAll(elements => elements.some((element, index) => {
        const rect = element.getBoundingClientRect();
        const next = elements[index + 1]?.getBoundingClientRect();
        return next && rect.right > next.left;
      }));
      expect(overlaps, 'Navigation captions stay separate').toBe(false);
      const navFits = await page.locator('.hotbar-item:visible').evaluateAll(elements => elements.every(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      }));
      expect(navFits).toBe(true);
      const skillLabelsFit = await page.locator('.skill-name').evaluateAll(elements => elements.every(element => {
        const label = element.getBoundingClientRect();
        const slot = element.closest('.skill-slot')!.getBoundingClientRect();
        return label.left >= slot.left && label.right <= slot.right;
      }));
      expect(skillLabelsFit).toBe(true);
    });
  }
}

for (const mode of ['game', 'classic']) {
  test(`accessible names match visible labels in ${mode}`, async ({ page }) => {
    await page.goto(`/?mode=${mode}`);
    await expect(page.locator('[data-view-link="toggle"]')).toHaveText(mode === 'game' ? 'Classic view' : 'Game view');
    const toggle = page.locator('#day-toggle');
    await expect(toggle).toHaveAccessibleName('Daytime — Switch to night');
    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Nighttime — Switch to day');
    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Daytime — Switch to night');
    await page.mouse.move(0, 0);
    await page.locator('.brand').focus();
    const audit = await new AxeBuilder({ page }).withRules(['label-content-name-mismatch']).analyze();
    expect(audit.violations).toEqual([]);
  });
}
