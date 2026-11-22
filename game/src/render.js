// Everything the eye sees: the room, the cones, the loot, the HUD and the
// screens. The cover shot lives or dies here: one frame must show a room
// the thief is crossing, guards with vision cones, cameras, a loot target
// and an alarm meter, so the HUD and every one of those is drawn in the
// playing state, never hidden behind a menu.

import { W, H, HUD_H, COLORS, VISION_RANGE, VISION_HALF, CAM_RANGE, CAM_HALF, VAULT_HOLD, LOOT_HOLD, clamp } from './config.js';
import { levelLootTotal } from './levels.js';

function conePath(ctx, x, y, dir, range, half) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - half, dir + half);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, dir, range, half, fill, edge) {
  conePath(ctx, x, y, dir, range, half);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function draw(ctx, world, t) {
  const level = world.level;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  drawRoom(ctx, world);
  drawLoot(ctx, world);
  drawExit(ctx, world);
  drawLasers(ctx, world);
  for (const c of world.cameras) drawCamera(ctx, c);
  for (const g of world.guards) drawGuard(ctx, g);
  drawPlayer(ctx, world, t);
  drawHud(ctx, world);

  if (world.screen === 'title') drawTitle(ctx, world, t);
  else if (world.screen === 'caught') drawCaught(ctx, world);
  else if (world.screen === 'clear') drawClear(ctx, world);
  else if (world.screen === 'win') drawWin(ctx, world);

  if (world.msgT > 0 && world.screen === 'playing') {
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232, 234, 242, 0.92)';
    ctx.fillText(world.msg, W / 2, H - 18);
  }
}

function drawRoom(ctx, world) {
  const level = world.level;
  // Floor: two-tone tiles.
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, HUD_H, W, H - HUD_H);
  ctx.fillStyle = COLORS.floorAlt;
  const tile = 48;
  for (let y = HUD_H; y < H; y += tile) {
    for (let x = 0; x < W; x += tile) {
      if (((x / tile) | 0) % 2 === ((y / tile) | 0) % 2) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
  // Carpet runner down the middle of the room.
  ctx.fillStyle = COLORS.carpet;
  ctx.fillRect(0, 280, W, 64);

  // Shadow zones: pools of dark where detection is 3x slower.
  for (const s of level.shadows) {
    ctx.fillStyle = COLORS.shadow;
    roundRect(ctx, s.x, s.y, s.w, s.h, 10);
    ctx.fill();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(154, 163, 189, 0.8)';
    ctx.fillText('SHADOW', s.x + s.w / 2, s.y + s.h / 2 + 4);
  }

  // Vents: the thief is unseen inside; guards never enter.
  for (const v of level.vents) {
    ctx.fillStyle = COLORS.vent;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = COLORS.ventEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(v.x + 1, v.y + 1, v.w - 2, v.h - 2);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(v.x + 6, v.y + (v.h / 4) * i);
      ctx.lineTo(v.x + v.w - 6, v.y + (v.h / 4) * i);
    }
    ctx.strokeStyle = 'rgba(154, 163, 189, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Walls: solid with a lit top edge.
  for (const w of level.walls) {
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(w.x, w.y, w.w, 3);
  }
}

function drawLoot(ctx, world) {
  for (const l of world.loot) {
    if (l.taken) continue;
    const pulse = 1 + Math.sin(world.time * 3 + l.x) * 0.06;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.scale(pulse, pulse);
    if (l.kind === 'vault') {
      // The big one: a gold diamond on a dark plinth ring.
      ctx.fillStyle = 'rgba(255, 215, 106, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.vault;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.lootRing;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (l.kind === 'gem') {
      ctx.fillStyle = l.value >= 2500 ? '#7ef0c1' : '#8fd0ff';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Painting: a gilded frame with a canvas that glints.
      ctx.fillStyle = COLORS.loot;
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#7a5c1e';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = 'rgba(255, 233, 168, 0.9)';
      ctx.fillRect(-8, -5, 16, 3);
    }
    ctx.restore();
    // Value tag, always readable.
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.lootRing;
    ctx.fillText(`$${l.value.toLocaleString('en-US')}`, l.x, l.y - 20);
    // Channel progress ring while E is held.
    if (world.holdLoot === l && l.progress > 0) {
      ctx.beginPath();
      ctx.arc(l.x, l.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * l.progress);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawExit(ctx, world) {
  const ex = world.level.exit;
  const open = world.exitOpen();
  const sealed = world.lockdown > 0;
  ctx.fillStyle = sealed ? COLORS.exitSealed : open ? COLORS.exit : '#3a415c';
  ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
  ctx.strokeStyle = 'rgba(232, 234, 242, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ex.x + 0.5, ex.y + 0.5, ex.w - 1, ex.h - 1);
  // The door's name goes ABOVE the door, never below: the shadow zone's
  // label sits below and the two would collide. The label is centred on
  // the door but clamped so a door on the right wall cannot push its name
  // off the canvas edge.
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = sealed ? COLORS.exitSealed : open ? COLORS.exit : COLORS.dim;
  const cx = ex.x + ex.w / 2;
  const label = sealed ? `SEALED ${Math.ceil(world.lockdown)}s` : ex.label;
  const labelW = ctx.measureText(label).width;
  const labelX = clamp(cx, labelW / 2 + 4, W - labelW / 2 - 4);
  const labelY = ex.y - 8;
  ctx.fillText(label, labelX, labelY);
  if (open && !sealed) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = COLORS.exit;
    ctx.fillText('GO!', cx, ex.y + ex.h + 14);
  }
}

function drawLasers(ctx, world) {
  for (const b of world.level.lasers) {
    const hot = world.laserCd > 0;
    ctx.strokeStyle = hot ? '#ffffff' : COLORS.laser;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.laser;
    ctx.beginPath();
    ctx.arc(b.x1, b.y1, 4, 0, Math.PI * 2);
    ctx.arc(b.x2, b.y2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuard(ctx, g) {
  const chasing = g.state === 'chase';
  drawCone(ctx, g.x, g.y, g.dir, VISION_RANGE, VISION_HALF, COLORS.cone, COLORS.coneEdge);
  // Body: a dark-blue disc with a visor that points where it looks.
  ctx.fillStyle = chasing ? COLORS.guardChase : COLORS.guard;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 234, 242, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#0b0e17';
  ctx.beginPath();
  ctx.arc(g.x + Math.cos(g.dir) * 5, g.y + Math.sin(g.dir) * 5, 4, 0, Math.PI * 2);
  ctx.fill();
  // Suspicion: a "?" while it grows wary, "!" once it chases.
  if (chasing || g.susp > 0.25) {
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = chasing ? COLORS.guardChase : '#ffb224';
    ctx.fillText(chasing ? '!' : '?', g.x, g.y - 18);
  }
}

function drawCamera(ctx, c) {
  const blind = c.blind > 0;
  if (!blind) {
    drawCone(ctx, c.x, c.y, c.dir, CAM_RANGE, CAM_HALF, COLORS.camCone, COLORS.camConeEdge);
  }
  ctx.fillStyle = blind ? '#3a415c' : '#c94f5e';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 234, 242, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = blind ? '#555c78' : '#e5484d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x + Math.cos(c.dir) * 14, c.y + Math.sin(c.dir) * 14);
  ctx.stroke();
}

function drawPlayer(ctx, world, t) {
  const p = world.player;
  const sneak = world.sneaking;
  // A soft ring when hidden in shadow or a vent: the game tells you
  // you are safe without a word.
  if (world.inVentNow || world.inShadow(p.x, p.y)) {
    ctx.strokeStyle = 'rgba(57, 217, 138, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = sneak ? COLORS.playerSneak : COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0b0e17';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick + a little mask line, so direction reads at a glance.
  ctx.strokeStyle = '#0b0e17';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.dir) * 11, p.y + Math.sin(p.dir) * 11);
  ctx.stroke();
  if (world.holdLoot) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LIFTING…', p.x, p.y - 20);
  }
}

function drawHud(ctx, world) {
  const level = world.level;
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = COLORS.hudEdge;
  ctx.fillRect(0, HUD_H - 2, W, 2);

  ctx.textAlign = 'left';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(level.name, 16, 20);
  ctx.font = '400 11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(level.sub, 16, 36);

  // Loot: this room's take plus the run total. On the clear and win
  // screens the room's take has already been folded into totalLoot by
  // finishLevel, so adding levelLoot again would double-count it.
  const total = world.screen === 'clear' || world.screen === 'win' ? world.totalLoot : world.totalLoot + world.levelLoot;
  ctx.textAlign = 'right';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.loot;
  ctx.fillText(`$${total.toLocaleString('en-US')}`, 560, 20);
  ctx.font = '400 11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  const left = world.loot.filter((l) => !l.taken).length;
  ctx.fillText(`${left} loot left · room $${levelLootTotal(level).toLocaleString('en-US')}`, 560, 36);

  // Alarm meter. Kept short (130px) so the filled bar never runs into
  // the tools hint on the right, even at 100%.
  const ax = 590;
  const aw = 130;
  ctx.textAlign = 'left';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = world.alarm >= 75 ? COLORS.alarmHot : COLORS.alarm;
  ctx.fillText(world.lockdown > 0 ? `LOCKDOWN ${Math.ceil(world.lockdown)}s` : 'ALARM', ax, 20);
  ctx.fillStyle = '#232838';
  roundRect(ctx, ax, 26, aw, 10, 5);
  ctx.fill();
  const frac = clamp(world.alarm / 100, 0, 1);
  ctx.fillStyle = world.alarm >= 75 ? COLORS.alarmHot : COLORS.alarm;
  if (frac > 0) {
    roundRect(ctx, ax, 26, aw * frac, 10, 5);
    ctx.fill();
  }

  // Tools.
  ctx.textAlign = 'right';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`◉ ${world.coins}   ⚡ ${world.emps}`, 944, 20);
  ctx.font = '400 11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('click: coin · Q: EMP · E: lift · Shift: sneak', 944, 36);
}

function dimScreen(ctx) {
  ctx.fillStyle = 'rgba(5, 7, 14, 0.78)';
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(ctx, world, t) {
  dimScreen(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.loot;
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.fillText('THE MERIDIAN VAULT', W / 2, 190);
  ctx.fillStyle = COLORS.text;
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('A three-room museum heist. Lift it all. Leave no trace.', W / 2, 228);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — sneak      E (hold) — lift loot', W / 2, 300);
  ctx.fillText('Click — toss a coin      Q — EMP the cameras      R — retry a room', W / 2, 326);
  ctx.fillText('Hide in shadows and vents. Mind the cones. At alarm 100 the exit seals.', W / 2, 352);
  const blink = 0.55 + Math.sin(t * 3) * 0.45;
  ctx.fillStyle = `rgba(245, 166, 35, ${blink.toFixed(2)})`;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to start the heist', W / 2, 420);
}

function drawCaught(ctx, world) {
  dimScreen(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.alarmHot;
  ctx.font = '900 56px system-ui, sans-serif';
  ctx.fillText('BUSTED', W / 2, 240);
  ctx.fillStyle = COLORS.text;
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('A guard laid a hand on your shoulder. The night is not over.', W / 2, 282);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillText('Press R to retry the room', W / 2, 330);
}

function drawClear(ctx, world) {
  dimScreen(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.exit;
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.fillText('ROOM CLEAR', W / 2, 230);
  ctx.fillStyle = COLORS.text;
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(
    `${world.level.name} — lifted $${world.levelLoot.toLocaleString('en-US')} (run total $${world.totalLoot.toLocaleString('en-US')})`,
    W / 2,
    272,
  );
  ctx.fillStyle = COLORS.dim;
  ctx.font = '400 15px system-ui, sans-serif';
  const next = world.levelIndex + 1 >= 3 ? 'the getaway' : LEVELS_NEXT(world.levelIndex);
  ctx.fillText(`Press ENTER for ${next}`, W / 2, 320);
}

function LEVELS_NEXT(i) {
  return ['The Vault Hall', 'The Meridian Vault'][i] || 'the getaway';
}

function drawWin(ctx, world) {
  dimScreen(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.loot;
  ctx.font = '900 52px system-ui, sans-serif';
  ctx.fillText('CLEAN GETAWAY', W / 2, 200);
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(`Rank: ${world.rank()}`, W / 2, 252);
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(`Total loot: $${world.totalLoot.toLocaleString('en-US')} across three rooms`, W / 2, 290);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillText(`Peak alarm ${Math.round(world.peakAlarm)}% · spotted ${world.spotted} time${world.spotted === 1 ? '' : 's'}`, W / 2, 322);
  ctx.fillText('Press ENTER to run it again', W / 2, 372);
}
