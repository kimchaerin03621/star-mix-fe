import { test, expect } from '@playwright/test';
import { enterSpaceInHeadset, installQuestEmulator } from './xr.js';

// The way in: the viewer is carried in from a diagonal and ends up in the middle of the ring of stars
// (on a screen the camera flies; in a headset the play space slides).
const REST_DISTANCE_TO_DRUMS = 3.55; // from the resting eye (0, 1.6, 1) to the drums at (2.46, 1.3, -1.54)
// (in the headset test the emulated head stands at (0, 1.6, 0), a little closer)

const distanceToDrums = (page) => page.evaluate(() => window.__starMixTest?.getHeadDistanceTo?.('drums') ?? null);

test('on a screen the camera flies in from a diagonal and comes to rest inside the ring', async ({ page }) => {
  // An ordinary screen: no headset emulation (it would make the page count as a headset page).
  await page.setViewportSize({ width: 1600, height: 850 });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForFunction(() => window.__starMixTest?.getHeadDistanceTo?.('drums') != null, undefined, { timeout: 30_000, polling: 50 });

  const first = await distanceToDrums(page);
  expect(first).toBeGreaterThan(6); // still far out on the diagonal
  // ...and coming in. (The page starts over after 30 s of nobody around, and the test machine draws
  // only a frame or two a second, so this watches the approach rather than waiting for the very end.)
  await expect.poll(() => distanceToDrums(page), { timeout: 20_000 }).toBeLessThan(first - 1.5);
});

test('in a headset the play space slides the viewer in and then gives the space back', async ({ page }) => {
  test.setTimeout(120_000);
  await installQuestEmulator(page);
  await page.addInitScript(() => {
    window.__skipEntryFlight = false;
    // Notes how far the head is from the drums as soon as the scene exists.
    window.__drumsDistances = [];
    setInterval(() => {
      const distance = window.__starMixTest?.getHeadDistanceTo?.('drums');
      if (distance != null && window.__starMixTest?.getControllerState?.().presenting) window.__drumsDistances.push(distance);
    }, 50);
  });
  await enterSpaceInHeadset(page);

  // It ends at rest (the emulated head stands at (0, 1.6, 0): 2.9 m from the drums)...
  await expect.poll(() => distanceToDrums(page), { timeout: 60_000 }).toBeLessThan(3.1);
  await page.waitForTimeout(500);
  expect(await distanceToDrums(page)).toBeGreaterThan(2.7);
  // ...after having started far out on the diagonal.
  const seen = await page.evaluate(() => window.__drumsDistances);
  expect(Math.max(...seen)).toBeGreaterThan(5);
});
