import { test, expect } from '@playwright/test';
import { installQuestEmulator } from './xr.js';

// The headset station (?vr) is what a Quest running the page on its own sees: no
// webcam, no keyboard, so everything hangs on one controller-clickable button.

test.beforeEach(async ({ page }) => {
  // Count what a headset without a camera must never need.
  await page.addInitScript(() => {
    window.__cameraRequests = 0;
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (original) {
      navigator.mediaDevices.getUserMedia = (...args) => {
        window.__cameraRequests += 1;
        return original(...args);
      };
    }
  });
  await installQuestEmulator(page);
});

test('opens on a single start button, with no galaxy and no camera', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/?vr');

  await expect(page.locator('.vr-station-start')).toBeEnabled();
  await expect(page.locator('.minimal-intro-arrow')).toHaveCount(0);
  // Only the (hidden) 3D canvas exists: the 2D galaxy is not even mounted.
  await expect(page.locator('canvas')).toHaveCount(1);

  expect(await page.evaluate(() => window.__cameraRequests)).toBe(0);
  // (The hand-tracking library's code is part of the bundle; what must not be
  // downloaded is its model and wasm.)
  expect(requested.some((url) => /cdn\.jsdelivr\.net\/npm\/@mediapipe|mediapipe-models/.test(url))).toBe(false);
});

test('one click starts the headset session in the spatial scene', async ({ page }) => {
  await page.goto('/?vr');
  await page.locator('.vr-station-start').click();

  await page.waitForFunction(() => window.__starMixTest?.getControllerState().presenting === true, undefined, { timeout: 20_000, polling: 100 });
  const stems = Object.keys(await page.evaluate(() => window.__starMixTest.getStemPositions())).sort();
  expect(stems).toEqual(['bass', 'drums', 'lead_vocal', 'piano']);
  expect(await page.evaluate(() => window.__cameraRequests)).toBe(0);
});

test('taking the headset off starts over for the next visitor', async ({ page }) => {
  await page.goto('/?vr');
  await page.locator('.vr-station-start').click();
  await page.waitForFunction(() => window.__starMixTest?.getControllerState().presenting === true, undefined, { timeout: 20_000, polling: 100 });

  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => window.__starMixTest.endSession());
  await reloaded;

  await expect(page.locator('.vr-station-start')).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('.vr-enter-button')).toHaveCount(0);
});

test('on a device without VR the button is disabled and explains why', async ({ page }) => {
  // A plain browser: take the emulated headset away before the page loads.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
  });
  await page.goto('/?vr');

  await expect(page.locator('.vr-station-start')).toBeDisabled();
  await expect(page.locator('.vr-station-note')).toBeVisible();
});
