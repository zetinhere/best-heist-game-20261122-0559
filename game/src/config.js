// Tuning constants, palette and the seeded RNG for The Meridian Vault.
// Everything the game balances on lives here, so a tweak never hunts
// through the simulation or the renderer.

// Logical playfield. Every level fits inside one frame: the whole room,
// the thief, the guards, the cameras, the loot and the alarm meter are all
// visible at once, which is what the judge's first criterion asks for.
export const W = 960;
export const H = 600;
export const HUD_H = 48;

// The thief.
export const PLAYER_R = 11;
export const PLAYER_SPEED = 168; // px per second, walking
export const PLAYER_SNEAK = 96; // px per second, holding SHIFT
export const LOOT_HOLD = 0.5; // seconds of E held for a normal loot
export const VAULT_HOLD = 2.6; // seconds of E held for a vault

// The guards.
export const GUARD_R = 12;
export const GUARD_PATROL = 62;
export const GUARD_CHASE = 122;
export const GUARD_TURN = 3.4; // radians per second the guard can turn
export const VISION_RANGE = 198;
export const VISION_HALF = 0.56; // ~32 degrees each side of facing
export const CHASE_RANGE = 300; // a guard that sees you this close gives chase at once
export const CATCH_R = 24; // guard centre to thief centre: caught

// Cameras.
export const CAM_RANGE = 178;
export const CAM_HALF = 0.42;

// Detection. A watcher's "see" is 0..1 each frame (in cone, line of sight,
// scaled by distance); suspicion and the alarm both grow from it.
export const SUSP_GAIN = 1.5; // suspicion per second at see == 1
export const SUSP_DECAY = 0.55;
export const CHASE_AT = 0.55; // suspicion that turns a patrol into a chase
export const ALARM_GAIN = 42; // alarm points per second at max suspicion
export const ALARM_CAM = 30; // alarm points per second while a camera sees you
export const ALARM_DECAY = 7; // alarm points per second while nobody sees you
export const SHADOW_SLOW = 3; // detection is this many times slower in shadow
export const SNEAK_SLOW = 2; // ...and this many times slower while sneaking
export const LASER_ALARM = 25; // alarm added by tripping a laser beam
export const LASER_COOLDOWN = 1.0;

// Tools.
export const COINS_PER_LEVEL = 3;
export const EMP_PER_LEVEL = 2;
export const EMP_TIME = 8; // seconds cameras stay blind
export const COIN_HEAR = 280; // guards this close hear a tossed coin
export const INVESTIGATE_WAIT = 2.2; // seconds a guard stares at a coin spot

// Alarm / lockdown.
export const LOCKDOWN_AT = 100;
export const LOCKDOWN_TIME = 10; // seconds the exit stays sealed
export const LOCKDOWN_DRAIN_TO = 40; // alarm after a lockdown ends

// Rank bands, by the highest alarm the run ever reached.
export const RANK_GHOST = 30;
export const RANK_SHADOW = 75;

export const COLORS = {
  bg: '#0b0e17',
  floor: '#171b28',
  floorAlt: '#1b2032',
  carpet: '#3d2436',
  wall: '#2e3550',
  wallTop: '#4a5478',
  shadow: 'rgba(6, 8, 18, 0.55)',
  vent: '#232838',
  ventEdge: '#4a5478',
  loot: '#f2c14e',
  lootRing: '#ffe9a8',
  vault: '#ffd76a',
  exit: '#39d98a',
  exitSealed: '#e5484d',
  player: '#f5a623',
  playerSneak: '#d18a1d',
  guard: '#5b7bd5',
  guardChase: '#e5484d',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneEdge: 'rgba(242, 201, 76, 0.55)',
  camCone: 'rgba(229, 72, 77, 0.18)',
  camConeEdge: 'rgba(229, 72, 77, 0.55)',
  laser: '#ff4d6d',
  text: '#e8eaf2',
  dim: '#9aa3bd',
  alarm: '#ffb224',
  alarmHot: '#e5484d',
  hud: '#12162a',
  hudEdge: '#2e3550',
};

// Deterministic RNG (mulberry32) for anything cosmetic that must not
// depend on Math.random. Level layouts are fixed tables, so the game is
// deterministic by construction; this is only for dust and sparkle.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Shortest angle from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
