import { test, expect } from '@playwright/test';
import {
  aimControllers,
  distance,
  enterSpaceInHeadset,
  installQuestEmulator,
  setButton,
  stemPositions,
} from './xr.js';

// The space is one huge white graph; each instrument colors a region of it around its
// sounding node. The graph stays put; only the colored regions move.
const CONTROLLER_AT = [0.4, 1.5, 0];
const AIM_ELSEWHERE = [1.0, 2.2, -4.5];
const EMPTY_SPACE = [0, 4.5, -4]; // nowhere near any instrument

const graph = (page) => page.evaluate(() => window.__starMixGraph());

test.beforeEach(async ({ page }) => {
  await installQuestEmulator(page);
  await enterSpaceInHeadset(page);
  await page.waitForFunction(() => window.__starMixGraph?.().regions.length === 4, undefined, { timeout: 20_000, polling: 100 });
});

test('the space is a big graph with one colored region per instrument', async ({ page }) => {
  const info = await graph(page);
  expect(info.nodeCount).toBeGreaterThan(3000);
  expect(info.linkCount).toBeGreaterThan(info.nodeCount);
  expect(info.regions).toHaveLength(4);
  info.regions.forEach((region) => expect(region.nodes).toBeGreaterThanOrEqual(12));
});

test('regions never share a node, and each sits at its instrument', async ({ page }) => {
  const info = await graph(page);
  // A node can have one region only, so the regions' sizes add up to every colored node.
  expect(info.regions.reduce((sum, region) => sum + region.nodes, 0)).toBe(info.coloredNodes);
  expect(new Set(info.regions.map((region) => region.seedNode)).size).toBe(4);

  const stems = await stemPositions(page);
  const byKey = { lead_vocal: 'lead_vocal', drums: 'drums', bass: 'bass', piano: 'piano' };
  info.regions.forEach((region) => {
    expect(distance(region.seedPosition, stems[byKey[region.key]])).toBeLessThan(0.8);
  });
});

test('holding a region and moving it carries the color to other nodes; the graph stays', async ({ page }) => {
  const before = await graph(page);
  const drumsBefore = before.regions.find((region) => region.key === 'drums');

  await aimControllers(page, CONTROLLER_AT, stems(await stemPositions(page)).drums);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await aimControllers(page, CONTROLLER_AT, AIM_ELSEWHERE);

  await expect.poll(async () => {
    const info = await graph(page);
    return info.regions.find((region) => region.key === 'drums').seedNode;
  }, { timeout: 10_000 }).not.toBe(drumsBefore.seedNode);

  const after = await graph(page);
  expect(after.nodeCount).toBe(before.nodeCount); // the graph itself did not change
  expect(after.regions.reduce((sum, region) => sum + region.nodes, 0)).toBe(after.coloredNodes);
  expect(new Set(after.regions.map((region) => region.seedNode)).size).toBe(4);
});

test('only a colored region can be picked: pointing at plain white space grabs nothing', async ({ page }) => {
  const before = await stemPositions(page);
  await aimControllers(page, CONTROLLER_AT, EMPTY_SPACE);
  await setButton(page, 'right', 'trigger', 1);
  await page.waitForTimeout(300);
  await aimControllers(page, CONTROLLER_AT, [-2, 3.5, -3]);
  await page.waitForTimeout(500);
  const after = await stemPositions(page);
  Object.keys(before).forEach((key) => expect(distance(after[key], before[key])).toBeLessThan(0.05));
});

function stems(positions) {
  return positions;
}
