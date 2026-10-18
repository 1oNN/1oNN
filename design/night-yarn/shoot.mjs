// Screenshots the Night Yarn mockup with headless Chromium. Run from the repo root:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node design/night-yarn/shoot.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/design/night-yarn/mockup.html`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
async function shoot(name, viewport, { hash = '', fullPage = true, clip = null, scale = 1 } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(url + hash);
  await page.waitForTimeout(250);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) errors.push(`${name}: page scrolls horizontally`);
  const out = path.join(here, `${name}.png`);
  if (clip) {
    const box = await page.locator(clip).boundingBox();
    await page.screenshot({ path: out, clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } });
  } else {
    await page.screenshot({ path: out, fullPage });
  }
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${name}: ${viewport.width}x${viewport.height} page height ${h}`);
  await page.close();
}
await shoot('desktop', { width: 1180, height: 820 });
await shoot('phone', { width: 390, height: 844 });
await shoot('desktop-light', { width: 1180, height: 820 }, { hash: '#light' });
await shoot('_fabric-2x', { width: 1180, height: 820 }, { clip: '#play .stage', scale: 2 });
await shoot('_fabric-2x-light', { width: 1180, height: 820 }, { hash: '#light', clip: '#play .stage', scale: 2 });
await browser.close();
server.close();
if (errors.length) { console.error('Problems:\n' + errors.join('\n')); process.exit(1); }
console.log('ok');
