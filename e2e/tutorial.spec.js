import { test, expect } from '@playwright/test';

// The first-visit tutorial: a translucent explanation per step, closed with the button; then the visitor
// tries it, and the next step comes once they succeed. Done here with the mouse (the hand path reads
// the same scene state, so a hand and a mouse count the same).
// The test machine draws only a frame or two a second, so a hold must last a few seconds to be seen.
const HOLD_FOR_FRAMES = 3500;
const star = (page, key) => page.evaluate((k) => window.__starMixTest.getStarOnScreen(k), key);

// Keeps the mouse moving a little so the visitor counts as "here" while we wait for the next window.
async function waitForIntro(page, text) {
  const intro = page.getByTestId('tutorial-intro');
  await expect(async () => {
    await page.mouse.move(40 + Math.random() * 20, 400 + Math.random() * 20);
    await expect(intro).toContainText(text, { timeout: 1000 });
  }).toPass({ timeout: 60_000, intervals: [300] });
  return intro;
}

async function holdAndWheel(page, key, wheelY) {
  const where = await star(page, key);
  await page.mouse.move(where.x, where.y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  // Wheel only once the scene really holds it (on a slow machine the hold takes a moment to register).
  await page.waitForFunction(() => Object.values(window.__starMixTest.getDragging()).some(Boolean), undefined, { timeout: 15_000, polling: 100 });
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, wheelY);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(HOLD_FOR_FRAMES); // this machine draws only a few frames a second: let the scene catch up
  await page.mouse.up();
}

test('the tutorial walks through the moves one at a time and closes each window with the button', async ({ page }) => {
  test.setTimeout(420_000);
  // Notes every tutorial element that ever showed up (the short-lived ones are over by the time a slow check looks).
  await page.addInitScript(() => {
    window.__tutorialSeen = new Set();
    new MutationObserver(() => {
      document.querySelectorAll('[data-testid^="tutorial-"]').forEach((element) => window.__tutorialSeen.add(element.dataset.testid));
    }).observe(document, { childList: true, subtree: true });
  });
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());
  await page.setViewportSize({ width: 1600, height: 850 });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 30_000 });

  // 1. grab and carry
  const intro = await waitForIntro(page, '사운드 잡아 옮기기');
  await expect(intro).toContainText('1 / 5');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(intro).toBeHidden();
  await expect(page.getByTestId('tutorial-hint')).toContainText('주먹을 쥐어');
  const drums = await star(page, 'drums');
  await page.mouse.move(drums.x, drums.y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.move(drums.x - 250, drums.y - 80, { steps: 12 });
  await page.waitForTimeout(HOLD_FOR_FRAMES);
  await page.mouse.up();
  // (success shows for a moment while the hold is still going; the next explanation coming is the proof)

  // 2. send it far (the wheel up while holding)
  await waitForIntro(page, '사운드 멀리 보내기');
  await page.getByRole('button', { name: '확인' }).click();
  await holdAndWheel(page, 'drums', -400);
  // (success shows for a moment while the hold is still going; the next explanation coming is the proof)

  // 3. bring it close (the wheel down while holding)
  await waitForIntro(page, '사운드 가까이 당기기');
  await page.getByRole('button', { name: '확인' }).click();
  await holdAndWheel(page, 'drums', 400);
  // (success shows for a moment while the hold is still going; the next explanation coming is the proof)

  // 4. look around (drag on empty space)
  await waitForIntro(page, '둘러보기');
  await page.getByRole('button', { name: '확인' }).click();
  await page.mouse.move(800, 140);
  await page.mouse.down();
  await page.mouse.move(1150, 160, { steps: 20 });
  await page.waitForTimeout(HOLD_FOR_FRAMES);
  await page.mouse.up();
  // (success shows for a moment while the hold is still going; the next explanation coming is the proof)

  // 5. zoom (the wheel)
  await waitForIntro(page, '가까이 보기');
  await page.getByRole('button', { name: '확인' }).click();
  // The view eases toward the zoom over many frames, which this machine draws slowly: keep turning the wheel.
  await expect.poll(async () => {
    await page.mouse.wheel(0, 400);
    return page.evaluate(() => window.__tutorialSeen.has('tutorial-finale'));
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  expect(await page.evaluate(() => window.__tutorialSeen.has('tutorial-success'))).toBe(true);
});

test('the tutorial can be skipped, and Escape does the same', async ({ page }) => {
  test.setTimeout(150_000);
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());
  await page.setViewportSize({ width: 1600, height: 850 });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 30_000 });

  const intro = await waitForIntro(page, '사운드 잡아 옮기기');
  await page.keyboard.press('Escape');
  await expect(intro).toBeHidden();
  await page.mouse.move(700, 300);
  await page.waitForTimeout(4000);
  await expect(page.getByTestId('tutorial-intro')).toHaveCount(0);
  await expect(page.getByTestId('tutorial-hint')).toHaveCount(0);
});

test('no tutorial in still mode', async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());
  await page.goto('/?demo&still');
  await page.locator('.minimal-intro-arrow').click();
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 30_000 });
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.move(300 + i * 40, 300);
    await page.waitForTimeout(500);
  }
  await expect(page.getByTestId('tutorial-intro')).toHaveCount(0);
});
