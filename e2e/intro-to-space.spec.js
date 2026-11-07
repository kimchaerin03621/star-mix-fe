import { test, expect } from '@playwright/test';
import { installQuestEmulator } from './xr.js';

// There is no 2D galaxy: the intro's arrow opens the 3D space directly.
test('the intro arrow goes straight to the spatial scene', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await installQuestEmulator(page);
  await page.goto('/?demo&still');
  await expect(page.locator('.minimal-intro-arrow')).toBeVisible();
  // Only the 3D canvas exists: the 2D galaxy is not mounted.
  await expect(page.locator('canvas')).toHaveCount(1);

  await page.locator('.minimal-intro-arrow').click();

  await page.waitForFunction(() => Object.keys(window.__starMixTest?.getStemPositions() ?? {}).length === 4, undefined, { timeout: 20_000 });
  await expect(page.locator('.minimal-intro-overlay')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the hint in the space no longer mentions the galaxy or the rock sign', async ({ page }) => {
  await installQuestEmulator(page);
  await page.goto('/');
  await page.locator('.minimal-intro-arrow').click();
  await expect(page.getByText('주먹을 쥐어 별을 잡고 옮겨 보세요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/은하|1초 유지/)).toHaveCount(0);
});
