import { test, expect } from '@playwright/test';
import { aimControllers, distance, enterSpaceInHeadset, installQuestEmulator, setButton, stemPositions } from './xr.js';

// When stars line up along the controller's ray, only the front one is picked.
const CONTROLLER_AT = [0.4, 1.5, 0];

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await enterSpaceInHeadset(page);
});

const place = (page, key, position) => page.evaluate(([k, p]) => window.__starMixTest.setStemPosition(k, p), [key, position]);

test('with two stars on the same ray, only the nearer one is grabbed', async ({ page }) => {
  const stems = await stemPositions(page);
  const front = stems.drums;

  // Put the piano star exactly behind the drums star, on the line the controller points along.
  const length = distance(front, CONTROLLER_AT);
  const direction = front.map((value, index) => (value - CONTROLLER_AT[index]) / length);
  const behind = CONTROLLER_AT.map((value, index) => value + direction[index] * (length + 2.6));
  await place(page, 'piano', behind);
  await page.waitForTimeout(400);
  const pianoBefore = (await stemPositions(page)).piano;

  await aimControllers(page, CONTROLLER_AT, front);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(400);

  // Swing the controller sideways: the held star follows, the one behind stays put.
  await aimControllers(page, CONTROLLER_AT, [-1.5, 2.4, -3.5]);
  await page.waitForTimeout(800);

  const after = await stemPositions(page);
  expect(distance(after.drums, front)).toBeGreaterThan(1);
  expect(distance(after.piano, pianoBefore)).toBeLessThan(0.1);
});

test('a controller holding one star does not pick up a second one', async ({ page }) => {
  const stems = await stemPositions(page);
  await aimControllers(page, CONTROLLER_AT, stems.drums);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(400);

  // Sweep across the other stars while still holding the first. (Stars get pushed out of the
  // way, which is fine; what matters is that no second star is picked up.)
  for (const target of [stems.bass, stems.piano, stems.lead_vocal]) {
    await aimControllers(page, CONTROLLER_AT, target);
    await page.waitForTimeout(400);
  }
  const holds = (await page.evaluate(() => window.__starMixTest.getControllerHolds())).filter(Boolean);
  expect(holds).toEqual(['drums']);
});
