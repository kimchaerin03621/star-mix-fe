import { test, expect } from '@playwright/test';
import {
  aimControllers,
  distance,
  enterSpaceInHeadset,
  installQuestEmulator,
  setButton,
  stemPositions,
} from './xr.js';

// The nebula stars inside a real headset session (emulated Quest 3): they must draw
// without errors, react to the controllers, and be easy to grab by their visible size.

const CONTROLLER_AT = [0.4, 1.5, 0];
const FAR_AWAY = [-3, 4, 4]; // pointing at empty space

const shapes = (page) => page.evaluate(() => window.__starMixTest.getNebulaShapes());
const pointAlong = (from, toward, length) => {
  const gap = toward.map((value, index) => value - from[index]);
  const size = Math.hypot(...gap);
  return from.map((value, index) => value + (gap[index] / size) * length);
};

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
});

test('all four nebulae draw inside the headset session without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource|Failed to fetch|play\(\)|MediaPipe/.test(message.text())) {
      errors.push(message.text());
    }
  });

  await enterSpaceInHeadset(page);
  await page.waitForTimeout(2500);

  expect(await page.evaluate(() => window.__starMixTest.getControllerState().presenting)).toBe(true);
  expect(Object.keys(await shapes(page)).sort()).toEqual(['bass', 'drums', 'lead_vocal', 'piano']);
  const stats = await page.evaluate(() => window.__starMixTest.getRenderStats());
  expect(stats.calls).toBeGreaterThan(0);
  expect(stats.triangles).toBeGreaterThan(0);
  expect(stats.lines).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('pointing a controller at a nebula forms its instrument, and looking away relaxes it', async ({ page }) => {
  await enterSpaceInHeadset(page);
  const vocal = (await stemPositions(page)).lead_vocal;

  await aimControllers(page, CONTROLLER_AT, vocal);
  await expect.poll(async () => (await shapes(page)).lead_vocal, { timeout: 8000 }).toBeGreaterThan(0.8);
  // Only the star being pointed at gathers into its instrument.
  expect((await shapes(page)).drums).toBeLessThan(0.2);

  await aimControllers(page, CONTROLLER_AT, FAR_AWAY);
  await expect.poll(async () => (await shapes(page)).lead_vocal, { timeout: 8000 }).toBeLessThan(0.2);
});

test('a nebula can be grabbed by its edge, not only its exact center', async ({ page }) => {
  await enterSpaceInHeadset(page);
  const drums = (await stemPositions(page)).drums;

  // Aim 0.7 m to the side of the star's center: inside the nebula, but far outside the
  // 0.28 m a plain star used to allow.
  const edge = [drums[0] + 0.7, drums[1], drums[2]];
  await aimControllers(page, CONTROLLER_AT, edge);
  await page.waitForTimeout(500);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(400);

  const elsewhere = [1.8, 2.0, -3];
  await aimControllers(page, CONTROLLER_AT, elsewhere);
  const grabDistance = distance(CONTROLLER_AT, drums);
  const expected = pointAlong(CONTROLLER_AT, elsewhere, grabDistance);
  await expect.poll(async () => distance((await stemPositions(page)).drums, expected), { timeout: 8000 }).toBeLessThan(0.5);
});

test('neighbouring nebulae are joined by threads in the headset too', async ({ page }) => {
  await enterSpaceInHeadset(page);
  await page.waitForTimeout(1500);
  const bridges = await page.evaluate(() => window.__starMixBridges());
  expect(bridges.length).toBeGreaterThanOrEqual(2);
  bridges.forEach((bridge) => expect(bridge.threads).toBeGreaterThan(0));
});

test('the ?vr station also shows the nebulae once the headset session starts', async ({ page }) => {
  await page.goto('/?vr');
  await page.locator('.vr-station-start').click();
  await page.waitForFunction(() => window.__starMixTest?.getControllerState().presenting === true, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(1500);
  expect(Object.keys(await shapes(page)).sort()).toEqual(['bass', 'drums', 'lead_vocal', 'piano']);
});

test('every nebula faces the viewer inside the headset (the outline is never edge-on)', async ({ page }) => {
  await enterSpaceInHeadset(page);
  await page.waitForTimeout(2000);
  const { nebulae } = await page.evaluate(() => window.__starMixTest.getFacingInfo());
  Object.values(nebulae).forEach((alignment) => expect(alignment).toBeGreaterThan(0.98));
});
