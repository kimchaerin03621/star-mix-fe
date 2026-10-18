import fs from 'node:fs';
import { test } from '@playwright/test';
import { startTabRecording, stopTabRecording } from '../e2e/recording.js';
import { ease, lerp, makeHand } from './hands.js';

// A scripted run of the exhibition, filmed with sound. The hands are generated
// data (not the webcam), shaped like real tracker output, so every reaction on
// screen is the app's own: palm cursors, the rock-sign ring, hover, grab, depth.

const FRAME_MS = 33;
const OUTPUT = 'recordings/demo.webm';
const TIMELINE = 'recordings/demo-timeline.txt';

// Same camera the spatial scene opens with (see src/audio/stemLayout.js).
const CAMERA = { x: 0, y: 1.6, z: 2, fovDegrees: 75 };

const timeline = [];
let startedAt = 0;
const mark = (label) => {
  const line = `${((Date.now() - startedAt) / 1000).toFixed(1).padStart(5)}s  ${label}`;
  timeline.push(line);
  console.log(line);
};

const show = (page, hands) => page.evaluate((list) => {
  const now = performance.now();
  window.__starMixDemo.setHands(list.map((hand) => ({ ...hand, timestamp: now })));
}, hands);

// Calls `frame(progress)` about 30 times a second and shows the hands it returns.
async function animate(page, durationMs, frame) {
  const started = Date.now();
  for (;;) {
    const progress = Math.min(1, (Date.now() - started) / durationMs);
    await show(page, frame(progress));
    if (progress >= 1) return;
    await page.waitForTimeout(FRAME_MS);
  }
}

const hold = (page, durationMs, hands) => animate(page, durationMs, () => hands);
const glide = (from, to, progress) => ({
  x: lerp(from.x, to.x, ease(progress)),
  y: lerp(from.y, to.y, ease(progress)),
});

function screenPointOf([x, y, z], aspect) {
  const halfHeight = Math.tan((CAMERA.fovDegrees / 2) * (Math.PI / 180));
  const depth = CAMERA.z - z;
  return {
    x: 0.5 + (x - CAMERA.x) / (depth * halfHeight * aspect) / 2,
    y: 0.5 - (y - CAMERA.y) / (depth * halfHeight) / 2,
  };
}

// Holding the rock sign for a bit more than a second fires the unmix / return.
async function rockSign(page, at, id = 1) {
  await animate(page, 700, (p) => [makeHand({ id, ...glide({ x: at.x, y: at.y + 0.12 }, at, p), pose: 'openPalm' })]);
  await hold(page, 1500, [makeHand({ id, ...at, pose: 'rock' })]);
  await show(page, []);
}

test('record the exhibition demo with sound', async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());
  // The app asks for the webcam; answer with a blank canvas stream so no real
  // camera turns on (the hands in this demo are scripted anyway).
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
  await page.waitForFunction(() => window.__starMixDemo);
  await show(page, []);

  const tracks = await startTabRecording(page);
  startedAt = Date.now();
  mark(`recording started (video ${tracks.videoTracks}, audio ${tracks.audioTracks})`);

  // --- Intro ---------------------------------------------------------------
  await page.waitForTimeout(2800);
  mark('click through the intro');
  await page.locator('.minimal-intro-arrow').click();
  // The click leaves the mouse "inside" the page, which the galaxy draws as a stray glow.
  await page.evaluate(() => window.dispatchEvent(new Event('mouseleave')));
  await page.getByText('1초 유지 — 소리가 풀려요').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1800);

  // --- Galaxy: stir the stars with open palms ---------------------------------
  mark('galaxy: one palm sweeps across');
  const right = { id: 1, handedness: 'Right', pose: 'openPalm', scale: 0.75 };
  await animate(page, 1800, (p) => [makeHand({ ...right, ...glide({ x: 0.2, y: 0.4 }, { x: 0.82, y: 0.55 }, p) })]);
  await animate(page, 1800, (p) => [makeHand({ ...right, ...glide({ x: 0.82, y: 0.55 }, { x: 0.22, y: 0.35 }, p) })]);

  mark('galaxy: a second palm joins, the halves mix');
  const left = { id: 2, handedness: 'Left', pose: 'openPalm', scale: 0.75 };
  await animate(page, 2600, (p) => [
    makeHand({ ...right, ...glide({ x: 0.22, y: 0.35 }, { x: 0.75, y: 0.65 }, p) }),
    makeHand({ ...left, ...glide({ x: 0.9, y: 0.35 }, { x: 0.3, y: 0.6 }, p) }),
  ]);
  await animate(page, 2200, (p) => [
    makeHand({ ...right, ...glide({ x: 0.75, y: 0.65 }, { x: 0.35, y: 0.4 }, p) }),
    makeHand({ ...left, ...glide({ x: 0.3, y: 0.6 }, { x: 0.7, y: 0.45 }, p) }),
  ]);
  await show(page, []);
  await page.waitForTimeout(2200);

  // --- Rock sign: the galaxy unmixes into its instruments ----------------------
  mark('rock sign: hold to unmix');
  await rockSign(page, { x: 0.5, y: 0.5 });
  mark('stars gather and split into instrument clusters');
  await page.waitForFunction(() => window.__starMixTest, undefined, { timeout: 20_000 });
  await page.waitForTimeout(3500);
  mark('spatial scene');

  // --- Spatial scene: hover, grab, move, depth, orbit --------------------------
  const positions = await page.evaluate(() => window.__starMixTest.getStemPositions());
  const aspect = await page.evaluate(() => window.innerWidth / window.innerHeight);
  const drums = screenPointOf(positions.drums, aspect);
  const grabber = { id: 3, handedness: 'Right' };

  mark('palm hovers over the drums star');
  await animate(page, 1300, (p) => [makeHand({ ...grabber, ...glide({ x: 0.62, y: 0.8 }, drums, p), pose: 'openPalm' })]);
  await hold(page, 1200, [makeHand({ ...grabber, ...drums, pose: 'openPalm' })]);

  mark('fist grabs it and carries it');
  await hold(page, 500, [makeHand({ ...grabber, ...drums, pose: 'fist' })]);
  const carried = { x: 0.5, y: 0.32 };
  await animate(page, 2400, (p) => [makeHand({ ...grabber, ...glide(drums, carried, p), pose: 'fist' })]);
  await hold(page, 800, [makeHand({ ...grabber, ...carried, pose: 'fist' })]);

  const helper = { id: 4, handedness: 'Left' };
  mark('other hand, index finger: push the star away');
  await hold(page, 2300, [
    makeHand({ ...grabber, ...carried, pose: 'fist' }),
    makeHand({ ...helper, x: 0.2, y: 0.72, pose: 'indexOnly' }),
  ]);
  mark('other hand, thumb: pull the star close');
  await hold(page, 2300, [
    makeHand({ ...grabber, ...carried, pose: 'fist' }),
    makeHand({ ...helper, x: 0.2, y: 0.72, pose: 'thumbOnly' }),
  ]);

  mark('open the hand to let go');
  await hold(page, 900, [makeHand({ ...grabber, ...carried, pose: 'openPalm' })]);
  await show(page, []);
  await page.waitForTimeout(1200);

  mark('three fingers: orbit the camera');
  const orbit = { id: 5, handedness: 'Right', pose: 'cameraMove' };
  await hold(page, 500, [makeHand({ ...orbit, x: 0.5, y: 0.55 })]);
  await animate(page, 2600, (p) => [makeHand({ ...orbit, ...glide({ x: 0.5, y: 0.55 }, { x: 0.6, y: 0.55 }, p) })]);
  await animate(page, 2200, (p) => [makeHand({ ...orbit, ...glide({ x: 0.6, y: 0.55 }, { x: 0.47, y: 0.55 }, p) })]);
  await show(page, []);
  await page.waitForTimeout(2200);

  // --- Rock sign again: back to the galaxy ----------------------------------
  mark('rock sign: hold to go back');
  await rockSign(page, { x: 0.5, y: 0.5 }, 6);
  await page.waitForTimeout(4200);
  mark('back in the galaxy');
  await page.waitForTimeout(1500);

  const saved = await stopTabRecording(page, OUTPUT);
  fs.writeFileSync(TIMELINE, `${timeline.join('\n')}\n`);
  console.log(`SAVED ${OUTPUT} ${(saved.bytes / 1e6).toFixed(1)} MB`, JSON.stringify(saved.audio));
});
