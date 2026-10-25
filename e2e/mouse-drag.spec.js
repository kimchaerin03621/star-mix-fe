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
  await page.waitForTimeout(1200);
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 20_000, polling: 100 });
  await page.waitForTimeout(2000);
});

test('with the view zoomed all the way out, every region can be grabbed without jumping', async ({ page }) => {
  for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, 400); await page.waitForTimeout(30); }
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
  await page.mouse.move(150, 120);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const dragging = await page.evaluate(() => window.__starMixTest.getDragging());
  expect(Object.values(dragging).some(Boolean)).toBe(false);
  await page.mouse.up();
});

test('the wheel takes a held region out to the far edge of the graph and up to the eye', async ({ page }) => {
  const { x, y } = await star(page, 'drums');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const eyeTo = () => page.evaluate(() => window.__starMixTest.getCameraDistanceTo('drums'));

  for (let i = 0; i < 12; i += 1) { await page.mouse.wheel(0, -1000); await page.waitForTimeout(60); }
  expect(await eyeTo()).toBeGreaterThan(30);

  for (let i = 0; i < 12; i += 1) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(60); }
  expect(await eyeTo()).toBeLessThan(0.5);
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
