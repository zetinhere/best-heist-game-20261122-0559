// The three rooms of the Meridian museum, as fixed tables. Every room fits
// inside one frame (960x600): the outer walls bound the play area, interior
// rects are display cases and vaults the thief must walk around.
//
// Conventions:
// - walls: {x, y, w, h} solid rects; the canvas edge is walled by the four
//   outer rects, so nothing ever leaves the room.
// - loot: {x, y, value, name, kind} — kind "painting", "gem" or "vault"
//   (a vault needs VAULT_HOLD seconds of E; the rest need LOOT_HOLD).
// - guards: {x, y, waypoints: [[x, y], ...]} — waypoints are [x, y] ARRAYS;
//   the Guard constructor normalises them to {x, y} objects (a guard whose
//   waypoints stay arrays computes NaN and vanishes from the room).
// - cameras: {x, y, base, sweep, period, phase} — base is the resting angle
//   in radians (0 = east, PI/2 = south), sweep the radians it swings each
//   side, period the seconds of one full swing.
// - shadows: {x, y, w, h} — detection 3x slower inside.
// - vents: {x, y, w, h} — the thief is unseen inside; guards never enter.
// - lasers: {x1, y1, x2, y2} — crossing one adds LASER_ALARM to the alarm.
// - exit: {x, y, w, h, label} — the door; its name is drawn ABOVE it.
// - start: {x, y} where the thief begins the room.

function outerWalls() {
  return [
    { x: 0, y: 48, w: 960, h: 16 }, // top, under the HUD
    { x: 0, y: 584, w: 960, h: 16 }, // bottom
    { x: 0, y: 48, w: 16, h: 552 }, // left
    { x: 944, y: 48, w: 16, h: 552 }, // right
  ];
}

export const LEVELS = [
  {
    name: "The Kings' Gallery",
    sub: 'Room 1 of 3 — lift the four paintings',
    walls: [
      ...outerWalls(),
      { x: 180, y: 150, w: 150, h: 26 },
      { x: 420, y: 150, w: 150, h: 26 },
      { x: 630, y: 150, w: 150, h: 26 },
      { x: 300, y: 330, w: 180, h: 26 },
      { x: 600, y: 420, w: 150, h: 26 },
      { x: 150, y: 430, w: 120, h: 26 },
    ],
    loot: [
      { x: 255, y: 205, value: 1200, name: 'Portrait of the Meridian King', kind: 'painting' },
      { x: 495, y: 205, value: 900, name: 'The Duchess in Blue', kind: 'painting' },
      { x: 705, y: 205, value: 1500, name: 'Sunset over the Old Canal', kind: 'painting' },
      { x: 390, y: 385, value: 800, name: 'Still Life with Silver', kind: 'painting' },
    ],
    guards: [
      { x: 120, y: 120, waypoints: [[120, 120], [840, 120], [840, 500], [120, 500]] },
      { x: 120, y: 300, waypoints: [[120, 300], [120, 500], [280, 500], [280, 300]] },
    ],
    cameras: [
      // Mounted 2px off the top wall (y=66, not 64): a camera sitting
      // exactly on the wall's edge counts as inside the wall, and its
      // line of sight would be blocked by the wall it hangs on.
      { x: 480, y: 66, base: Math.PI / 2, sweep: 0.55, period: 6, phase: 0 },
    ],
    shadows: [
      { x: 60, y: 300, w: 120, h: 90 },
      { x: 780, y: 380, w: 120, h: 90 },
    ],
    vents: [{ x: 880, y: 520, w: 48, h: 48 }],
    lasers: [],
    exit: { x: 928, y: 120, w: 16, h: 84, label: 'SERVICE DOOR' },
    start: { x: 80, y: 540 },
  },
  {
    name: 'The Vault Hall',
    sub: 'Room 2 of 3 — crack the Meridian Diamond',
    walls: [
      ...outerWalls(),
      { x: 380, y: 200, w: 200, h: 140 }, // the vault block itself
      { x: 150, y: 150, w: 140, h: 26 },
      { x: 670, y: 150, w: 140, h: 26 },
      { x: 150, y: 420, w: 140, h: 26 },
      { x: 670, y: 420, w: 140, h: 26 },
    ],
    loot: [
      { x: 480, y: 372, value: 8000, name: 'The Meridian Diamond', kind: 'vault' },
      { x: 220, y: 205, value: 1200, name: 'The General on Horseback', kind: 'painting' },
      { x: 740, y: 205, value: 1000, name: 'Winter at the Docks', kind: 'painting' },
      { x: 220, y: 475, value: 1400, name: 'The Clockmaker', kind: 'painting' },
    ],
    guards: [
      // G1's bottom patrol line runs at y=480, not y=500: the vent's top
      // edge is y=520, and a line at 500 would pass 20px above it —
      // inside catch range of a thief hugging the vent's top edge.
      { x: 120, y: 120, waypoints: [[120, 120], [840, 120], [840, 480], [120, 480]] },
      { x: 300, y: 420, waypoints: [[300, 420], [660, 420]] },
      { x: 320, y: 150, waypoints: [[320, 150], [320, 520]] },
    ],
    cameras: [
      { x: 480, y: 66, base: Math.PI / 2, sweep: 0.6, period: 5, phase: 0 },
      { x: 480, y: 582, base: -Math.PI / 2, sweep: 0.6, period: 7, phase: 2 },
    ],
    shadows: [
      { x: 60, y: 250, w: 110, h: 100 },
      { x: 790, y: 250, w: 110, h: 100 },
    ],
    vents: [{ x: 60, y: 520, w: 48, h: 48 }],
    lasers: [],
    exit: { x: 16, y: 120, w: 16, h: 84, label: 'ZIPLINE' },
    start: { x: 880, y: 540 },
  },
  {
    name: 'The Meridian Vault',
    sub: 'Room 3 of 3 — the big one, then gone',
    walls: [
      ...outerWalls(),
      { x: 300, y: 140, w: 160, h: 26 },
      { x: 500, y: 140, w: 160, h: 26 },
      { x: 300, y: 440, w: 160, h: 26 },
      { x: 500, y: 440, w: 160, h: 26 },
      { x: 430, y: 250, w: 100, h: 100 }, // the vault plinth
    ],
    loot: [
      { x: 480, y: 372, value: 12000, name: 'The Meridian Vault', kind: 'vault' },
      { x: 200, y: 180, value: 2500, name: 'The Star Sapphire', kind: 'gem' },
      { x: 760, y: 180, value: 2000, name: 'The Emerald Idol', kind: 'gem' },
      { x: 200, y: 490, value: 1500, name: 'The Jade Mask', kind: 'painting' },
    ],
    guards: [
      // Same y=480 bottom line as level 2: the vents' top edges are
      // y=520, and a patrol at y=500 would pass inside catch range.
      { x: 120, y: 120, waypoints: [[120, 120], [840, 120], [840, 480], [120, 480]] },
      { x: 240, y: 300, waypoints: [[240, 120], [240, 520]] },
      { x: 720, y: 300, waypoints: [[720, 520], [720, 120]] },
      { x: 280, y: 480, waypoints: [[280, 480], [680, 480], [680, 180], [280, 180]] },
    ],
    cameras: [
      { x: 240, y: 66, base: Math.PI / 2, sweep: 0.5, period: 5, phase: 0 },
      { x: 720, y: 66, base: Math.PI / 2, sweep: 0.5, period: 6, phase: 3 },
      { x: 480, y: 582, base: -Math.PI / 2, sweep: 0.55, period: 6, phase: 1.5 },
    ],
    shadows: [
      { x: 60, y: 250, w: 110, h: 100 },
      { x: 790, y: 250, w: 110, h: 100 },
    ],
    vents: [
      { x: 60, y: 520, w: 48, h: 48 },
      { x: 852, y: 520, w: 48, h: 48 },
    ],
    lasers: [
      { x1: 200, y1: 300, x2: 420, y2: 300 },
      { x1: 660, y1: 200, x2: 660, y2: 420 },
    ],
    exit: { x: 928, y: 460, w: 16, h: 84, label: 'SERVICE DOOR' },
    start: { x: 80, y: 100 },
  },
];

export function levelLootTotal(level) {
  return level.loot.reduce((s, l) => s + l.value, 0);
}

export function gameLootTotal() {
  return LEVELS.reduce((s, l) => s + levelLootTotal(l), 0);
}
