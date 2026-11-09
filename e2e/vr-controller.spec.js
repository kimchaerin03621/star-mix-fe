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
const DRUMS_START = [2.46, 1.3, -1.54];
const AIM_ELSEWHERE = [1.8, 2.0, -3];
// A grabbed star stays as far from the controller as it was when grabbed.
const HELD_DISTANCE = Math.hypot(...DRUMS_START.map((value, index) => value - CONTROLLER_AT[index]));
// The farthest a star can be sent: the edge of the graph, about 10 m from its middle.
const GRAPH_EDGE_FROM_CONTROLLER = [8.2, 10.2];

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

test('pushing the thumbstick forward sends a held star away, up to the edge of the graph', async ({ page }) => {
  test.setTimeout(180_000);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);

  await setThumbstick(page, 'right', 0, -1);
  // The push moves a fixed step per frame, and this test browser draws in software (slow),
  // so the full distance can take a while here; a real headset does it in a couple of seconds.
  await expect.poll(async () => distance(await drums(page), CONTROLLER_AT), { timeout: 120_000 })
    .toBeGreaterThan(GRAPH_EDGE_FROM_CONTROLLER[0]);

  await page.waitForTimeout(1000);
  expect(distance(await drums(page), CONTROLLER_AT)).toBeLessThan(GRAPH_EDGE_FROM_CONTROLLER[1]);
});

test('pulling the thumbstick back brings a held star closer', async ({ page }) => {
  test.setTimeout(120_000);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);

  await setThumbstick(page, 'right', 0, 1);
  // The pull moves a fixed step per frame and this test browser draws in software (slow), so allow time.
  await expect.poll(async () => distance(await drums(page), CONTROLLER_AT), { timeout: 60_000 })
    .toBeLessThan(HELD_DISTANCE - 1.5);
});

test('a star pulled right up to the controller can be grabbed again', async ({ page }) => {
  test.setTimeout(150_000);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await setThumbstick(page, 'right', 0, 1);
  await expect.poll(async () => distance(await drums(page), CONTROLLER_AT), { timeout: 80_000 })
    .toBeLessThan(0.8);
  await setThumbstick(page, 'right', 0, 0);
  await setButton(page, 'right', 'trigger', 0);
  await page.waitForTimeout(300);

  // It sits right at the hand now: aim at it, grab it again and carry it away.
  const resting = await drums(page);
  await aimControllers(page, CONTROLLER_AT, resting);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await aimControllers(page, CONTROLLER_AT, AIM_ELSEWHERE);
  const expected = pointAlong(CONTROLLER_AT, AIM_ELSEWHERE, distance(resting, CONTROLLER_AT));
  await expect.poll(async () => distance(await drums(page), expected), { timeout: 10_000 }).toBeLessThan(0.3);
});
