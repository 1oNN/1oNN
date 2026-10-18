// Stitch path builders for the 3D view. Pure: no three.js, no DOM. Every stitch is one or more
// yarn paths (point lists in cell units) that a TubeGeometry is swept along. Coordinates are
// relative to the stitch's base centre: x along the row, y up off the mat, z toward the viewer,
// so "up the stitch" (toward the next row) is -z. `dir` mirrors sc/dc/bobble for turned rows.
import { STITCHES } from '../patterns.js';

export const R = 0.1;                         // yarn tube radius in cells (3 px at the 2D scale; brief 0.087, a touch plumper to read as fabric)
/** Leg ends sit just under the tube centre line, so they pass beneath the cap below (at y = R) but
 *  never cut into the mat (y = 0), where an open tube end would show as a hollow sliver. */
const FOOT = 0.2 * R;
export const TILT = (35 * Math.PI) / 180;     // cap loops lean 35 deg off the mat
const TAU = Math.PI * 2;

/** Loose stitches are wider and squatter, tight ones narrower and taller (same numbers as 2D). */
export function tensionScales(t) {
  return { wScale: 1 - 0.24 * t, hScale: 1 - 0.10 * t };
}

function ellipse(n, fn) {
  const pts = [];
  for (let i = 0; i < n; i += 1) pts.push(fn((i / n) * TAU));
  return pts;
}

/**
 * A closed loop shaped like a chain link (a stadium: two half-circles of radius b joined by straight
 * sides), half-length a along x and half-width b across, sampled evenly by arc length. Unlike an
 * ellipse its tightest bend is b, never b^2/a, so a tube of radius R (< b) never folds through itself
 * at the ends. Returns n points [u, v] with u along the length and v across, starting at (a, 0).
 */
function stadium(n, a, b) {
  const r = Math.min(b, a);
  const flat = 2 * (a - r);
  const per = 2 * flat + TAU * r;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    let d = (i / n) * per;
    // walk: right half-circle (centre a - r), top straight (right to left), left half-circle, bottom straight
    const seg1 = Math.PI * r;
    if (d < seg1 / 2) { const t = d / r; pts.push([a - r + r * Math.cos(t), r * Math.sin(t)]); continue; }
    d -= seg1 / 2;
    if (d < flat) { pts.push([a - r - d, r]); continue; }
    d -= flat;
    if (d < seg1) { const t = Math.PI / 2 + d / r; pts.push([-(a - r) + r * Math.cos(t), r * Math.sin(t)]); continue; }
    d -= seg1;
    if (d < flat) { pts.push([-(a - r) + d, -r]); continue; }
    d -= flat;
    const t = -Math.PI / 2 + d / r; pts.push([a - r + r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

/** The "top two loops" every stitch but a chain ends in; the next row is worked into it. */
function capLoop(w, h, { sag = 0, pinch = 1, lift = 0 }) {
  const a = 0.37 * w * pinch;                 // neighbouring caps nearly touch, so the row top reads as a chain of V's
  const b = Math.max(0.14 * h, 1.6 * R) + sag * 0.05; // >= 1.3 R everywhere: the ends never crease
  const cy = R + lift;
  const cz = -0.84 * h + sag * 0.08;
  return {
    pts: stadium(18, a, b).map(([u, v]) => [u, cy + v * Math.sin(TILT), cz + v * Math.cos(TILT)]),
    closed: true,
    segs: 28,
    centre: [0, cy, cz],
  };
}

function chain(w, h, lift) {
  const a = 0.40 * w; const b = Math.max(0.36 * h, 1.5 * R);
  const pts = stadium(18, a, b).map(([u, v]) => {
    const th = Math.atan2(v / b, u / a);       // where on the loop, for the strand crossing over itself once
    return [u, R + lift + 0.45 * R * Math.sin(2 * th), -0.5 * h + v];
  });
  return { pts, closed: true, segs: 28, centre: [0, R + lift, -0.5 * h] };
}

function single(w, h, dir, dipZ, loose) {
  const bow = 0.06 + (loose ? 0.06 : 0);
  const apexY = Math.max(0.9 * R, 1.6 * R - (loose ? 0.06 : 0));
  const apexZ = -0.64 * h;
  // the apex is a rounded turn (radius ~2.4 R), not a point, so the tube never pinches there
  const pts = [
    [-0.28 * w, FOOT, dipZ],
    [-0.28 * w - bow, 0.6 * R, -0.3 * h],
    [-0.14 * w, 1.3 * R, apexZ + 0.07 * h],
    [0, apexY, apexZ],
    [0.14 * w, 1.3 * R, apexZ + 0.07 * h],
    [0.28 * w + bow, 0.6 * R, -0.3 * h],
    [0.28 * w, FOOT, dipZ],
  ];
  return { pts: pts.map(([x, y, z]) => [x * dir, y, z]), closed: false, segs: 24 };
}

/**
 * A post is the pulled-up loop of the stitch: two strands side by side from the base (dipping into
 * the cap below) up to just under the cap, so hdc/dc rows have the body of real fabric.
 */
function post(w, h, dir, dipZ, topZ) {
  const a = 0.11 * w;
  const pts = [
    [-a, FOOT, dipZ],
    [-a - 0.02, R, -0.22 * h],
    [-a, 1.05 * R, -0.5 * h],
    [-0.55 * a, R, topZ + 0.03 * h],
    [0.55 * a, R, topZ],
    [a, 1.05 * R, -0.5 * h],
    [a + 0.02, R, -0.22 * h],
    [a, FOOT, dipZ],
  ];
  return { pts: pts.map(([x, y, z]) => [x * dir, y, z]), closed: false, segs: 32 };
}

function halfDouble(w, h, dir, dipZ) { return post(w, h, dir, dipZ, -0.74 * h); }

function doublePost(w, h, dir, dipZ) { return post(w, h, dir, dipZ, -0.76 * h); }

/** One yarn-over wrap: a single helix turn around the post between 0.40h and 0.56h. */
function wrap(w, h, dir, turns = 1) {
  const n = 10 * turns;
  const rx = 0.11 * w + 1.6 * R; const ry = 1.35 * R;
  const pts = [];
  for (let k = 0; k <= n; k += 1) {
    const a = (k / n) * TAU * turns + Math.PI / 2;
    // the wrap's two ends tuck in among the post's strands instead of ending in the air beside it
    const tuck = 0.3 + 0.7 * Math.sin((Math.PI * k) / n);
    pts.push([dir * rx * tuck * Math.sin(a), 1.05 * R + ry * tuck * Math.cos(a), -(0.40 + 0.16 * (k / n)) * h]);
  }
  return { pts, closed: false, segs: 16 * turns };
}

/** Bobble loops are plumper than the yarn elsewhere, so their silhouettes merge into one puff. */
export const BOBBLE_R = 1.3 * R;

/**
 * Bobble: four fat loops pulled up side by side over a squashed dome of the same yarn. Each loop is a
 * rounded arch from its own base (spread along the row) to its own point on the near half of the cap,
 * leaning out at its own angle; packed this close their tubes touch, and the dome under them fills
 * the gaps, so the bobble reads as one round puff, not a fan of ribs with the mat between them.
 * Returns { loops, dome: { centre, radii } } in stitch-local units.
 */
function bobble(w, h, dir, dipZ) {
  const loops = [];
  const capZ = -0.84 * h + 0.55 * Math.max(0.14 * h, 1.6 * R);
  [-1.5, -0.5, 0.5, 1.5].forEach((k) => {
    const ang = (k * 30 * Math.PI) / 180;
    const bx = dir * 0.26 * w * Math.sin(ang);              // the arch leans out sideways ...
    const by = 0.42 * w * Math.cos(ang) + 0.05;            // ... and up, so the four make a dome
    const x0 = dir * 0.07 * w * k; const x1 = dir * 0.08 * w * k;
    const z0 = dipZ; const z1 = capZ;
    const pts = [];
    for (let i = 0; i <= 7; i += 1) {
      const phi = (i / 7) * Math.PI;
      const u = (1 - Math.cos(phi)) / 2;                   // 0 -> 1 along the arch, eased like a half circle
      const lift = Math.sin(phi);
      pts.push([x0 + (x1 - x0) * u + bx * lift, FOOT + (R - FOOT) * u + by * lift, z0 + (z1 - z0) * u + 0.05 * h * lift]);
    }
    loops.push({ pts, closed: false, segs: 16, radius: BOBBLE_R });
  });
  const zc = (dipZ + capZ) / 2;
  // the dome rises nearly to the loops' crowns, so only their outer sides show: one round puff
  return { loops, dome: { centre: [0, 0, zc], radii: [0.4 * w, 0.58 * w, Math.max(0.33 * h, Math.abs(capZ - dipZ) * 0.48)] } };
}

/** A slack loop that hangs off the base of a loose stitch (the 2D "baggy" cue). */
function slackLoop(w) {
  return {
    pts: ellipse(12, (th) => [-0.18 * w + 0.17 * Math.cos(th), 0.8 * R, 0.1 + 0.1 * Math.sin(th)]),
    closed: true,
    segs: 16,
  };
}

/**
 * Build the yarn paths for one placed stitch.
 *   s = { st, t, q, wrong, n }        the stitch as the game stores it
 *   f = { cx, z0, h, dir, dipZ, lift } its frame in cell units (from the 2D layout)
 * Returns { curves: [{ pts (stitch-local), closed, segs, radius? }], origin: [x, 0, z] (world base
 *           centre), radius, dome: { centre, radii } | null, cap: [x, y, z] (world), pin: [x, y, z] | null }.
 */
export function stitchCurves(s, f) {
  const t = s.wrong ? 0 : (s.t || 0);
  const { wScale, hScale } = tensionScales(t);
  const w = wScale;                                   // one cell wide at neutral tension
  const h = (f.h ?? STITCHES[s.st].height / 30) * hScale;
  const loose = s.q === 'loose';
  const tight = s.q === 'tight';
  const radius = tight ? R * 1.15 : R;
  // Deterministic hand-made jitter on neat stitches.
  const jitter = s.q === 'neat' ? ((((s.n || 0) * 7919) % 13) / 13 - 0.5) * 0.04 : 0;
  const dir = f.dir || 1;
  const dipZ = f.dipZ || 0;
  const curves = [];
  let cap = null;
  let dome = null;

  switch (s.st) {
    case 'ch': {
      const c = chain(w, h, f.lift || 0);
      curves.push(c); cap = c.centre;
      break;
    }
    case 'sc':
      curves.push(single(w, h, dir, dipZ, loose));
      break;
    case 'hdc':
      curves.push(halfDouble(w, h, dir, dipZ));
      break;
    case 'dc':
      curves.push(doublePost(w, h, dir, dipZ));
      curves.push(wrap(w, h, dir, 1));
      break;
    case 'bo': {
      const b = bobble(w, h, dir, dipZ);
      curves.push(...b.loops);
      dome = b.dome;
      break;
    }
    default:
      break;
  }
  if (s.st !== 'ch') {
    const c = capLoop(w, h, { sag: loose ? 1 : 0, pinch: tight ? 0.82 : 1 });
    curves.push(c); cap = c.centre;
  }
  if (loose) curves.push(slackLoop(w));

  const origin = [f.cx + jitter, 0, f.z0];
  const toWorld = ([x, y, z]) => [origin[0] + x, y, origin[2] + z];
  return {
    curves,                                   // stitch-local: add `origin` to get world positions; a curve's own `radius` wins
    origin,
    radius,
    dome,                                     // bobble only: { centre, radii } of the puff under its loops (stitch-local)
    cap: toWorld(cap),
    // The pin goes into the stitch's lower half on the -x side: the hook stands in the cap (a wrong
    // stitch is on the hook) and leans +x, so the pin and its head stay in view.
    pin: s.wrong ? toWorld([-0.3 * w, 0, -0.4 * h]) : null,
  };
}
