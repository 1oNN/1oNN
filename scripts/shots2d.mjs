// Visual check of the 2D game and the gallery in docs/visuals: serves the folder, plays the scarf by
// keyboard and writes screenshots of the title (day and night), mid-game (a wrong stitch waiting to be
// frogged, a hold, idle), a clean game (a run of neat stitches, then the A+ completion card) at desktop
// (1180x820) and phone (390x844) sizes to docs/visuals/2d-*.png, plus a 2x close-up of the project
// cards and of the mat, the out-of-yarn card, a phone on its side, and the 1200x630 social preview
// docs/visuals/og-card.png (scripts/og-card.html: the name, a swatch drawn by js/render.js, a tagline).
// Run: CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/shots2d.mjs [desktop|phone|cards|fabric|oops|landscape|og]
// It fails if a plank seam of the tabletop crosses a line of text on the wood, if the clean game does
// not come out A+ (after three tries), or if the social card's tagline wraps or anything leaves its frame.
// The 2D game needs no WebGL, so Chromium runs without the SwiftShader GL flags: under SwiftShader
// every frame of the full-page grain overlay costs ~90 ms and CSS transitions lag far behind real time.
// Set GL=1 to launch with them anyway (e.g. to check the page next to the 3D view).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'visuals');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: process.env.GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const errors = [];
const keys = { ch: 'c', sc: 's', hdc: 'h', dc: 'd', bo: 'b' };

/** No plank seam (3 px every 230 px of the tabletop, offset --seam-y) may cross a line of text that
 *  sits on the wood: it would read as struck through, the leaflet's mark for a finished row. */
async function seamCheck(page, name) {
  const crossed = await page.evaluate(() => {
    const o = parseFloat(getComputedStyle(document.body).getPropertyValue('--seam-y')) || 0;
    const sy = window.scrollY; const bad = [];
    ['.topbar .titles', '#next', '.pick-head h2', '.pick-head small', '.hero h1', '.hero .tagline', '.foot'].forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height || !r.width) return;
      const a = r.top + sy; const b = r.bottom + sy;
      for (let y = o + 230 * Math.floor((a - 3 - o) / 230); y < b; y += 230) if (y + 3 > a) bad.push(`${sel} (${Math.round(a)}-${Math.round(b)}) by the seam at ${y}`);
    }));
    return bad;
  });
  crossed.forEach((m) => errors.push(`${name}: a plank seam crosses ${m}`));
}
async function shot(page, name, opts = {}) {
  const file = path.join(out, `2d-${name}.png`);
  await page.screenshot({ path: file, ...opts });
  await seamCheck(page, name);
  console.log('wrote', path.relative(root, file));
}
async function setTheme(page, t) {
  await page.evaluate((theme) => window.__crochet.setTheme(theme), t);
  await page.waitForTimeout(700); // frames are slow under SwiftShader: let the colour transitions finish
}
async function playSteps(page, steps, from, to, slips = {}, neat = 230) {
  for (let i = from; i < to; i += 1) {
    const s = steps[i];
    if (s.type === 'stitch') {
      const hold = slips[i] ?? neat;
      await page.keyboard.down(keys[s.st]);
      await page.waitForTimeout(hold);
      await page.keyboard.up(keys[s.st]);
    } else if (s.type === 'yarn') {
      await page.keyboard.press(String(s.yarn + 1));
    } else {
      await page.keyboard.press('t');
    }
  }
}
function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
}
async function fresh(context, tag, bests = {}) {
  const page = await context.newPage();
  watch(page, tag);
  await page.goto(url);
  await page.waitForSelector('.card');
  await page.evaluate((more) => {
    localStorage.clear();
    localStorage.setItem('crochet-game.best.coaster', JSON.stringify({ neat: 94, mistakes: 1, timeMs: 108000, grade: 'A' }));
    Object.entries(more).forEach(([id, b]) => localStorage.setItem(`crochet-game.best.${id}`, JSON.stringify(b)));
  }, bests);
  await page.reload();
  await page.waitForSelector('.card');
  return page;
}

async function run(viewport, tag) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await fresh(context, tag);
  await page.waitForTimeout(2000); // let the title underline draw itself (750 ms, slower headless)
  await shot(page, `title-${tag}`);
  if (tag === 'phone') await shot(page, 'title-full-phone', { fullPage: true });
  await setTheme(page, 'dark');
  await shot(page, `title-dark-${tag}`);
  await setTheme(page, 'light');

  await page.click('.card:nth-child(2)');
  await page.waitForSelector('#play:not([hidden])');
  const steps = await page.evaluate(() => window.__crochet.game.steps);
  const slips = { 7: 40, 9: 700, 20: 120, 33: 560 }; // loose, tight, nearly (loose side), nearly (tight side)
  const midIdx = steps.findIndex((s) => s.row === 5 && s.type === 'stitch' && s.i === 5);
  await playSteps(page, steps, 0, midIdx, slips);

  // a wrong stitch sits on the hook
  await page.keyboard.press('d', { delay: 300 });
  await page.waitForTimeout(500);
  await shot(page, `wrong-${tag}`);
  await page.keyboard.press('f');
  await page.waitForTimeout(350);

  // mid-hold, in the green
  await page.keyboard.down('s');
  await page.waitForTimeout(260);
  await shot(page, `hold-${tag}`);
  await page.keyboard.up('s');
  // the screenshot above makes that hold long (slow headless frames), so make one neat stitch before the idle shot
  await playSteps(page, steps, midIdx + 1, midIdx + 2, slips);
  await page.waitForTimeout(600);
  await shot(page, `play-${tag}`);
  if (tag === 'phone') await shot(page, 'play-full-phone', { fullPage: true });
  await setTheme(page, 'dark');
  await shot(page, `play-dark-${tag}`);
  await setTheme(page, 'light');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) errors.push(`${tag}: page scrolls horizontally`);

  // the rest of this game is not shown: back to the projects for a clean one
  await page.keyboard.press('Escape');
  await page.waitForSelector('#title:not([hidden])');
  await cleanGame(page, tag);
  await context.close();
}

/**
 * The scarf made with every stitch in the green: a run of neat stitches part way along row 8 (all
 * green chips, 100% neat, no mistakes), then fastened off for the A+ card. Holds are real key holds,
 * so a slow moment on a loaded machine can spoil one; then the game is started again (three tries).
 */
async function cleanGame(page, tag) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.click('.card:nth-child(2)');
    await page.waitForSelector('#play:not([hidden])');
    const steps = await page.evaluate(() => window.__crochet.game.steps);
    const runIdx = steps.findIndex((s) => s.row === 7 && s.type === 'stitch' && s.i === 11);
    await playSteps(page, steps, 0, runIdx, {}, 300);
    await page.waitForTimeout(700); // the last stitch's draw-in and the chip colours
    const allNeat = await page.evaluate(() => {
      const g = window.__crochet.game;
      return g.mistakes === 0 && g.rows.every((r) => r.every((s) => s.q === 'neat'));
    });
    if (!allNeat) { console.log(tag, `clean game, try ${attempt}: a stitch missed the green, starting again`); await page.keyboard.press('Escape'); await page.waitForSelector('#title:not([hidden])'); continue; }
    await shot(page, `streak-${tag}`);
    await playSteps(page, steps, runIdx, steps.length, {}, 300);
    await page.waitForSelector('#done:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(1600); // the stamp thuds down and the confetti has fallen
    const stats = await page.evaluate(() => window.__crochet.game.stats());
    console.log(tag, JSON.stringify(stats));
    if (stats.grade !== 'A+') { console.log(tag, `clean game, try ${attempt}: graded ${stats.grade}, starting again`); await page.keyboard.press('Escape'); await page.waitForSelector('#title:not([hidden])'); continue; }
    await shot(page, `done-${tag}`);
    await setTheme(page, 'dark');
    await shot(page, `done-dark-${tag}`);
    await setTheme(page, 'light');
    return;
  }
  errors.push(`${tag}: the clean game did not come out A+ in three tries`);
}

/** The three project cards up close (2x), one made already and graded, two not yet made. */
async function cardsCloseUp() {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  const page = await fresh(context, 'cards', { scarf: { neat: 100, mistakes: 0, timeMs: 47000, grade: 'A+' } });
  await page.waitForTimeout(1500);
  const clip = await page.evaluate(() => {
    const h = document.querySelector('.pick-head').getBoundingClientRect();
    const c = document.querySelector('#cards').getBoundingClientRect();
    // down to just above the tape on the "How to play" card, so no torn-off scrap of it shows
    const tape = document.querySelector('.howto .tape').getBoundingClientRect();
    return { x: Math.max(0, c.left - 26), y: h.top - 22, width: c.width + 52, height: Math.min(c.bottom + 30, tape.top - 2) - h.top + 22 };
  });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await setTheme(page, 'dark');
    const name = theme === 'dark' ? 'cards-dark' : 'cards';
    await page.screenshot({ path: path.join(out, `2d-${name}.png`), clip });
    await seamCheck(page, name);
    console.log(`wrote docs/visuals/2d-${name}.png`);
  }
  await context.close();
}

/** The 1200x630 social preview: scripts/og-card.html, a page made of the game's own tokens and renderer. */
async function ogCard() {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  watch(page, 'og');
  await page.goto(`${url}scripts/og-card.html`);
  await page.waitForFunction(() => window.__ogReady === true, null, { timeout: 10000 });
  const check = await page.evaluate(() => window.__ogCheck());
  check.problems.forEach((m) => errors.push(`og-card: ${m}`));
  await page.screenshot({ path: path.join(out, 'og-card.png') });
  console.log(`wrote docs/visuals/og-card.png (tagline ${check.tagline}px, seams at ${check.seam})`);
  await context.close();
}

async function fabricCloseUp() {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  const page = await fresh(context, '2x');
  await page.click('.card:nth-child(2)');
  await page.waitForSelector('#play:not([hidden])');
  const steps = await page.evaluate(() => window.__crochet.game.steps);
  const slips = { 7: 40, 9: 700, 20: 120, 33: 560 };
  const until = steps.findIndex((s) => s.row === 4 && s.type === 'stitch' && s.i === 7);
  await playSteps(page, steps, 0, until, slips);
  await page.keyboard.press('s', { delay: 300 }); // an sc in a dc row: wrong, so the pin shows
  await page.waitForTimeout(500);
  await page.locator('.mat').screenshot({ path: path.join(out, '2d-fabric-2x.png') });
  console.log('wrote docs/visuals/2d-fabric-2x.png');
  await setTheme(page, 'dark');
  await page.locator('.mat').screenshot({ path: path.join(out, '2d-fabric-2x-dark.png') });
  console.log('wrote docs/visuals/2d-fabric-2x-dark.png');
  await context.close();
}

/** The ran-out-of-yarn variant of the completion card (the ball is emptied by hand). */
async function outOfYarn() {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await fresh(context, 'oops');
  await page.click('.card:nth-child(3)');
  await page.waitForSelector('#play:not([hidden])');
  const steps = await page.evaluate(() => window.__crochet.game.steps);
  const until = steps.findIndex((s) => s.row === 2 && s.type === 'stitch' && s.st === 'bo');
  await playSteps(page, steps, 0, until);
  await page.evaluate(() => { window.__crochet.game.yarnLeft = 3; });
  await page.keyboard.press('b', { delay: 300 });
  await page.waitForSelector('#done:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot(page, 'oops-desktop');
  await context.close();
}

/** A large phone on its side (932 x 430, touch): the mat beside the meters and keys, all above the fold. */
async function landscape() {
  const context = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await fresh(context, 'landscape');
  await page.click('.card:nth-child(2)');
  await page.waitForSelector('#play:not([hidden])');
  const steps = await page.evaluate(() => window.__crochet.game.steps);
  const midIdx = steps.findIndex((s) => s.row === 5 && s.type === 'stitch' && s.i === 5);
  await playSteps(page, steps, 0, midIdx, { 7: 40, 9: 700 });
  await page.waitForTimeout(500);
  await shot(page, 'play-landscape');
  const fold = await page.evaluate(() => ['#next', '#btn-turn', '#yarn-buttons'].map((s) => document.querySelector(s).getBoundingClientRect().bottom).every((b) => b <= innerHeight + 0.5));
  if (!fold) errors.push('landscape 932x430: the next strip or a key is below the fold');
  await context.close();
}

const only = process.argv[2];
if (!only || only === 'desktop') await run({ width: 1180, height: 820 }, 'desktop');
if (!only || only === 'phone') await run({ width: 390, height: 844 }, 'phone');
if (!only || only === 'cards') await cardsCloseUp();
if (!only || only === 'fabric') await fabricCloseUp();
if (!only || only === 'oops') await outOfYarn();
if (!only || only === 'landscape') await landscape();
if (!only || only === 'og') await ogCard();

await browser.close();
server.close();
if (errors.length) { console.error('Browser errors:\n' + errors.join('\n')); process.exit(1); }
console.log('shots done');
