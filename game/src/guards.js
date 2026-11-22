// Guards and cameras: patrol AI, vision cones and line of sight.
//
// A guard walks its waypoints, watches a cone in front of it, and changes
// its mind in three states:
//   patrol     — walks the loop; suspicion grows while it sees the thief.
//   investigate — a tossed coin (or a lost trail) pulls it to a point,
//                where it stares for a couple of seconds, then resumes.
//   chase      — suspicion high: it runs at the thief. Lose sight for a
//                while and it falls back to investigating the last spot.
//
// A camera sweeps its cone back and forth on a fixed mount. An EMP blinds
// it for EMP_TIME seconds: its cone goes grey and it sees nothing.

import {
  GUARD_PATROL,
  GUARD_CHASE,
  GUARD_TURN,
  VISION_RANGE,
  VISION_HALF,
  CAM_RANGE,
  CAM_HALF,
  SUSP_GAIN,
  SUSP_DECAY,
  CHASE_AT,
  CHASE_RANGE,
  EMP_TIME,
  INVESTIGATE_WAIT,
  SHADOW_SLOW,
  SNEAK_SLOW,
  angleDiff,
  clamp,
  dist,
} from './config.js';

// ---- geometry helpers (shared with world.js) ----

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function segHitsSeg(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function segHitsRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const { x, y, w, h } = r;
  return (
    segHitsSeg(x1, y1, x2, y2, x, y, x + w, y) ||
    segHitsSeg(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segHitsSeg(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segHitsSeg(x1, y1, x2, y2, x, y + h, x, y)
  );
}

// True when nothing solid stands between the two points.
export function los(x1, y1, x2, y2, walls) {
  for (const w of walls) {
    if (segHitsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

// Move a circle (x, y, r) by (dx, dy) against solid rects, axis by axis.
// The radius is shrunk by ~0.5px so a circle grazing a wall's top edge can
// still slide along it instead of sticking.
export function moveCircle(pos, r, dx, dy, walls) {
  const slack = r - 0.5;
  let nx = pos.x + dx;
  for (const w of walls) {
    if (nx + slack > w.x && nx - slack < w.x + w.w && pos.y + slack > w.y && pos.y - slack < w.y + w.h) {
      nx = dx > 0 ? w.x - slack : w.x + w.w + slack;
    }
  }
  let ny = pos.y + dy;
  for (const w of walls) {
    if (nx + slack > w.x && nx - slack < w.x + w.w && ny + slack > w.y && ny - slack < w.y + w.h) {
      ny = dy > 0 ? w.y - slack : w.y + w.h + slack;
    }
  }
  return { x: nx, y: ny, movedX: nx - pos.x, movedY: ny - pos.y };
}

// How clearly a watcher at (wx, wy) facing `dir` sees a point (tx, ty):
// 0 when out of the cone, out of range, or behind a wall; near 1 up close
// in the middle of the cone. Shadow and sneaking slow it down.
export function seeFactor(wx, wy, dir, range, half, tx, ty, walls, inShadow, sneaking) {
  const d = dist(wx, wy, tx, ty);
  if (d > range) return 0;
  const ang = Math.atan2(ty - wy, tx - wx);
  if (Math.abs(angleDiff(dir, ang)) > half) return 0;
  if (!los(wx, wy, tx, ty, walls)) return 0;
  let see = 1.15 - d / range;
  if (inShadow) see /= SHADOW_SLOW;
  if (sneaking) see /= SNEAK_SLOW;
  return clamp(see, 0, 1);
}

// ---- guards ----

export class Guard {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    // Waypoints arrive as [x, y] ARRAYS in the level tables: normalise
    // them to {x, y} objects here, or walkTo computes NaN and the guard
    // vanishes from the room.
    this.waypoints = def.waypoints.map((w) =>
      Array.isArray(w) ? { x: w[0], y: w[1] } : { x: w.x, y: w.y },
    );
    this.wp = 0;
    this.dir = Math.PI / 2;
    this.state = 'patrol';
    this.susp = 0;
    this.see = 0;
    this.target = null; // investigate point {x, y}
    this.wait = 0; // seconds left staring at an investigate point
    this.lost = 0; // seconds since the thief was last seen (chase)
    this.stuck = 0; // seconds without progress toward a waypoint
    this.lastX = this.x;
    this.lastY = this.y;
  }

  update(dt, world) {
    const thief = world.player;
    const inShadow = world.inShadow(thief.x, thief.y);
    const sneaking = world.sneaking;
    const inVent = world.inVent(thief.x, thief.y);
    this.see = inVent
      ? 0
      : seeFactor(this.x, this.y, this.dir, VISION_RANGE, VISION_HALF, thief.x, thief.y, world.walls, inShadow, sneaking);
    if (this.see > 0) {
      this.susp = clamp(this.susp + this.see * SUSP_GAIN * dt, 0, 1);
      this.lost = 0;
    } else {
      this.susp = clamp(this.susp - SUSP_DECAY * dt, 0, 1);
      if (this.state === 'chase') this.lost += dt;
    }

    if (this.state === 'patrol' && (this.susp >= CHASE_AT || (this.see > 0.55 && dist(this.x, this.y, thief.x, thief.y) < CHASE_RANGE))) {
      this.state = 'chase';
      this.lost = 0;
    }

    if (this.state === 'patrol') {
      const wp = this.waypoints[this.wp];
      this.walkTo(wp.x, wp.y, GUARD_PATROL, dt, world.walls);
      if (dist(this.x, this.y, wp.x, wp.y) < 6) {
        this.wp = (this.wp + 1) % this.waypoints.length;
        this.stuck = 0;
      }
    } else if (this.state === 'investigate') {
      if (this.target) {
        const arrived = this.walkTo(this.target.x, this.target.y, GUARD_PATROL, dt, world.walls);
        if (arrived) {
          this.wait -= dt;
          this.dir += dt * 1.2; // look around while staring
          if (this.wait <= 0) {
            this.state = 'patrol';
            this.target = null;
          }
        }
      } else {
        this.state = 'patrol';
      }
    } else if (this.state === 'chase') {
      // A thief inside a vent is unseen: the guard holds its ground
      // rather than blundering into the one place it never enters.
      // It loses the trail from here, then investigates the vent's edge.
      if (!world.inVent(thief.x, thief.y)) {
        this.walkTo(thief.x, thief.y, GUARD_CHASE, dt, world.walls);
      }
      if (this.susp < 0.12 && this.lost > 3) {
        // Lost the trail: go look where the thief was last seen —
        // re-aimed out of any vent, which a guard never enters.
        this.state = 'investigate';
        this.target = world.avoidVent ? world.avoidVent(thief.x, thief.y) : { x: thief.x, y: thief.y };
        this.wait = INVESTIGATE_WAIT;
      }
    }

    // A guard that makes no progress toward its waypoint for a while is
    // wedged on a corner: skip to the next waypoint instead of pushing
    // into the wall forever.
    if (dist(this.x, this.y, this.lastX, this.lastY) < 0.5) {
      this.stuck += dt;
      if (this.stuck > 1.5 && this.state === 'patrol') {
        this.wp = (this.wp + 1) % this.waypoints.length;
        this.stuck = 0;
      }
    } else {
      this.stuck = 0;
    }
    this.lastX = this.x;
    this.lastY = this.y;
  }

  // Walk toward (tx, ty) at `speed`, turning toward the movement, sliding
  // along walls. Returns true when arrived (within 6px).
  walkTo(tx, ty, speed, dt, walls) {
    const d = dist(this.x, this.y, tx, ty);
    if (d < 6) return true;
    const want = Math.atan2(ty - this.y, tx - this.x);
    const turn = clamp(angleDiff(this.dir, want), -GUARD_TURN * dt, GUARD_TURN * dt);
    this.dir += turn;
    const step = Math.min(speed * dt, d);
    const moved = moveCircle(this, 12, Math.cos(this.dir) * step, Math.sin(this.dir) * step, walls);
    this.x = moved.x;
    this.y = moved.y;
    return false;
  }

  investigate(point) {
    if (this.state === 'chase') return; // a chase is worth more than a coin
    this.state = 'investigate';
    this.target = { x: point.x, y: point.y };
    this.wait = INVESTIGATE_WAIT;
  }
}

// ---- cameras ----

export class Camera {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    this.base = def.base;
    this.sweep = def.sweep;
    this.period = def.period;
    this.phase = def.phase || 0;
    this.blind = 0; // seconds left blinded by an EMP
    this.see = 0;
    this.t = 0;
  }

  get dir() {
    return this.base + Math.sin(((this.t + this.phase) / this.period) * Math.PI * 2) * this.sweep;
  }

  update(dt, world) {
    this.t += dt;
    if (this.blind > 0) {
      this.blind -= dt;
      this.see = 0;
      return;
    }
    const thief = world.player;
    const inShadow = world.inShadow(thief.x, thief.y);
    const sneaking = world.sneaking;
    const inVent = world.inVent(thief.x, thief.y);
    this.see = inVent
      ? 0
      : seeFactor(this.x, this.y, this.dir, CAM_RANGE, CAM_HALF, thief.x, thief.y, world.walls, inShadow, sneaking);
  }
}
