// Screenshot of the design board (docs/design-board.html) and the checks that keep it honest.
// Serves the project, opens the board in Chromium, waits for every picture and the live glyph sheet,
// and writes a full-page capture. Fails if a picture or the renderer did not load, the inlined tokens
// drift from docs/design-tokens.css, a glyph canvas is blank, or the page scrolls sideways at 390 px.
//
//   node scripts/shots-board.mjs                          # docs/visuals/design-board.png, day, 1180 wide
//   node scripts/shots-board.mjs --dark --out=/tmp/b.png  # the lamp theme
//   node scripts/shots-board.mjs --width=390 --slices=/tmp/slices   # also write 1400 px tall slices to look at
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const width = Number(args.width || 1180);
const theme = args.dark ? 'dark' : 'light';
const out = path.resolve(args.out || path.join(root, 'docs', 'visuals', 'design-board.png'));

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.gif': 'image/gif', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json',
};
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/docs/design-board.html`;

const failures = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function open(w, scheme) {
  const context = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.__board && window.__board.ready, null, { timeout: 30000 });
  await page.evaluate(async () => {
    // the board lazy-loads its pictures; a full-page capture does not scroll, so ask for them all now
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    // loaded is not painted: a full-page capture can run before an off-screen picture is decoded
    await Promise.all([...document.images].map((i) => i.decode().catch(() => null)));
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return { context, page, errors };
}

async function check(page, errors, label) {
  const res = await page.evaluate(() => {
    const out = {};
    out.error = window.__board.error || null;
    out.badImages = [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
    out.images = document.images.length;
    const canvases = [...document.querySelectorAll('[data-sheet] canvas')];
    out.canvases = canvases.length;
    out.blank = canvases.filter((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) return false;
      return true;
    }).map((c) => c.getAttribute('aria-label'));
    out.scroll = document.documentElement.scrollWidth - window.innerWidth;
    out.bodyClip = document.body.scrollWidth - document.body.clientWidth;
    out.tokens = document.getElementById('tokens').textContent.trim();
    out.height = document.documentElement.scrollHeight;
    out.fonts = ['display', 'body', 'mono'].map((k) => document.getElementById(`res-${k}`).textContent);
    return out;
  });
  const tokens = fs.readFileSync(path.join(root, 'docs', 'design-tokens.css'), 'utf8').trim();
  if (res.error) failures.push(`${label}: glyph sheet failed: ${res.error}`);
  if (res.badImages.length) failures.push(`${label}: pictures did not load: ${res.badImages.join(', ')}`);
  if (res.canvases !== 40) failures.push(`${label}: expected 40 glyph canvases, found ${res.canvases}`);
  if (res.blank.length) failures.push(`${label}: blank glyphs: ${res.blank.join(', ')}`);
  if (res.scroll > 0) failures.push(`${label}: page scrolls sideways by ${res.scroll} px`);
  if (res.bodyClip > 0) failures.push(`${label}: body clips ${res.bodyClip} px`);
  if (res.tokens !== tokens) failures.push(`${label}: the inlined tokens differ from docs/design-tokens.css`);
  errors.forEach((e) => failures.push(`${label}: ${e}`));
  console.log(`${label}: ${res.images} pictures, ${res.canvases} glyphs, ${res.height} px tall, fonts ${res.fonts.join(' / ')}`);
  return res;
}

// The capture.
{
  const { context, page, errors } = await open(width, theme);
  const res = await check(page, errors, `${width}px ${theme}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const shot = await page.screenshot({ path: out, fullPage: true });
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
  // Every picture must have painted into the capture, not just loaded: sample each one's box in the
  // PNG (decoded in the page) and fail on a flat placeholder.
  const flat = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const sy = window.scrollY;
    return [...document.images].filter((el) => {
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + window.scrollX + r.width * 0.1); const y = Math.round(r.top + sy + r.height * 0.1);
      const w = Math.max(1, Math.round(r.width * 0.8)); const h = Math.max(1, Math.round(r.height * 0.8));
      const d = ctx.getImageData(x, y, w, h).data;
      let lo = 255; let hi = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; if (v < lo) lo = v; if (v > hi) hi = v; }
      return hi - lo < 24; // a real capture has contrast inside it; a placeholder is one flat tone
    }).map((el) => el.getAttribute('src'));
  }, shot.toString('base64'));
  if (flat.length) failures.push(`${width}px ${theme}: pictures blank in the capture: ${flat.join(', ')}`);
  if (args.slices) {
    const dir = path.resolve(String(args.slices));
    fs.mkdirSync(dir, { recursive: true });
    const tall = 1400;
    for (let y = 0, n = 0; y < res.height; y += tall, n += 1) {
      const h = Math.min(tall, res.height - y);
      await page.screenshot({ path: path.join(dir, `slice-${String(n).padStart(2, '0')}.png`), fullPage: true, clip: { x: 0, y, width, height: h } });
    }
    console.log(`slices in ${dir}`);
  }
  await context.close();
}

// The phone check, whatever was captured.
if (width !== 390) {
  const { context, page, errors } = await open(390, theme);
  await check(page, errors, `390px ${theme}`);
  await context.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('design board ok');
