// Procedural CanvasTextures for the 3D view. No image files: wood, linen, bamboo, yarn ply and
// the wrong-stitch stripe are all drawn at runtime from the palette, so they follow the theme.
import {
  CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter,
} from '../../vendor/three/three.module.min.js';

/** Small deterministic PRNG so textures (and the demo's tension) are reproducible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
/** sRGB mix of two hex colours, f of the way from a to b (same recipe as the 2D renderer). */
export function mix(a, b, f) {
  const A = hexToRgb(a); const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * f));
}
export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, { srgb = false, repeat = [1, 1], anisotropy = 1 } = {}) {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Encode a periodic height field (0..1) as a tangent-space normal map. */
function normalMapFromHeight(w, h, heightAt, strength) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const hl = heightAt((x - 1 + w) % w, y); const hr = heightAt((x + 1) % w, y);
      const hu = heightAt(x, (y - 1 + h) % h); const hd = heightAt(x, (y + 1) % h);
      let nx = -(hr - hl) * strength; let ny = (hd - hu) * strength; let nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const o = (y * w + x) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Diagonal ply ridges: one tile wraps once around the tube, `ridges` soft stripes per tile (fine
 *  and shallow: it should read as twisted fibre in a close-up, not as candy-cane stripes). */
export function yarnNormalMap({ size = 128, ridges = 5, strength = 6 } = {}) {
  const c = normalMapFromHeight(size, size, (x, y) => {
    const u = ((x + y) / size) * ridges * Math.PI * 2;
    const s = 0.5 + 0.5 * Math.sin(u);
    return s * s * (3 - 2 * s); // smoothstep: softer crests
  }, strength);
  return toTexture(c);
}

/**
 * Ply colour map (linear greyscale, multiplies the yarn colour) on the same tiling as yarnNormalMap:
 * soft diagonal bands, two plies per wrap, with fine fibre streaks running along each ply, so the
 * twist reads even where the light is flat. Seamless: everything is a function of (x + y) and (x - y)
 * modulo the tile.
 */
export function yarnPlyMap({ size = 128, ridges = 5, seed = 9 } = {}) {
  const rng = mulberry32(seed);
  const fibre = Array.from({ length: size }, () => rng());
  const along = Array.from({ length: size }, () => rng());
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + y) % size; const w = (x - y + size) % size;
      const band = 0.5 + 0.5 * Math.sin((u / size) * ridges * Math.PI * 2);
      const groove = band * band * (3 - 2 * band);
      const f = (fibre[u] - 0.5) * (0.6 + 0.8 * along[(w + u * 3) % size]);
      const v = Math.max(0, Math.min(1, 0.88 + 0.08 * groove + 0.06 * f)); // a gentle swing: fibre, not stripes
      const o = (y * size + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = v * 255; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c);
}

/** The wrong-stitch stripe: 60% bad, 40% bad darkened 45%, one period per tile. */
export function stripeMap(bad) {
  const c = makeCanvas(40, 8);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bad; ctx.fillRect(0, 0, 40, 8);
  ctx.fillStyle = mix(bad, '#000000', 0.45); ctx.fillRect(24, 0, 16, 8);
  return toTexture(c, { srgb: true });
}

/**
 * Oak table top, seamless in both directions so it can repeat across the table without a visible
 * tile grid: two planks per tile running along x (the grain), long grain streaks that wobble with a
 * whole number of periods per tile, soft figure bands, a little warm noise, and an end joint per plank.
 */
export function woodTexture(pal, { size = 1024, seed = 11, anisotropy = 1 } = {}) {
  const rng = mulberry32(seed);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true }); // read back below: keep it off the GPU
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, size, size);
  const k = size / 1024;                                        // the recipe is drawn for 1024 px
  const planks = 2; const ph = size / planks;
  // Each plank a slightly different tone.
  for (let k = 0; k < planks; k += 1) {
    const toward = rng() < 0.5 ? pal.bg2 : pal.bg3;
    ctx.fillStyle = rgba(toward, 0.10 + rng() * 0.16);
    ctx.fillRect(0, k * ph, size, ph);
  }
  const wrapY = (fn) => { fn(-size); fn(0); fn(size); };
  // Figure: wide soft bands along the grain.
  for (let i = 0; i < 16; i += 1) {
    const y = rng() * size; const h = (14 + rng() * 60) * k;
    const col = rng() < 0.55 ? pal.bg2 : pal.bg3; const a = 0.08 + rng() * 0.14;
    wrapY((o) => {
      const g = ctx.createLinearGradient(0, y + o - h, 0, y + o + h);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, y + o - h, size, h * 2);
    });
  }
  // Grain: thin streaks, each a sine wobble with 1-3 whole periods across the tile.
  for (let i = 0; i < 420; i += 1) {
    const y = rng() * size; const w = Math.max(0.5, (0.5 + rng() * 2.6) * k);
    const dark = rng() < 0.6;
    const col = rgba(dark ? pal.bg2 : pal.bg3, dark ? 0.08 + rng() * 0.26 : 0.06 + rng() * 0.2);
    const amp = (1 + rng() * 7) * k; const per = 1 + Math.floor(rng() * 3); const phase = rng() * Math.PI * 2;
    const x0 = rng() * size; const len = size * (0.25 + rng() * 0.75);
    ctx.strokeStyle = col; ctx.lineWidth = w;
    // Path points are fixed when added, so the part past the right edge is rebuilt one tile left.
    wrapY((o) => [0, -size].forEach((ox) => {
      ctx.beginPath();
      for (let s = 0; s <= 64; s += 1) {
        const x = x0 + (s / 64) * len;
        const yy = y + o + amp * Math.sin((x / size) * Math.PI * 2 * per + phase);
        if (s === 0) ctx.moveTo(x + ox, yy); else ctx.lineTo(x + ox, yy);
      }
      ctx.stroke();
    }));
  }
  // Plank seams along the grain, and one butt joint across each plank.
  for (let k = 0; k < planks; k += 1) {
    const y = k * ph;
    ctx.fillStyle = rgba(pal.bg2, 0.85); ctx.fillRect(0, y, size, Math.max(1.5, 3 * k));
    ctx.fillStyle = rgba(pal.bg3, 0.35); ctx.fillRect(0, y + Math.max(1.5, 3 * k), size, 1);
    const jx = Math.round(rng() * size);
    ctx.fillStyle = rgba(pal.bg2, 0.7); ctx.fillRect(jx, y, Math.max(1, 2 * k), ph);
  }
  // Fine warm noise (the CSS uses 16%; minified on a plane that reads as carpet, so keep it low).
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 2 * 0.05 * 255;
    d[i] += n; d[i + 1] += n * 0.85; d[i + 2] += n * 0.7;
  }
  ctx.putImageData(img, 0, 0);
  // Roughness from luminance (darker grain = rougher), kept in 0.72..1.
  const rc = makeCanvas(size, size);
  const rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const v = (0.72 + (1 - l) * 0.5) * 255;
    rimg.data[i] = v; rimg.data[i + 1] = v; rimg.data[i + 2] = v; rimg.data[i + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  const unitsPerTile = 36; // planks ~18 cells (about 10 cm) wide
  return {
    map: toTexture(c, { srgb: true, anisotropy }),
    roughnessMap: toTexture(rc, { anisotropy }),
    unitsPerTile,
  };
}

/**
 * Linen blocking mat with the gauge grid baked in: dots at every cell, hairlines at every row
 * baseline. `cols` columns wide, `depth` cell units deep, `rowZ` = z of each row baseline (<= 0).
 * The mat spans x in [-3, cols + 3] and z in [-depth - 3, 3]; the canvas top row is the far edge.
 */
export function matTextures(pal, { cols, depth, rowZ, pxPerUnit = 48, anisotropy = 1 }) {
  const wU = cols + 6; const dU = depth + 6;
  const w = Math.round(wU * pxPerUnit); const h = Math.round(dU * pxPerUnit);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true }); // read back below: keep it off the GPU
  ctx.fillStyle = pal.surface2; ctx.fillRect(0, 0, w, h);
  // Weave: soft, blurred threads at an irregular 10-14 px pitch, every thread its own strength (linen
  // has slubs), plus a little noise. A regular fine weave (4-6 px) aliases into even corduroy stripes
  // across the mat at a low camera; an uneven, coarser one can only shimmer into noise.
  const rng = mulberry32(5);
  const thread = pal.dark ? '#ffffff' : pal.ink;
  const strength = pal.dark ? 0.018 : 0.02;
  const soft = [0.35, 1, 0.35];                               // a thread 3 px wide with soft edges
  for (let x = 0; x < w; x += 10 + Math.floor(rng() * 5)) {
    const a = strength * (0.4 + 1.2 * rng());
    soft.forEach((f, i) => { ctx.fillStyle = rgba(thread, a * f); ctx.fillRect(x + i, 0, 1, h); });
  }
  for (let y = 0; y < h; y += 10 + Math.floor(rng() * 5)) {
    const a = strength * (0.4 + 1.2 * rng());
    soft.forEach((f, i) => { ctx.fillStyle = rgba(thread, a * f); ctx.fillRect(0, y + i, w, 1); });
  }
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // Gauge grid.
  const toPx = (x) => (x + 3) * pxPerUnit;
  const toPy = (z) => (z + depth + 3) * pxPerUnit;
  ctx.fillStyle = rgba(pal.ink, 0.08);
  ctx.strokeStyle = rgba(pal.ink, 0.08);
  ctx.lineWidth = Math.max(1, pxPerUnit / 48);
  rowZ.forEach((z) => {
    const py = toPy(z);
    ctx.beginPath(); ctx.moveTo(toPx(0), py); ctx.lineTo(toPx(cols), py); ctx.stroke();
    for (let k = 0; k < cols; k += 1) {
      ctx.beginPath(); ctx.arc(toPx(k + 0.5), py, pxPerUnit * 0.045, 0, Math.PI * 2); ctx.fill();
    }
  });
  // Stitched hem round the mat edge.
  ctx.setLineDash([pxPerUnit * 0.12, pxPerUnit * 0.08]);
  ctx.strokeStyle = rgba(pal.ink, 0.14); ctx.lineWidth = Math.max(1, pxPerUnit / 24);
  ctx.strokeRect(pxPerUnit * 0.35, pxPerUnit * 0.35, w - pxPerUnit * 0.7, h - pxPerUnit * 0.7);
  ctx.setLineDash([]);
  // Crosshatch normal map: ten soft threads each way on a seamless 120 px tile, at an uneven 10-14 px
  // pitch like the colour weave, at half the old relief (under a raking lamp a deeper, finer or
  // regular weave lights up as corduroy stripes).
  const threads = (seed) => {
    const r = mulberry32(seed); const gaps = Array.from({ length: 10 }, () => 10 + 4 * r());
    const k = 120 / gaps.reduce((a, b) => a + b, 0); let at = 0;
    return gaps.map((g) => { const x = at; at += g * k; return x; });
  };
  const bump = (v, xs) => xs.reduce((m, x) => {
    const d = Math.min(Math.abs(v - x), 120 - Math.abs(v - x)); // wraps round the tile
    return Math.max(m, Math.max(0, 1 - d / 3.2) ** 2);
  }, 0);
  const tx = threads(17); const ty = threads(23);
  const nc = normalMapFromHeight(120, 120, (x, y) => 0.5 * (bump(x, tx) + bump(y, ty)), 1.5);
  return {
    map: toTexture(c, { srgb: true, anisotropy }),
    normalMap: toTexture(nc, { repeat: [w / 120, h / 120], anisotropy }),
    width: wU, depth: dU,
  };
}

/** Beech/bamboo hook: longitudinal grain, one node ring above the thumb rest, a "5 mm" stamp. */
export function bambooTexture(pal, { seed = 3 } = {}) {
  const w = 256; const h = 1024;
  const rng = mulberry32(seed);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, mix(pal.hook1, pal.hook2, 0.25));
  base.addColorStop(0.35, pal.hook1);
  base.addColorStop(1, mix(pal.hook1, pal.hook2, 0.35));
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i += 1) {
    const x = rng() * w; const dark = rng() < 0.4;
    ctx.strokeStyle = rgba(dark ? pal.hook3 : pal.hook2, 0.08 + rng() * 0.3);
    ctx.lineWidth = 0.6 + rng() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.bezierCurveTo(x + (rng() - 0.5) * 12, h * 0.33, x + (rng() - 0.5) * 12, h * 0.66, x + (rng() - 0.5) * 6, h + 10);
    ctx.stroke();
  }
  // Node ring (hook length 4.7 u; v runs tip -> end, canvas y = (1 - v) * h).
  const ringY = (1 - 1.75 / 4.7) * h;
  const ring = ctx.createLinearGradient(0, ringY - 9, 0, ringY + 9);
  ring.addColorStop(0, rgba(pal.hook3, 0)); ring.addColorStop(0.5, rgba(pal.hook3, 0.55)); ring.addColorStop(1, rgba(pal.hook3, 0));
  ctx.fillStyle = ring; ctx.fillRect(0, ringY - 9, w, 18);
  // Size stamp just below the thumb rest, running along the shaft.
  ctx.save();
  ctx.translate(w * 0.5, (1 - 1.0 / 4.7) * h);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 26px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(pal.hook3, 0.55);
  ctx.fillText('5 mm', 0, 0);
  ctx.restore();
  return toTexture(c, { srgb: true });
}

/**
 * The wrong-stitch pin's glass head: --bad with one white x printed on it, laid out for a
 * SphereGeometry's equirectangular UVs, centred at u = 0.25 (the sphere's +z side) and PIN_CROSS_LAT
 * above the equator; view3d turns the head so that point faces the camera. The x is widened in u by
 * 1/cos(latitude) so it is square on the sphere.
 */
export const PIN_CROSS_LAT = 0.55;
export function pinHeadTexture(bad) {
  const w = 128; const h = 64;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bad; ctx.fillRect(0, 0, w, h);
  const lat = PIN_CROSS_LAT;               // radians above the equator (the camera looks down at ~40 deg)
  const vy = h * (0.5 - lat / Math.PI);
  const sx = 1 / Math.cos(lat);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  const ux = w * 0.25; const d = 5;
  ctx.beginPath();
  ctx.moveTo(ux - d * sx, vy - d); ctx.lineTo(ux + d * sx, vy + d);
  ctx.moveTo(ux + d * sx, vy - d); ctx.lineTo(ux - d * sx, vy + d);
  ctx.stroke();
  return toTexture(c, { srgb: true });
}
