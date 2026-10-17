// Canvas renderer: lays out the fabric and draws stitches, the hook and the working loop.
import { STITCHES, expand } from './patterns.js';

export const CELL = 30;      // width of one stitch column
const PAD = 26;              // canvas padding
const MARGIN = CELL;         // room on each side for turning chains
const HOOK_ROOM = 70;        // space above the top row for the hook

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Compute row geometry for a pattern. */
export function layout(pattern) {
  const rows = pattern.rows.map((row) => {
    const ids = expand(row.spec);
    const foundation = ids.every((id) => id === 'ch');
    const slots = foundation ? ids.length : ids.filter((id) => id !== 'ch').length;
    const height = Math.max(...ids.map((id) => STITCHES[id].height));
    return { ids, foundation, slots, height };
  });
  const cols = Math.max(...rows.map((r) => r.slots));
  const width = PAD * 2 + MARGIN * 2 + cols * CELL;
  const fabricHeight = rows.reduce((s, r) => s + r.height, 0);
  const height = PAD * 2 + HOOK_ROOM + fabricHeight;
  let y = height - PAD;
  rows.forEach((r) => { r.y = y; y -= r.height; });
  const left = PAD + MARGIN + ((cols - rows[0].slots) * CELL) / 2;
  return { rows, cols, width, height, left };
}

/** x of slot k in row r. Even rows run left to right, odd rows right to left (the work is turned). */
function slotX(lay, r, k) {
  const row = lay.rows[r];
  const idx = r % 2 === 0 ? k : row.slots - 1 - k;
  return lay.left + idx * CELL;
}

/** Position and size for the next placed stitch in row r given what is already placed. */
export function nextPosition(lay, r, placed) {
  const row = lay.rows[r];
  const nonCh = placed.filter((s) => s.st !== 'ch' || row.foundation).length;
  const turning = placed.length - nonCh;
  return { x: slotX(lay, r, Math.min(nonCh, row.slots)), y: row.y, turningIndex: turning, dir: r % 2 === 0 ? 1 : -1 };
}

function stitchGeometry(lay, r, placed, i) {
  // Geometry of the i-th placed stitch in row r.
  const row = lay.rows[r];
  let slot = 0; let turning = 0;
  for (let j = 0; j < i; j += 1) {
    if (placed[j].st === 'ch' && !row.foundation) turning += 1; else slot += 1;
  }
  const s = placed[i];
  if (s.st === 'ch' && !row.foundation) {
    // Turning chain: sits in the margin at the row's start edge, stacked upwards.
    const edge = r % 2 === 0 ? lay.left - CELL * 0.85 : lay.left + row.slots * CELL - CELL * 0.15;
    return { x: edge, y: row.y - turning * 11, w: CELL, h: STITCHES.ch.height, turning: true };
  }
  return { x: slotX(lay, r, slot), y: row.y, w: CELL, h: STITCHES[s.st].height, turning: false };
}

function ellipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

/** Draw a single stitch glyph with its base-left corner at (x, y). */
export function drawStitch(ctx, s, g, color) {
  const t = s.t || 0;
  const wScale = 1 - 0.22 * t;
  const hScale = 1 - 0.12 * t;
  const w = g.w * wScale;
  const h = g.h * hScale;
  const x = g.x + (g.w - w) / 2;
  const y = g.y;
  const cx = x + w / 2;
  const tilt = (Math.abs(t) > 0.45 ? t * 0.12 : 0);

  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(tilt);
  ctx.translate(-cx, -y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  if (s.wrong) {
    ctx.strokeStyle = '#d6455a';
    ctx.fillStyle = 'rgba(214,69,90,0.25)';
    ctx.setLineDash([4, 4]);
  } else {
    ctx.strokeStyle = shade(color, s.q === 'neat' ? 0 : -18);
    ctx.fillStyle = color;
  }

  const top = y - h * 0.82;
  switch (s.st) {
    case 'ch':
      ellipse(ctx, cx, y - h / 2, w * 0.4, h * 0.36); ctx.stroke();
      break;
    case 'sc':
      line(ctx, x + w * 0.2, y, cx, y - h * 0.62);
      line(ctx, x + w * 0.8, y, cx, y - h * 0.62);
      ellipse(ctx, cx, top, w * 0.38, h * 0.14); ctx.stroke();
      break;
    case 'hdc':
      line(ctx, cx, y, cx, y - h * 0.7);
      line(ctx, cx - w * 0.28, y - h * 0.3, cx + w * 0.28, y - h * 0.5);
      ellipse(ctx, cx, top, w * 0.38, h * 0.12); ctx.stroke();
      break;
    case 'dc':
      line(ctx, cx, y, cx, y - h * 0.72);
      line(ctx, cx - w * 0.3, y - h * 0.3, cx + w * 0.3, y - h * 0.5);
      line(ctx, cx - w * 0.3, y - h * 0.46, cx + w * 0.3, y - h * 0.66);
      ellipse(ctx, cx, top, w * 0.38, h * 0.1); ctx.stroke();
      break;
    case 'bo':
      ctx.lineWidth = 3;
      ellipse(ctx, cx - w * 0.18, y - h * 0.42, w * 0.3, h * 0.36); ctx.fill(); ctx.stroke();
      ellipse(ctx, cx + w * 0.18, y - h * 0.42, w * 0.3, h * 0.36); ctx.fill(); ctx.stroke();
      ellipse(ctx, cx, y - h * 0.46, w * 0.3, h * 0.4); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4;
      ellipse(ctx, cx, top, w * 0.38, h * 0.12); ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawHook(ctx, x, y, dip, time) {
  const bob = Math.sin(time / 320) * 1.5 + dip;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#b98d55';
  line(ctx, 0, -56, 0, -8);
  ctx.strokeStyle = '#8f6a3d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.quadraticCurveTo(0, 4, -7, 2);
  ctx.quadraticCurveTo(-11, 1, -9, -5);
  ctx.stroke();
  ctx.fillStyle = '#d9b27a';
  ctx.beginPath(); ctx.roundRect(-4, -60, 8, 14, 3); ctx.fill();
  ctx.restore();
}

/**
 * Draw the whole scene.
 * frame = { time, hold: null | { progress 0..1, zone }, yarnColor, dir }
 */
export function draw(ctx, game, lay, frame) {
  const { width, height } = lay;
  ctx.clearRect(0, 0, width, height);

  // Fabric shadow
  const fabricTop = lay.rows[lay.rows.length - 1].y - lay.rows[lay.rows.length - 1].height;
  const fabricBottom = lay.rows[0].y;
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.beginPath();
  ctx.roundRect(lay.left - 6, fabricTop - 6 + 6, lay.cols * CELL + 12, fabricBottom - fabricTop + 12, 10);
  ctx.fill();

  // Placed stitches
  game.rows.forEach((placed, r) => {
    placed.forEach((s, i) => {
      const g = stitchGeometry(lay, r, placed, i);
      drawStitch(ctx, s, g, game.pattern.yarns[s.yarn].color);
    });
  });

  // Hook and working loop
  const step = game.step;
  if (step && game.active) {
    const r = step.row;
    const placed = game.rows[r];
    const row = lay.rows[r];
    const pos = nextPosition(lay, r, placed);
    let hx; let hy;
    if (step.type === 'stitch' && step.st === 'ch' && !row.foundation) {
      hx = (r % 2 === 0 ? lay.left - CELL * 0.85 : lay.left + row.slots * CELL - CELL * 0.15) + CELL / 2;
      hy = row.y - pos.turningIndex * 11 - 8;
    } else if (step.type === 'yarn' || (step.type === 'stitch' && placed.length === 0)) {
      hx = slotX(lay, r, 0) + CELL / 2;
      hy = row.y - 8;
    } else if (step.type === 'turn' || step.type === 'finish') {
      hx = slotX(lay, r, row.slots - 1) + CELL / 2 + pos.dir * CELL * 0.6;
      hy = row.y - row.height * 0.6;
    } else {
      hx = pos.x + CELL / 2;
      hy = row.y - 8;
    }
    const hold = frame.hold;
    const dip = hold ? hold.progress * 10 : 0;
    if (hold) {
      const rad = 5 + hold.progress * 16;
      ctx.save();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = frame.yarnColor;
      ellipse(ctx, hx, hy - 4 + dip, rad, rad * 0.7);
      ctx.stroke();
      ctx.restore();
    }
    drawHook(ctx, hx, hy - 2, dip, frame.time);

    // Working yarn trailing off to the side
    ctx.save();
    ctx.strokeStyle = frame.yarnColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Runs from the hook up and over the edge of the work, then down to the ball off-canvas.
    const side = hx < width / 2 ? -1 : 1;
    const edgeX = side < 0 ? PAD * 0.4 : width - PAD * 0.4;
    ctx.moveTo(hx + side * 4, hy - 6 + dip);
    ctx.bezierCurveTo(hx + side * 28, hy - 40, edgeX, hy - 30, edgeX, hy + 20);
    ctx.quadraticCurveTo(edgeX + side * 4, height - 30, edgeX - side * 6, height - 4);
    ctx.stroke();
    ctx.restore();
  }
}
