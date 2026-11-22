// The front door: canvas setup, the fixed-step loop, screen flow, and
// the deterministic shot mode the screenshots are taken from.
//
// Shot mode: ?shot=cover|title|alarm|win stages one fixed state and
// renders exactly one frame, then stops. A screenshot tool can capture it
// without racing the animation.

import { W, H } from './config.js';
import { createWorld, update } from './world.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import { resumeAudio, sfxClick } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || '1');

const world = createWorld();
const input = createInput(canvas);

// A first click or keypress unlocks audio (browsers gate AudioContext
// behind a gesture); it also starts the game from the title screen.
window.addEventListener('keydown', resumeAudio, { once: false });
window.addEventListener('mousedown', resumeAudio, { once: false });

if (shot) {
  // Deterministic single frame. The seed only decorates: nothing in the
  // staged state reads it, so the same shot always renders the same.
  void seed;
  stageShot(world, shot);
  draw(ctx, world, 0);
} else {
  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // a tab that slept does not fast-forward
    acc += dt;
    while (acc >= STEP) {
      update(world, input, STEP);
      acc -= STEP;
    }
    input.endFrame();
    draw(ctx, world, now / 1000);
  }
  requestAnimationFrame(frame);
}

// Clicking the canvas on the title screen starts the game too.
canvas.addEventListener('mousedown', () => {
  sfxClick();
});
