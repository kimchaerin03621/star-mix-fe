import { test, expect } from '@playwright/test';
import { installQuestEmulator } from './xr.js';

// Each star listens to its own stem: while the song plays, the stars that sound show a
// level, and the bands/hit values stay within their 0..1 range.
test('stars react to their own sound', async ({ page }) => {
  await installQuestEmulator(page);
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.getByText('🤘 1초 유지 — 소리가 풀려요').waitFor();
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__starMixSound, undefined, { timeout: 20_000, polling: 100 });

  const readings = [];
  for (let i = 0; i < 40; i += 1) {
    readings.push(...(await page.evaluate(() => window.__starMixSound())));
    await page.waitForTimeout(100);
  }

  expect(Math.max(...readings.map((r) => r.pulse))).toBeGreaterThan(0.05);
  readings.forEach((r) => {
    [r.pulse, r.low, r.high, r.hit].forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });
});
