import { test, expect } from '@playwright/test';
import { installQuestEmulator } from './xr.js';
import { makeHand } from '../demo/hands.js';

// With a webcam hand: an open palm over a colored region marks it (the whole region, not just a
// point inside it), and closing a hand into a fist never zooms the view on the way.
const W = 1600;
const H = 850;

const setHands = (page, hands) => page.evaluate((list) => {
  const now = performance.now();
  window.__starMixDemo.setHands(list.map((hand) => ({ ...hand, timestamp: now })));
}, hands);
const hold = async (page, hands, ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) { await setHands(page, hands); await page.waitForTimeout(33); }
};
const focusOf = async (page, key) => (await page.evaluate(() => window.__starMixGraph())).regions.find((r) => r.key === key).focus;
const camera = (page) => page.evaluate(() => window.__starMixTest.getCameraPosition());
const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.setViewportSize({ width: W, height: H });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForTimeout(1200);
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen && window.__starMixDemo, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(2000);
});

// A zoom-looking hand: thumb out, everything else folded, not quite a fist.
const zoomHand = (x, y, id = 1) => {
  const hand = makeHand({ id, x, y, pose: 'thumbOnly' });
  return { ...hand, gestures: { ...hand.gestures, thumbOnly: false, zoom: true } };
};

test('an open palm anywhere over a colored region marks that region', async ({ page }) => {
  const { shapes } = await page.evaluate(() => window.__starMixGraph());
  const edge = shapes.drums;
  // A point inside the region but well away from the star's own point.
  const inside = await page.evaluate(([c]) => window.__starMixTest.getPointOnScreen(c), [[edge.center[0] + edge.radius * 0.6, edge.center[1], edge.center[2]]]);
  await hold(page, [makeHand({ id: 1, x: inside.x / W, y: inside.y / H, pose: 'openPalm' })], 700);
  expect(await focusOf(page, 'drums')).toBeGreaterThan(0.4);
  expect(await focusOf(page, 'lead_vocal')).toBeLessThan(0.05);

  await hold(page, [makeHand({ id: 1, x: 0.5, y: 0.97, pose: 'openPalm' })], 900); // away from every region
  expect(await focusOf(page, 'drums')).toBeLessThan(0.05);
});

test('closing a hand over a region does not zoom the view', async ({ page }) => {
  const { shapes } = await page.evaluate(() => window.__starMixGraph());
  const centre = await page.evaluate(([c]) => window.__starMixTest.getPointOnScreen(c), [shapes.drums.center]);
  const x = centre.x / W;
  const y = centre.y / H;
  const before = await camera(page);

  await hold(page, [makeHand({ id: 1, x, y, pose: 'openPalm' })], 500);
  await hold(page, [zoomHand(x, y)], 350); // the half-closed moment on the way to a fist
  await hold(page, [makeHand({ id: 1, x, y, pose: 'fist' })], 400);

  expect(gap(await camera(page), before)).toBeLessThan(0.05);
  const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
  expect(dragging.drums).toBe(true); // and the region was grabbed
});

test('a zoom pose held in empty space still zooms, but only after a moment', async ({ page }) => {
  const before = await camera(page);
  await hold(page, [zoomHand(0.5, 0.97, 7)], 250);
  expect(gap(await camera(page), before)).toBeLessThan(0.05); // too brief to count

  await hold(page, [zoomHand(0.5, 0.97, 7)], 1500);
  expect(gap(await camera(page), before)).toBeGreaterThan(0.3); // held: it zooms
});
