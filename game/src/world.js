// The game state: one room at a time, the thief, the alarm, the tools,
// and the screens that frame a run (title, playing, caught, clear, win).
//
// Loot accounting is per level: levelLoot counts what this room paid, and
// finishLevel adds it to totalLoot exactly once. The HUD must never add
// levelLoot again after a level is finished, or the win screen and the HUD
// disagree.

import {
  PLAYER_R,
  PLAYER_SPEED,
  PLAYER_SNEAK,
  LOOT_HOLD,
  VAULT_HOLD,
  ALARM_GAIN,
  ALARM_CAM,
  ALARM_DECAY,
  LASER_ALARM,
  LASER_COOLDOWN,
  COINS_PER_LEVEL,
  EMP_PER_LEVEL,
  EMP_TIME,
  COIN_HEAR,
  LOCKDOWN_AT,
  LOCKDOWN_TIME,
  LOCKDOWN_DRAIN_TO,
  RANK_GHOST,
  RANK_SHADOW,
  CATCH_R,
  W,
  H,
  clamp,
  dist,
} from './config.js';
import { LEVELS, levelLootTotal } from './levels.js';
import { Guard, Camera, moveCircle, pointInRect, segHitsRect } from './guards.js';
import { moveVector } from './input.js';
import { sfxPickup, sfxVault, sfxCoin, sfxEmp, sfxSpotted, sfxCaught, sfxWin } from './audio.js';

export function createWorld() {
  const world = {
    screen: 'title', // title | playing | caught | clear | win
    screenT: 0, // seconds on the current screen
    levelIndex: 0,
    level: null,
    walls: [],
    loot: [],
    guards: [],
    cameras: [],
    player: { x: 80, y: 540, dir: -Math.PI / 2 },
    alarm: 0,
    peakAlarm: 0,
    levelLoot: 0,
    totalLoot: 0,
    coins: COINS_PER_LEVEL,
    emps: EMP_PER_LEVEL,
    lockdown: 0, // seconds left sealed
    holdT: 0, // seconds E has been held on the current loot
    holdLoot: null, // the loot being channelled
    laserCd: 0,
    sneaking: false,
    inVentNow: false,
    caughtBy: null,
    msg: '',
    msgT: 0,
    time: 0,
    spotted: 0, // times a guard entered chase

    inShadow(x, y) {
      return (this.level?.shadows || []).some((s) => pointInRect(x, y, s));
    },
    inVent(x, y) {
      return (this.level?.vents || []).some((v) => pointInRect(x, y, v));
    },
    // Push a point out of any vent it sits inside, along the smallest
    // penetration, with a 6px margin. Guards never enter vents, so a
    // chase or an investigation that ends inside one is re-aimed at the
    // nearest edge instead.
    avoidVent(x, y) {
      for (const v of this.level?.vents || []) {
        if (pointInRect(x, y, v)) {
          const left = x - v.x;
          const right = v.x + v.w - x;
          const top = y - v.y;
          const bottom = v.y + v.h - y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) return { x: v.x - 6, y };
          if (m === right) return { x: v.x + v.w + 6, y };
          if (m === top) return { x, y: v.y - 6 };
          return { x, y: v.y + v.h + 6 };
        }
      }
      return { x, y };
    },
    allLootTaken() {
      return this.loot.every((l) => l.taken);
    },
    exitOpen() {
      return this.allLootTaken() && this.lockdown <= 0;
    },
    rank() {
      if (this.peakAlarm < RANK_GHOST) return 'GHOST';
      if (this.peakAlarm < RANK_SHADOW) return 'SHADOW';
      return 'LOUD';
    },
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  const level = LEVELS[index];
  world.levelIndex = index;
  world.level = level;
  world.walls = level.walls;
  world.loot = level.loot.map((l) => ({ ...l, taken: false, progress: 0 }));
  world.guards = level.guards.map((g) => new Guard(g));
  world.cameras = level.cameras.map((c) => new Camera(c));
  world.player = { x: level.start.x, y: level.start.y, dir: -Math.PI / 2 };
  world.alarm = 0;
  world.levelLoot = 0;
  world.coins = COINS_PER_LEVEL;
  world.emps = EMP_PER_LEVEL;
  world.lockdown = 0;
  world.holdT = 0;
  world.holdLoot = null;
  world.laserCd = 0;
  world.msg = level.name;
  world.msgT = 2.5;
}

function finishLevel(world) {
  world.totalLoot += world.levelLoot;
  if (world.levelIndex + 1 >= LEVELS.length) sfxWin();
  else sfxVault();
  world.screen = 'clear';
  world.screenT = 0;
}

function failLevel(world, guard) {
  sfxCaught();
  world.caughtBy = guard;
  world.screen = 'caught';
  world.screenT = 0;
}

export function startGame(world) {
  world.totalLoot = 0;
  world.peakAlarm = 0;
  world.spotted = 0;
  loadLevel(world, 0);
  world.screen = 'playing';
  world.screenT = 0;
}

export function update(world, input, dt) {
  world.time += dt;
  world.screenT += dt;
  if (world.msgT > 0) world.msgT -= dt;
  if (world.laserCd > 0) world.laserCd -= dt;

  if (world.screen === 'title') {
    if (input.wasPressed('Enter') || input.click) {
      input.click = null;
      startGame(world);
    }
    return;
  }
  if (world.screen === 'caught') {
    if (input.wasPressed('r') || input.wasPressed('Enter')) {
      loadLevel(world, world.levelIndex);
      world.screen = 'playing';
      world.screenT = 0;
    }
    return;
  }
  if (world.screen === 'clear') {
    // No delay gate here: the clear screen is reached by walking into
    // the exit, never by pressing Enter, so a quick Enter cannot be an
    // accidental double-press.
    if (input.wasPressed('Enter') || input.click) {
      input.click = null;
      if (world.levelIndex + 1 >= LEVELS.length) {
        world.screen = 'win';
        world.screenT = 0;
      } else {
        loadLevel(world, world.levelIndex + 1);
        world.screen = 'playing';
        world.screenT = 0;
      }
    }
    return;
  }
  if (world.screen === 'win') {
    if (world.screenT > 0.6 && (input.wasPressed('Enter') || input.wasPressed('r'))) {
      startGame(world);
    }
    return;
  }

  // ---- playing ----
  const p = world.player;
  const mv = moveVector(input);
  world.sneaking = input.held('Shift');
  const speed = world.sneaking ? PLAYER_SNEAK : PLAYER_SPEED;
  if (mv.x !== 0 || mv.y !== 0) {
    p.dir = Math.atan2(mv.y, mv.x);
  }
  const moved = moveCircle(p, PLAYER_R, mv.x * speed * dt, mv.y * speed * dt, world.walls);
  p.x = clamp(moved.x, 16 + PLAYER_R, W - 16 - PLAYER_R);
  p.y = clamp(moved.y, 48 + PLAYER_R, H - 16 - PLAYER_R);
  world.inVentNow = world.inVent(p.x, p.y);

  // Coin toss: a click throws a coin there; nearby guards investigate.
  if (input.click) {
    const c = input.click;
    input.click = null;
    if (world.coins > 0 && !world.inVent(c.x, c.y)) {
      world.coins -= 1;
      sfxCoin();
      for (const g of world.guards) {
        if (dist(g.x, g.y, c.x, c.y) < COIN_HEAR) g.investigate(c);
      }
      world.msg = 'Coin tossed — they heard that';
      world.msgT = 1.2;
    }
  }

  // EMP: Q blinds every camera for EMP_TIME seconds.
  if (input.wasPressed('q') && world.emps > 0) {
    world.emps -= 1;
    sfxEmp();
    for (const c of world.cameras) c.blind = EMP_TIME;
    world.msg = 'EMP — cameras blind for 8s';
    world.msgT = 1.5;
  }

  // Loot: hold E near a loot spot. A vault needs the long channel.
  const near = world.loot.find((l) => !l.taken && dist(p.x, p.y, l.x, l.y) < 34);
  if (near && input.held('e')) {
    const need = near.kind === 'vault' ? VAULT_HOLD : LOOT_HOLD;
    if (world.holdLoot !== near) {
      world.holdLoot = near;
      world.holdT = 0;
    }
    world.holdT += dt;
    near.progress = clamp(world.holdT / need, 0, 1);
    if (world.holdT >= need) {
      near.taken = true;
      near.progress = 0;
      world.levelLoot += near.value;
      if (near.kind === 'vault') sfxVault();
      else sfxPickup();
      world.holdLoot = null;
      world.holdT = 0;
      world.msg = `Lifted ${near.name} — $${near.value.toLocaleString('en-US')}`;
      world.msgT = 1.6;
    }
  } else {
    if (world.holdLoot) world.holdLoot.progress = 0;
    world.holdLoot = null;
    world.holdT = 0;
  }

  // Lasers: crossing a beam trips the alarm (with a cooldown).
  if (world.laserCd <= 0) {
    for (const beam of world.level.lasers) {
      if (segHitsRect(beam.x1, beam.y1, beam.x2, beam.y2, { x: p.x - PLAYER_R, y: p.y - PLAYER_R, w: PLAYER_R * 2, h: PLAYER_R * 2 })) {
        world.alarm = clamp(world.alarm + LASER_ALARM, 0, 100);
        world.laserCd = LASER_COOLDOWN;
        world.msg = 'Laser tripped!';
        world.msgT = 1.2;
        break;
      }
    }
  }

  // Watchers.
  let maxSusp = 0;
  for (const g of world.guards) {
    const wasChase = g.state === 'chase';
    g.update(dt, world);
    if (!wasChase && g.state === 'chase') {
      world.spotted += 1;
      sfxSpotted();
    }
    maxSusp = Math.max(maxSusp, g.susp);
  }
  let camSee = 0;
  for (const c of world.cameras) {
    c.update(dt, world);
    camSee = Math.max(camSee, c.see);
  }

  // Alarm: climbs while anyone sees the thief, falls when nobody does.
  if (maxSusp > 0 || camSee > 0) {
    world.alarm = clamp(world.alarm + (maxSusp * ALARM_GAIN + camSee * ALARM_CAM) * dt, 0, 100);
  } else {
    world.alarm = clamp(world.alarm - ALARM_DECAY * dt, 0, 100);
  }
  world.peakAlarm = Math.max(world.peakAlarm, world.alarm);

  // Lockdown: at 100 the exit seals for LOCKDOWN_TIME seconds.
  if (world.alarm >= LOCKDOWN_AT && world.lockdown <= 0) {
    world.lockdown = LOCKDOWN_TIME;
    world.msg = 'LOCKDOWN — the exit is sealed!';
    world.msgT = 2;
  }
  if (world.lockdown > 0) {
    world.lockdown -= dt;
    if (world.lockdown <= 0) {
      world.lockdown = 0;
      world.alarm = Math.min(world.alarm, LOCKDOWN_DRAIN_TO);
    }
  }

  // Caught: a guard touches the thief.
  for (const g of world.guards) {
    if (dist(g.x, g.y, p.x, p.y) < CATCH_R) {
      failLevel(world, g);
      return;
    }
  }

  // Exit: all loot taken, exit open, thief walks into the door.
  const ex = world.level.exit;
  if (world.exitOpen() && p.x + PLAYER_R > ex.x && p.x - PLAYER_R < ex.x + ex.w && p.y + PLAYER_R > ex.y && p.y - PLAYER_R < ex.y + ex.h) {
    finishLevel(world);
  }
}
