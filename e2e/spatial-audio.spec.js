import { test, expect } from '@playwright/test';
import { enterSpaceInHeadset, installQuestEmulator, setButton, aimControllers, stemPositions } from './xr.js';

// Spatial sound follows the listener's head: turn your head and the sound must stay where its
// star is, so it moves around you. It also has to do so while no star is held. The angles are
// widened on purpose (so moving a star is easier to hear), and distance changes level and brightness.
const audio = (page) => page.evaluate(() => window.__starMixAudio());

const AZIMUTH_STRETCH = 1.4;

// Sideways angle (degrees, right is positive) of a point as seen from the listener, for a level head.
function azimuthDeg(point, listener) {
  const [fx, , fz] = listener.forward;
  const size = Math.hypot(fx, fz);
  const forward = [fx / size, fz / size];
  const right = [-forward[1], forward[0]];
  const dx = point[0] - listener.position[0];
  const dz = point[2] - listener.position[2];
  return (Math.atan2(dx * right[0] + dz * right[1], dx * forward[0] + dz * forward[1]) * 180) / Math.PI;
}
const distanceFrom = (point, listener) => Math.hypot(point[0] - listener.position[0], point[1] - listener.position[1], point[2] - listener.position[2]);

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await enterSpaceInHeadset(page);
  await page.waitForFunction(() => window.__starMixAudio?.(), undefined, { polling: 100 });
});

function expectSoundsPlacedLikeTheStars(listener, panners, stems) {
  Object.entries(panners).forEach(([key, placed]) => {
    // Same distance as the star...
    expect(distanceFrom(placed, listener)).toBeCloseTo(distanceFrom(stems[key], listener), 1);
    // ...and a wider angle to the side.
    const starAngle = azimuthDeg(stems[key], listener);
    const expected = Math.max(-176, Math.min(176, starAngle * AZIMUTH_STRETCH));
    expect(azimuthDeg(placed, listener)).toBeCloseTo(expected, 0);
  });
}

test('the listener faces where the head faces, and the sounds keep their stars when the head turns', async ({ page }) => {
  const before = await audio(page);
  // Looking straight ahead: the listener faces -z.
  expect(before.forward[2]).toBeLessThan(-0.9);

  // Turn the head a quarter turn to the left: the listener must now face -x.
  await page.evaluate(() => window.__xrDevice.quaternion.set(0, Math.SQRT1_2, 0, Math.SQRT1_2));
  await expect.poll(async () => (await audio(page)).forward[0], { timeout: 10_000 }).toBeLessThan(-0.9);

  const turned = await audio(page);
  expect(Math.abs(turned.forward[2])).toBeLessThan(0.2);
  // Each sound is still placed by where its star is, as seen from the head as it is now.
  expectSoundsPlacedLikeTheStars(turned, turned.panners, await stemPositions(page));
});

test('the sounds follow their stars whether or not one is held, with wider angles', async ({ page }) => {
  const rest = await audio(page);
  const stems = await stemPositions(page);
  expectSoundsPlacedLikeTheStars(rest, rest.panners, stems);

  await aimControllers(page, [0.4, 1.5, 0], stems.drums);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await aimControllers(page, [0.4, 1.5, 0], [1.0, 2.2, -4.5]);
  await page.waitForTimeout(800);

  const held = await audio(page);
  const moved = await stemPositions(page);
  expect(Math.hypot(...moved.drums.map((v, i) => v - stems.drums[i]))).toBeGreaterThan(0.5);
  expectSoundsPlacedLikeTheStars(held, held.panners, moved);
});

test('a star that moves away gets quieter and duller, and one that comes close gets louder', async ({ page }) => {
  const start = (await audio(page)).distance;
  // At its starting distance a sound is unchanged: full level, wide open.
  Object.values(start).forEach(({ gain, cutoff }) => {
    expect(gain).toBeGreaterThan(0.85);
    expect(gain).toBeLessThan(1.15);
    expect(cutoff).toBeGreaterThan(15000);
  });

  await page.evaluate(() => window.__starMixTest.setStemPosition('drums', [0, 1.6, -7.5]));
  await page.evaluate(() => window.__starMixTest.setStemPosition('bass', [0, 1.6, -1.5]));
  await expect.poll(async () => (await audio(page)).distance.drums.gain, { timeout: 8000 }).toBeLessThan(0.6);
  const changed = (await audio(page)).distance;
  expect(changed.drums.cutoff).toBeLessThan(11000); // duller far away
  expect(changed.bass.gain).toBeGreaterThan(1.7); // louder up close
  expect(changed.bass.cutoff).toBeGreaterThan(15000); // and still bright
});
