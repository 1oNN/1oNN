// DOM, input and audio glue for the crochet game.
import { PATTERNS, STITCHES, KEY_TO_STITCH, buildSteps } from './patterns.js';
import { Game, HOLD, tensionFromHold } from './game.js';
import {
  layout, draw, drawGuide, stitchGeometry, symbolSvg, setPalette, readPalette, yarnColor, getHookPosition,
} from './render.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#fabric');
const ctx = canvas.getContext('2d');

const ui = {
  title: $('#title'),
  cards: $('#cards'),
  play: $('#play'),
  done: $('#done'),
  rows: $('#rows'),
  chips: $('#chips'),
  next: $('#next'),
  leafletNext: $('#leaflet-next'),
  uhoh: $('#uhoh'),
  hint: $('#hint'),
  tension: $('#tension-fill'),
  tensionBar: $('#tension-fill .bar'),
  tensionLabel: $('#tension-label'),
  tensionKnob: $('#tension-knob'),
  tensionGhost: $('#tension-ghost'),
  tensionPin: $('#tension-pin'),
  yarnFill: $('#yarn-fill'),
  yarnLabel: $('#yarn-label'),
  yarnBall: $('#yarn-ball'),
  yarnRow: $('#yarn-row'),
  time: $('#stat-time'),
  neat: $('#stat-neat'),
  mistakes: $('#stat-mistakes'),
  buttons: $('#buttons'),
  yarnButtons: $('#yarn-buttons'),
  projectName: $('#project-name'),
  level: $('#level'),
  rowEyebrow: $('#row-eyebrow'),
  leafletTitle: $('#leaflet-title'),
  leafletMeta: $('#leaflet-meta'),
  matGauge: $('#mat-gauge'),
  toast: $('#toast'),
  doneEyebrow: $('#done-eyebrow'),
  doneTitle: $('#done-title'),
  doneBody: $('#done-body'),
  confetti: $('#confetti'),
  mute: $('#mute'),
  muteFoot: $('#mute-foot'),
  theme: $('#theme'),
  themeFoot: $('#theme-foot'),
  guide: $('#guide'),
  view3d: $('#view3d'),
  viewToggle: $('#view-toggle'),
  instruments: $('.instruments'),
};

let game = null;
let lay = null;
let hold = null;       // { st, start, vibrated } while a stitch key is held
let muted = false;
let toastTimer = null;
let ghostTimer = null;
let doneTimer = null;  // the completion card waits a beat after the last move (cancelled on leaving)
let scale = 1;         // device pixels per layout pixel on the fabric canvas
let lastRelease = null; // { q, ms } of the last stitch released, for the tension readout
const fx = { place: null, frog: null, yarn: null }; // feedback moments the renderer animates

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedMotion.matches;

// ---------- theme ----------
const THEME_KEY = 'hooked.theme';
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function currentTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark' || t === 'light') return t;
  return darkMQ.matches ? 'dark' : 'light';
}
function refreshPalette() {
  setPalette(readPalette());
  const dark = currentTheme() === 'dark';
  const label = `Theme: ${dark ? 'night' : 'day'} (N)`;
  ui.theme.setAttribute('aria-label', label);
  ui.theme.title = label;
  ui.themeFoot.innerHTML = `Theme: ${dark ? 'night' : 'day'} <kbd>N</kbd>`;
  drawGuideCard();
  if (game) { renderPanel(); } else { renderCards(); }
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage is optional */ }
  refreshPalette();
}
function toggleTheme() { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }
darkMQ.addEventListener('change', refreshPalette);
new MutationObserver(refreshPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- audio ----------
let audio = null;
function beep(freq, dur = 0.08, type = 'sine', gain = 0.08) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch { /* audio is optional */ }
}
const SOUNDS = {
  neat: () => beep(880, 0.09),
  ok: () => beep(660, 0.09),
  loose: () => beep(392, 0.14, 'triangle'),
  tight: () => beep(392, 0.14, 'triangle'),
  wrong: () => beep(140, 0.25, 'sawtooth', 0.06),
  frog: () => { beep(520, 0.06); setTimeout(() => beep(380, 0.08), 70); },
  turn: () => { beep(523, 0.07); setTimeout(() => beep(784, 0.1), 80); },
  finish: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 110)),
};

// ---------- helpers ----------
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function bestKey(id) { return `crochet-game.best.${id}`; }
function loadBest(id) { try { return JSON.parse(localStorage.getItem(bestKey(id))); } catch { return null; } }
function saveBest(id, stats) {
  const prev = loadBest(id);
  const better = !prev || stats.neat > prev.neat || (stats.neat === prev.neat && stats.timeMs < prev.timeMs);
  if (better) { try { localStorage.setItem(bestKey(id), JSON.stringify(stats)); } catch { /* ignore */ } }
  return better;
}
const QUALITY_WORD = { neat: 'neat', ok: 'nearly', loose: 'too loose', tight: 'too tight' };
const SHORT_NAME = { ch: 'chain', sc: 'single crochet', hdc: 'half double', dc: 'double crochet', bo: 'bobble' };
function kbd(k) { return `<kbd>${k}</kbd>`; }
function toast(msg, kind = '') {
  ui.toast.innerHTML = msg;
  ui.toast.className = `toast show ${kind}`;
  // keep the label off the hook: move it to the right when the hook is in the left 40%
  const hp = getHookPosition(game);
  if (hp && lay && hp.x / lay.width < 0.4) ui.toast.classList.add('right');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.classList.remove('show'); }, 1400);
}
function shake() {
  if (reduced()) return;
  const el = showing3d() ? ui.view3d : canvas; // shake whichever view of the work is on the mat
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
}
function flip() {
  if (reduced()) return;
  canvas.classList.remove('flip');
  void canvas.offsetWidth;
  canvas.classList.add('flip');
}
function stepLabel(step, html = true) {
  if (!step) return '';
  const key = (k) => (html ? kbd(k) : `(${k})`);
  if (step.type === 'stitch') return `${STITCHES[step.st].name} ${key(STITCHES[step.st].key.toUpperCase())}`;
  if (step.type === 'turn') return `turn the work ${key('T')}`;
  if (step.type === 'finish') return `fasten off ${key('T')}`;
  if (step.type === 'yarn') return `change to ${game.pattern.yarns[step.yarn].name} ${key(step.yarn + 1)}`;
  return '';
}
function splitName(name) {
  const m = name.match(/^(.*?)\s*(\(.*\))$/);
  return m ? `${m[1]} <small>${m[2]}</small>` : name;
}

// ---------- canvas scaling ----------
const mat = canvas.parentElement;
const work = mat.parentElement;
/** Extra mat height under the canvas that holds the 2D | 3D control when it cannot sit beside it. */
const TOGGLE_BAND = 40;
/**
 * Size the fabric canvas: the mat's inner width capped at 720 px, and short enough that the meters,
 * the next strip and every key stay on screen on a laptop (the work column must fit the viewport).
 * The 2D | 3D control sits in the mat's bottom-right corner, where the 2D ball is drawn, so it never
 * covers the canvas: the canvas moves left to clear it when the mat has spare width (a laptop), and
 * otherwise the mat grows a strip under the canvas for it (a phone, or a canvas at its full width).
 * The choice is made from the width without the strip, so it cannot flip back and forth.
 */
function fitCanvas() {
  if (!lay || ui.play.hidden) return;
  const ms = getComputedStyle(mat);
  const padX = parseFloat(ms.paddingLeft) + parseFloat(ms.paddingRight);
  const padY = 2 * parseFloat(ms.paddingTop) + 2; // the strip, when there is one, is added below
  const inner = mat.clientWidth - padX;
  // top bar, instruments, next strip, keys and gaps (fractional sizes: rounded ones make it flicker).
  // A phone on its side lays the meters and keys beside the mat: then only the top bar is above it.
  const wr = work.getBoundingClientRect(); const mr = mat.getBoundingClientRect();
  const beside = ui.instruments.getBoundingClientRect().left >= mr.right - 1;
  const chrome = beside ? mr.top - wr.top : wr.height - mr.height;
  const app = ui.play.parentElement;
  const as = getComputedStyle(app);
  const appPad = parseFloat(as.paddingTop) + 12;
  const fit = (band) => {
    const maxH = Math.max(190, window.innerHeight - chrome - padY - band - appPad);
    return Math.max(160, Math.floor(Math.min(inner, 720, (maxH * lay.width) / lay.height)));
  };
  let cssW = fit(0);
  let band = false; let shift = 0;
  if (!ui.viewToggle.hidden) {
    // room the control needs to the right of the canvas, measured from the mat's content edge
    const tg = ui.viewToggle;
    const need = tg.offsetWidth + (mat.clientWidth - tg.offsetLeft - tg.offsetWidth) + 6 - parseFloat(ms.paddingRight);
    const spare = inner - cssW;
    if (spare / 2 >= need) shift = 0;
    else if (spare >= need) shift = Math.ceil(2 * need - spare); // margin-right: the centred canvas slides left
    else { band = true; cssW = fit(TOGGLE_BAND); }
  }
  mat.classList.toggle('banded', band);
  canvas.style.marginRight = shift ? `${shift}px` : '';
  const curW = parseFloat(canvas.style.width) || 0;
  if (Math.abs(curW - cssW) < 2 && curW <= inner) cssW = curW;   // no 1 px see-saw with the layout
  else canvas.style.width = `${cssW}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  scale = dpr * (cssW / lay.width);
  const w = Math.round(lay.width * scale);
  const h = Math.round(lay.height * scale);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
function drawGuideCard() {
  if (ui.guide && !ui.title.hidden) drawGuide(ui.guide);
}
if ('ResizeObserver' in window) {
  new ResizeObserver(() => fitCanvas()).observe(mat);
  new ResizeObserver(() => drawGuideCard()).observe(ui.guide);
}
window.addEventListener('resize', () => {
  fitCanvas(); drawGuideCard();
  if (view3d && showing3d()) view3d.resize();
});

// ---------- tabletop plank seams ----------
// The wood has a 3 px plank seam every 230 px (css: --seam-y). A seam through a line of text on the
// wood reads as a strike-through (the leaflet's mark for a finished row), so the seams are slid, as a
// whole, to the offset that keeps them in the gaps between those lines (the hero mark matters less).
const SEAM_PERIOD = 230;
const SEAM_H = 3;
const SEAM_AVOID = [
  ['.topbar .titles', 10], ['#next', 10], ['.pick-head h2', 10], ['.pick-head small', 10],
  ['.hero h1', 10], ['.hero .tagline', 10], ['.foot', 10], ['.hero .mark', 3],
];
let seamY = -1;
function placeSeams() {
  const sy = window.scrollY;
  const spans = [];
  SEAM_AVOID.forEach(([sel, weight]) => document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0) spans.push([r.top + sy - 3, r.bottom + sy + 3, weight]);
  }));
  const cost = (o) => spans.reduce((c, [a, b, w]) => {
    // seams at o + 230k .. + 3: does any fall in [a, b)?
    const k = Math.ceil((a - SEAM_H - o) / SEAM_PERIOD);
    return o + k * SEAM_PERIOD < b ? c + w : c;
  }, 0);
  let best = seamY < 0 ? 0 : seamY; let bestCost = cost(best);
  for (let o = 0; o < SEAM_PERIOD && bestCost > 0; o += 1) {
    const c = cost(o);
    if (c < bestCost) { best = o; bestCost = c; }
  }
  if (best !== seamY) { seamY = best; document.body.style.setProperty('--seam-y', `${best}px`); }
}
if ('ResizeObserver' in window) new ResizeObserver(() => placeSeams()).observe(document.querySelector('#app'));

// ---------- 2D | 3D view ----------
// The 3D view (js/view3d.js on the vendored three.js) is another view of the same game: input,
// meters, next strip and leaflet do not change. It is imported the first time it is asked for,
// lives in #view3d over the mat for as long as the play screen is up, and is disposed on leaving it.
const VIEW_KEY = 'hooked.view';
let viewMode = storedView() || '2d'; // the view the player picked (remembered)
let view3d = null;          // the live 3D view, or null
let view3dModule = null;    // the import() promise, so the module is fetched once
let viewGen = 0;            // bumps whenever a pending 3D start should be abandoned
let webgl = null;           // null = not probed yet
function hasWebGL() {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      webgl = !!gl;
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext(); // the probe's context is not needed: give the slot back now
    } catch { webgl = false; }
  }
  return webgl;
}
/** The remembered view, or null when nothing is stored or storage is blocked (then the choice made
 *  in this session stands: a private window must not drop the player back to 2D on every project). */
function storedView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === '3d' || v === '2d' ? v : null;
  } catch { return null; }
}
/** Is the mat on screen? (A phone scrolled down to the leaflet does not need the 3D view drawn.) */
let matOnScreen = true;
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => { matOnScreen = entries[entries.length - 1].isIntersecting; }).observe(mat);
}
/** Is the 3D view the one on the mat right now (built and shown)? */
function showing3d() { return !!view3d && mat.classList.contains('is-3d'); }
function currentHold() {
  if (!hold) return null;
  const ms = performance.now() - hold.start;
  return { progress: Math.min(1, ms / HOLD.max), zone: tensionFromHold(ms).q };
}
function syncViewToggle() {
  ui.viewToggle.hidden = !hasWebGL();
  [...ui.viewToggle.querySelectorAll('button')].forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.view === viewMode));
    b.removeAttribute('aria-busy');
  });
}
function setView(mode, { remember = true } = {}) {
  viewMode = mode === '3d' && hasWebGL() ? '3d' : '2d';
  if (remember) { try { localStorage.setItem(VIEW_KEY, viewMode); } catch { /* storage is optional */ } }
  syncViewToggle();
  if (viewMode === '3d') show3d(); else show2d();
}
function toggleView() { if (hasWebGL()) setView(viewMode === '3d' ? '2d' : '3d'); }
function show2d() {
  viewGen += 1;
  ui.view3d.hidden = true;
  if (!view3d) delete ui.view3d.dataset.state;
  // Focus follows the work onto the canvas, but not off the 2D | 3D switch the player just used.
  const onToggle = ui.viewToggle.contains(document.activeElement);
  const hadFocus = !onToggle && (document.activeElement === document.body || mat.contains(document.activeElement));
  mat.classList.remove('is-3d');
  fitCanvas();
  if (hadFocus && ui.play && !ui.play.hidden) canvas.focus({ preventScroll: true });
}
/** In 3D the work area's focus target is the three.js canvas (the 2D canvas is hidden under it). */
function focus3d() {
  if (!view3d) return;
  const a = document.activeElement;
  if (ui.viewToggle.contains(a)) return; // a keyboard user on the switch stays on it
  if (a === document.body || a === canvas || mat.contains(a)) view3d.canvas.focus({ preventScroll: true });
}
async function show3d() {
  if (!game || ui.play.hidden) return;
  const gen = ++viewGen;
  if (view3d) {
    ui.view3d.hidden = false;
    ui.view3d.dataset.state = 'ready';
    mat.classList.add('is-3d');
    view3d.resize();
    view3d.invalidate(true); // it renders on demand: draw it now it is back on the mat
    view3d.update();
    focus3d();
    return;
  }
  // Build it laid out but invisible, so the renderer has a size, and keep drawing 2D until it is ready.
  const busy = ui.viewToggle.querySelector('[data-view="3d"]');
  busy.setAttribute('aria-busy', 'true');
  ui.view3d.dataset.state = 'loading';
  ui.view3d.hidden = false;
  let mod;
  try {
    view3dModule = view3dModule || import('./view3d.js');
    mod = await view3dModule;
  } catch (err) {
    view3dModule = null; // let a later try fetch it again
    if (gen === viewGen) fail3d(err);
    return;
  }
  if (gen !== viewGen) return; // the player moved on (2D, another start, or left): they own the mat now
  // One frame for the busy state to paint before the scene is built (that is one long task).
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  if (gen !== viewGen) return;
  let v;
  try {
    v = mod.createView3D(ui.view3d, { game, getHold: currentHold, theme: 'auto', framing: 'fit' });
  } catch (err) { fail3d(err); return; }
  view3d = v;
  v.canvas.tabIndex = 0;
  // Shaders compile and textures upload over the next tasks; 2D stays on the mat meanwhile.
  await v.ready;
  if (gen !== viewGen || view3d !== v) return; // put away (2D: it is kept, built) or freed meanwhile
  busy.removeAttribute('aria-busy');
  ui.view3d.dataset.state = 'ready';
  mat.classList.add('is-3d');
  view3d.resize();
  view3d.update();
  focus3d();
}
/** No 3D on this device after all: the control goes, 2D stays, and the preference is kept. */
function fail3d(err) {
  webgl = false;
  console.warn('3D view unavailable:', err);
  setView('2d', { remember: false });
  toast('The 3D view could not start here');
}
/** Leaving the play screen: free the GPU (geometries, textures, the context) and go back to 2D. */
function disposeView3d() {
  viewGen += 1;
  if (view3d) {
    const { renderer } = view3d;
    try { view3d.dispose(); } catch { /* already gone */ }
    try { renderer.forceContextLoss(); } catch { /* not every browser lets go on request */ }
    view3d = null;
  }
  ui.view3d.hidden = true;
  delete ui.view3d.dataset.state;
  mat.classList.remove('is-3d');
}
ui.viewToggle.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => { if (b.dataset.view !== viewMode) setView(b.dataset.view); });
});
/** A mouse click never leaves focus on a play-screen button, so Enter stays the turn key; Tab still
 *  reaches every button, and Enter or Space then activates the focused one. */
function keepFocusOff(el) { el.addEventListener('mousedown', (e) => e.preventDefault()); }
ui.viewToggle.querySelectorAll('button').forEach(keepFocusOff);

// ---------- title screen ----------
function renderCards() {
  ui.cards.innerHTML = '';
  PATTERNS.forEach((p) => {
    const best = loadBest(p.id);
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `
      <span class="eyebrow level">${p.level}</span>
      <strong>${p.name}</strong>
      <span class="blurb">${p.blurb}</span>
      <span class="yarns">${p.yarns.map((y) => `<i class="skein" style="--yarn:${yarnColor(y)}" title="${y.name}"></i>`).join('')}
        <small>${p.rows.length} rows · ${buildSteps(p).length} moves</small></span>
      <span class="best">${best ? `Best <b>${best.grade}</b> · ${best.neat}% neat · ${fmtTime(best.timeMs)}` : 'Not yet made'}</span>`;
    card.addEventListener('click', () => start(p));
    ui.cards.appendChild(card);
  });
}

// ---------- play screen ----------
function start(pattern) {
  clearTimeout(doneTimer); doneTimer = null;
  game = new Game(pattern);
  lay = layout(pattern);
  clearHold();
  lastRelease = null;
  fx.place = null; fx.frog = null; fx.yarn = null;
  ui.projectName.innerHTML = splitName(pattern.name);
  ui.level.textContent = `${pattern.level} · `;
  ui.leafletTitle.textContent = pattern.name;
  ui.leafletMeta.textContent = `${pattern.level} · ${pattern.yarns.length} yarn${pattern.yarns.length > 1 ? 's' : ''} · 5 mm hook · ${pattern.rows.length} rows`;
  ui.matGauge.textContent = `${lay.cols} st × ${pattern.rows.length} rows`;
  ui.tensionPin.classList.remove('show');
  ui.tensionGhost.classList.remove('show', 'on');
  ui.toast.className = 'toast';
  ui.title.hidden = true;
  ui.done.hidden = true;
  ui.play.hidden = false;
  window.scrollTo(0, 0);
  renderRows();
  renderYarnButtons();
  renderPanel();
  // "Make it again" keeps a 3D view that is on the mat; one put away under 2D is let go.
  if (view3d) { if (showing3d()) view3d.setGame(game); else disposeView3d(); }
  viewMode = hasWebGL() ? storedView() || viewMode : '2d';
  syncViewToggle();
  fitCanvas();
  canvas.focus({ preventScroll: true });
  if (viewMode === '3d') show3d(); else show2d();
  placeSeams();
}

function renderRows() {
  ui.rows.innerHTML = '';
  ui.rows.scrollTop = 0;
  ui.rowEyebrow.textContent = '';
  renderPanel.lastRow = null;
  game.pattern.rows.forEach((row, r) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="txt"><b>Row ${r + 1}</b> ${row.text}</span>`;
    li.dataset.row = r;
    ui.rows.appendChild(li);
  });
}

function renderYarnButtons() {
  ui.yarnButtons.innerHTML = '';
  game.pattern.yarns.forEach((y, i) => {
    const b = document.createElement('button');
    b.className = 'yarn-btn';
    b.setAttribute('aria-label', `${y.name} yarn (${i + 1})`);
    b.innerHTML = `<i class="ball" style="--yarn:${yarnColor(y)}"></i><span class="label">${y.name}</span><kbd>${i + 1}</kbd>`;
    b.addEventListener('click', () => doYarn(i));
    keepFocusOff(b);
    ui.yarnButtons.appendChild(b);
  });
}

function setReadout(html, q = '') {
  ui.tensionLabel.innerHTML = html;
  ui.tensionLabel.className = `readout${q ? ` q-${q}` : ''}`;
}
function idleReadout() {
  if (game.blocked) setReadout('<b>frog first</b> · then hold a stitch key', 'blocked');
  else if (lastRelease) setReadout(`last stitch: <b>${QUALITY_WORD[lastRelease.q]}</b> · ${(lastRelease.ms / 1000).toFixed(2)} s`, lastRelease.q);
  else setReadout('hold a stitch key');
}

function renderPanel() {
  const step = game.step;
  const stats = game.stats();
  const total = game.pattern.rows.length;
  const row = step ? step.row : total - 1;

  // Top bar: the row number ticks over when the work is turned
  const rowText = `Row ${row + 1} of ${total}`;
  if (ui.rowEyebrow.textContent !== rowText) {
    const ticked = ui.rowEyebrow.textContent !== '' && renderPanel.lastRow != null && row > renderPanel.lastRow;
    ui.rowEyebrow.textContent = rowText;
    if (ticked && !reduced()) { ui.rowEyebrow.classList.remove('tick'); void ui.rowEyebrow.offsetWidth; ui.rowEyebrow.classList.add('tick'); }
  }

  // Row list: the highlighter band moves down and the finished row is struck through left to right
  const advanced = renderPanel.lastRow != null && row === renderPanel.lastRow + 1;
  [...ui.rows.children].forEach((li, r) => {
    li.classList.toggle('current', r === row);
    li.classList.toggle('done', r < row);
    li.classList.toggle('fresh', advanced && r === row - 1);
  });
  renderPanel.lastRow = row;
  // Keep the current row visible inside the leaflet's own scroller. (scrollIntoView would also
  // scroll the page, which on a phone drags the fabric and the keys out of view on every move.)
  const cur = ui.rows.children[row];
  if (cur) {
    const top = cur.offsetTop; const bottom = top + cur.offsetHeight;
    if (top < ui.rows.scrollTop) ui.rows.scrollTop = top - 4;
    else if (bottom > ui.rows.scrollTop + ui.rows.clientHeight) ui.rows.scrollTop = bottom - ui.rows.clientHeight + 4;
  }

  // Chips for the current row
  ui.chips.innerHTML = '';
  const rowSteps = game.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.row === row);
  const wrongStitch = game.blocked ? game.rows[row][game.rows[row].length - 1] : null;
  rowSteps.forEach(({ s, i }) => {
    if (i === game.idx && wrongStitch) {
      const bad = document.createElement('span');
      bad.className = 'chip wrong';
      bad.innerHTML = `${symbolSvg(wrongStitch.st, 14)}${STITCHES[wrongStitch.st].abbr}`;
      ui.chips.appendChild(bad);
    }
    const chip = document.createElement('span');
    chip.className = 'chip';
    if (s.type === 'stitch') {
      chip.innerHTML = `${symbolSvg(s.st, 14)}${STITCHES[s.st].abbr}`;
      const placed = game.rows[row].filter((p) => !p.wrong)[s.i];
      if (i < game.idx && placed) chip.classList.add('done', placed.q);
    } else if (s.type === 'turn') { chip.textContent = 'turn'; chip.classList.add('action'); }
    else if (s.type === 'finish') { chip.textContent = 'fasten off'; chip.classList.add('action'); }
    else if (s.type === 'yarn') { chip.textContent = game.pattern.yarns[s.yarn].name; chip.classList.add('action'); }
    if (i < game.idx && s.type !== 'stitch') chip.classList.add('done');
    if (i === game.idx) chip.classList.add('current');
    ui.chips.appendChild(chip);
  });

  // Next instruction: the strip above the tags and the leaflet's line
  ui.uhoh.classList.toggle('blocked', game.blocked);
  if (game.blocked) {
    ui.next.innerHTML = `Frog the wrong stitch ${kbd('F')}`;
    ui.next.className = 'next blocked';
    ui.leafletNext.innerHTML = `Wrong stitch. Frog it ${kbd('F')}`;
    const expected = step && step.type === 'stitch' ? `a ${STITCHES[step.st].name}` : stepLabel(step, false);
    ui.hint.textContent = `That was a ${STITCHES[wrongStitch.st].name} where ${expected} belongs. Rip the red stitch back out, then carry on.`;
  } else if (game.active) {
    ui.next.innerHTML = `Next: ${stepLabel(step)}`;
    ui.next.className = 'next';
    ui.leafletNext.innerHTML = `Next: ${stepLabel(step)}`;
    if (step.type === 'stitch') {
      const n = step.i + 1;
      const count = rowSteps.filter(({ s }) => s.type === 'stitch').length;
      ui.hint.textContent = `Stitch ${n} of ${count} in this row. Hold the key, release in the green.`;
    } else if (step.type === 'turn') ui.hint.textContent = 'End of row. Turn the work to start the next one.';
    else if (step.type === 'yarn') ui.hint.textContent = 'The pattern changes colour here.';
    else ui.hint.textContent = 'Last stitch done. Fasten off to finish the piece.';
  } else {
    ui.next.innerHTML = game.status === 'done' ? 'Fastened off' : 'Out of yarn';
    ui.next.className = 'next';
    ui.leafletNext.innerHTML = ui.next.innerHTML;
    ui.hint.textContent = '';
  }
  if (!hold) idleReadout();

  // Stats
  ui.time.textContent = fmtTime(stats.timeMs);
  ui.neat.textContent = `${stats.neat}%`;
  ui.mistakes.textContent = String(stats.mistakes);

  // Yarn
  const yarn = game.pattern.yarns[game.currentYarn];
  const yc = yarnColor(yarn);
  const yarnPct = Math.max(0, stats.yarnLeft / stats.yarnTotal);
  ui.yarnFill.style.width = `${yarnPct * 100}%`;
  ui.yarnFill.parentElement.style.setProperty('--yarn', yc);
  ui.yarnBall.style.setProperty('--yarn', yc);
  ui.yarnBall.style.transform = `scale(${(14 + 8 * yarnPct) / 22})`;
  ui.tension.parentElement.style.setProperty('--yarn', yc);
  ui.yarnLabel.innerHTML = `<b>${Math.round(yarnPct * 100)}%</b> left · ${yarn.name} on the hook`;
  ui.yarnFill.parentElement.classList.toggle('low', yarnPct < 0.15);
  ui.yarnFill.parentElement.classList.toggle('empty', yarnPct < 0.05);
  ui.yarnRow.classList.toggle('low', yarnPct < 0.15);

  // Yarn buttons
  [...ui.yarnButtons.children].forEach((b, i) => {
    b.classList.toggle('active', i === game.currentYarn);
    b.setAttribute('aria-pressed', i === game.currentYarn ? 'true' : 'false');
  });
  // Stitch tags
  ui.buttons.classList.toggle('blocked', game.blocked);
  [...ui.buttons.children].forEach((b) => {
    b.classList.toggle('expected', !!step && step.type === 'stitch' && step.st === b.dataset.st && !game.blocked);
  });
  $('#btn-turn').classList.toggle('expected', !!step && (step.type === 'turn' || step.type === 'finish') && !game.blocked);
  $('#btn-frog').classList.toggle('expected', game.blocked);
}

function handle(result) {
  if (!result) return;
  const now = performance.now();
  switch (result.kind) {
    case 'placed': {
      SOUNDS[result.q]();
      const placed = game.rows[result.row];
      fx.place = { n: placed[placed.length - 1].n, at: now, q: result.q };
      if (result.q !== 'neat') toast(result.q === 'ok' ? 'Nearly' : result.q === 'loose' ? 'Too loose' : 'Too tight', result.q);
      break;
    }
    case 'wrong': {
      SOUNDS.wrong(); shake();
      const placed = game.rows[result.row];
      fx.place = { n: placed[placed.length - 1].n, at: now, q: 'wrong' };
      toast(`Wrong stitch! Frog it ${kbd('F')}`, 'wrong');
      break;
    }
    case 'wrong-action':
      SOUNDS.wrong(); shake(); toast(`Not yet. Next: ${stepLabel(result.expected)}`, 'wrong');
      break;
    case 'blocked':
      SOUNDS.wrong(); shake(); toast(`Frog the wrong stitch first ${kbd('F')}`, 'wrong');
      break;
    case 'frogged':
      SOUNDS.frog(); toast(result.wrong ? 'Frogged. Carry on.' : 'Ripped back one stitch');
      break;
    case 'cant-frog-past-turn':
      toast('You have already turned. Keep going.');
      break;
    case 'turned':
      SOUNDS.turn(); flip();
      break;
    case 'yarn':
      SOUNDS.turn(); toast(`Now using ${game.pattern.yarns[result.yarn].name}`);
      break;
    case 'finished':
      SOUNDS.finish(); showDone();
      break;
    case 'out-of-yarn':
      SOUNDS.wrong(); showDone();
      break;
    default:
      break;
  }
  renderPanel();
}

function doFrog() {
  if (!game) return;
  const step = game.step;
  let cap = null;
  if (step) {
    const row = game.rows[step.row];
    if (row.length) {
      const copy = [...row];
      const i = copy.length - 1;
      cap = { s: copy[i], g: stitchGeometry(lay, step.row, copy, i) };
    }
  }
  const res = game.frog();
  if (res.kind === 'frogged' && cap) fx.frog = { at: performance.now(), ...cap };
  handle(res);
}
function doYarn(i) {
  if (!game) return;
  const from = yarnColor(game.pattern.yarns[game.currentYarn]);
  const res = game.pressYarn(i);
  if (res.kind === 'yarn') fx.yarn = { at: performance.now(), from, to: yarnColor(game.pattern.yarns[i]) };
  handle(res);
}

const COMPLIMENT = {
  'A+': 'That is a swatch you could gift.',
  A: 'Even rows and a steady hand.',
  B: 'A good piece with a few wobbles.',
  C: 'It holds together. The next one will be neater.',
  D: 'Every frogged row teaches something.',
};
function showDone() {
  const s = game.stats();
  const ran = game.status === 'out-of-yarn';
  const best = ran ? false : saveBest(game.pattern.id, s);
  const yc = yarnColor(game.pattern.yarns[game.currentYarn]);
  const yarnPct = Math.round((s.yarnLeft / s.yarnTotal) * 100);
  const failed = ran && game.step && game.step.type === 'stitch' ? STITCHES[game.step.st].name : 'stitch';
  const letter = s.grade.replace('+', '');
  const results = `
    <div class="results">
      <div class="row"><span class="label">Neatness</span><span class="value">${s.neat}%</span></div>
      <div class="row"><span class="label">Mistakes</span><span class="value">${s.mistakes}</span></div>
      <div class="row"><span class="label">Time</span><span class="value">${fmtTime(s.timeMs)}</span></div>
      <div class="row"><span class="label">Yarn left</span><span class="value"><i class="ball" style="--yarn:${yc}"></i>${yarnPct}%</span></div>
    </div>`;
  ui.doneEyebrow.textContent = game.pattern.name;
  ui.doneTitle.textContent = ran ? 'Out of yarn' : 'Fastened off!';
  ui.doneBody.innerHTML = ran
    ? `<p class="sub">The piece is ${Math.round(s.progress * 100)}% done, and the ${yarnPct}% left on the ball is not enough for the next ${failed}. Loose stitches eat yarn: aim for the green, and frog loose ones straight away.</p>
       <div class="stamp-wrap"><i class="empty-ball" style="--yarn:${yc}"></i></div>${results}`
    : `<p class="sub">${COMPLIMENT[s.grade] || COMPLIMENT.B}</p>
       <div class="stamp-wrap"><div class="stamp ${letter}"><span class="g">${letter}${s.grade.endsWith('+') ? '<span class="plus">+</span>' : ''}</span><span class="cap">${letter === 'A' ? 'neatly made' : letter === 'B' ? 'nearly there' : 'keep going'}</span></div></div>
       ${results}
       ${best ? '<p class="new-best">New personal best</p>' : ''}`;
  const g = game;
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => {
    doneTimer = null;
    if (game !== g || ui.play.hidden) return; // left (Esc) or started another project meanwhile
    ui.done.hidden = false;
    $('#btn-again').focus({ preventScroll: true });
    if (!ran) confetti();
  }, ran ? 300 : 900);
}

/** Yarn-snippet confetti: short strands in the project's yarn colours, curling as they fall. */
function confetti() {
  if (reduced() || !game) return;
  const c = ui.confetti;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth; const H = window.innerHeight;
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const cx = c.getContext('2d');
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = game.pattern.yarns.map(yarnColor);
  const parts = Array.from({ length: 120 }, () => ({
    x: W * (0.25 + 0.5 * Math.random()), y: H * 0.45 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 420, vy: -260 - Math.random() * 260,
    len: 10 + Math.random() * 8, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 10,
    curl: 0.3 + Math.random() * 0.7, phase: Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now(); let last = t0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const el = now - t0;
    cx.clearRect(0, 0, W, H);
    cx.lineWidth = 3; cx.lineCap = 'round';
    cx.globalAlpha = el > 900 ? Math.max(0, 1 - (el - 900) / 300) : 1;
    parts.forEach((p) => {
      p.vy += 900 * dt; p.vx *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      cx.save();
      cx.translate(p.x, p.y); cx.rotate(p.rot);
      cx.strokeStyle = p.color;
      cx.beginPath();
      cx.moveTo(-p.len / 2, 0);
      cx.quadraticCurveTo(0, p.len * p.curl * Math.sin(el / 120 + p.phase), p.len / 2, 0);
      cx.stroke();
      cx.restore();
    });
    if (el < 1200 && !ui.done.hidden) requestAnimationFrame(tick); else cx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(tick);
}

function backToTitle() {
  clearTimeout(doneTimer); doneTimer = null;
  disposeView3d();
  clearHold();
  game = null;
  ui.play.hidden = true;
  ui.done.hidden = true;
  ui.title.hidden = false;
  window.scrollTo(0, 0);
  renderCards();
  drawGuideCard();
  placeSeams();
}

// ---------- input ----------
function tagFor(st) { return ui.buttons.querySelector(`[data-st="${st}"]`); }
/** The event's own time (same origin as performance.now()), or now when it has none. */
function eventTime(e) {
  const now = performance.now();
  const t = e && e.timeStamp;
  return Number.isFinite(t) && t > 0 && t <= now + 1 ? t : now;
}
// The tension fill and knob run as compositor animations started on the key press (linear over
// HOLD.max, as currentHold() is), so they keep moving smoothly even while a slow 3D frame holds the
// main thread; the rAF loop only writes the readout text. Without WAAPI the loop moves them instead.
let meterAnims = [];
let meterTravel = 0;   // px the knob travels from 0 to HOLD.max
function meterAt(progress) {
  ui.tensionBar.style.transform = `translateX(${(progress - 1) * 100}%)`;
  ui.tensionKnob.style.transform = `translateX(${progress * meterTravel}px)`;
}
function startMeter(at) {
  stopMeter();
  meterTravel = Math.max(0, ui.tension.parentElement.clientWidth - 6);
  if (typeof ui.tensionBar.animate !== 'function') { meterAt(0); return; }
  const opts = { duration: HOLD.max, easing: 'linear', fill: 'forwards' };
  meterAnims = [
    ui.tensionBar.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(0%)' }], opts),
    ui.tensionKnob.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(${meterTravel}px)` }], opts),
  ];
  const since = Math.max(0, performance.now() - at); // the key went down this long ago
  meterAnims.forEach((a) => { a.currentTime = Math.min(HOLD.max, since); });
}
function stopMeter() {
  meterAnims.forEach((a) => a.cancel());
  meterAnims = [];
  meterAt(0);
}
function beginHold(st, at = performance.now()) {
  if (!game || !game.active || hold) return;
  hold = { st, start: at, vibrated: false };
  ui.tension.parentElement.classList.add('holding');
  ui.tensionPin.classList.remove('show');
  ui.tensionGhost.classList.remove('show', 'on');
  clearTimeout(ghostTimer);
  startMeter(at);
  const b = tagFor(st);
  if (b) b.classList.add('pressed');
}
function clearHold() {
  hold = null;
  stopMeter();
  ui.tension.parentElement.classList.remove('holding');
  [...ui.buttons.children].forEach((b) => b.classList.remove('pressed'));
}
function endHold(st, at = performance.now()) {
  if (!hold || hold.st !== st) return;
  const ms = Math.max(0, at - hold.start);
  clearHold();
  const { q } = tensionFromHold(ms);
  const frac = Math.min(1, ms / HOLD.max);
  if (game.active && !game.blocked) {
    // a sewing pin marks the release point until the next hold; a ghost knob fades over 1.2 s
    const at = `calc(3px + (100% - 6px) * ${frac.toFixed(4)})`; // the knob's own scale
    ui.tensionPin.style.left = at;
    ui.tensionPin.style.setProperty('--pin', `var(--${q === 'neat' ? 'neat' : q === 'ok' ? 'ok' : 'bad'})`);
    ui.tensionPin.classList.add('show');
    ui.tensionGhost.style.left = at;
    ui.tensionGhost.classList.add('show', 'on');
    ghostTimer = setTimeout(() => { ui.tensionGhost.classList.remove('on'); }, 30);
    lastRelease = { q, ms };
  }
  handle(game.pressStitch(st, ms));
}

// Tab navigation shows the canvas focus ring; any pointer use hides it again.
document.addEventListener('keydown', (e) => { if (e.key === 'Tab') document.documentElement.classList.add('tabbing'); }, true);
document.addEventListener('pointerdown', () => document.documentElement.classList.remove('tabbing'), true);
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+V pastes, Ctrl+F finds: not game keys
  // A button reached with Tab takes Enter and Space itself (a focused stitch tag has no click: Enter
  // stays the turn key there).
  const focused = e.target && e.target.closest ? e.target.closest('button, a') : null;
  if ((e.key === 'Enter' || e.key === ' ') && focused && !focused.dataset.st) return;
  if (e.key === 'Escape') { if (game || !ui.done.hidden) backToTitle(); return; }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
  if (e.key === 'n' || e.key === 'N') { toggleTheme(); return; }
  if (!game) return;
  if (ui.done.hidden === false) { if (e.key === 'Enter') { e.preventDefault(); start(game.pattern); } return; }
  const k = e.key.toLowerCase();
  if (KEY_TO_STITCH[k]) { e.preventDefault(); beginHold(KEY_TO_STITCH[k], eventTime(e)); }
  else if (k === 't' || e.key === 'Enter') { e.preventDefault(); handle(game.pressTurn()); }
  else if (k === 'f' || e.key === 'Backspace') { e.preventDefault(); doFrog(); }
  else if (k === 'v') { e.preventDefault(); toggleView(); }
  else if (/^[1-9]$/.test(k)) doYarn(Number(k) - 1);
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (KEY_TO_STITCH[k]) endHold(KEY_TO_STITCH[k], eventTime(e));
});
window.addEventListener('blur', () => { clearHold(); });

// Stitch tags (press and hold works with mouse and touch)
Object.values(STITCHES).forEach((s) => {
  const b = document.createElement('button');
  b.className = 'tag';
  b.dataset.st = s.id;
  b.setAttribute('aria-label', `${s.name} (hold ${s.key.toUpperCase()})`);
  b.innerHTML = `${symbolSvg(s.id)}<b class="abbr">${s.abbr}</b><span class="name">${SHORT_NAME[s.id]}</span><kbd>${s.key.toUpperCase()}</kbd><i class="flag">next</i><i class="chev">&#9662;</i>`;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    beginHold(s.id, eventTime(e));
    try { b.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
  });
  b.addEventListener('pointerup', (e) => endHold(s.id, eventTime(e)));
  b.addEventListener('pointercancel', () => clearHold());
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  ui.buttons.appendChild(b);
});
$('#btn-turn').addEventListener('click', () => { if (game) handle(game.pressTurn()); });
$('#btn-frog').addEventListener('click', doFrog);
['#btn-turn', '#btn-frog', '#btn-quit', '#mute', '#theme'].forEach((sel) => keepFocusOff($(sel)));
$('#btn-quit').addEventListener('click', backToTitle);
$('#btn-again').addEventListener('click', () => { if (game) start(game.pattern); else backToTitle(); });
$('#btn-menu').addEventListener('click', backToTitle);
function toggleMute() {
  muted = !muted;
  const label = `Sound: ${muted ? 'off' : 'on'} (M)`;
  ui.mute.classList.toggle('off', muted);
  ui.mute.setAttribute('aria-label', label);
  ui.mute.title = label;
  ui.muteFoot.innerHTML = `Sound: ${muted ? 'off' : 'on'} <kbd>M</kbd>`;
}
ui.mute.addEventListener('click', toggleMute);
ui.muteFoot.addEventListener('click', toggleMute);
ui.theme.addEventListener('click', toggleTheme);
ui.themeFoot.addEventListener('click', toggleTheme);

// ---------- animation loop ----------
function frame(time) {
  if (game) {
    const holdInfo = currentHold();
    if (hold) {
      const ms = performance.now() - hold.start;
      const { progress, zone: q } = holdInfo;
      if (!meterAnims.length) meterAt(progress); // no WAAPI: the loop moves the fill and knob
      ui.tension.dataset.zone = q;
      ui.tensionLabel.innerHTML = `<b>${STITCHES[hold.st].name}</b> · ${(ms / 1000).toFixed(2)} s`;
      ui.tensionLabel.className = 'readout';
      if (q === 'neat' && !hold.vibrated) {
        hold.vibrated = true;
        try { if (navigator.vibrate) navigator.vibrate(8); } catch { /* optional */ }
      }
    }
    if (showing3d()) { if (matOnScreen) view3d.update(); } // the 2D canvas is hidden under it, so it is not drawn
    else {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      draw(ctx, game, lay, {
        time, hold: holdInfo, yarnColor: yarnColor(game.pattern.yarns[game.currentYarn]), k: scale, fx, reduced: reduced(),
      });
    }
    if (game.status === 'playing') ui.time.textContent = fmtTime(game.elapsedMs());
  }
  requestAnimationFrame(frame);
}

// Tension meter zone markers, derived from HOLD so the UI matches the rules.
(function placeZones() {
  const pct = (ms) => `${(ms / HOLD.max) * 100}%`;
  const neatLo = HOLD.centre - HOLD.neat * HOLD.span;
  const neatHi = HOLD.centre + HOLD.neat * HOLD.span;
  const okLo = HOLD.centre - HOLD.ok * HOLD.span;
  const okHi = HOLD.centre + HOLD.ok * HOLD.span;
  const ok = $('#zone-ok'); const neat = $('#zone-neat');
  ok.style.left = pct(okLo); ok.style.width = pct(okHi - okLo);
  neat.style.left = pct(neatLo); neat.style.width = pct(neatHi - neatLo);
  const ticks = document.querySelector('.meter.tension + .ticks');
  if (ticks) ticks.style.setProperty('--neat-mid', pct(HOLD.centre));
}());

refreshPalette();
requestAnimationFrame(frame);

// Exposed for the browser smoke test only.
window.__crochet = {
  get game() { return game; }, start, PATTERNS, setTheme: applyTheme,
  setView, get view() { return viewMode; }, get view3d() { return view3d; },
};
