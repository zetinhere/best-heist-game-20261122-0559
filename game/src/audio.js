// Procedural sound, WebAudio only: no audio files, no network. Every
// sound is a short oscillator blip, created lazily on the first user
// gesture (a page that has heard no gesture has no AudioContext yet).

let ctx = null;
let muted = false;

function ac() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

export function resumeAudio() {
  const a = ac();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

function tone(freq, dur, type, gain, when = 0) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

export function sfxPickup() {
  tone(880, 0.12, 'sine', 0.12);
  tone(1318, 0.14, 'sine', 0.1, 0.07);
}

export function sfxVault() {
  tone(523, 0.15, 'triangle', 0.12);
  tone(659, 0.15, 'triangle', 0.12, 0.1);
  tone(784, 0.25, 'triangle', 0.12, 0.2);
}

export function sfxCoin() {
  tone(1567, 0.08, 'square', 0.05);
}

export function sfxEmp() {
  tone(220, 0.3, 'sawtooth', 0.07);
  tone(110, 0.35, 'sawtooth', 0.06, 0.05);
}

export function sfxSpotted() {
  tone(196, 0.18, 'square', 0.09);
  tone(147, 0.22, 'square', 0.09, 0.12);
}

export function sfxCaught() {
  tone(110, 0.5, 'sawtooth', 0.12);
  tone(82, 0.6, 'sawtooth', 0.12, 0.15);
}

export function sfxWin() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.12));
}

export function sfxClick() {
  tone(1200, 0.05, 'sine', 0.06);
}

export function setMuted(m) {
  muted = m;
}
