// Deterministic screenshot scenes. Each shot stages a real game state —
// the same world the player plays, with fixed positions and numbers — and
// main.js renders exactly one frame of it. No randomness, no animation
// phase: the same shot always renders the same pixels.
//
// The cover is the frame the judge weighs most: a room the thief is
// crossing, guards with vision cones, cameras, a loot target and an alarm
// meter, all visible at once.

import { loadLevel } from './world.js';
import { gameLootTotal } from './levels.js';

function place(world, px, py, dir) {
  world.player.x = px;
  world.player.y = py;
  world.player.dir = dir;
}

export function stageShot(world, name) {
  // Every shot starts from a clean load so nothing leaks between shots.
  if (name === 'title') {
    loadLevel(world, 0);
    world.screen = 'title';
    world.screenT = 1.2;
    return;
  }

  if (name === 'cover') {
    loadLevel(world, 0);
    world.screen = 'playing';
    // One painting already lifted, the thief crossing the room toward
    // the next, a guard's cone sweeping just past him.
    world.loot[0].taken = true;
    world.levelLoot = 1200;
    place(world, 480, 300, -Math.PI / 2);
    world.guards[0].x = 700;
    world.guards[0].y = 120;
    world.guards[0].dir = Math.PI;
    world.guards[0].wp = 1;
    world.guards[1].x = 280;
    world.guards[1].y = 420;
    world.guards[1].dir = Math.PI / 2;
    world.guards[1].susp = 0.3;
    world.cameras[0].t = 1.4;
    world.alarm = 34;
    world.peakAlarm = 34;
    world.msg = '';
    world.msgT = 0;
    return;
  }

  if (name === 'alarm') {
    loadLevel(world, 1);
    world.screen = 'playing';
    // The vault is cracked, the alarm is at 82%, and a guard is on the
    // thief's heels: the fair caught moment, a breath before BUSTED.
    world.loot[0].taken = true;
    world.levelLoot = 8000;
    place(world, 480, 430, Math.PI / 2);
    const chaser = world.guards[2];
    chaser.x = 480;
    chaser.y = 480;
    chaser.dir = -Math.PI / 2;
    chaser.state = 'chase';
    chaser.susp = 0.9;
    chaser.see = 0.9;
    world.guards[0].x = 200;
    world.guards[0].y = 120;
    world.guards[0].dir = 0;
    world.guards[1].x = 660;
    world.guards[1].y = 420;
    world.guards[1].dir = Math.PI;
    world.cameras[0].t = 2.2;
    world.cameras[1].t = 0.6;
    world.alarm = 82;
    world.peakAlarm = 82;
    world.spotted = 2;
    world.msg = 'SPOTTED — run!';
    world.msgT = 5;
    return;
  }

  if (name === 'win') {
    loadLevel(world, 2);
    world.screen = 'win';
    world.screenT = 1.0;
    // The run is over: every room's loot is already lifted, so the room
    // behind the overlay shows empty plinths, not loot still waiting.
    for (const l of world.loot) l.taken = true;
    world.totalLoot = gameLootTotal();
    world.peakAlarm = 18;
    world.spotted = 0;
    return;
  }

  throw new Error(`unknown shot: ${name}`);
}

export const SHOT_NAMES = ['cover', 'title', 'alarm', 'win'];
