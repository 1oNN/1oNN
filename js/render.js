// Canvas renderer for Hooked. Lays out the fabric and draws it as plied yarn on a linen
// blocking mat, with a beech hook standing in the working loop and a ball of yarn sitting by
// the lower-right corner. Everything colour-bearing comes from the CSS tokens via setPalette().
import { STITCHES, expand } from './patterns.js';

export const CELL = 30;      // width of one stitch column
const PAD = 18;              // canvas padding
const MARGIN = 30;           // room on each side for turning chains
const HOOK_ROOM = 64;        // space above the top row for the hook
const BALL_ROOM = 72;        // room to the right of the fabric for the ball
const TAU = Math.PI * 2;
const HOOK_ANGLE = Math.PI / 6;   // the hook leans 30 degrees right of vertical

export const PLACE_ANIM_MS = 340; // pen-stroke draw-in (140 ms) then a settle of up to 200 ms
export const WRONG_LIVE_MS = 1400; // a wrong stitch stays live this long so its halo can pulse
export const FROG_ANIM_MS = 200;

/** Chart symbols shared by the stitch keys, the row chips and the stitch guide. */
export const STITCH_SYMBOLS = {
  ch: '<ellipse cx="12" cy="12" rx="8" ry="4.5"/>',
  sc: '<path d="M5 5 19 19 M19 5 5 19"/>',
  hdc: '<path d="M12 4v16 M5 4h14"/>',
  dc: '<path d="M12 4v16 M5 4h14 M8 13.5l8-3.5"/>',
  bo: '<ellipse cx="12" cy="12" rx="5.5" ry="8.5" fill="currentColor" fill-opacity=".22"/><path d="M12 20.5V3.5 M12 20.5 7.5 5 M12 20.5l4.5-15"/>',
};

/** Inline SVG for a chart symbol, sized in CSS. */
export function symbolSvg(id, size = 24) {
  return `<svg class="sym" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STITCH_SYMBOLS[id] || ''}</svg>`;
}

// ---------------------------------------------------------------- palette
const DEFAULT_PALETTE = {
  ink: '#2f2318', muted: '#6b5543', bad: '#b23a30', neat: '#4d7536', ok: '#8f6a10',
  surface: '#fbf6ec', surface2: '#f1e7d4', surface3: '#e9dcc5', line: '#d6c3a6',
  bg: '#d4b188', bg2: '#bf9666', bg3: '#e3c9a4',
  yarns: { rose: '#e2869f', teal: '#3b9e98', mustard: '#dcae36', lavender: '#9c86d2' },
  hook: ['#ecd3a4', '#c69c63', '#86603a'],
  shadowInk: '60, 35, 15',
  halo: 0,
  fontMono: 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
};
let palette = { ...DEFAULT_PALETTE };
let paletteVersion = 0;

/** Replace the palette (call after a theme change). Missing keys fall back to the light tokens. */
export function setPalette(obj = {}) {
  palette = {
    ...DEFAULT_PALETTE,
    ...obj,
    yarns: { ...DEFAULT_PALETTE.yarns, ...(obj.yarns || {}) },
    hook: obj.hook && obj.hook.every(Boolean) ? obj.hook : DEFAULT_PALETTE.hook,
  };
  paletteVersion += 1;
}
export function getPalette() { return palette; }

/** Read the design tokens from the document so the canvas matches the current theme. */
export function readPalette(el = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!el) return { ...DEFAULT_PALETTE };
  const cs = getComputedStyle(el);
  const g = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
  const d = DEFAULT_PALETTE;
  return {
    ink: g('--ink', d.ink), muted: g('--muted', d.muted), bad: g('--bad', d.bad), neat: g('--neat', d.neat), ok: g('--ok', d.ok),
    surface: g('--surface', d.surface), surface2: g('--surface-2', d.surface2), surface3: g('--surface-3', d.surface3), line: g('--line', d.line),
    bg: g('--bg', d.bg), bg2: g('--bg-2', d.bg2), bg3: g('--bg-3', d.bg3),
    yarns: {
      rose: g('--yarn-rose', d.yarns.rose), teal: g('--yarn-teal', d.yarns.teal),
      mustard: g('--yarn-mustard', d.yarns.mustard), lavender: g('--yarn-lavender', d.yarns.lavender),
    },
    hook: [g('--hook-1', d.hook[0]), g('--hook-2', d.hook[1]), g('--hook-3', d.hook[2])],
    shadowInk: g('--shadow-ink', d.shadowInk),
    halo: parseFloat(g('--halo-canvas', '0')) || 0,
    fontMono: g('--font-mono', d.fontMono),
  };
}

/** Colour of a pattern yarn: the token for a known name (Rose, Teal, ...), else the pattern's own hex. */
export function yarnColor(yarn) {
  if (!yarn) return palette.yarns.teal;
  const key = String(yarn.name || '').toLowerCase();
  return palette.yarns[key] || yarn.color;
}
function yarnOf(game, s) { return yarnColor(game.pattern.yarns[s.yarn] || game.pattern.yarns[0]); }

// ---------------------------------------------------------------- colour maths (sRGB)
const WARM_DARK = [42, 22, 8];
const WARM_LIGHT = [255, 247, 232];
function rgb(c) {
  if (!c) return [0, 0, 0];
  const s = String(c).trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/[\d.]+/g);
  if (m && m.length >= 3) return m.slice(0, 3).map(Number);
  return [0, 0, 0];
}
function css([r, g, b], a = 1) { return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`; }
function mixTo(c, to, f) { const a = rgb(c); return a.map((v, i) => v + (to[i] - v) * f); }
function darken(c, f) { return css(mixTo(c, WARM_DARK, f)); }
function lighten(c, f) { return css(mixTo(c, WARM_LIGHT, f)); }
function alpha(c, a) { return css(rgb(c), a); }
function mixColors(a, b, f) { return css(mixTo(a, rgb(b), f)); }
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const easeOut = (p) => 1 - (1 - p) ** 3;

// ---------------------------------------------------------------- layout
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
  const width = PAD * 2 + MARGIN * 2 + cols * CELL + BALL_ROOM;
  const fabricHeight = rows.reduce((s, r) => s + r.height, 0);
  const height = PAD * 2 + HOOK_ROOM + fabricHeight;
  let y = height - PAD;
  rows.forEach((r) => { r.y = y; y -= r.height; });
  const left = PAD + MARGIN + ((cols - rows[0].slots) * CELL) / 2;
  return { rows, cols, width, height, left, pad: PAD, margin: MARGIN, ballRoom: BALL_ROOM, hookRoom: HOOK_ROOM };
}

/** x of slot k in row r. Even rows run left to right, odd rows right to left (the work is turned). */
function slotX(lay, r, k) {
  const row = lay.rows[r];
  const idx = r % 2 === 0 ? k : row.slots - 1 - k;
  return lay.left + idx * CELL;
}

/** Where a turning chain sits: in the margin at the row's start edge. */
function turningEdge(lay, r) {
  const row = lay.rows[r];
  return r % 2 === 0 ? lay.left - CELL * 0.85 : lay.left + row.slots * CELL - CELL * 0.15;
}

/** Position and size for the next placed stitch in row r given what is already placed. */
export function nextPosition(lay, r, placed) {
  const row = lay.rows[r];
  const nonCh = placed.filter((s) => s.st !== 'ch' || row.foundation).length;
  const turning = placed.length - nonCh;
  return { x: slotX(lay, r, Math.min(nonCh, row.slots)), y: row.y, turningIndex: turning, dir: r % 2 === 0 ? 1 : -1 };
}

/** Geometry of the i-th placed stitch in row r: base-left corner (x, y), cell width w, stitch height h. */
export function stitchGeometry(lay, r, placed, i) {
  const row = lay.rows[r];
  let slot = 0; let turning = 0;
  for (let j = 0; j < i; j += 1) {
    if (placed[j].st === 'ch' && !row.foundation) turning += 1; else slot += 1;
  }
  const s = placed[i];
  const dir = r % 2 === 0 ? 1 : -1;
  if (s.st === 'ch' && !row.foundation) {
    return { x: turningEdge(lay, r), y: row.y - turning * 11, w: CELL, h: STITCHES.ch.height, turning: true, dir };
  }
  return { x: slotX(lay, r, slot), y: row.y, w: CELL, h: STITCHES[s.st].height, turning: false, dir };
}

/** Centre of a placed stitch's top loop (where the next row is worked into and where the hook stands). */
export function stitchAnchor(s, g) {
  const t = s.t || 0;
  const h = g.h * (1 - 0.10 * t);
  const cx = g.x + g.w / 2;
  if (s.st === 'ch') return { x: cx, y: g.y - h / 2 };
  return { x: cx, y: g.y - 0.84 * h + (s.q === 'loose' ? 2 : 0) };
}

// ---------------------------------------------------------------- yarn stroke
/**
 * Stroke a path as a cord of yarn: halo (dark theme only), warm shadow, body, and a soft top
 * highlight. Offsets are in layout px; shadowBlur ignores the transform so it is scaled by k.
 */
function yarnStroke(ctx, path, color, w, o = {}) {
  const k = o.k || 1;
  const a = o.alpha == null ? 1 : o.alpha;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.dashOffset || 0; }
  // Striped (a wrong stitch): the halo, shadow and a dark underlay run solid, so the stitch keeps its
  // whole shape, and the body and highlight are dashed over it in square-ended stripes.
  const solid = () => { if (o.underlay) ctx.setLineDash([]); };
  if (o.halo > 0) {
    ctx.save();
    solid();
    ctx.globalAlpha = a;
    ctx.lineWidth = w + 1.6;
    ctx.strokeStyle = alpha(color, Math.min(1, o.halo));
    ctx.shadowColor = alpha(color, Math.min(1, o.halo * 2));
    ctx.shadowBlur = 10 * k;
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.save();
  solid();
  ctx.globalAlpha = a * 0.5;
  ctx.translate(0.6, 1.7);
  ctx.lineWidth = w + 1;
  ctx.strokeStyle = o.shadowColor || darken(color, 0.6);
  ctx.stroke(path);
  ctx.restore();
  if (o.underlay) {
    ctx.save();
    solid();
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.strokeStyle = o.underlay;
    ctx.stroke(path);
    ctx.restore();
    ctx.lineCap = 'butt';
  }
  if (o.outline) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = w + 3;
    ctx.strokeStyle = o.outline;
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke(path);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = a * (o.highlight == null ? 0.5 : o.highlight);
  ctx.translate(-0.3, -0.24 * w);
  ctx.lineWidth = Math.max(0.8, 0.3 * w);
  ctx.strokeStyle = lighten(color, 0.62);
  ctx.stroke(path);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- glyphs
const CAP_RX = 0.42;  // cap loop half-width / w: neighbouring caps meet, so the row top reads as a chain
const CAP_GAP = 0.36; // half-angle (rad) of the gap at the back of a cap loop

/**
 * Stripes for a wrong stitch's path of length `len`: a whole number of 6:4 stripes of about 10 px,
 * so every path starts and ends on a bright stripe (the 3D wrong stitch's stripe texture in 2D).
 */
function wrongDash(len) {
  const period = len / Math.max(2, Math.round(len / 10));
  return [0.6 * period, 0.4 * period];
}

function jitter(n) { return (((n * 7919) % 13) / 12 - 0.5) * 1.2; }

function ellipseLen(a, b) { return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); }
function pathLen(st, w, h, capRx, capRy) {
  const cap = ellipseLen(capRx, capRy);
  switch (st) {
    case 'ch': return ellipseLen(0.40 * w, 0.36 * h);
    case 'sc': return Math.max(cap, 2.2 * Math.hypot(0.28 * w, 0.64 * h));
    case 'hdc': return Math.max(cap, 0.78 * h);
    case 'dc': return Math.max(cap, 0.8 * h);
    default: return cap;
  }
}

/** Build the yarn paths of a glyph. Base-centre at (cx, y), up is -y. `capOpen`: the next row is
 *  worked into this cap, so it gets the gap at the back where those legs go in. */
function glyphPaths(st, cx, y, w, h, dir, capRx, capRy, capDy, capOpen = false) {
  const body = new Path2D();
  const fills = [];
  let cap = null;
  switch (st) {
    case 'ch':
      body.ellipse(cx, y - h / 2, 0.40 * w, 0.36 * h, 0, 0, TAU);
      break;
    case 'sc':
      body.moveTo(cx - 0.28 * w, y);
      body.quadraticCurveTo(cx - 0.34 * w, y - 0.40 * h, cx, y - 0.64 * h);
      body.quadraticCurveTo(cx + 0.34 * w, y - 0.40 * h, cx + 0.28 * w, y);
      break;
    case 'hdc':
      body.moveTo(cx, y);
      body.bezierCurveTo(cx + 0.06 * w * dir, y - 0.25 * h, cx - 0.06 * w * dir, y - 0.50 * h, cx, y - 0.74 * h);
      break;
    case 'dc':
      body.moveTo(cx, y);
      body.bezierCurveTo(cx + 0.06 * w * dir, y - 0.25 * h, cx - 0.06 * w * dir, y - 0.52 * h, cx, y - 0.76 * h);
      body.moveTo(cx - 0.30 * w * dir, y - 0.40 * h);
      body.lineTo(cx + 0.30 * w * dir, y - 0.56 * h);
      break;
    case 'bo':
      fills.push(
        [cx - 0.18 * w, y - 0.42 * h, 0.30 * w, 0.36 * h],
        [cx + 0.18 * w, y - 0.42 * h, 0.30 * w, 0.36 * h],
        [cx, y - 0.46 * h, 0.30 * w, 0.40 * h],
      );
      break;
    default:
      break;
  }
  if (st !== 'ch') {
    // Worked into: a short gap at the back (top) of the loop, where the next row's legs go in, so a
    // column of caps reads as a chain of loops rather than a stack of O-rings. Nothing is worked into
    // the row on the hook yet: its caps are whole loops (two facing curls would read as rams' horns).
    cap = new Path2D();
    if (capOpen) cap.ellipse(cx, y - 0.84 * h + capDy, capRx, capRy, 0, -Math.PI / 2 + CAP_GAP, (3 * Math.PI) / 2 - CAP_GAP);
    else cap.ellipse(cx, y - 0.84 * h + capDy, capRx, capRy, 0, 0, TAU);
  }
  return { body: st === 'bo' ? null : body, fills, cap };
}

/** A brick sewing pin pushed into a wrong stitch at (px, py), head up-left of the entry point. */
function drawPin(ctx, px, py, pal, k, scale = 1, a = 1, headR = 3.75) {
  const ang = (35 * Math.PI) / 180;
  const hx = px - 14 * Math.sin(ang) * scale;
  const hy = py - 14 * Math.cos(ang) * scale;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = alpha(pal.ink, 0.85);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = pal.bad;
  ctx.shadowColor = `rgba(${pal.shadowInk},.35)`;
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetY = 1.5 * k;
  ctx.beginPath(); ctx.arc(hx, hy, headR * scale, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  const d = 1.7 * (headR / 3.75) * scale;
  ctx.beginPath();
  ctx.moveTo(hx - d, hy - d); ctx.lineTo(hx + d, hy + d);
  ctx.moveTo(hx + d, hy - d); ctx.lineTo(hx - d, hy + d);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a single stitch glyph. `g` = { x, y, w, h, dir } with (x, y) the base-left corner on the row
 * baseline; `color` the yarn. `opts` = { k, palette, halo, progress (0..1 pen-stroke draw-in),
 * anim: { kind: 'place' | 'frog', elapsed }, capOpen (the next row is worked into its cap) }.
 */
export function drawStitch(ctx, s, g, color, opts = {}) {
  const k = opts.k || 1;
  const pal = opts.palette || palette;
  const halo = opts.halo == null ? pal.halo : opts.halo;
  const t = s.t || 0;
  const q = s.wrong ? 'wrong' : (s.q || 'neat');
  const w = g.w * (1 - 0.24 * t);
  const h = g.h * (1 - 0.10 * t);
  const dir = g.dir || 1;
  const y = g.y;
  let cx = g.x + g.w / 2;
  if (q === 'neat') cx += jitter(s.n || 0);

  let col = color; let lw = 5.2; let a = 1; let dash = null; let dashOffset = 0; let shadowColor = null;
  let capRx = CAP_RX * w; let capRy = clamp(0.13 * h, 3.4, 4.8); let capDy = 0; let rot = 0; let haloMul = 1;
  if (q === 'wrong') { col = pal.bad; shadowColor = darken(pal.bad, 0.6); haloMul = 1.3; }
  else if (q === 'loose') { col = lighten(color, 0.12); a = 0.82; lw = 4.7; rot = 0.14 * t; capDy = 2; capRy += 1.5; }
  else if (q === 'tight') { col = darken(color, 0.22); lw = 5.6; rot = 0.14 * t; capRx *= 0.82; }
  else if (q === 'ok') { col = t < 0 ? lighten(color, 0.07) : darken(color, 0.07); }

  // Motion: pen-stroke draw-in, then a settle that depends on the quality.
  const anim = opts.anim;
  let drawIn = opts.progress == null ? 1 : clamp(opts.progress);
  let scale = 1; let sy = 1; let dx = 0; let dy = 0; let hi = 0.5; let pinScale = 1; let pinAlpha = 1; let slackAlpha = 1;
  if (anim && anim.kind === 'place') {
    const e = anim.elapsed;
    drawIn = clamp(e / 140);
    const dur = { neat: 120, ok: 160, loose: 200, tight: 120, wrong: 160 }[q] || 140;
    const p = clamp((e - 140) / dur);
    const eo = easeOut(p);
    if (q === 'neat') { scale = 1.08 - 0.08 * eo; hi = 0.5 + 0.4 * Math.sin(Math.PI * p); }
    else if (q === 'ok') { dx = 2 * Math.sin(TAU * p) * (1 - p); }
    else if (q === 'loose') { sy = 0.9 + 0.1 * eo; capDy += 2 * (1 - eo); slackAlpha = clamp((p - 0.75) / 0.25); }
    else if (q === 'tight') { dy = e >= 140 && p < 0.25 ? -1 : 0; }
    else if (q === 'wrong') {
      pinScale = 1.6 - 0.6 * eo;
      if (e < WRONG_LIVE_MS) haloMul += 0.6 * Math.abs(Math.sin((e / 700) * Math.PI)); // the halo pulses twice (dark theme)
    }
  } else if (anim && anim.kind === 'frog') {
    const e = anim.elapsed;
    drawIn = 1 - clamp(e / 180);
    const pp = clamp(e / 160);
    pinScale = pp < 0.5 ? 1 + 0.8 * pp : 1.4 * (1 - (pp - 0.5) * 2);
    pinAlpha = 1 - pp;
    slackAlpha = 1 - pp;
  }
  if (drawIn < 1 && q !== 'wrong') {
    const len = pathLen(s.st, w, h, capRx, capRy);
    dash = [len, len];
    dashOffset = len * (1 - drawIn);
  }
  if (q === 'wrong' && drawIn < 1) a *= Math.max(0.15, drawIn);

  ctx.save();
  ctx.translate(cx + dx, y + dy);
  ctx.rotate(rot);
  ctx.scale(scale, scale * sy);
  ctx.translate(-cx, -y);

  const capOpen = !!opts.capOpen;
  const paths = glyphPaths(s.st, cx, y, w, h, dir, capRx, capRy, capDy, capOpen);
  const so = { k, alpha: a, dash, dashOffset, halo: halo * haloMul, shadowColor, highlight: hi };
  // the cap's highlight is quieter than the body's, so the row top is not a string of glossy beads
  const capSo = { ...so, highlight: hi * 0.6 };
  if (q === 'wrong') {
    const under = darken(pal.bad, 0.45);
    Object.assign(so, { dash: wrongDash(pathLen(s.st, w, h, capRx, capRy)), underlay: under });
    Object.assign(capSo, { dash: wrongDash(ellipseLen(capRx, capRy) * (capOpen ? 1 - CAP_GAP / Math.PI : 1)), underlay: under });
  }

  // Bobble puffs are the only filled shapes, so they pop forward as they do in real fabric.
  paths.fills.forEach(([ex, ey, rx, ry]) => {
    const p = new Path2D();
    p.ellipse(ex, ey, rx, ry, 0, 0, TAU);
    ctx.save();
    ctx.globalAlpha = a * drawIn;
    const grd = ctx.createRadialGradient(ex - rx * 0.4, ey - ry * 0.5, 1, ex, ey, rx * 1.35);
    grd.addColorStop(0, lighten(col, 0.45));
    grd.addColorStop(0.6, col);
    grd.addColorStop(1, darken(col, 0.22));
    ctx.fillStyle = grd;
    ctx.shadowColor = `rgba(${pal.shadowInk},.35)`;
    ctx.shadowBlur = 3 * k;
    ctx.shadowOffsetY = 1.5 * k;
    ctx.fill(p);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = darken(col, 0.22);
    if (q === 'wrong') ctx.setLineDash(wrongDash(ellipseLen(rx, ry)));
    ctx.stroke(p);
    if (halo * haloMul > 0) {
      ctx.strokeStyle = alpha(col, halo * haloMul); ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 10 * k; ctx.stroke(p);
    }
    ctx.restore();
  });
  if (paths.body) yarnStroke(ctx, paths.body, col, lw, so);
  if (paths.cap) yarnStroke(ctx, paths.cap, col, lw * 0.85, capSo);
  if (q === 'loose' && slackAlpha > 0) {
    const slack = new Path2D();
    slack.ellipse(cx - 0.18 * w, y + 1, 5, 3, -0.4, 0, TAU);
    yarnStroke(ctx, slack, col, 3.2, { ...so, alpha: a * slackAlpha, dash: null, underlay: null });
  }
  ctx.restore();

  // a bigger pin head when the mat is drawn small (a phone), so the error is never a few red pixels
  if (q === 'wrong' && pinAlpha > 0) drawPin(ctx, cx - 0.22 * w, y - 0.9 * h, pal, k, pinScale, pinAlpha, opts.small ? 4.5 : 3.75);
}

// ---------------------------------------------------------------- hook, loop, ball, knot
/** The hook's J, in hook space: crook open to the left. */
function throatPath() {
  const throat = new Path2D();
  throat.moveTo(0, -10);
  throat.quadraticCurveTo(0, 4, -7, 2);
  throat.quadraticCurveTo(-11, 1, -9, -5);
  return throat;
}

/** The J of the crook, drawn last of the hook (over the stitch on the hook, under the loop's front
 *  strand), outlined in --hook-3 so it separates from the yarn round it (brief 6.5: always visible). */
function drawThroat(ctx, x, y, pal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(HOOK_ANGLE);
  const head = ctx.createLinearGradient(-11, 0, 2, 0);
  head.addColorStop(0, pal.hook[0]);
  head.addColorStop(0.55, pal.hook[1]);
  head.addColorStop(1, pal.hook[2]);
  const throat = throatPath();
  ctx.lineCap = 'round';
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = pal.hook[2];
  ctx.stroke(throat);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = head;
  ctx.stroke(throat);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,247,232,.7)';                               // lit edge
  ctx.beginPath(); ctx.moveTo(-1.4, -6); ctx.quadraticCurveTo(-1.6, 1.6, -6.6, 0.4); ctx.stroke();
  ctx.restore();
}

/** Beech hook, pivot at the throat (x, y), leaning 30 degrees to the right: the shaft, thumb rest and
 *  the shadow of the whole hook (drawThroat() then draws the J itself on top). */
function drawHook(ctx, x, y, pal, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(HOOK_ANGLE);
  const grd = ctx.createLinearGradient(-3.5, 0, 3.5, 0);
  grd.addColorStop(0, pal.hook[0]);
  grd.addColorStop(0.5, pal.hook[1]);
  grd.addColorStop(1, pal.hook[2]);
  const head = ctx.createLinearGradient(-11, 0, 2, 0);
  head.addColorStop(0, pal.hook[0]);
  head.addColorStop(0.55, pal.hook[1]);
  head.addColorStop(1, pal.hook[2]);
  const edge = alpha(pal.hook[2], 0.6);
  const throat = throatPath();
  const shaft = new Path2D(); shaft.roundRect(-3.5, -70, 7, 62, 3.5);
  const rest = new Path2D(); rest.roundRect(-5, -50, 10, 16, 4.5);
  // blurred shadow on the mat
  ctx.save();
  ctx.shadowColor = `rgba(${pal.shadowInk},.28)`;
  ctx.shadowBlur = 7 * k;
  ctx.shadowOffsetX = 4 * k;
  ctx.shadowOffsetY = 6 * k;
  ctx.fillStyle = grd;
  ctx.fill(shaft); ctx.fill(rest);
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = head;
  ctx.stroke(throat);
  ctx.restore();
  // a hairline edge so the pale lit side still reads on the linen
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = edge;
  ctx.stroke(shaft); ctx.stroke(rest);
  ctx.fillStyle = grd;
  ctx.fill(shaft); ctx.fill(rest);
  ctx.strokeStyle = alpha(pal.hook[2], 0.22);                             // grain
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1.6, -66); ctx.lineTo(-1.2, -12);
  ctx.moveTo(1.2, -62); ctx.lineTo(1.6, -16);
  ctx.moveTo(-3.6, -48); ctx.lineTo(-3.4, -36);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,247,232,.7)';                               // lit edge
  ctx.beginPath(); ctx.moveTo(-2.6, -67); ctx.lineTo(-2.6, -11); ctx.stroke();
  ctx.fillStyle = alpha(pal.hook[2], 0.55);                               // size mark
  ctx.font = `600 6px ${pal.fontMono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(0.3, -25); ctx.rotate(-Math.PI / 2); ctx.fillText('5 mm', 0, 0); ctx.restore();
  ctx.restore();
}

/** Loop geometry in hook space: it rides the shaft above the throat, its lower edge clear of the
 *  bottom of the J, so the crook stays visible. */
function loopShape(prog) {
  const rx = 6 + 9 * prog;
  const ry = 9.5 + 14.5 * prog;
  return { rx, ry, cx: 0.5, cy: -9 - ry * 0.82 };
}

/** The working loop around the throat; `half` = 'back' (behind the hook) or 'front'. */
function drawLoop(ctx, x, y, color, prog, zone, pal, k, half) {
  const { rx, ry, cx, cy } = loopShape(prog);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(HOOK_ANGLE);
  const p = new Path2D();
  if (half === 'back') p.ellipse(cx, cy, rx, ry, 0, Math.PI / 2, (3 * Math.PI) / 2);
  else p.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
  let col = color; let outline = null;
  if (zone === 'neat') outline = pal.neat;
  else if (zone && zone !== 'ok') col = mixColors(color, pal.surface3, 0.35);
  yarnStroke(ctx, p, col, 4.6, { k, halo: pal.halo, outline });
  ctx.restore();
}

/** World position of the loop's right edge, where the working yarn leaves it. */
function loopEdge(hx, hy, prog) {
  const { rx, cx, cy } = loopShape(prog);
  const lx = cx + rx; const ly = cy + 4;
  const c = Math.cos(HOOK_ANGLE); const s = Math.sin(HOOK_ANGLE);
  return { x: hx + lx * c - ly * s, y: hy + lx * s + ly * c };
}

/** [rotation deg, tilt deg, centre offset x / r, y / r] of the ball's wound strands. */
const BALL_WRAPS = [[0, 20, 0.06, -0.08], [32, 65, -0.1, 0.04], [64, 35, 0.08, 0.1], [100, 85, -0.04, -0.1], [134, 50, 0.1, 0.02], [166, 75, -0.08, 0.08]];

function drawBall(ctx, cx, cy, r, color, pal, k, roll = 0) {
  ctx.save();
  // soft shadow on the mat
  ctx.save();
  ctx.translate(cx + 4, cy + r * 0.85);
  ctx.scale(1.1, 0.42);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  sh.addColorStop(0, `rgba(${pal.shadowInk},.3)`);
  sh.addColorStop(1, `rgba(${pal.shadowInk},0)`);
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();
  if (pal.halo > 0) {
    ctx.save();
    ctx.strokeStyle = alpha(color, pal.halo);
    ctx.lineWidth = 1.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * k;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  const grd = ctx.createRadialGradient(cx - 0.35 * r, cy - 0.35 * r, r * 0.1, cx, cy, r * 1.05);
  grd.addColorStop(0, lighten(color, 0.35));
  grd.addColorStop(0.55, color);
  grd.addColorStop(1, darken(color, 0.30));
  ctx.fillStyle = grd;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.lineCap = 'round';
  // Six wound strands, each a great circle seen at its own tilt (so its own minor radius) and a
  // little off-centre; only the front half of each is drawn, so wraps cross the middle of the ball.
  BALL_WRAPS.forEach(([deg, tilt, ox, oy]) => {
    const ang = (deg * Math.PI) / 180 + roll;
    const ry = r * 1.04 * Math.abs(Math.cos((tilt * Math.PI) / 180));
    const ex = cx + ox * r; const ey = cy + oy * r;
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = css(mixTo(color, WARM_DARK, 0.5), 0.34);
    ctx.beginPath(); ctx.ellipse(ex, ey + 1.5, r * 1.04, ry, ang, 0, Math.PI); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = css(mixTo(color, WARM_LIGHT, 0.62), 0.5);
    ctx.beginPath(); ctx.ellipse(ex, ey - 1.5, r * 1.04, ry, ang, 0, Math.PI); ctx.stroke();
  });
  const gloss = ctx.createRadialGradient(cx - 0.45 * r, cy - 0.5 * r, 1, cx - 0.3 * r, cy - 0.3 * r, 0.9 * r);
  gloss.addColorStop(0, 'rgba(255,247,232,.45)');
  gloss.addColorStop(1, 'rgba(255,247,232,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.restore();
}

function drawSlipKnot(ctx, x, y, color, k, pal) {
  const p = new Path2D();
  p.ellipse(x, y, 7, 5, 0, 0, TAU);
  p.moveTo(x - 5, y + 3);
  p.lineTo(x - 9, y + 8);
  yarnStroke(ctx, p, color, 4.4, { k, halo: pal.halo });
}

// ---------------------------------------------------------------- mat and fabric
/** Gauge grid on the blocking mat: a dot per column per row baseline and a hairline per row. */
function drawMat(ctx, lay, pal) {
  ctx.save();
  ctx.fillStyle = alpha(pal.ink, 0.10);
  ctx.strokeStyle = alpha(pal.ink, 0.06);
  ctx.lineWidth = 1;
  const x0 = lay.left; const x1 = lay.left + lay.cols * CELL;
  lay.rows.forEach((row) => {
    ctx.beginPath(); ctx.moveTo(x0 - MARGIN * 0.6, row.y + 0.5); ctx.lineTo(x1 + MARGIN * 0.6, row.y + 0.5); ctx.stroke();
    for (let c = 0; c < lay.cols; c += 1) {
      ctx.beginPath(); ctx.arc(x0 + c * CELL + CELL / 2, row.y, 0.9, 0, TAU); ctx.fill();
    }
  });
  ctx.restore();
}

function fabricShadowPath(game, lay) {
  const p = new Path2D();
  let any = false;
  game.rows.forEach((placed, r) => {
    const row = lay.rows[r];
    const xs = [];
    placed.forEach((s, i) => { const g = stitchGeometry(lay, r, placed, i); if (!g.turning) xs.push(g.x); });
    if (!xs.length) return;
    any = true;
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    p.roundRect(minX - 4, row.y - row.height - 2, maxX - minX + CELL + 8, row.height + 6, 6);
  });
  return any ? p : null;
}

const states = new WeakMap();
function stateFor(game) {
  let s = states.get(game);
  if (!s) { s = { hook: null, cache: null, cacheKey: '', lastTime: 0 }; states.set(game, s); }
  return s;
}

/** Hook position in layout px (used by the UI to keep the toast off the hook). */
export function getHookPosition(game) { return game ? stateFor(game).hook : null; }

/** The placed fabric cached on an offscreen canvas; only animating stitches are left out. */
function fabricLayer(game, lay, pal, k, skipN, small) {
  const st = stateFor(game);
  const key = [paletteVersion, k.toFixed(4), lay.width, lay.height, game.rows.map((r) => r.length).join(','), skipN == null ? '' : skipN, small ? 's' : ''].join('|');
  if (st.cacheKey === key && st.cache) return st.cache;
  const W = Math.max(1, Math.ceil(lay.width * k)); const H = Math.max(1, Math.ceil(lay.height * k));
  let c = st.cache;
  if (!c) { c = document.createElement('canvas'); st.cache = c; }
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const cx = c.getContext('2d');
  cx.setTransform(k, 0, 0, k, 0, 0);
  cx.clearRect(0, 0, lay.width, lay.height);
  const sp = fabricShadowPath(game, lay);
  if (sp) {
    // Soft drop shadow under the piece. Only the shadow is painted (the shape itself is drawn far
    // off-canvas and its shadow offset back), then it is knocked out under the piece with a
    // feathered edge, so the mat shows through the holes and there is no hard paper-like rim.
    const OFF = 4000;
    cx.save();
    cx.shadowColor = `rgba(${pal.shadowInk},.32)`;
    cx.shadowBlur = 16 * k;
    cx.shadowOffsetX = OFF * k;
    cx.shadowOffsetY = 9 * k;
    cx.fillStyle = '#000';
    cx.translate(-OFF, 0);
    cx.fill(sp);
    cx.restore();
    cx.save();
    cx.globalCompositeOperation = 'destination-out';
    if ('filter' in cx) cx.filter = `blur(${4 * k}px)`;
    cx.fill(sp);
    cx.restore();
    // the halo is deeper than the bottom padding: fade it out before the canvas edge cuts it off
    cx.save();
    cx.globalCompositeOperation = 'destination-in';
    const fade = cx.createLinearGradient(0, lay.height - PAD + 2, 0, lay.height - 1);
    fade.addColorStop(0, '#000');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = fade;
    cx.fillRect(0, 0, lay.width, lay.height);
    cx.restore();
  }
  game.rows.forEach((placed, r) => {
    // columns of the next row that have a stitch worked into this row's caps (turning chains do not)
    const above = new Set();
    const next = game.rows[r + 1] || [];
    next.forEach((s, i) => {
      if (s.wrong) return;
      const g = stitchGeometry(lay, r + 1, next, i);
      if (!g.turning) above.add(Math.round(g.x));
    });
    placed.forEach((s, i) => {
      if (skipN != null && s.n === skipN) return;
      const g = stitchGeometry(lay, r, placed, i);
      drawStitch(cx, s, g, yarnOf(game, s), { k, palette: pal, small, capOpen: !g.turning && above.has(Math.round(g.x)) });
    });
  });
  st.cacheKey = key;
  return c;
}

/** The union of the placed rows' rects (as for the drop shadow), cached per fabric state. */
function fabricRegion(game, lay) {
  const st = stateFor(game);
  const key = `${lay.width}|${game.rows.map((r) => r.length).join(',')}`;
  if (st.regionKey !== key) { st.region = fabricShadowPath(game, lay); st.regionKey = key; }
  return st.region;
}

function findStitch(game, lay, n) {
  for (let r = game.rows.length - 1; r >= 0; r -= 1) {
    const placed = game.rows[r];
    for (let i = placed.length - 1; i >= 0; i -= 1) {
      if (placed[i].n === n) return { s: placed[i], g: stitchGeometry(lay, r, placed, i) };
    }
  }
  return null;
}

/** Where the hook stands: in the top loop of the last stitch made. */
function hookAnchor(game, lay) {
  const step = game.step;
  let r = step ? step.row : game.rows.length - 1;
  if (!step) { while (r > 0 && !game.rows[r].length) r -= 1; }
  const placed = game.rows[r];
  if (placed.length) {
    const i = placed.length - 1;
    return { ...stitchAnchor(placed[i], stitchGeometry(lay, r, placed, i)), slip: false };
  }
  if (r > 0 && game.rows[r - 1].length) {
    const prev = game.rows[r - 1]; const i = prev.length - 1;
    return { ...stitchAnchor(prev[i], stitchGeometry(lay, r - 1, prev, i)), slip: false };
  }
  return { x: slotX(lay, r, 0) + CELL / 2, y: lay.rows[r].y - STITCHES.ch.height / 2, slip: true };
}

/** Where the next stitch's top loop will be, which the hook glides toward during a hold. */
function holdTarget(game, lay, step) {
  const r = step.row; const placed = game.rows[r]; const row = lay.rows[r];
  const pos = nextPosition(lay, r, placed);
  if (step.st === 'ch' && !row.foundation) {
    return { x: turningEdge(lay, r) + CELL / 2, y: row.y - pos.turningIndex * 11 - STITCHES.ch.height / 2 };
  }
  const h = STITCHES[step.st].height;
  return { x: pos.x + CELL / 2, y: row.y - (step.st === 'ch' ? h / 2 : 0.84 * h) };
}

function bez(p0, c1, c2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
}

/**
 * Draw the whole scene.
 * frame = { time, hold: null | { progress 0..1, zone }, yarnColor, k (device scale), reduced,
 *           fx: { place: { n, at } | null, frog: { at, s, g } | null, yarn: { at, from, to } | null } }
 */
export function draw(ctx, game, lay, frame) {
  const pal = frame.palette || palette;
  const k = frame.k || 1;
  const time = frame.time || 0;
  const fx = frame.fx || {};
  const reduced = !!frame.reduced;
  // css px per layout px (k without the device pixel ratio): under ~0.8 the mat is phone-sized
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const small = k / dpr < 0.8;
  const st = stateFor(game);
  const dt = st.lastTime ? clamp(time - st.lastTime, 0, 100) : 16;
  st.lastTime = time;

  ctx.clearRect(0, 0, lay.width, lay.height);
  drawMat(ctx, lay, pal);

  const step = game.step;
  const active = game.active;
  const yc = frame.yarnColor || yarnOf(game, { yarn: game.currentYarn });

  // Hook: anchored in the top loop of the last stitch; glides toward the next slot while holding.
  const anchor = hookAnchor(game, lay);
  let target = { x: anchor.x, y: anchor.y };
  let dip = 0;
  const hold = frame.hold;
  if (hold && active && step && step.type === 'stitch') {
    const nt = holdTarget(game, lay, step);
    const p = hold.progress * 0.6;
    target = { x: anchor.x + (nt.x - anchor.x) * p, y: anchor.y + (nt.y - anchor.y) * p };
    dip = 9 * hold.progress;
  }
  if (!st.hook || reduced) st.hook = { x: target.x, y: target.y };
  else {
    const f = 1 - Math.exp(-dt / 70);
    st.hook.x += (target.x - st.hook.x) * f;
    st.hook.y += (target.y - st.hook.y) * f;
  }
  const dist = Math.hypot(target.x - st.hook.x, target.y - st.hook.y);
  const lift = Math.min(18, dist * 0.12);           // a shallow arc on long slides (turns)
  const bob = reduced ? 0 : Math.sin(time / 320) * 1.5;
  const hx = st.hook.x; const hy = st.hook.y - lift + bob + dip;

  // Ball of yarn by the lower-right corner, shrinking with the yarn left.
  const yarnLeft = clamp(game.yarnLeft / game.yarnTotal);
  const r = Math.min(30, 14 + 16 * yarnLeft);
  const bx = lay.left + lay.cols * CELL + MARGIN + 36;
  const by = lay.rows[0].y - r;
  let ballColor = yc; let roll = 0;
  if (fx.yarn && time - fx.yarn.at < 300 && !reduced) {
    const p = (time - fx.yarn.at) / 300;
    ballColor = mixColors(fx.yarn.from, fx.yarn.to, easeOut(p));
    roll = (p * Math.PI) / 2;
  }

  // Working yarn: from the loop's edge, down and right behind the work, into the ball.
  const loopProg = hold ? hold.progress : 0;
  const edge = loopEdge(hx, hy, loopProg);
  const c1 = { x: edge.x + 0.45 * (bx - edge.x), y: edge.y + 26 };
  const c2 = { x: bx - 28, y: by - r - 36 };
  const end = { x: bx, y: by - r };
  if (active) {
    const wy = new Path2D();
    wy.moveTo(edge.x, edge.y);
    wy.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    // Where it runs behind the fabric it is only glimpsed through the holes: faint and unlit there,
    // so it never reads as a stray strand lying across the work.
    const region = fabricRegion(game, lay);
    if (region) {
      const outside = new Path2D();
      outside.rect(0, 0, lay.width, lay.height);
      outside.addPath(region);
      ctx.save(); ctx.clip(outside, 'evenodd');
      yarnStroke(ctx, wy, ballColor, 4.4, { k, halo: pal.halo });
      ctx.restore();
      ctx.save(); ctx.clip(region);
      yarnStroke(ctx, wy, ballColor, 4.4, { k, alpha: 0.45, highlight: 0 });
      ctx.restore();
    } else yarnStroke(ctx, wy, ballColor, 4.4, { k, halo: pal.halo });
  }

  // The fabric (cached) plus whatever is animating on top of it. A wrong stitch on the hook is drawn
  // over the hook's throat (after the back of the loop and the hook, before the front of the loop),
  // so its red legs and cap are never hidden under the crook.
  const liveMs = fx.place && fx.place.q === 'wrong' ? WRONG_LIVE_MS : PLACE_ANIM_MS;
  const placing = fx.place && time - fx.place.at < liveMs && !reduced ? fx.place : null;
  const curRow = step ? game.rows[step.row] : null;
  const onHook = active && game.blocked && curRow && curRow.length ? curRow[curRow.length - 1] : null;
  const skipN = placing ? placing.n : onHook ? onHook.n : null;
  const layer = fabricLayer(game, lay, pal, k, skipN, small);
  ctx.drawImage(layer, 0, 0, lay.width, lay.height);
  const live = (n) => {
    const found = findStitch(game, lay, n);
    if (!found) return;
    const anim = placing && placing.n === n ? { kind: 'place', elapsed: time - placing.at } : null;
    drawStitch(ctx, found.s, found.g, yarnOf(game, found.s), { k, palette: pal, anim, small });
  };
  if (placing && !(onHook && onHook.n === placing.n)) live(placing.n);
  if (fx.frog && time - fx.frog.at < FROG_ANIM_MS && !reduced && fx.frog.s) {
    const e = time - fx.frog.at;
    const fcol = yarnOf(game, fx.frog.s);
    drawStitch(ctx, fx.frog.s, fx.frog.g, fcol, { k, palette: pal, anim: { kind: 'frog', elapsed: e }, small });
    const p = clamp(e / FROG_ANIM_MS);
    const pt = bez(edge, c1, c2, end, p);
    const curl = new Path2D();
    curl.ellipse(pt.x, pt.y, 7, 4, p * 3, 0, TAU);
    yarnStroke(ctx, curl, fcol, 3.4, { k, halo: pal.halo, alpha: 1 - p * 0.5 });
  }

  if (anchor.slip && active) drawSlipKnot(ctx, anchor.x, anchor.y, yc, k, pal);
  drawBall(ctx, bx, by, r, ballColor, pal, k, roll);

  if (active) {
    const zone = hold ? hold.zone : null;
    drawLoop(ctx, hx, hy, yc, loopProg, zone, pal, k, 'back');
    drawHook(ctx, hx, hy, pal, k);
    if (onHook) live(onHook.n);
    drawThroat(ctx, hx, hy, pal); // over the stitch on the hook's cap: the J always shows
    drawLoop(ctx, hx, hy, yc, loopProg, zone, pal, k, 'front');
  } else if (game.status === 'done') {
    // Fastened off: a short tail of yarn is left at the last loop.
    const tail = new Path2D();
    tail.moveTo(anchor.x, anchor.y);
    tail.quadraticCurveTo(anchor.x + 10, anchor.y - 14, anchor.x + 18, anchor.y - 6);
    yarnStroke(ctx, tail, yc, 4.4, { k, halo: pal.halo });
  }
}

/** "How to read your fabric": a 5 x 4 matrix of glyphs (ch sc hdc dc bo x neat loose tight wrong). */
export function drawGuide(canvas, pal = palette) {
  const W = 360; const H = 200;
  const cssW = canvas.clientWidth || W;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const k = dpr * (cssW / W);
  const w = Math.round(W * k); const h = Math.round(H * k);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cols = ['ch', 'sc', 'hdc', 'dc', 'bo'];
  const colours = [pal.yarns.teal, pal.yarns.rose, pal.yarns.mustard, pal.yarns.lavender, pal.yarns.teal];
  const rows = [
    { label: 'neat', t: 0, q: 'neat' },
    { label: 'loose', t: -0.9, q: 'loose' },
    { label: 'tight', t: 0.9, q: 'tight' },
    { label: 'wrong', t: 0, q: 'wrong', wrong: true },
  ];
  const labelW = 46; const top = 18;
  const cw = (W - labelW) / cols.length; const rh = (H - top) / rows.length;
  ctx.font = `600 11px ${pal.fontMono}`;
  ctx.fillStyle = pal.muted;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  cols.forEach((st, c) => ctx.fillText(st, labelW + c * cw + cw / 2, 8));
  ctx.textAlign = 'left';
  rows.forEach((row, ri) => {
    const y = top + ri * rh + rh * 0.86;
    ctx.fillStyle = pal.muted;
    ctx.fillText(row.label, 4, top + ri * rh + rh / 2);
    cols.forEach((st, c) => {
      const g = { x: labelW + c * cw + cw / 2 - CELL / 2, y, w: CELL, h: STITCHES[st].height, dir: 1 };
      drawStitch(ctx, { st, t: row.t, q: row.q, wrong: !!row.wrong, n: ri * 5 + c }, g, colours[c], { k, palette: pal });
    });
  });
}
