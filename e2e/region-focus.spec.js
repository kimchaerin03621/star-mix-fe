import { test, expect } from '@playwright/test';
import { makeHand } from '../demo/hands.js';
import { installQuestEmulator } from './xr.js';

// A region that is pointed at (palm, mouse) or held shows it by growing and glowing a little
// more; nothing else on screen changes. A palm counts as over a region anywhere on its colored area.
test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.setViewportSize({ width: 1600, height: 850 });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForTimeout(1200);
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen && window.__starMixDemo, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(2500);
});

const graph = (page) => page.evaluate(() => window.__starMixGraph());
const showPalm = (page, px, py) => page.evaluate(([x, y, hand]) => {
  window.__starMixDemo.setHands([{ ...hand, x: 1 - x / 1600, y: y / 850, timestamp: performance.now() }]);
}, [px, py, makeHand({ id: 1, x: 0.5, y: 0.5, pose: 'openPalm' })]);

test('pointing at a region with the mouse makes it grow; holding it makes it stronger; others stay put', async ({ page }) => {
  const { shapes } = await graph(page);
  const middle = await page.evaluate((c) => window.__starMixTest.getPointOnScreen(c), shapes.drums.center);
  await page.mouse.move(middle.x, middle.y);
  await page.waitForTimeout(600);
  let { focus } = await graph(page);
  expect(focus.drums).toBeGreaterThan(0.45);
  expect(focus.drums).toBeLessThan(0.75);
  ['lead_vocal', 'bass', 'piano'].forEach((key) => expect(focus[key] ?? 0).toBeLessThan(0.05));

  await page.mouse.down();
  await page.waitForTimeout(600);
  ({ focus } = await graph(page));
  expect(focus.drums).toBeGreaterThan(0.9);
  ['lead_vocal', 'bass', 'piano'].forEach((key) => expect(focus[key] ?? 0).toBeLessThan(0.05));
  await page.mouse.up();
  await page.mouse.move(800, 810);
  await page.waitForTimeout(700);
  expect((await graph(page)).focus.drums).toBeLessThan(0.1);
});

test('an open palm over any part of a region points at it, not only over its center point', async ({ page }) => {
  const { shapes } = await graph(page);
  const middle = await page.evaluate((c) => window.__starMixTest.getPointOnScreen(c), shapes.drums.center);
  const edge = await page.evaluate(([c, r]) => window.__starMixTest.getPointOnScreen([c[0] + r * 0.6, c[1], c[2]]), [shapes.drums.center, shapes.drums.radius]);
  const reachPx = Math.abs(edge.x - middle.x);
  expect(reachPx).toBeGreaterThan(90); // farther than the old, small hover circle

  await showPalm(page, edge.x, middle.y);
  await expect.poll(async () => (await page.evaluate(() => window.__starMixTest.getHandInteraction()))?.hoveredOrbKey, { timeout: 5000 }).toBe('drums');
  await expect.poll(async () => (await graph(page)).focus.drums, { timeout: 5000 }).toBeGreaterThan(0.4);

  await showPalm(page, 800, 810); // plain space
  await page.waitForTimeout(1200);
  expect((await page.evaluate(() => window.__starMixTest.getHandInteraction()))?.hoveredOrbKey ?? null).toBeNull();
});
