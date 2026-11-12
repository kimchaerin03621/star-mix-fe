import fs from 'node:fs';
import { test } from '@playwright/test';
import { startTabRecording, stopTabRecording } from '../e2e/recording.js';

// A 30-second film of the real site (the ?demo page), driven with the mouse and filmed with its sound.
// Tab capture does not draw the mouse pointer, so on screen the sounds simply follow an invisible hand.
// Run:  npx playwright test -c playwright.demo.config.js demo/mouse-demo.spec.js

const SECONDS = 30;
const OUTPUT = 'recordings/demo-30s.webm';
const TIMELINE = 'recordings/demo-30s-timeline.txt';

const timeline = [];
let startedAt = 0;
const elapsed = () => (Date.now() - startedAt) / 1000;
const mark = (label) => {
  const line = `${elapsed().toFixed(1).padStart(5)}s  ${label}`;
  timeline.push(line);
  console.log(line);
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

// Moves the (invisible) pointer smoothly, so the picture shows a hand-like motion, not a jump.
async function glide(page, from, to, ms) {
  const began = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - began) / ms);
    await page.mouse.move(from.x + (to.x - from.x) * ease(t), from.y + (to.y - from.y) * ease(t));
    if (t >= 1) return;
    await page.waitForTimeout(12);
  }
}

// Turns the wheel in small, even steps (deltaY < 0 = away, > 0 = toward you).
async function wheel(page, deltaY, ticks, everyMs) {
  for (let i = 0; i < ticks; i += 1) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(everyMs);
  }
}

test('record a 30-second demo with the mouse', async ({ page }) => {
  test.setTimeout(240_000);
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());
  // The app asks for the webcam; answer with a blank stream so no real camera turns on.
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints?.video) return original(constraints);
      const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 480 });
      canvas.getContext('2d').fillRect(0, 0, 640, 480);
      return canvas.captureStream(15);
    };
  });
  await page.goto('/?demo');
  await page.locator('.minimal-intro-arrow').waitFor();
  await page.mouse.move(60, 60);

  // Load the scene first (the click, the loading and the build take a few seconds of black), with the fly-in
  // held at its start; the film then opens on the scene and the fly-in starts on cue.
  // No pointer in the picture: the sounds should look as if a hand moved them.
  await page.addStyleTag({ content: '*, *::before, *::after { cursor: none !important; }' });
  await page.evaluate(() => { window.__holdEntryFlight = true; });
  await page.locator('.minimal-intro-arrow').click();
  await page.keyboard.press('Escape'); // the first-visit tutorial is skipped: this film is the explanation
  await page.waitForFunction(() => window.__starMixTest?.getStarOnScreen, undefined, { timeout: 60_000 });
  await page.waitForTimeout(2500);

  const tracks = await startTabRecording(page);
  startedAt = Date.now();
  mark(`recording started (video ${tracks.videoTracks}, audio ${tracks.audioTracks})`);

  const size = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const at = (fx, fy) => ({ x: size.w * fx, y: size.h * fy });
  const starPoint = async (key) => {
    const star = await page.evaluate((k) => window.__starMixTest.getStarOnScreen(k), key);
    return { x: star.x, y: star.y };
  };

  // --- The way in: the view flies in from a diagonal --------------------------------------------------
  await page.waitForTimeout(900);
  mark('the view flies in from a diagonal');
  await page.evaluate(() => { window.__holdEntryFlight = false; });
  // Let the fly-in finish (about 4 s) without touching anything: a click or wheel would end it early.
  await page.waitForFunction(() => window.__tutorialProbe?.flightDone === true, undefined, { timeout: 30_000, polling: 100 });
  await page.waitForTimeout(300);

  // --- Look around: the regions wrap around the viewer ----------------------------------------------
  mark('look around');
  const top = at(0.5, 0.1);
  await page.mouse.move(top.x, top.y);
  await page.mouse.down();
  await glide(page, top, { x: top.x - size.w * 0.1, y: top.y }, 1300);
  await glide(page, { x: top.x - size.w * 0.1, y: top.y }, { x: top.x + size.w * 0.08, y: top.y }, 1500);
  await glide(page, { x: top.x + size.w * 0.08, y: top.y }, top, 900);
  await page.mouse.up();
  await page.waitForTimeout(300);

  // --- Grab the drums and carry them across ---------------------------------------------------------
  mark('hover the drums, then grab and carry them');
  const drums = await starPoint('drums');
  await glide(page, top, drums, 600);
  await page.waitForTimeout(600);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await glide(page, drums, at(0.4, 0.4), 2200);
  await page.waitForTimeout(300);

  // --- Push it far, pull it close: the sound follows --------------------------------------------------
  mark('send it far away');
  await wheel(page, -160, 12, 110);
  await page.waitForTimeout(600);
  mark('bring it close');
  await wheel(page, 160, 12, 110);
  await page.waitForTimeout(500);
  await page.mouse.up();
  await page.waitForTimeout(300);

  // --- The vocal, across the other way ----------------------------------------------------------------
  mark('grab the vocal and carry it to the other side');
  const vocal = await starPoint('lead_vocal');
  await glide(page, at(0.4, 0.4), vocal, 600);
  await page.waitForTimeout(400);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await glide(page, vocal, at(0.7, 0.45), 2100);
  await page.waitForTimeout(300);
  await page.mouse.up();

  // --- The piano: out and back ------------------------------------------------------------------------
  mark('the piano: away, then back');
  const piano = await starPoint('piano');
  await glide(page, at(0.7, 0.45), piano, 600);
  await page.waitForTimeout(400);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await wheel(page, -160, 8, 90);
  await glide(page, piano, at(0.3, 0.5), 900);
  await wheel(page, 160, 8, 90);
  await page.mouse.up();

  // --- A last look around, back to where it began, then rest on the scene ---------------------------------
  mark('a last look around');
  const last = at(0.5, 0.1);
  await glide(page, at(0.3, 0.5), last, 500);
  await page.mouse.down();
  const room = Math.max(1500, (SECONDS - elapsed() - 0.8) * 1000);
  await glide(page, last, { x: last.x + size.w * 0.07, y: last.y }, room * 0.5);
  await glide(page, { x: last.x + size.w * 0.07, y: last.y }, last, room * 0.5);
  await page.mouse.up();
  while (elapsed() < SECONDS) await page.waitForTimeout(100);
  mark('end');

  const saved = await stopTabRecording(page, OUTPUT);
  fs.writeFileSync(TIMELINE, `${timeline.join('\n')}\n`);
  console.log(`SAVED ${OUTPUT} ${(saved.bytes / 1e6).toFixed(1)} MB`, JSON.stringify({ ...saved.audio, rmsPerSecond: saved.audio?.rmsPerSecond?.slice(0, 40) }));
});
