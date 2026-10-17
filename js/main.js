// DOM, input and audio glue for the crochet game.
import { PATTERNS, STITCHES, KEY_TO_STITCH, buildSteps } from './patterns.js';
import { Game, HOLD, tensionFromHold } from './game.js';
import { layout, draw } from './render.js';

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
  hint: $('#hint'),
  tension: $('#tension-fill'),
  tensionLabel: $('#tension-label'),
  yarnFill: $('#yarn-fill'),
  yarnLabel: $('#yarn-label'),
  time: $('#stat-time'),
  neat: $('#stat-neat'),
  mistakes: $('#stat-mistakes'),
  buttons: $('#buttons'),
  yarnButtons: $('#yarn-buttons'),
  projectName: $('#project-name'),
  toast: $('#toast'),
  doneTitle: $('#done-title'),
  doneBody: $('#done-body'),
  mute: $('#mute'),
};

let game = null;
let lay = null;
let hold = null;       // { st, start } while a stitch key is held
let muted = false;
let toastTimer = null;

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
function toast(msg, kind = '') {
  ui.toast.textContent = msg;
  ui.toast.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.className = 'toast'; }, 1400);
}
function shake() {
  canvas.classList.remove('shake');
  void canvas.offsetWidth; // restart the animation
  canvas.classList.add('shake');
}
function stepLabel(step) {
  if (!step) return '';
  if (step.type === 'stitch') return `${STITCHES[step.st].name} (${STITCHES[step.st].key.toUpperCase()})`;
  if (step.type === 'turn') return 'turn the work (T)';
  if (step.type === 'finish') return 'fasten off (T)';
  if (step.type === 'yarn') return `change to ${game.pattern.yarns[step.yarn].name} (${step.yarn + 1})`;
  return '';
}

// ---------- title screen ----------
function renderCards() {
  ui.cards.innerHTML = '';
  PATTERNS.forEach((p) => {
    const best = loadBest(p.id);
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `
      <span class="level">${p.level}</span>
      <strong>${p.name}</strong>
      <span class="blurb">${p.blurb}</span>
      <span class="yarns">${p.yarns.map((y) => `<i style="background:${y.color}" title="${y.name}"></i>`).join('')}
        <small>${p.rows.length} rows · ${buildSteps(p).length} moves</small></span>
      <span class="best">${best ? `Best: ${best.grade} · ${best.neat}% neat · ${fmtTime(best.timeMs)}` : 'Not yet made'}</span>`;
    card.addEventListener('click', () => start(p));
    ui.cards.appendChild(card);
  });
}

// ---------- play screen ----------
function start(pattern) {
  game = new Game(pattern);
  lay = layout(pattern);
  canvas.width = lay.width;
  canvas.height = lay.height;
  hold = null;
  ui.projectName.textContent = pattern.name;
  ui.title.hidden = true;
  ui.done.hidden = true;
  ui.play.hidden = false;
  renderRows();
  renderYarnButtons();
  renderPanel();
  canvas.focus();
}

function renderRows() {
  ui.rows.innerHTML = '';
  game.pattern.rows.forEach((row, r) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>Row ${r + 1}</b> ${row.text}`;
    li.dataset.row = r;
    ui.rows.appendChild(li);
  });
}

function renderYarnButtons() {
  ui.yarnButtons.innerHTML = '';
  game.pattern.yarns.forEach((y, i) => {
    const b = document.createElement('button');
    b.className = 'yarn-btn';
    b.innerHTML = `<i style="background:${y.color}"></i>${y.name} <kbd>${i + 1}</kbd>`;
    b.addEventListener('click', () => handle(game.pressYarn(i)));
    ui.yarnButtons.appendChild(b);
  });
}

function renderPanel() {
  const step = game.step;
  const stats = game.stats();
  const row = step ? step.row : game.pattern.rows.length - 1;

  // Row list
  [...ui.rows.children].forEach((li, r) => {
    li.classList.toggle('current', r === row);
    li.classList.toggle('done', r < row);
  });
  const cur = ui.rows.children[row];
  if (cur) cur.scrollIntoView({ block: 'nearest' });

  // Chips for the current row
  ui.chips.innerHTML = '';
  const rowSteps = game.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.row === row);
  rowSteps.forEach(({ s, i }) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    if (s.type === 'stitch') {
      chip.textContent = STITCHES[s.st].abbr;
      const placed = game.rows[row].filter((p) => !p.wrong)[s.i];
      if (i < game.idx && placed) chip.classList.add('done', placed.q);
    } else if (s.type === 'turn') { chip.textContent = 'turn'; chip.classList.add('action'); }
    else if (s.type === 'finish') { chip.textContent = 'fasten off'; chip.classList.add('action'); }
    else if (s.type === 'yarn') { chip.textContent = game.pattern.yarns[s.yarn].name; chip.classList.add('action'); }
    if (i < game.idx && s.type !== 'stitch') chip.classList.add('done');
    if (i === game.idx) chip.classList.add('current');
    ui.chips.appendChild(chip);
  });

  // Next instruction
  if (game.blocked) {
    ui.next.textContent = 'Wrong stitch! Frog it (F)';
    ui.next.className = 'next blocked';
    ui.hint.textContent = 'Rip the red stitch back out before carrying on.';
  } else if (game.active) {
    ui.next.textContent = `Next: ${stepLabel(step)}`;
    ui.next.className = 'next';
    if (step.type === 'stitch') {
      const n = step.i + 1;
      const total = rowSteps.filter(({ s }) => s.type === 'stitch').length;
      ui.hint.textContent = `Stitch ${n} of ${total} in this row. Hold the key, release in the green.`;
    } else if (step.type === 'turn') ui.hint.textContent = 'End of row. Turn the work to start the next one.';
    else if (step.type === 'yarn') ui.hint.textContent = 'The pattern changes colour here.';
    else ui.hint.textContent = 'Last stitch done. Fasten off to finish the piece.';
  }

  // Stats
  ui.time.textContent = fmtTime(stats.timeMs);
  ui.neat.textContent = `${stats.neat}%`;
  ui.mistakes.textContent = String(stats.mistakes);
  const yarnPct = Math.max(0, stats.yarnLeft / stats.yarnTotal);
  ui.yarnFill.style.width = `${yarnPct * 100}%`;
  ui.yarnFill.style.background = game.pattern.yarns[game.currentYarn].color;
  ui.yarnLabel.textContent = `${Math.round(yarnPct * 100)}% left`;
  ui.yarnFill.parentElement.classList.toggle('low', yarnPct < 0.15);

  // Yarn buttons
  [...ui.yarnButtons.children].forEach((b, i) => b.classList.toggle('active', i === game.currentYarn));
  // Stitch buttons
  [...ui.buttons.children].forEach((b) => {
    b.classList.toggle('expected', !!step && step.type === 'stitch' && step.st === b.dataset.st && !game.blocked);
  });
  $('#btn-turn').classList.toggle('expected', !!step && (step.type === 'turn' || step.type === 'finish') && !game.blocked);
  $('#btn-frog').classList.toggle('expected', game.blocked);
}

function handle(result) {
  if (!result) return;
  switch (result.kind) {
    case 'placed':
      SOUNDS[result.q]();
      if (result.q !== 'neat') toast(result.q === 'ok' ? 'Nearly' : result.q === 'loose' ? 'Too loose' : 'Too tight', result.q);
      break;
    case 'wrong':
      SOUNDS.wrong(); shake(); toast('Wrong stitch!', 'wrong');
      break;
    case 'wrong-action':
      SOUNDS.wrong(); shake(); toast(`Not yet. Next: ${stepLabel(result.expected)}`, 'wrong');
      break;
    case 'blocked':
      SOUNDS.wrong(); shake(); toast('Frog the wrong stitch first (F)', 'wrong');
      break;
    case 'frogged':
      SOUNDS.frog(); toast(result.wrong ? 'Frogged. Carry on.' : 'Ripped back one stitch');
      break;
    case 'cant-frog-past-turn':
      toast('You have already turned. Keep going.');
      break;
    case 'turned':
      SOUNDS.turn();
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

function showDone() {
  const s = game.stats();
  const ran = game.status === 'out-of-yarn';
  const best = ran ? false : saveBest(game.pattern.id, s);
  ui.doneTitle.textContent = ran ? 'You ran out of yarn' : `${game.pattern.name}: finished!`;
  ui.doneBody.innerHTML = ran
    ? `<p>The piece is ${Math.round(s.progress * 100)}% done and the ball is empty. Loose stitches eat yarn: aim for the green zone, and frog loose ones straight away.</p>`
    : `<div class="grade ${s.grade.replace('+', 'plus')}">${s.grade}</div>
       <dl>
         <dt>Neatness</dt><dd>${s.neat}%</dd>
         <dt>Mistakes</dt><dd>${s.mistakes}</dd>
         <dt>Time</dt><dd>${fmtTime(s.timeMs)}</dd>
         <dt>Yarn left</dt><dd>${Math.round((s.yarnLeft / s.yarnTotal) * 100)}%</dd>
       </dl>
       ${best ? '<p class="new-best">New personal best!</p>' : ''}`;
  setTimeout(() => { ui.done.hidden = false; }, ran ? 300 : 900);
}

function backToTitle() {
  game = null; hold = null;
  ui.play.hidden = true;
  ui.done.hidden = true;
  ui.title.hidden = false;
  renderCards();
}

// ---------- input ----------
function beginHold(st) {
  if (!game || !game.active || hold) return;
  hold = { st, start: performance.now() };
  ui.tensionLabel.textContent = STITCHES[st].name;
}
function endHold(st) {
  if (!hold || hold.st !== st) return;
  const ms = performance.now() - hold.start;
  hold = null;
  ui.tension.style.width = '0%';
  ui.tensionLabel.textContent = 'hold a stitch key';
  handle(game.pressStitch(st, ms));
}

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'Escape') { if (game) backToTitle(); return; }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
  if (!game) return;
  if (ui.done.hidden === false) { if (e.key === 'Enter') backToTitle(); return; }
  const k = e.key.toLowerCase();
  if (KEY_TO_STITCH[k]) { e.preventDefault(); beginHold(KEY_TO_STITCH[k]); }
  else if (k === 't' || e.key === 'Enter') { e.preventDefault(); handle(game.pressTurn()); }
  else if (k === 'f' || e.key === 'Backspace') { e.preventDefault(); handle(game.frog()); }
  else if (/^[1-9]$/.test(k)) handle(game.pressYarn(Number(k) - 1));
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (KEY_TO_STITCH[k]) endHold(KEY_TO_STITCH[k]);
});
window.addEventListener('blur', () => { hold = null; ui.tension.style.width = '0%'; });

// Stitch buttons (press and hold works with mouse and touch)
Object.values(STITCHES).forEach((s) => {
  const b = document.createElement('button');
  b.className = 'stitch-btn';
  b.dataset.st = s.id;
  b.innerHTML = `<span class="abbr">${s.abbr}</span><span class="name">${s.name}</span><kbd>${s.key.toUpperCase()}</kbd>`;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); beginHold(s.id); });
  b.addEventListener('pointerup', () => endHold(s.id));
  b.addEventListener('pointercancel', () => { hold = null; ui.tension.style.width = '0%'; });
  ui.buttons.appendChild(b);
});
$('#btn-turn').addEventListener('click', () => handle(game.pressTurn()));
$('#btn-frog').addEventListener('click', () => handle(game.frog()));
$('#btn-quit').addEventListener('click', backToTitle);
$('#btn-again').addEventListener('click', () => start(game.pattern));
$('#btn-menu').addEventListener('click', backToTitle);
function toggleMute() { muted = !muted; ui.mute.textContent = muted ? 'Sound: off (M)' : 'Sound: on (M)'; }
ui.mute.addEventListener('click', toggleMute);

// ---------- animation loop ----------
function frame(time) {
  if (game) {
    let holdInfo = null;
    if (hold) {
      const ms = performance.now() - hold.start;
      const progress = Math.min(1, ms / HOLD.max);
      const { q } = tensionFromHold(ms);
      holdInfo = { progress, zone: q };
      ui.tension.style.width = `${progress * 100}%`;
      ui.tension.dataset.zone = q;
    }
    draw(ctx, game, lay, { time, hold: holdInfo, yarnColor: game.pattern.yarns[game.currentYarn].color });
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
}());

renderCards();
requestAnimationFrame(frame);

// Exposed for the browser smoke test only.
window.__crochet = { get game() { return game; }, start, PATTERNS };
