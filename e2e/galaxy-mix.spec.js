import { test, expect } from '@playwright/test';
import { makeHand } from '../demo/hands.js';
import { installQuestEmulator } from './xr.js';

// The galaxy has to answer a first-time visitor's small movements: a gentle sweep
// of one palm should clearly move the sound, and the lift must go away at rest.
const EQ_LIMITS_DB = { low: 4, mid: -2, high: 7 };
const SWEEP_MS = 1600;

const readMix = (page) => page.evaluate(() => window.__starMixGalaxy.getMix());
const showHands = (page, hands) => page.evaluate((list) => {
  const now = performance.now();
  window.__starMixDemo.setHands(list.map((hand) => ({ ...hand, timestamp: now })));
}, hands);

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.goto('/');
  await page.locator('.minimal-intro-arrow').click();
  await page.getByText('🤘 1초 유지 — 소리가 풀려요').waitFor();
  await page.waitForFunction(() => window.__starMixGalaxy?.getMix().vocalToRight !== null);
  await page.waitForTimeout(1500);
});

async function sweepOnePalm(page) {
  const hand = { id: 1, handedness: 'Right', pose: 'openPalm', scale: 0.65 };
  const lowestLiftSeen = { low: 0, high: 0 };
  const startedAt = Date.now();
  while (Date.now() - startedAt < SWEEP_MS) {
    const progress = (Date.now() - startedAt) / SWEEP_MS;
    await showHands(page, [makeHand({ ...hand, x: 0.3 + 0.3 * progress, y: 0.5 })]);
    const { eqDb } = await readMix(page);
    lowestLiftSeen.low = Math.min(lowestLiftSeen.low, eqDb.low);
    lowestLiftSeen.high = Math.min(lowestLiftSeen.high, eqDb.high);
    await page.waitForTimeout(40);
  }
  await showHands(page, []);
  await page.waitForTimeout(1500);
  return lowestLiftSeen;
}

test('at rest the sound is flat and untouched', async ({ page }) => {
  const mix = await readMix(page);
  expect(mix.stir).toBeLessThan(0.05);
  expect(Math.abs(mix.eqDb.low)).toBeLessThan(0.05);
  expect(Math.abs(mix.eqDb.mid)).toBeLessThan(0.05);
  expect(Math.abs(mix.eqDb.high)).toBeLessThan(0.05);
  expect(mix.vocalToRight).toBeLessThan(0.1);
});

test('a gentle sweep of one palm clearly moves the sound', async ({ page }) => {
  await sweepOnePalm(page);
  const mix = await readMix(page);

  // The vocal has largely moved to the other speaker.
  expect(mix.vocalToRight).toBeGreaterThan(0.35);
  // And the sound has a perceptible lift (highs up a few dB).
  expect(mix.stir).toBeGreaterThan(0.25);
  expect(mix.eqDb.high).toBeGreaterThan(1.5);
});

test('the stir lift stays gentle: never cuts, never exceeds its limits', async ({ page }) => {
  const lowest = await sweepOnePalm(page);
  const { eqDb } = await readMix(page);

  expect(lowest.low).toBeGreaterThan(-0.3);
  expect(lowest.high).toBeGreaterThan(-0.3);
  expect(eqDb.low).toBeLessThanOrEqual(EQ_LIMITS_DB.low + 0.05);
  expect(eqDb.high).toBeLessThanOrEqual(EQ_LIMITS_DB.high + 0.05);
  expect(eqDb.mid).toBeGreaterThanOrEqual(EQ_LIMITS_DB.mid - 0.05);
});
