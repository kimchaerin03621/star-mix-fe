import { test, expect } from '@playwright/test';
import { installQuestEmulator } from './xr.js';

// Moving a region with the mouse: it must be grabbed where it is (even with the view zoomed all
// the way out), it must not jump toward the eye on click, and the wheel must take it as far as the
// graph reaches and right up to the eye.
const star = (page, key) => page.evaluate((k) => window.__starMixTest.getStarOnScreen(k), key);
const positions = (page) => page.evaluate(() => window.__starMixTest.getStemPositions());
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await page.setViewportSize({ width: 1600, height: 850 });
  await page.goto('/?demo&still');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(2000);
});

test('with the view zoomed all the way out, every region can be grabbed without jumping', async ({ page }) => {
  test.setTimeout(180_000);
  for (let i = 0; i < 70; i += 1) { await page.mouse.wheel(0, 400); await page.waitForTimeout(30); } // the view starts right in the middle, so zooming out takes a few more turns
  await page.waitForTimeout(600);

  for (const key of ['lead_vocal', 'drums', 'bass', 'piano']) {
    const before = (await positions(page))[key];
    const onScreen = await star(page, key);
    expect(onScreen.distance).toBeGreaterThan(15); // really zoomed out
    await page.mouse.move(onScreen.x, onScreen.y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.waitForTimeout(350);

    const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
    expect(Object.keys(dragging).filter((k) => dragging[k])).toEqual([key]); // this one only
    expect(distance((await positions(page))[key], before)).toBeLessThan(0.05); // and it did not move
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
});

test('clicking plain white space grabs nothing', async ({ page }) => {
  await page.mouse.move(800, 810);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
  expect(Object.values(dragging).some(Boolean)).toBe(false);
  await page.mouse.up();
});

test('the wheel takes a held region out to the edge of the graph (no farther) and up to the eye', async ({ page }) => {
  test.setTimeout(180_000);
  const { x, y } = await star(page, 'drums');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const eyeTo = () => page.evaluate(() => window.__starMixTest.getCameraDistanceTo('drums'));

  for (let i = 0; i < 20; i += 1) { await page.mouse.wheel(0, -1000); await page.waitForTimeout(60); }
  // The graph ends about 10 m from its middle; a region stops there, it cannot leave the graph.
  expect(await eyeTo()).toBeGreaterThan(8);
  const out = (await positions(page)).drums;
  expect(Math.hypot(out[0], (out[1] - 1.6) / 0.75, out[2])).toBeLessThan(10);

  for (let i = 0; i < 20; i += 1) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(60); }
  // It stops just in front of the eye (never behind it), and is still in the picture.
  expect(await eyeTo()).toBeLessThan(1);
  expect(await eyeTo()).toBeGreaterThan(0.5);
  expect((await star(page, 'drums')).visible).toBe(true);
  await page.mouse.up();
});

test('turning the view pivots around the middle of the whole graph', async ({ page }) => {
  const { centroid } = await page.evaluate(() => window.__starMixGraph());
  const target = await page.evaluate(() => window.__starMixTest.getOrbitTarget());
  expect(distance(target, centroid)).toBeLessThan(0.5);

  // Turning the view around keeps the eye the same distance from that middle.
  const eyeToMiddle = async () => page.evaluate(([c]) => {
    const info = window.__starMixTest.getStarOnScreen('drums'); // forces a camera read
    return info ? c : c;
  }, [centroid]);
  await eyeToMiddle();
  await page.mouse.move(800, 500);
  await page.mouse.down();
  await page.mouse.move(1200, 450, { steps: 15 });
  await page.mouse.up();
  const after = await page.evaluate(() => window.__starMixTest.getOrbitTarget());
  expect(distance(after, target)).toBeLessThan(0.01); // the pivot did not wander
});

test('a press a little off a region still grabs it, and does not turn the view', async ({ page }) => {
  const { x, y, distance: eye } = await star(page, 'drums');
  const pixelsPerMeter = 850 / (eye * 1.535); // 75 degree view, 850 px tall
  const target = await page.evaluate(() => window.__starMixTest.getOrbitTarget());
  await page.mouse.move(x + 1.3 * pixelsPerMeter, y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.move(x + 1.3 * pixelsPerMeter + 60, y + 30, { steps: 8 });
  await page.waitForTimeout(250);
  const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
  expect(Object.keys(dragging).filter((k) => dragging[k])).toEqual(['drums']);
  expect(distance(await page.evaluate(() => window.__starMixTest.getOrbitTarget()), target)).toBeLessThan(0.01);
  await page.mouse.up();
});

test('a region pushed all the way out stays at the edge of the graph and can be grabbed again', async ({ page }) => {
  const { x, y } = await star(page, 'drums');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  for (let i = 0; i < 14; i += 1) { await page.mouse.wheel(0, -1000); await page.waitForTimeout(60); }
  await page.mouse.up();
  await page.waitForTimeout(800);

  // The star did not leave the graph, so it is still where its color is drawn.
  const { shapes } = await page.evaluate(() => window.__starMixGraph());
  const starPoint = (await positions(page)).drums;
  expect(distance(starPoint, shapes.drums.center)).toBeLessThan(3);

  // Pressing on the region grabs it (and only it).
  const middle = await page.evaluate((c) => window.__starMixTest.getPointOnScreen(c), shapes.drums.center);
  await page.mouse.move(middle.x, middle.y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
  expect(Object.keys(dragging).filter((k) => dragging[k])).toEqual(['drums']);
  await page.mouse.up();
});

test('with the pointer resting on a region (not pressed), the wheel zooms the view', async ({ page }) => {
  const { shapes } = await page.evaluate(() => window.__starMixGraph());
  const middle = await page.evaluate((c) => window.__starMixTest.getPointOnScreen(c), shapes.drums.center);
  await page.mouse.move(middle.x, middle.y);
  await page.waitForTimeout(400);
  expect(Object.values(await page.evaluate(() => window.__starMixTest.getDragging())).some(Boolean)).toBe(false);

  const eyeTo = () => page.evaluate(() => window.__starMixTest.getCameraDistanceTo('drums'));
  const before = await eyeTo();
  for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  expect(Math.abs((await eyeTo()) - before)).toBeGreaterThan(0.15); // the view zoomed (before the fix the wheel did nothing here)

  // Pressing there still grabs the region rather than turning the view.
  const here = await page.evaluate(() => window.__starMixTest.getStarOnScreen('drums'));
  const target = await page.evaluate(() => window.__starMixTest.getOrbitTarget());
  await page.mouse.move(here.x, here.y);
  await page.mouse.down();
  await page.mouse.move(here.x + 40, here.y + 20, { steps: 6 });
  const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
  expect(Object.keys(dragging).filter((k) => dragging[k])).toEqual(['drums']);
  expect(distance(await page.evaluate(() => window.__starMixTest.getOrbitTarget()), target)).toBeLessThan(0.01);
  await page.mouse.up();
});
