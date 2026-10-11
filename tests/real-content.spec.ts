import { expect, test } from '@playwright/test';

const projects = [
  { id: 'astana-explorer', title: 'Astana Explorer', source: 'https://github.com/illidan111/astana-explorer' },
  { id: 'job-tracker', title: 'Job Tracker', source: 'https://github.com/illidan111/job-tracker' },
  { id: 'pixel-portfolio', title: 'Pixel Portfolio', source: 'https://github.com/illidan111/portfolio-1' },
];

for (const mode of ['game', 'classic']) {
  test(`real projects, evidence labels and unassigned durations in ${mode}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/?mode=${mode}`);
    await expect(page.locator('[data-project] h3')).toHaveText(projects.map(project => project.title));
    await expect(page.getByRole('button', { name: 'Inspect JavaScript', exact: true })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Inspect Figma', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-skill-duration]')).toHaveCount(0);
    await expect(page.locator('.item-tooltip')).toContainText([
      'Used in: Job Tracker, Pixel Portfolio', 'Used in: Pixel Portfolio', 'Used in: Job Tracker',
      'Used in: Astana Explorer, Job Tracker, Pixel Portfolio', 'Used in: Astana Explorer, Job Tracker, Pixel Portfolio',
      'Used in: Astana Explorer, Pixel Portfolio', 'Used in: Astana Explorer, Job Tracker, Pixel Portfolio', 'Used in: Pixel Portfolio',
    ]);
    await expect(page.locator('.quest-log ol .eyebrow')).toHaveText(['26 September 2026', '27 September 2026', '10 October 2026']);
    for (const project of projects) {
      await page.goto(`/projects/${project.id}/?mode=${mode}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
      await expect(page.getByRole('link', { name: 'Source ↗', exact: true })).toHaveAttribute('href', project.source);
      await expect(page.getByRole('link', { name: 'Live Demo', exact: true })).toHaveCount(0);
      await expect(page.locator('.prose li')).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });
}
