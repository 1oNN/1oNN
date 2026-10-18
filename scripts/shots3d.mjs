// Renders the 3D view in headless Chromium (SwiftShader WebGL) and writes docs/visuals/3d-*.png: the
// beauty renders of the finished pieces on the 3D stage alone, drawn at 2x and scaled to 1920 x 1200
// (3d-hero, 3d-top, 3d-grazing, 3d-dark, 3d-dark-close, 3d-coaster, 3d-pouch and the stitch close-up
// 3d-closeup), the working views with the showcase's own bar (3d-wrong, 3d-hold, 3d-phone), a 96-frame
// turntable mp4 and a palette-optimised 480 px gif (at most 6 MB), and the in-game 3D view
// (docs/visuals/game-3d-*.png). It also checks, in numbers, that the rows stack straight, the stripes
// come in pattern order, the hook stands where render.js puts it (the last stitch's top loop), the
// working loop never hides the crook (and at least 70% of it is in view), the ball stays in frame (in
// the game, beside the row being worked, clear of the labels; on the turntable, at every angle), each
// yarn renders near its token's hue, the dark mat holds its
// --surface-2 value under the lamp with a warm room behind it, and the in-game camera is close
// enough that the row being worked fills well over half the mat.
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/shots3d.mjs
// Env: CHROMIUM_PATH, FFMPEG (default /usr/bin/ffmpeg), SHOTS_TMP (where turntable frames go).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'visuals');
fs.mkdirSync(out, { recursive: true });
const ffmpeg = process.env.FFMPEG || '/usr/bin/ffmpeg';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const warnings = [];
function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error') errors.push(`${tag} console: ${text}`);
    else if (m.type() === 'warning' && /webgl|three|shader|GL_/i.test(text)) warnings.push(`${tag} warning: ${text}`);
  });
}
function check(ok, msg) { if (!ok) errors.push(`check failed: ${msg}`); else console.log('ok', msg); }

/** Wait n animation frames so the view has rendered the latest state (SwiftShader: ~1-2 fps). */
const settle = (page, n = 2) => page.evaluate((k) => new Promise((r) => { const f = (i) => (i <= 0 ? r() : requestAnimationFrame(() => f(i - 1))); f(k); }), n);

async function shoot(page, name) {
  await settle(page, 2);
  const file = path.join(out, name);
  await page.screenshot({ path: file });
  console.log('wrote', path.relative(root, file));
  return file;
}

const glState = (page) => page.evaluate(() => {
  const v = window.__view3d.view;
  const gl = v.renderer.getContext();
  return { glError: gl.getError(), calls: v.renderer.info.render.calls, triangles: v.renderer.info.render.triangles, stitches: v.stitchCount };
});

/** Hook vs render.js: both views stand the hook in the top loop of the last stitch made
 *  (stitchAnchor() of the last placed stitch, as render.js's hookAnchor does), in cell units. */
const hookCheck = (page) => page.evaluate(async () => {
  const { layout, stitchGeometry, stitchAnchor, CELL } = await import('./js/render.js');
  const g = window.__view3d.game; const v = window.__view3d.view;
  const info = v.inspect();
  const step = g.step;
  if (!step) return { info, expected: null };
  const lay = layout(g.pattern);
  let r = step.row;
  while (r > 0 && !g.rows[r].length) r -= 1;
  const placed = g.rows[r];
  if (!placed.length) return { info, expected: null };
  const i = placed.length - 1;
  const a = stitchAnchor(placed[i], stitchGeometry(lay, r, placed, i));
  return { info, expected: { x: (a.x - lay.left) / CELL, row: r, st: placed[i].st } };
});

/** Mean colour round world points [x, y, z] in a fresh render of the view (px radius r). */
const sample = (page, pts, r = 1, handle = 'window.__view3d.view') => page.evaluate(async ({ pts: P, r: R, handle: h }) => {
  // eslint-disable-next-line no-new-func
  const v = new Function(`return ${h}`)();
  const img = new Image();
  img.src = v.screenshot();
  await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const V = v.camera.position.constructor;
  v.camera.updateMatrixWorld();
  const px = (x, y) => { const d = ctx.getImageData(x - R, y - R, 2 * R + 1, 2 * R + 1).data; const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; } return s.map((q) => q / (d.length / 4)); };
  return P.map((p) => {
    if (p.ndc) return px(Math.round(((p.ndc[0] + 1) / 2) * c.width), Math.round(((1 - p.ndc[1]) / 2) * c.height));
    const q = new V(p[0], p[1], p[2]).project(v.camera);
    const x = Math.round(((q.x + 1) / 2) * c.width); const y = Math.round(((1 - q.y) / 2) * c.height);
    return x < R || y < R || x >= c.width - R || y >= c.height - R ? null : px(x, y);
  }).filter(Boolean);
}, { pts, r, handle });
const meanRgb = (list) => list.reduce((a, c) => a.map((v, i) => v + c[i] / list.length), [0, 0, 0]);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function hue([r, g, b]) {
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn || 1;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** The yarn tokens as the page resolves them (the light or dark block, whichever is applied). */
const tokens = (page) => page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(['rose', 'teal', 'mustard', 'lavender'].map((n) => [n, cs.getPropertyValue(`--yarn-${n}`).trim()]).concat([['surface2', cs.getPropertyValue('--surface-2').trim()]]));
});

/** Each yarn's mean rendered colour on the near side of its stitches' top loops vs its token's hue. */
async function yarnHueCheck(page, tag) {
  const { info, pattern } = await page.evaluate(() => ({ info: window.__view3d.view.inspect(), pattern: window.__view3d.game.pattern }));
  const tok = await tokens(page);
  const b = 0.16; const tilt = (35 * Math.PI) / 180;
  for (const [i, y] of pattern.yarns.entries()) {
    const pts = info.rows.flatMap((r) => r.caps.filter((c) => c.yarn === i && c.st !== 'ch').map((c) => [c.at[0], c.at[1] + b * Math.sin(tilt), c.at[2] + b * Math.cos(tilt)]));
    if (!pts.length) continue;
    const got = meanRgb(await sample(page, pts, 1));
    const want = tok[y.name.toLowerCase()];
    const gap = hueGap(hue(got), hue(hexRgb(want)));
    check(gap <= 15, `${tag}: ${y.name} renders at hue ${hue(got).toFixed(0)} (${toHex(got)}), token ${want} at ${hue(hexRgb(want)).toFixed(0)}: ${gap.toFixed(0)} deg apart`);
  }
}

const shots = [];

// ---------------------------------------------------------------- the scarf, worked by the auto-player
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
watch(page, 'scarf');
await page.goto(`${base}3d.html?autoplay=1&speed=fast&seed=7&theme=light`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__view3d && window.__view3d.game, null, { timeout: 60000 });
// Let the timer work the first stitches with animated holds (exercises the loop, tube growth, turn).
await page.waitForFunction(() => window.__view3d.game.idx >= 10, null, { timeout: 240000, polling: 250 });
await page.evaluate(() => window.__view3d.player.pause());

// Mid-row: the hook must stand in the last stitch's top loop, where 2D puts it.
await page.evaluate(() => window.__view3d.player.advanceTo(30));
await settle(page, 6);
{
  const { info, expected } = await hookCheck(page);
  check(expected && Math.abs(info.hook.x - expected.x) < 0.06, `hook in the last stitch's top loop, as in 2D (row ${expected && expected.row + 1}, x ${info.hook.x} vs render.js stitchAnchor ${expected && expected.x.toFixed(3)})`);
  // the J of the crook, seen from the default camera, is never hidden by the working loop
  await page.evaluate(() => window.__view3d.view.setCamera({ azimuth: -25, elevation: 40 }));
  await settle(page, 2);
  const crook = await page.evaluate(() => window.__view3d.view.inspect().crook);
  check(crook && crook.total > 20 && crook.loop <= 0.1, `the crook is clear of the working loop from the default view (${crook && Math.round(crook.loop * 100)}% of ${crook && crook.total} crook points behind the loop)`);
  check(crook && crook.seen >= 0.7, `the crook is in view from the default view (${crook && Math.round(crook.seen * 100)}% seen; ${crook && Math.round(crook.stitches * 100)}% behind stitches)`);
}

// The auto-player's one slip: an sc where the 6th dc of row 4 should be. Pin in it, hook on it.
const slipped = await page.evaluate(() => window.__view3d.player.playUntilSlip());
check(slipped, 'the auto-player slipped a wrong stitch onto the hook');
await settle(page, 6);
await page.evaluate(() => window.__view3d.view.setCamera({ azimuth: -26, elevation: 36, distance: 7.5, free: true, target: 'hook' }));
await page.waitForTimeout(300);
shots.push(await shoot(page, '3d-wrong.png'));

// Frog it and finish the piece (same tension rules, synchronously: SwiftShader is far too slow to
// watch ~130 steps at 120 ms each).
await page.evaluate(() => window.__view3d.player.finish());
await page.waitForFunction(() => window.__view3d.game.status === 'done', null, { timeout: 60000, polling: 200 });
await page.waitForTimeout(500);
await settle(page, 4);
const done = await page.evaluate(() => ({ stats: window.__view3d.game.stats(), info: window.__view3d.view.inspect(), pattern: window.__view3d.game.pattern }));
console.log(JSON.stringify(done.stats));
check(done.stats.mistakes === 1, `one mistake, frogged (mistakes ${done.stats.mistakes})`);

// Rows stack straight: every body row starts and ends in the same column (turning chains excluded;
// neat stitches carry a +-0.02 hand-made jitter).
{
  const body = done.info.rows.filter((r) => r.row > 0);
  const minXs = body.map((r) => r.minX); const maxXs = body.map((r) => r.maxX);
  const spread = (a) => Math.max(...a) - Math.min(...a);
  check(spread(minXs) < 0.06 && spread(maxXs) < 0.06, `rows stack straight (first-stitch x spread ${spread(minXs).toFixed(3)}, last ${spread(maxXs).toFixed(3)})`);
  const zs = done.info.rows.map((r) => r.z);
  check(zs.every((z, i) => i === 0 || z < zs[i - 1]), 'each row sits beyond the one below (z decreasing)');
}
// Stripe order follows the pattern (scarf: Teal rows 1-3, Mustard 4-5, Teal 6-7, Mustard 8-9).
{
  let cur = 0;
  const want = done.pattern.rows.map((r) => done.pattern.yarns[(cur = r.yarn ?? cur)].name);
  const got = done.info.rows.map((r) => r.yarns.join('+'));
  check(JSON.stringify(want) === JSON.stringify(got), `stripes in pattern order: ${got.map((y, i) => `${i + 1}:${y}`).join(' ')}`);
}
const info = await glState(page);
console.log(JSON.stringify(info));
check(info.glError === 0, `no WebGL error (gl.getError() = ${info.glError})`);

// The colour checks run here, on the 1x page; the beauty renders (hero, top-down, grazing, dark, the
// coaster, the pouch, the close-up) are made on a 2x page with no page UI further down.
await page.evaluate(() => window.__view3d.view.setCamera({ azimuth: -25, elevation: 40, free: true }));
await settle(page, 2);
await yarnHueCheck(page, 'light hero');

// Dark theme: the same table under the lamp.
await page.evaluate(() => { window.__view3d.setTheme('dark'); window.__view3d.view.setCamera({ azimuth: -25, elevation: 40, free: true }); });
await page.waitForTimeout(300);
await settle(page, 2);
{
  // Under the lamp the linen holds its --surface-2 value (as the 2D mat does), and the room behind
  // the table stays a warm brown (no violet cast from the cool rim).
  const { cols, depth } = await page.evaluate(async () => {
    const { layout, CELL } = await import('./js/render.js');
    const lay = layout(window.__view3d.game.pattern);
    return { cols: lay.cols, depth: lay.rows.reduce((s, r) => s + r.height, 0) / CELL };
  });
  const matPts = [
    ...[-1, -2.5, -4, -5.5, -7].map((z) => [-2.2, 0.01, Math.max(z, -depth)]),
    ...[1, 3.5, 6, 8.5, 11].map((x) => [Math.min(x, cols - 1), 0.01, 1.8]),
    ...[2, 5, 8, 11].map((x) => [Math.min(x, cols - 1), 0.01, -depth - 1.7]),
  ];
  const tok = await tokens(page);
  const matL = (await sample(page, matPts, 2)).map(luminance);
  const ratio = matL.reduce((a, b) => a + b, 0) / matL.length / luminance(hexRgb(tok.surface2));
  check(ratio >= 0.8, `dark: the mat's mean luminance is ${ratio.toFixed(2)}x --surface-2 (${tok.surface2}); at least 0.8x`);
  const room = meanRgb(await sample(page, [{ ndc: [-0.85, 0.94] }, { ndc: [0, 0.94] }, { ndc: [0.85, 0.94] }], 3));
  check(hue(room) >= 20 && hue(room) <= 50, `dark: the far table and room are warm (${toHex(room)}, hue ${hue(room).toFixed(0)}, want 20-50)`);
  await yarnHueCheck(page, 'dark hero');
}
await page.evaluate(() => window.__view3d.setTheme('light'));

// Turntable: 96 frames, a full 360 degrees round the finished scarf, on a clean 4:3 stage (the 3D
// stage only, no page UI). It orbits the middle of the piece and the ball beside it together, at the
// one distance that keeps both in frame at every angle, a little lower than the hero (32 deg) so the
// stitch relief reads as it turns: an mp4 at 24 fps, and a 480 px gif of every other frame at 12 fps
// (both 4 s a turn).
await page.addStyleTag({ content: '.bar, .hint { display: none !important; }' });
await page.setViewportSize({ width: 960, height: 720 });
await page.evaluate(() => window.__view3d.view.resize());
const ttTarget = await page.evaluate(async () => {
  const { layout, CELL } = await import('./js/render.js');
  const lay = layout(window.__view3d.game.pattern);
  const depth = lay.rows.reduce((s, r) => s + r.height, 0) / CELL;
  // the piece runs from its turning chains (x -1.2) to the ball (x cols + 3.4), the foundation (z 0.7) to the last row
  return [(lay.cols + 2.2) / 2, 0, (0.3 - depth) / 2];
});
const stage = page.locator('#stage');
const frames = fs.mkdtempSync(path.join(process.env.SHOTS_TMP || os.tmpdir(), 'hooked-turntable-'));
const TT = 96;
for (let i = 0; i < TT; i += 1) {
  const az = -25 + (i * 360) / TT;
  await page.evaluate(({ a, t }) => window.__view3d.view.setCamera({ azimuth: a, elevation: 32, free: true, distance: 'orbit', target: t }), { a: az, t: ttTarget });
  if (i % 24 === 0) {
    // the ball (and the whole piece) stays in frame all the way round
    const b = await page.evaluate(() => window.__view3d.view.inspect().ball);
    check(b && b.x0 >= 0 && b.y0 >= 0 && b.x1 <= b.w && b.y1 <= b.h, `turntable at ${az} deg: the ball is in frame (${b && [b.x0, b.y0, b.x1, b.y1].map(Math.round).join(', ')} of ${b && b.w} x ${b && b.h})`);
  }
  await settle(page, 2);
  await stage.screenshot({ path: path.join(frames, `f-${String(i).padStart(3, '0')}.png`) });
}
const mp4 = path.join(out, '3d-turntable.mp4');
const gif = path.join(out, '3d-turntable.gif');
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', '24', '-i', path.join(frames, 'f-%03d.png'),
  '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', mp4]);
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', '24', '-i', path.join(frames, 'f-%03d.png'),
  '-vf', 'framestep=2,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  '-loop', '0', gif]);
{
  const g = fs.readFileSync(gif);
  const size = fs.statSync(gif).size;
  check(g.toString('latin1', 0, 6).startsWith('GIF8') && g.readUInt16LE(6) === 480 && size <= 6 * 1024 * 1024,
    `turntable gif is ${g.readUInt16LE(6)} x ${g.readUInt16LE(8)} px and ${(size / 1024 / 1024).toFixed(2)} MB (480 px wide, at most 6 MB)`);
}
fs.rmSync(frames, { recursive: true, force: true });
await page.close();

// ---------------------------------------------------------------- beauty renders (2x, no page UI)
// The finished pieces on the table, on the 3D stage alone: drawn at 2560 x 1600 (device pixel ratio
// 2, with MSAA) and scaled down to 1920 x 1200 with a lanczos filter, so the ply twist and the tube
// edges stay crisp. Played by the same rules and seed as above (the scarf has its one slip, frogged).
const beautyTmp = fs.mkdtempSync(path.join(process.env.SHOTS_TMP || os.tmpdir(), 'hooked-beauty-'));
const bp = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
watch(bp, 'beauty');
await bp.goto(`${base}3d.html?autoplay=0&seed=7&theme=light&pattern=scarf`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await bp.waitForFunction(() => window.__view3d && window.__view3d.game, null, { timeout: 60000 });
await bp.evaluate(() => window.__view3d.view.ready);
await bp.addStyleTag({ content: '.bar, .hint { display: none !important; }' });
await bp.evaluate(() => window.__view3d.view.resize());

/** Start pattern `id` (unless it is the one on the table) and work it to the end. */
async function finishPattern(id) {
  await bp.evaluate((pid) => {
    const v = window.__view3d;
    if (v.game.pattern.id !== pid) v.start(v.PATTERNS.find((p) => p.id === pid));
    v.player.finish();
  }, id);
  await bp.waitForFunction(() => window.__view3d.game.status === 'done', null, { timeout: 60000, polling: 200 });
  await bp.waitForTimeout(1500); // the fasten-off confetti (1.2 s) has landed and been cleared
  await settle(bp, 3);
}
/** Place the camera, render, and write docs/visuals/<name> at 1920 px wide. */
async function beauty(name, cam) {
  await bp.evaluate((c) => { window.__view3d.view.setCamera(c); window.__view3d.view.invalidate(true); }, cam);
  await bp.waitForTimeout(250);
  await settle(bp, 3);
  const raw = path.join(beautyTmp, name);
  await bp.locator('#stage').screenshot({ path: raw });
  const file = path.join(out, name);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=1920:-1:flags=lanczos', '-pred', 'mixed', file]);
  console.log('wrote', path.relative(root, file));
  return file;
}

await finishPattern('scarf');
// Three-quarter hero (the default framing), and the top-down chart view, square over the mat.
shots.push(await beauty('3d-hero.png', { azimuth: -25, elevation: 40, free: true }));
shots.push(await beauty('3d-top.png', { azimuth: 0, elevation: 89, free: true }));
// Grazing light: the key lamp brought down to ~15 deg from the left so it rakes across the stitch
// relief (each strand lit on one side, a long shadow on the other), the other lights let down, and a
// low camera from the front-left with the whole piece and the ball in frame; the far table melts
// into the room behind (no horizon line).
await bp.evaluate(() => {
  const v = window.__view3d.view;
  const lights = v.scene.children.filter((o) => o.isLight);
  window.__saved = lights.map((l) => ({ l, p: l.position.clone(), i: l.intensity }));
  const key = lights.find((o) => o.isDirectionalLight && o.castShadow);
  key.position.set(key.target.position.x - 22, 6, key.target.position.z + 2); // ~15 deg: rakes the yarn, not the mat weave
  key.intensity = 3.0;
  lights.forEach((l) => { if (l !== key && !l.isSpotLight) l.intensity *= 0.45; }); // let the rake show
});
shots.push(await beauty('3d-grazing.png', { azimuth: -20, elevation: 19, free: true, distance: 21, target: [7.5, 0, -3.8] }));
await bp.evaluate(() => { window.__saved.forEach(({ l, p, i }) => { l.position.copy(p); l.intensity = i; }); });
// Dark theme: the same table under the lamp, and closer in over the stripes.
await bp.evaluate(() => window.__view3d.setTheme('dark'));
await bp.waitForTimeout(300);
shots.push(await beauty('3d-dark.png', { azimuth: -25, elevation: 40, free: true }));
shots.push(await beauty('3d-dark-close.png', { azimuth: -16, elevation: 30, free: true, distance: 12, target: [7.9, 0, -3] }));
await bp.evaluate(() => window.__view3d.setTheme('light'));
await bp.waitForTimeout(300);

// The mug coaster, finished: rose sc rows on a foundation chain, the hero angle.
await finishPattern('coaster');
shots.push(await beauty('3d-coaster.png', { azimuth: -25, elevation: 40, free: true }));
await yarnHueCheck(bp, 'coaster');

// The bobble pouch panel, finished, at the hero angle; then the stitch close-up: the camera at 4.5
// units (half the 9 of the closest working view, 3d-hold.png) on the last bobble of the last bobble
// row, so the bobble's loops over its dome, the sc beside it (cap loop and legs), the hdc posts of the
// row below and the turning chain at the edge show as real tubes with their ply twist.
await finishPattern('pouch');
shots.push(await beauty('3d-pouch.png', { azimuth: -25, elevation: 40, free: true }));
await yarnHueCheck(bp, 'pouch, finished');
{
  const closeTarget = await bp.evaluate(() => {
    const rows = window.__view3d.view.inspect().rows.filter((r) => r.caps.some((c) => c.st === 'bo'));
    const bo = rows[rows.length - 1].caps.filter((c) => c.st === 'bo').sort((a, b) => b.at[0] - a.at[0])[0];
    return [bo.at[0] + 0.5, 0.15, bo.at[2] + 0.45];
  });
  shots.push(await beauty('3d-closeup.png', { azimuth: -25, elevation: 38, free: true, distance: 4.5, target: closeTarget }));
  // what is in the frame: at least three stitch types, each with its top loop inside the picture
  const inFrame = await bp.evaluate(() => {
    const v = window.__view3d.view; const V = v.camera.position.constructor;
    v.camera.updateMatrixWorld();
    const types = new Set();
    v.inspect().rows.forEach((r) => r.caps.forEach((c) => {
      const q = new V(...c.at).project(v.camera);
      if (Math.abs(q.x) < 0.9 && Math.abs(q.y) < 0.9 && q.z < 1) types.add(c.st);
    }));
    return [...types];
  });
  check(inFrame.length >= 3, `close-up: ${inFrame.length} stitch types in frame (${inFrame.join(', ')}; at least 3)`);
}
await bp.close();
fs.rmSync(beautyTmp, { recursive: true, force: true });

// ---------------------------------------------------------------- mid-row hold on the bobble pouch
const mid = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
watch(mid, 'pouch');
await mid.goto(`${base}3d.html?autoplay=0&seed=7&theme=light&pattern=pouch`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await mid.waitForFunction(() => window.__view3d && window.__view3d.game, null, { timeout: 60000 });
await mid.evaluate(() => window.__view3d.player.advanceTo(56));
await settle(mid, 6);
{
  const { info: hi, expected } = await hookCheck(mid);
  check(expected && Math.abs(hi.hook.x - expected.x) < 0.06, `pouch: hook in the last stitch's top loop (${expected && expected.st} in row ${expected && expected.row + 1})`);
}
await mid.evaluate(() => window.__view3d.player.freezeHold(0.62));
await settle(mid, 4);
await mid.evaluate(() => window.__view3d.view.setCamera({ azimuth: -28, elevation: 34, distance: 9, free: true, target: 'hook' }));
await mid.waitForTimeout(300);
shots.push(await shoot(mid, '3d-hold.png'));
{
  const crook = await mid.evaluate(() => window.__view3d.view.inspect().crook);
  check(crook && crook.loop <= 0.1, `pouch, mid-hold: the swollen loop still leaves the crook in view (${crook && Math.round(crook.loop * 100)}% behind it)`);
  await yarnHueCheck(mid, 'pouch');
}
await mid.close();

// ---------------------------------------------------------------- phone width: no sideways scroll
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
watch(phone, 'phone');
await phone.goto(`${base}3d.html?autoplay=0&seed=7&theme=light`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await phone.waitForFunction(() => window.__view3d && window.__view3d.game, null, { timeout: 60000 });
await phone.evaluate(() => window.__view3d.player.advanceTo(70));
await phone.waitForTimeout(500);
const wide = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!wide, '3d.html does not scroll sideways at 390 px');
shots.push(await shoot(phone, '3d-phone.png'));
{
  const fr = await phone.evaluate(() => window.__view3d.view.inspect().frame);
  const [x0, x1, y0, y1] = fr.extent;
  check(x0 >= -0.92 && x1 <= 0.92 && Math.abs((y0 + y1) / 2) <= 0.15, `phone: the whole piece and the ball are in frame and centred (x ${x0}..${x1}, y ${y0}..${y1})`);
}
// dispose() frees every geometry and texture it made and takes its canvas out of the page.
const freed = await phone.evaluate(() => {
  const v = window.__view3d.view;
  const before = { ...v.renderer.info.memory };
  const mem = v.renderer.info.memory;
  v.dispose();
  return { before, after: { geometries: mem.geometries, textures: mem.textures }, canvas: !!document.querySelector('.view3d-canvas') };
});
check(freed.after.geometries === 0 && freed.after.textures === 0 && !freed.canvas,
  `dispose() frees GPU memory (geometries ${freed.before.geometries} -> ${freed.after.geometries}, textures ${freed.before.textures} -> ${freed.after.textures}, canvas removed ${!freed.canvas})`);
await phone.close();

// ---------------------------------------------------------------- the game's own 3D view (index.html)
{
  const g3 = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  watch(g3, 'game');
  await g3.goto(base, { waitUntil: 'domcontentloaded' });
  await g3.evaluate(() => { localStorage.setItem('hooked.view', '3d'); localStorage.removeItem('hooked.theme'); });
  await g3.reload();
  await g3.click('.card:nth-child(2)');
  await g3.waitForSelector('.mat.is-3d', { timeout: 120000 });
  // The ball travels beside the row being worked: in the canvas, clear of the corner labels, the orbit
  // hint and the 2D | 3D switch, at rows 2, 5 and 9 (its shrinking is the out-of-yarn cue).
  for (const row of [1, 4, 8]) {
    await g3.evaluate((rr) => {
      const g = window.__crochet.game;
      while (g.active && !(g.step.row === rr && g.step.type === 'stitch' && g.step.st !== 'ch' && g.step.i >= 3)) {
        const s = g.step;
        if (s.type === 'stitch') g.pressStitch(s.st, 300); else if (s.type === 'yarn') g.pressYarn(s.yarn); else g.pressTurn();
      }
    }, row);
    await g3.waitForTimeout(900); // the view pans, and the ball moves, to the row being worked (600 ms)
    await settle(g3, 3);
    const b = await g3.evaluate(() => {
      const box = window.__crochet.view3d.inspect().ball;
      const c = document.querySelector('#view3d').getBoundingClientRect();
      const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { sel, x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top }; };
      return { box, labels: ['.mat-label.tl', '.mat-label.tr', '.orbit-hint', '#view-toggle'].map(rect) };
    });
    const { box } = b;
    const inside = box && box.x0 >= 0 && box.y0 >= 0 && box.x1 <= box.w && box.y1 <= box.h;
    const hits = b.labels.filter((l) => box && box.x0 < l.x1 && box.x1 > l.x0 && box.y0 < l.y1 && box.y1 > l.y0).map((l) => l.sel);
    check(inside && !hits.length, `game, row ${row + 1}: the ball is in the frame (${box && [box.x0, box.y0, box.x1, box.y1].map(Math.round).join(', ')} of ${box && box.w} x ${box && box.h}) and clear of the labels${hits.length ? ` (under ${hits.join(', ')})` : ''}`);
  }
  // Work the scarf (by its own rules, no slips) to the first stitch of the last row.
  await g3.evaluate(() => {
    const g = window.__crochet.game; const last = g.pattern.rows.length - 1;
    while (g.active && !(g.step.row === last && g.step.type === 'stitch' && g.step.st !== 'ch')) {
      const s = g.step;
      if (s.type === 'stitch') g.pressStitch(s.st, 300); else if (s.type === 'yarn') g.pressYarn(s.yarn); else g.pressTurn();
    }
  });
  await g3.waitForTimeout(900); // the view pans to the row being worked (600 ms)
  await settle(g3, 3);
  const fr = await g3.evaluate(() => window.__crochet.view3d.inspect());
  check(fr.frame.finalRowWidth >= 0.55, `game: working the last row, it spans ${Math.round(fr.frame.finalRowWidth * 100)}% of the mat's width (at least 55%; aspect ${fr.frame.aspect})`);
  check(fr.crook && fr.crook.loop <= 0.1, `game: the crook is clear of the working loop (${fr.crook && Math.round(fr.crook.loop * 100)}% behind it)`);
  check(fr.crook && fr.crook.seen >= 0.7, `game: the crook is in view (${fr.crook && Math.round(fr.crook.seen * 100)}% seen; ${fr.crook && Math.round(fr.crook.stitches * 100)}% behind stitches)`);
  // A wrong stitch (an sc in a dc row) on the hook, in light and in dark.
  await g3.keyboard.press('s', { delay: 300 });
  await g3.waitForTimeout(800);
  await settle(g3, 3);
  shots.push(await shoot(g3, 'game-3d-wrong.png'));
  await g3.evaluate(() => window.__crochet.setTheme('dark'));
  await g3.waitForTimeout(900);
  await settle(g3, 3);
  shots.push(await shoot(g3, 'game-3d-dark.png'));
  await g3.evaluate(() => window.__crochet.setTheme('light'));
  await g3.close();
}

console.log('wrote', path.relative(root, mp4), `${(fs.statSync(mp4).size / 1024).toFixed(0)} kB`);
console.log('wrote', path.relative(root, gif), `${(fs.statSync(gif).size / 1024).toFixed(0)} kB`);

await browser.close();
server.close();
if (warnings.length) console.warn('Browser warnings:\n' + warnings.join('\n'));
if (errors.length) { console.error('Errors:\n' + errors.join('\n')); process.exit(1); }
console.log(JSON.stringify({ shots: shots.map((s) => path.relative(root, s)), mp4: path.relative(root, mp4), gif: path.relative(root, gif) }));
console.log('3d shots done');
