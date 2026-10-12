import * as THREE from 'three';

const SIZE = 256;
const INK = '#120b1c';
const textureCache = {};

const microphone = (ctx) => {
  ctx.beginPath();
  ctx.roundRect(96, 28, 64, 112, 32);
  ctx.stroke();
  [64, 84, 104].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(96, y);
    ctx.lineTo(160, y);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.arc(128, 112, 54, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 166);
  ctx.lineTo(128, 220);
  ctx.moveTo(92, 224);
  ctx.lineTo(164, 224);
  ctx.stroke();
};

const snareDrum = (ctx) => {
  ctx.beginPath();
  ctx.ellipse(128, 120, 78, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50, 120);
  ctx.lineTo(50, 188);
  ctx.ellipse(128, 188, 78, 26, 0, Math.PI, 0, true);
  ctx.lineTo(206, 120);
  ctx.stroke();
  ctx.beginPath();
  [-39, 0, 39].forEach((offset) => {
    ctx.moveTo(128 + offset, 144);
    ctx.lineTo(128 + offset * 0.9, 210);
  });
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(70, 26);
  ctx.lineTo(132, 96);
  ctx.moveTo(186, 26);
  ctx.lineTo(124, 96);
  ctx.stroke();
};

const guitar = (ctx, { longNeck }) => {
  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(Math.PI / 5);
  ctx.translate(-128, -128);

  const neckTop = longNeck ? -6 : 22;
  ctx.beginPath();
  ctx.moveTo(118, neckTop + 28);
  ctx.lineTo(118, 138);
  ctx.moveTo(138, neckTop + 28);
  ctx.lineTo(138, 138);
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(112, neckTop, 32, 30, 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(118, 138);
  ctx.bezierCurveTo(80, 128, 64, 160, 84, 184);
  ctx.bezierCurveTo(58, 204, 78, 246, 128, 246);
  ctx.bezierCurveTo(178, 246, 198, 204, 172, 184);
  ctx.bezierCurveTo(192, 160, 176, 128, 138, 138);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(128, neckTop + 30);
  ctx.lineTo(128, 212);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(110, 200, 36, 12, 5);
  ctx.stroke();
  ctx.restore();
};

const piano = (ctx) => {
  const left = 22;
  const right = 234;
  const top = 70;
  const bottom = 186;
  const keyWidth = (right - left) / 7;

  ctx.beginPath();
  ctx.roundRect(left, top, right - left, bottom - top, 12);
  ctx.stroke();

  ctx.beginPath();
  for (let i = 1; i < 7; i += 1) {
    ctx.moveTo(left + keyWidth * i, top);
    ctx.lineTo(left + keyWidth * i, bottom);
  }
  ctx.stroke();

  [1, 2, 4, 5, 6].forEach((i) => {
    const x = left + keyWidth * i;
    ctx.beginPath();
    ctx.roundRect(x - 9, top, 18, 74, 4);
    ctx.fill();
  });
};

const DRAWERS = {
  vocal: (ctx) => microphone(ctx),
  drum: (ctx) => snareDrum(ctx),
  bass: (ctx) => guitar(ctx, { longNeck: true }),
  guitar: (ctx) => guitar(ctx, { longNeck: false }),
  piano: (ctx) => piano(ctx),
};

// Dark line-art silhouette of an instrument, meant to sit on top of the star's
// glowing core so it reads as a cut-out of light.
export function getInstrumentTexture(instrument) {
  if (typeof document === 'undefined') return null;
  const draw = DRAWERS[instrument];
  if (!draw) return null;
  if (textureCache[instrument]) return textureCache[instrument];

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  textureCache[instrument] = texture;
  return texture;
}
