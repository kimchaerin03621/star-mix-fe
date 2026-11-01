import { test, expect } from '@playwright/test';
import { installQuestEmulator } from './xr.js';

// A region shows when it is pointed at (hand, mouse or controller) and when it is held, so you can
// tell what you are holding. (Not in still mode, which turns this off for photographs.)
const star = (page, key) => page.evaluate((k) => window.__starMixTest.getStarOnScreen(k), key);

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.setViewportSize({ width: 1600, height: 850 });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForTimeout(1200);
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(2000);
});

test('a region shows when it is pointed at, and shows more when it is held', async ({ page }) => {
  const focusOf = async (key) => (await page.evaluate(() => window.__starMixGraph())).regions.find((r) => r.key === key).focus;
  const { x, y } = await star(page, 'drums');

  expect(await focusOf('drums')).toBeLessThan(0.05); // left alone: no cue

  await page.mouse.move(x, y);
  await page.waitForTimeout(700);
  const pointed = await focusOf('drums');
  expect(pointed).toBeGreaterThan(0.5); // pointed at: a clear cue
  expect(pointed).toBeLessThan(0.85); // and clearly less than held
  expect(await focusOf('bass')).toBeLessThan(0.05); // and only that region

  await page.mouse.down();
  await page.waitForTimeout(700);
  expect(await focusOf('drums')).toBeGreaterThan(0.9); // held: the strongest cue

  await page.mouse.up();
  await page.mouse.move(800, 810);
  await page.waitForTimeout(900);
  expect(await focusOf('drums')).toBeLessThan(0.05); // let go and moved away: cue gone
});
