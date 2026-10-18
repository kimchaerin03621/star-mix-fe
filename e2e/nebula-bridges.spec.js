import { test, expect } from '@playwright/test';
import { makeHand } from '../demo/hands.js';
import { installQuestEmulator } from './xr.js';

// Stars that are close reach toward each other and are joined by short threads, as
// if about to merge; they must never actually overlap into one.
const THREAD_MAX_LENGTH = 1.2;
const BRIDGE_START = 3.2;
const STAR_MIN_DISTANCE = 1.7;

const showHands = (page, hands) => page.evaluate((list) => {
  const now = performance.now();
  window.__starMixDemo.setHands(list.map((hand) => ({ ...hand, timestamp: now })));
}, hands);

const screenOf = (position, aspect) => {
  const half = Math.tan((75 / 2) * (Math.PI / 180));
  const depth = 2 - position[2];
  return { x: 0.5 + position[0] / (depth * half * aspect) / 2, y: 0.5 - (position[1] - 1.6) / (depth * half) / 2 };
};

const closestPair = (positions) => {
  const keys = Object.keys(positions);
  let closest = Infinity;
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      closest = Math.min(closest, Math.hypot(...positions[keys[i]].map((v, k) => v - positions[keys[j]][k])));
    }
  }
  return closest;
};

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.getByText('🤘 1초 유지 — 소리가 풀려요').waitFor();
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__starMixTest, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(4000);
});

test('only stars that are close are joined, by short threads', async ({ page }) => {
  const bridges = await page.evaluate(() => window.__starMixBridges());

  // At the starting layout two pairs of neighbours are within reach, the rest are far apart.
  expect(bridges.length).toBeGreaterThanOrEqual(2);
  bridges.forEach((bridge) => {
    expect(bridge.centerDistance).toBeLessThan(BRIDGE_START);
    expect(bridge.threads).toBeGreaterThan(0);
    // Threads longer than the limit are simply not drawn; the drawn ones are short links
    // between facing edges, never a line across the cluster.
    expect(Math.min(...bridge.lengths)).toBeLessThanOrEqual(THREAD_MAX_LENGTH + 0.15);
  });
});

test('dragging one star into another never merges them', async ({ page }) => {
  const positions = await page.evaluate(() => window.__starMixTest.getStemPositions());
  const aspect = 1280 / 720;
  const vocal = screenOf(positions.lead_vocal, aspect);
  const drums = screenOf(positions.drums, aspect);

  await showHands(page, [makeHand({ id: 1, ...vocal, pose: 'openPalm' })]);
  await page.waitForTimeout(500);
  await showHands(page, [makeHand({ id: 1, ...vocal, pose: 'fist' })]);
  await page.waitForTimeout(300);

  // Push the vocal star straight at the drums star, all the way onto it.
  const started = Date.now();
  while (Date.now() - started < 2500) {
    const progress = (Date.now() - started) / 2500;
    await showHands(page, [makeHand({
      id: 1,
      x: vocal.x + (drums.x - vocal.x) * progress,
      y: vocal.y + (drums.y - vocal.y) * progress,
      pose: 'fist',
    })]);
    await page.waitForTimeout(33);
  }
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => window.__starMixTest.getStemPositions());
  // They may touch, but never overlap into one.
  expect(closestPair(after)).toBeGreaterThan(STAR_MIN_DISTANCE - 0.1);
});
