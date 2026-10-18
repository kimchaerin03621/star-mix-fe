import { test, expect } from '@playwright/test';
import {
  aimControllers,
  distance,
  enterSpaceInHeadset,
  installQuestEmulator,
  setButton,
  setThumbstick,
  stemPositions,
} from './xr.js';

const CONTROLLER_AT = [0.4, 1.5, 0];
const DRUMS_START = [2.84, 1.3, -2.2];
const AIM_ELSEWHERE = [1.8, 2.0, -3];
const HELD_DISTANCE = 3.3;
const MAX_DRAG_DISTANCE = 10;

const pointAlong = (from, toward, length) => {
  const gap = toward.map((value, index) => value - from[index]);
  const size = Math.hypot(...gap);
  return from.map((value, index) => value + (gap[index] / size) * length);
};

const drums = async (page) => (await stemPositions(page)).drums;

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await enterSpaceInHeadset(page);
  await aimControllers(page, CONTROLLER_AT, DRUMS_START);
});

test('pointing at a star without pressing anything leaves it alone', async ({ page }) => {
  await page.waitForTimeout(500);
  expect(distance(await drums(page), DRUMS_START)).toBeLessThan(0.05);
});

test('the trigger grabs a star and it follows the controller', async ({ page }) => {
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);

  await aimControllers(page, CONTROLLER_AT, AIM_ELSEWHERE);
  const expected = pointAlong(CONTROLLER_AT, AIM_ELSEWHERE, HELD_DISTANCE);
  await expect.poll(async () => distance(await drums(page), expected)).toBeLessThan(0.2);
});

test('pulling the trigger does not switch the song', async ({ page }) => {
  const before = Object.keys(await stemPositions(page)).sort();

  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(800);

  expect(Object.keys(await stemPositions(page)).sort()).toEqual(before);
});

test('no controller button switches the song (the exhibition plays one song)', async ({ page }) => {
  const before = Object.keys(await stemPositions(page)).sort();

  // xr-standard buttons: squeeze, thumbstick press, A/X and B/Y.
  for (const id of ['squeeze', 'a-button', 'b-button', 'thumbstick']) {
    await setButton(page, 'right', id, 1);
    await setButton(page, 'left', id, 1);
    await page.waitForTimeout(300);
    await setButton(page, 'right', id, 0);
    await setButton(page, 'left', id, 0);
  }
  await page.keyboard.press('n');
  await page.waitForTimeout(500);

  expect(Object.keys(await stemPositions(page)).sort()).toEqual(before);
});

test('releasing the trigger leaves the star where it was dropped', async ({ page }) => {
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await aimControllers(page, CONTROLLER_AT, AIM_ELSEWHERE);
  const dropAt = pointAlong(CONTROLLER_AT, AIM_ELSEWHERE, HELD_DISTANCE);
  await expect.poll(async () => distance(await drums(page), dropAt)).toBeLessThan(0.2);

  await setButton(page, 'right', 'trigger', 0);
  await page.waitForTimeout(300);
  await aimControllers(page, CONTROLLER_AT, [-2, 1.5, -2]);
  await page.waitForTimeout(500);

  expect(distance(await drums(page), dropAt)).toBeLessThan(0.2);
});

test('pushing the thumbstick forward sends a held star away, up to 10 m', async ({ page }) => {
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);

  await setThumbstick(page, 'right', 0, -1);
  await expect.poll(async () => distance(await drums(page), CONTROLLER_AT), { timeout: 15_000 })
    .toBeGreaterThan(MAX_DRAG_DISTANCE - 0.3);

  await page.waitForTimeout(1000);
  expect(distance(await drums(page), CONTROLLER_AT)).toBeLessThan(MAX_DRAG_DISTANCE + 0.3);
});

test('pulling the thumbstick back brings a held star closer', async ({ page }) => {
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);

  await setThumbstick(page, 'right', 0, 1);
  await expect.poll(async () => distance(await drums(page), CONTROLLER_AT), { timeout: 15_000 })
    .toBeLessThan(HELD_DISTANCE - 1.5);
});
