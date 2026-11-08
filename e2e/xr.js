import path from 'node:path';
import { expect } from '@playwright/test';

const IWER_BUNDLE = path.resolve('node_modules/iwer/build/iwer.min.js');

// Replaces navigator.xr with IWER's Quest 3 emulation before the app loads.
// CDN downloads (MediaPipe models, XR controller profiles) are blocked so the
// tests run offline and fast: they never use webcam hand tracking, and the app
// reads the controllers' raw poses and gamepads, not the loaded 3D models.
export async function installQuestEmulator(page) {
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());
  await page.addInitScript({ path: IWER_BUNDLE });
  await page.addInitScript(() => {
    // The app builds its lighter headset graph on a real Quest; this makes the emulator count as one.
    window.__headsetGraph = true;
    const { XRDevice, metaQuest3 } = window.IWER;
    const device = new XRDevice(metaQuest3);
    device.installRuntime();
    device.position.set(0, 1.6, 0);
    window.__xrDevice = device;
  });
}

// Intro -> spatial scene (the arrow opens it directly) -> headset session.
export async function enterSpaceInHeadset(page) {
  await page.goto('/');
  await page.locator('.minimal-intro-arrow').click();

  const vrButton = page.locator('.vr-enter-button');
  await expect(vrButton).toBeVisible({ timeout: 30_000 });

  await vrButton.click();
  await expect(vrButton).toBeHidden({ timeout: 10_000 });
  await page.waitForFunction(() => Object.keys(window.__starMixTest?.getStemPositions() ?? {}).length > 0);
  await reconnectControllers(page);
}

// IWER announces its controllers before three.js is listening, so the app never
// sees them (they stay invisible at the origin). Reconnecting re-sends the event.
async function reconnectControllers(page) {
  await page.evaluate(async () => {
    const { left, right } = window.__xrDevice.controllers;
    left.connected = false;
    right.connected = false;
    await new Promise((resolve) => setTimeout(resolve, 400));
    left.connected = true;
    right.connected = true;
  });
  // Poll on a timer: while a headset session is active the page's own frame callbacks may pause.
  await page.waitForFunction(() => window.__starMixTest.getControllerState().controllers.every((c) => c.visible), undefined, { polling: 100 });
}

// The app reads either controller depending on which one is closer, so the tests
// aim both at once and press the button on one of them.
export async function aimControllers(page, from, to) {
  await page.evaluate(([origin, target]) => {
    const dx = target[0] - origin[0];
    const dy = target[1] - origin[1];
    const dz = target[2] - origin[2];
    const length = Math.hypot(dx, dy, dz);
    // Rotation taking the controller's forward axis (0, 0, -1) onto the aim direction.
    const x = dy / length;
    const y = -dx / length;
    const w = 1 - dz / length;
    const norm = Math.hypot(x, y, w);
    ['left', 'right'].forEach((hand) => {
      const controller = window.__xrDevice.controllers[hand];
      controller.position.set(origin[0], origin[1], origin[2]);
      controller.quaternion.set(x / norm, y / norm, 0, w / norm);
    });
  }, [from, to]);
}

export async function setButton(page, hand, id, value) {
  await page.evaluate(([h, button, v]) => {
    window.__xrDevice.controllers[h].updateButtonValue(button, v);
  }, [hand, id, value]);
}

export async function setThumbstick(page, hand, x, y) {
  await page.evaluate(([h, px, py]) => {
    window.__xrDevice.controllers[h].updateAxes('thumbstick', px, py);
  }, [hand, x, y]);
}

export function stemPositions(page) {
  return page.evaluate(() => window.__starMixTest.getStemPositions());
}

export const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
