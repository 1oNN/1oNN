// Browser smoke test: serves the game, plays a whole project by keyboard, and saves screenshots.
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
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
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

await page.goto(url);
await page.waitForSelector('.card');
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
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
    await page.screenshot({ path: path.join(root, 'docs', 'screenshot.png') });
  }
}
await page.waitForSelector('#done:not([hidden])', { timeout: 5000 });
// Phone-width layout check on a fresh page.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
phone.on('pageerror', (e) => errors.push(`phone pageerror: ${e.message}`));
await phone.goto(url);
await phone.click('.card:nth-child(1)');
await phone.waitForSelector('#play:not([hidden])');
const wide = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (wide) errors.push('phone layout scrolls horizontally');
await phone.screenshot({ path: path.join(root, 'docs', 'phone.png'), fullPage: true });
await phone.close();
await page.screenshot({ path: path.join(root, 'docs', 'finished.png') });
const stats = await page.evaluate(() => window.__crochet.game.stats());
const status = await page.evaluate(() => window.__crochet.game.status);
console.log(JSON.stringify({ status, stats }, null, 2));

await browser.close();
server.close();
if (errors.length) { console.error('Browser errors:\n' + errors.join('\n')); process.exit(1); }
if (status !== 'done' || stats.mistakes !== 1) { console.error('Unexpected end state'); process.exit(1); }
console.log('smoke test passed');
