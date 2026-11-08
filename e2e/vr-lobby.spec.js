import { test, expect } from '@playwright/test';
import { aimControllers, distance, installQuestEmulator, setButton, stemPositions } from './xr.js';

// The headset lobby (?lobby): the logo and an enter button in front, sound nodes all around,
// and the nodes' drift tilts the left/right balance of the one song.
const BUTTON_AT = [0, 1.5, -2.2];
const CONTROLLER_AT = [0.3, 1.45, 0];

const lobby = (page) => page.evaluate(() => window.__starMixLobby?.getState() ?? null);

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.goto('/?lobby');
  const start = page.locator('.vr-station-start');
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();
  await page.waitForFunction(() => window.__starMixLobby?.getState().count > 0, undefined, { timeout: 30_000, polling: 100 });
  // The emulator announces its controllers before the app is listening: reconnect them so they show up.
  await page.evaluate(async () => {
    const { left, right } = window.__xrDevice.controllers;
    left.connected = false;
    right.connected = false;
    await new Promise((resolve) => setTimeout(resolve, 400));
    left.connected = true;
    right.connected = true;
  });
  await page.waitForTimeout(500);
});

test('the visitor starts in the lobby: many nodes all around, the sound centered', async ({ page }) => {
  const state = await lobby(page);
  expect(state.count).toBeGreaterThan(300);
  expect(Math.abs(state.balance)).toBeLessThan(0.05);
  // The main space is not built yet.
  expect(await page.evaluate(() => window.__starMixTest ?? null)).toBeNull();
});

test('swishing the right-hand nodes to the left tilts the sound left, and it drifts back', async ({ page }) => {
  await page.evaluate(() => window.__starMixLobby.sweep({ from: [4.5, 1.6, -1.5], velocity: [-3, 0, 0.3], seconds: 4, radius: 3 }));
  await expect.poll(async () => (await lobby(page)).balance, { timeout: 15_000 }).toBeLessThan(-0.1);

  // Left alone, the nodes settle back toward home and the sound comes back to the middle.
  await expect.poll(async () => Math.abs((await lobby(page)).balance), { timeout: 60_000 }).toBeLessThan(0.05);
});

test('swishing the left-hand nodes to the right tilts the sound right', async ({ page }) => {
  await page.evaluate(() => window.__starMixLobby.sweep({ from: [-4.5, 1.6, -1.5], velocity: [3, 0, 0.3], seconds: 4, radius: 3 }));
  await expect.poll(async () => (await lobby(page)).balance, { timeout: 15_000 }).toBeGreaterThan(0.1);
});

test('pointing a controller at the button and pulling the trigger opens the main space', async ({ page }) => {
  await aimControllers(page, CONTROLLER_AT, BUTTON_AT);
  await expect.poll(async () => (await lobby(page)).buttonHovered, { timeout: 10_000 }).toBe(true);
  await setButton(page, 'right', 'trigger', 1);

  await page.waitForFunction(() => window.__starMixLobby === undefined && Object.keys(window.__starMixTest?.getStemPositions() ?? {}).length > 0, undefined, { timeout: 60_000, polling: 200 });
  expect(Object.keys(await stemPositions(page)).length).toBeGreaterThan(0);
});

test('pointing elsewhere and pulling the trigger leaves the lobby open', async ({ page }) => {
  await aimControllers(page, CONTROLLER_AT, [3, 1.6, 2]);
  await page.waitForTimeout(500);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(1500);

  expect(await lobby(page)).not.toBeNull();
});

test('swinging the controller beam across the nodes carries them (far ones too), without any pretend hand', async ({ page }) => {
  const before = await lobby(page);
  for (let step = 0; step <= 24; step += 1) {
    const x = 5 - step * (10 / 24);
    await aimControllers(page, [0, 1.5, 0], [x, 1.6, -3]);
    await page.waitForTimeout(60);
  }
  await expect.poll(async () => Math.abs((await lobby(page)).balance - before.balance), { timeout: 10_000 }).toBeGreaterThan(0.03);
});

test('after entering through the lobby, a star can still be grabbed and carried', async ({ page }) => {
  test.setTimeout(150_000);
  await aimControllers(page, CONTROLLER_AT, BUTTON_AT);
  await expect.poll(async () => (await lobby(page)).buttonHovered, { timeout: 10_000 }).toBe(true);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForFunction(() => window.__starMixLobby === undefined && Object.keys(window.__starMixTest?.getStemPositions() ?? {}).length > 0, undefined, { timeout: 60_000, polling: 200 });
  await setButton(page, 'right', 'trigger', 0);
  await page.waitForTimeout(1500);

  const drums = (await stemPositions(page)).drums;
  await aimControllers(page, [0.4, 1.5, 0], drums);
  await page.waitForTimeout(500);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(500);
  await aimControllers(page, [0.4, 1.5, 0], [1.8, 2.0, -3]);
  await expect.poll(async () => distance((await stemPositions(page)).drums, drums), { timeout: 15_000 }).toBeGreaterThan(1);
});
