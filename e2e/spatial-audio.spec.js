import { test, expect } from '@playwright/test';
import { enterSpaceInHeadset, installQuestEmulator, setButton, aimControllers, stemPositions, distance } from './xr.js';

// Spatial sound follows the listener's head: turn your head and the sound must stay where its
// star is, so it moves around you. It also has to do so while no star is held.
const audio = (page) => page.evaluate(() => window.__starMixAudio());

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await enterSpaceInHeadset(page);
  await page.waitForFunction(() => window.__starMixAudio?.(), undefined, { polling: 100 });
});

test('the listener faces where the head faces, with nothing held', async ({ page }) => {
  const before = await audio(page);
  // Looking straight ahead: the listener faces -z.
  expect(before.forward[2]).toBeLessThan(-0.9);

  // Turn the head a quarter turn to the left: the listener must now face -x.
  await page.evaluate(() => window.__xrDevice.quaternion.set(0, Math.SQRT1_2, 0, Math.SQRT1_2));
  await expect.poll(async () => (await audio(page)).forward[0], { timeout: 10_000 }).toBeLessThan(-0.9);

  const turned = await audio(page);
  expect(Math.abs(turned.forward[2])).toBeLessThan(0.2);
  // Positions of the sounds do not move when the head turns; they stay with their stars.
  const stems = await stemPositions(page);
  Object.entries(turned.panners).forEach(([key, position]) => {
    expect(distance(position, stems[key])).toBeLessThan(0.05);
  });
});

test('the sounds sit on their stars whether or not one is held', async ({ page }) => {
  const rest = await audio(page);
  const stems = await stemPositions(page);
  Object.entries(rest.panners).forEach(([key, position]) => expect(distance(position, stems[key])).toBeLessThan(0.05));

  await aimControllers(page, [0.4, 1.5, 0], stems.drums);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await aimControllers(page, [0.4, 1.5, 0], [1.0, 2.2, -4.5]);
  await page.waitForTimeout(800);

  const held = await audio(page);
  const moved = await stemPositions(page);
  expect(distance(held.panners.drums, moved.drums)).toBeLessThan(0.05);
  expect(distance(moved.drums, stems.drums)).toBeGreaterThan(0.5);
});
