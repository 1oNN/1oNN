// Browser smoke test: serves the game, plays a whole project by keyboard, and saves screenshots.
// Then switches a game in progress to the 3D view (key V) in a second Chromium with SwiftShader WebGL.
// Needs playwright (npx playwright or a global install) and Chromium. Run: node scripts/smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

/**
 * Nothing on the play screen may run past the right gutter. body has overflow-x: hidden, so a too-wide
 * column is clipped rather than scrolled, and documentElement.scrollWidth alone can never see it:
 * check body's own scroll width and the right edge of every control that has to be reachable.
 */
const overflow = (p) => p.evaluate(() => {
  const out = [];
  const lim = window.innerWidth - 15; // 16 px gutter, 1 px of rounding
  if (document.documentElement.scrollWidth > window.innerWidth) out.push(`page scrolls (${document.documentElement.scrollWidth} > ${window.innerWidth})`);
  if (document.body.scrollWidth > document.body.clientWidth) out.push(`body is clipping ${document.body.scrollWidth - document.body.clientWidth} px`);
  ['.mat', '#mute', '.topbar', '#buttons .tag:last-child', '#yarn-buttons', '.actions', '.instruments', '#view-toggle'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.offsetParent === null) return;
    const r = el.getBoundingClientRect().right;
    if (r > lim + 0.5) out.push(`${sel} ends at ${r.toFixed(1)} (> ${lim})`);
  });
  return out;
});
const settleFrames = (p, n = 2) => p.evaluate((k) => new Promise((r) => { const f = (i) => (i <= 0 ? r() : requestAnimationFrame(() => f(i - 1))); f(k); }), n);

await page.goto(url);
await page.waitForSelector('.card');
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
await page.waitForTimeout(900); // the title's underline draws itself in on load
await page.screenshot({ path: path.join(root, 'docs', 'title.png') });

// Start the scarf (has yarn changes and two stitch heights) and play it with a few deliberate slips.
await page.click('.card:nth-child(2)');
await page.waitForSelector('#play:not([hidden])');
const steps = await page.evaluate(() => window.__crochet.game.steps);
const keys = { ch: 'c', sc: 's', hdc: 'h', dc: 'd', bo: 'b' };

let shot = false;
for (let i = 0; i < steps.length; i += 1) {
  const s = steps[i];
  if (s.type === 'stitch') {
    if (i === 4) { // a wrong stitch, then frog it
      await page.keyboard.press('d', { delay: 300 });
      await page.keyboard.press('f');
    }
    const hold = i === 7 ? 40 : i === 9 ? 700 : 300; // one loose, one tight, rest neat
    await page.keyboard.down(keys[s.st]);
    await page.waitForTimeout(hold);
    await page.keyboard.up(keys[s.st]);
  } else if (s.type === 'yarn') {
    await page.keyboard.press(String(s.yarn + 1));
  } else {
    await page.keyboard.press('t');
  }
  if (!shot && s.row === 5 && s.type === 'turn') {
    shot = true;
    await page.waitForTimeout(450); // let the turn's row tick and strike-through finish
    await page.screenshot({ path: path.join(root, 'docs', 'screenshot.png') });
  }
}
await page.waitForSelector('#done:not([hidden])', { timeout: 5000 });
// Phone-width layout checks: every project at 360, 375 and 390 px, nothing past the right gutter.
for (const [w, h] of [[360, 740], [375, 667], [390, 844]]) {
  const phone = await browser.newPage({ viewport: { width: w, height: h } });
  phone.on('pageerror', (e) => errors.push(`phone ${w} pageerror: ${e.message}`));
  await phone.goto(url);
  await phone.waitForSelector('.card');
  for (const n of [1, 2, 3]) {
    await phone.click(`.card:nth-child(${n})`);
    await phone.waitForSelector('#play:not([hidden])');
    await settleFrames(phone, 2);
    (await overflow(phone)).forEach((m) => errors.push(`phone ${w}x${h}, project ${n}: ${m}`));
    if (w === 390 && n === 1) await phone.screenshot({ path: path.join(root, 'docs', 'phone.png'), fullPage: true });
    await phone.keyboard.press('Escape');
    await phone.waitForSelector('#title:not([hidden])');
  }
  await phone.close();
}
// A window narrowed from a laptop to a phone mid-game must re-fit, not hold the old width open.
{
  const rs = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  rs.on('pageerror', (e) => errors.push(`resize pageerror: ${e.message}`));
  await rs.goto(url);
  await rs.click('.card:nth-child(2)');
  await rs.waitForSelector('#play:not([hidden])');
  await settleFrames(rs, 2);
  await rs.setViewportSize({ width: 390, height: 844 });
  await rs.waitForTimeout(200);
  await settleFrames(rs, 3);
  (await overflow(rs)).forEach((m) => errors.push(`resized 1180 -> 390: ${m}`));
  await rs.close();
}
// A phone on its side, up to the largest (956 x 440): the next strip and every key above the fold.
for (const [w, h] of [[568, 320], [844, 390], [932, 430], [956, 440]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const land = await ctx.newPage();
  land.on('pageerror', (e) => errors.push(`landscape ${w} pageerror: ${e.message}`));
  await land.goto(url);
  await land.click('.card:nth-child(2)');
  await land.waitForSelector('#play:not([hidden])');
  await settleFrames(land, 2);
  const fold = await land.evaluate(() => ['#next', '#buttons', '#btn-turn', '#yarn-buttons'].map((sel) => [sel, document.querySelector(sel).getBoundingClientRect().bottom, innerHeight]));
  fold.forEach(([sel, b, ih]) => { if (b > ih + 0.5) errors.push(`landscape ${w}x${h}: ${sel} ends at ${b.toFixed(1)}, below the fold (${ih})`); });
  (await overflow(land)).forEach((m) => errors.push(`landscape ${w}x${h}: ${m}`));
  await ctx.close();
}
// Leaving during the beat before the completion card: Esc must win (no card over the title, no error).
{
  const race = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const raceErrors = [];
  race.on('pageerror', (e) => { raceErrors.push(e.message); errors.push(`race pageerror: ${e.message}`); });
  await race.goto(url);
  await race.click('.card:nth-child(1)');
  await race.waitForSelector('#play:not([hidden])');
  await race.evaluate(() => {
    const g = window.__crochet.game;
    while (g.active && g.step.type !== 'finish') {
      const s = g.step;
      if (s.type === 'stitch') g.pressStitch(s.st, 300); else if (s.type === 'yarn') g.pressYarn(s.yarn); else g.pressTurn();
    }
  });
  await race.keyboard.press('t'); // fasten off: the card is due in 900 ms
  await race.waitForTimeout(150);
  await race.keyboard.press('Escape');
  await race.waitForTimeout(1200);
  const st = await race.evaluate(() => ({ done: !document.querySelector('#done').hidden, title: !document.querySelector('#title').hidden }));
  if (st.done || !st.title) errors.push(`Esc before the completion card: ${JSON.stringify(st)} (the card must not open over the title)`);
  await race.keyboard.press('Enter');
  await race.waitForTimeout(200);
  if (raceErrors.length) errors.push(`Esc before the completion card threw: ${raceErrors.join('; ')}`);
  await race.close();
}
await page.screenshot({ path: path.join(root, 'docs', 'finished.png') });
const stats = await page.evaluate(() => window.__crochet.game.stats());
const status = await page.evaluate(() => window.__crochet.game.status);
console.log(JSON.stringify({ status, stats }, null, 2));
await browser.close();

// ---------- 3D view: switch a game in progress to 3D and back ----------
// A separate Chromium with SwiftShader WebGL, so the 2D run above stays exactly as it was.
const gl = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const frames = (p, n = 2) => p.evaluate((k) => new Promise((r) => { const f = (i) => (i <= 0 ? r() : requestAnimationFrame(() => f(i - 1))); f(k); }), n);
const threeCanvas = '#view3d canvas[data-engine^="three.js"]';
const fail = (msg) => errors.push(`3d: ${msg}`);
{
  const p3 = await gl.newPage({ viewport: { width: 1180, height: 820 } });
  const pageErrors = [];
  p3.on('pageerror', (e) => { pageErrors.push(e.message); errors.push(`3d pageerror: ${e.message}`); });
  p3.on('console', (m) => { if (m.type() === 'error') errors.push(`3d console: ${m.text()}`); });
  await p3.goto(url);
  await p3.waitForSelector('.card');
  await p3.click('.card:nth-child(2)');
  await p3.waitForSelector('#play:not([hidden])');
  if (await p3.isHidden('#view-toggle')) fail('the 2D | 3D control is hidden although WebGL works');
  if (await p3.evaluate(() => [...document.scripts].some((x) => /view3d/.test(x.src)) || performance.getEntriesByType('resource').some((r) => /view3d/.test(r.name)))) fail('view3d.js was loaded before 3D was asked for');
  // Holds are timed by the key events' own timestamps (CDP), 300 ms apart: under SwiftShader a key
  // event is acknowledged only once the busy renderer has handled it, so a wait between two
  // keyboard.down/up calls makes holds as long as the load makes them (and the README image sloppy).
  const cdp = await p3.context().newCDPSession(p3);
  const holdKey = async (k, ms = 300) => {
    const ev = { key: k, code: `Key${k.toUpperCase()}`, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0), nativeVirtualKeyCode: k.toUpperCase().charCodeAt(0) };
    const t0 = Date.now() / 1000;
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev, text: k, timestamp: t0 });
    await p3.waitForTimeout(ms);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev, timestamp: t0 + ms / 1000 });
  };
  // Work into row 4 (by the game's own rules, neat holds), the last move by key, then press V mid-row.
  const st = await p3.evaluate(() => window.__crochet.game.steps);
  const upto = st.findIndex((x) => x.row === 3 && x.type === 'stitch' && x.i === 4);
  await p3.evaluate((n) => {
    const g = window.__crochet.game;
    while (g.active && g.idx < n - 1) {
      const s = g.step;
      if (s.type === 'stitch') g.pressStitch(s.st, 300); else if (s.type === 'yarn') g.pressYarn(s.yarn); else g.pressTurn();
    }
  }, upto);
  await holdKey(keys[st[upto - 1].st]); // one move through the UI, so the panel shows the state
  await p3.keyboard.press('v');
  await p3.waitForSelector(threeCanvas, { timeout: 90000 });
  await p3.waitForSelector('.mat.is-3d', { timeout: 90000 });
  await frames(p3, 2);
  if (pageErrors.length) fail(`page errors after switching to 3D: ${pageErrors.join('; ')}`);
  if (!(await p3.$(threeCanvas))) fail('no three.js <canvas> in #view3d');
  const before = await p3.evaluate(() => ({
    stitches: window.__crochet.view3d.stitchCount,
    placed: window.__crochet.game.rows.reduce((n, r) => n + r.length, 0),
    stored: localStorage.getItem('hooked.view'),
    fabric: getComputedStyle(document.querySelector('#fabric')).visibility,
  }));
  if (before.stitches !== before.placed) fail(`3D shows ${before.stitches} stitches, the game has ${before.placed}`);
  if (before.stored !== '3d') fail(`hooked.view is ${before.stored}, not 3d`);
  if (before.fabric !== 'hidden') fail('the 2D canvas still shows under the 3D view');
  // Keep playing in 3D: input is unchanged and the view follows every stitch.
  for (let i = upto; i < upto + 3; i += 1) await holdKey(keys[st[i].st]);
  await frames(p3, 3);
  const after = await p3.evaluate(() => window.__crochet.view3d.stitchCount);
  if (after !== before.stitches + 3) fail(`3D did not follow play (${before.stitches} -> ${after} stitches)`);
  fs.mkdirSync(path.join(root, 'docs', 'visuals'), { recursive: true });
  await p3.waitForTimeout(400); // let the newest stitch finish growing out of the loop
  await frames(p3, 2);
  const neat3d = await p3.evaluate(() => window.__crochet.game.stats().neat);
  if (neat3d < 90) fail(`the game played for the README's 3D image is only ${neat3d}% neat (holds are 300 ms: want at least 90%)`);
  else await p3.screenshot({ path: path.join(root, 'docs', 'visuals', 'game-3d.png') });
  // Back to 2D (V), and the 3D view is kept but put away; 3D again comes straight back.
  await p3.keyboard.press('v');
  await frames(p3, 2);
  const flat = await p3.evaluate(() => ({ is3d: document.querySelector('.mat').classList.contains('is-3d'), hidden: document.querySelector('#view3d').hidden, view: window.__crochet.view }));
  if (flat.is3d || !flat.hidden || flat.view !== '2d') fail(`V did not go back to 2D (${JSON.stringify(flat)})`);
  await p3.keyboard.press('v');
  await p3.waitForSelector('.mat.is-3d', { timeout: 30000 });
  // Leaving the play screen disposes of the 3D view.
  await p3.keyboard.press('Escape');
  await p3.waitForSelector('#title:not([hidden])');
  const gone = await p3.evaluate(() => ({ canvas: !!document.querySelector('#view3d canvas'), view: !!window.__crochet.view3d }));
  if (gone.canvas || gone.view) fail(`the 3D view was not disposed on leaving (${JSON.stringify(gone)})`);
  // The choice is remembered: the next project opens in 3D.
  await p3.click('.card:nth-child(1)');
  await p3.waitForSelector(threeCanvas, { timeout: 90000 });
  await p3.keyboard.press('v');
  await p3.keyboard.press('Escape');
  console.log(JSON.stringify({ view3d: { before, after } }));
  await p3.close();
}
for (const [w, h, n] of [[390, 844, 1], [360, 740, 3]]) {
  // Phone width in 3D: nothing past the right gutter (the coaster at 390, the long-named pouch at 360).
  const ph = await gl.newPage({ viewport: { width: w, height: h } });
  ph.on('pageerror', (e) => errors.push(`3d phone pageerror: ${e.message}`));
  await ph.goto(url);
  await ph.evaluate(() => localStorage.setItem('hooked.view', '3d'));
  await ph.click(`.card:nth-child(${n})`);
  await ph.waitForSelector(threeCanvas, { timeout: 90000 });
  await frames(ph, 2);
  (await overflow(ph)).forEach((m) => fail(`phone ${w}x${h} in 3D: ${m}`));
  await ph.close();
}
await gl.close();

server.close();
if (errors.length) { console.error('Browser errors:\n' + errors.join('\n')); process.exit(1); }
if (status !== 'done' || stats.mistakes !== 1) { console.error('Unexpected end state'); process.exit(1); }
console.log('smoke test passed');
