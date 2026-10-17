// Game state machine. Pure JS, no DOM, so it can be unit-tested.
import { STITCHES, buildSteps, idealYarn } from './patterns.js';

/** Hold timings in ms. The player holds a stitch key to "pull through"; the hold length sets tension. */
export const HOLD = { centre: 320, span: 300, neat: 0.45, ok: 0.75, max: 800 };

export const QUALITY_SCORE = { neat: 100, ok: 60, loose: 25, tight: 25 };

/** Map a hold duration to a tension value t in [-1, 1] (negative = loose, positive = tight) and a quality label. */
export function tensionFromHold(ms) {
  const t = Math.max(-1, Math.min(1, (ms - HOLD.centre) / HOLD.span));
  let q;
  if (Math.abs(t) <= HOLD.neat) q = 'neat';
  else if (Math.abs(t) <= HOLD.ok) q = 'ok';
  else q = t < 0 ? 'loose' : 'tight';
  return { t, q };
}

/** Yarn used by a stitch at tension t. Loose stitches waste yarn, tight ones save a little. */
export function yarnCost(st, t) {
  return STITCHES[st].yarn * (1 - 0.3 * t);
}

export function gradeFor(neat, mistakes) {
  if (neat >= 92 && mistakes === 0) return 'A+';
  if (neat >= 85 && mistakes <= 2) return 'A';
  if (neat >= 70 && mistakes <= 5) return 'B';
  if (neat >= 50) return 'C';
  return 'D';
}

export class Game {
  constructor(pattern, { now = () => Date.now() } = {}) {
    this.pattern = pattern;
    this.now = now;
    this.steps = buildSteps(pattern);
    this.idx = 0;
    this.rows = pattern.rows.map(() => []); // placed stitches per row
    this.yarnTotal = Math.round(idealYarn(pattern) * 1.25);
    this.yarnLeft = this.yarnTotal;
    this.currentYarn = 0;
    this.mistakes = 0;
    this.scores = [];
    this.blocked = false; // a wrong stitch sits on the hook and must be frogged
    this.status = 'ready'; // ready | playing | done | out-of-yarn
    this.startedAt = null;
    this.finishedAt = null;
    this.placedCount = 0;
  }

  get step() { return this.steps[this.idx]; }
  get active() { return this.status === 'ready' || this.status === 'playing'; }

  _start() {
    if (this.status === 'ready') { this.status = 'playing'; this.startedAt = this.now(); }
  }

  elapsedMs() {
    if (this.startedAt == null) return 0;
    return (this.finishedAt ?? this.now()) - this.startedAt;
  }

  neatness() {
    if (!this.scores.length) return 100;
    return Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length);
  }

  stats() {
    const neat = this.neatness();
    return {
      neat,
      mistakes: this.mistakes,
      timeMs: this.elapsedMs(),
      yarnLeft: this.yarnLeft,
      yarnTotal: this.yarnTotal,
      grade: gradeFor(neat, this.mistakes),
      progress: this.idx / this.steps.length,
    };
  }

  /** The player held a stitch key for `holdMs` and released it. */
  pressStitch(st, holdMs) {
    if (!this.active) return { kind: 'inactive' };
    if (this.blocked) return { kind: 'blocked' };
    if (!STITCHES[st]) return { kind: 'unknown' };
    const step = this.step;
    const { t, q } = tensionFromHold(holdMs);

    if (step.type === 'stitch' && step.st === st) {
      const cost = yarnCost(st, t);
      if (cost > this.yarnLeft) {
        this.status = 'out-of-yarn';
        this.finishedAt = this.now();
        return { kind: 'out-of-yarn' };
      }
      this._start();
      this.yarnLeft -= cost;
      this.rows[step.row].push({ st, t, q, wrong: false, cost, yarn: step.yarn, n: this.placedCount++ });
      this.scores.push(QUALITY_SCORE[q]);
      this.idx += 1;
      return { kind: 'placed', q, t, row: step.row };
    }

    // Wrong stitch: it goes on the work and must be frogged before continuing.
    this._start();
    const cost = Math.min(this.yarnLeft, yarnCost(st, 0));
    this.yarnLeft -= cost;
    this.rows[step.row].push({ st, t: 0, q: 'wrong', wrong: true, cost, yarn: this.currentYarn, n: this.placedCount++ });
    this.mistakes += 1;
    this.blocked = true;
    return { kind: 'wrong', expected: step, row: step.row };
  }

  /** Turn the work (or fasten off on the final row). */
  pressTurn() {
    if (!this.active) return { kind: 'inactive' };
    if (this.blocked) return { kind: 'blocked' };
    const step = this.step;
    if (step.type === 'turn') {
      this._start();
      this.idx += 1;
      return { kind: 'turned', row: step.row };
    }
    if (step.type === 'finish') {
      this._start();
      this.idx += 1;
      this.status = 'done';
      this.finishedAt = this.now();
      return { kind: 'finished', stats: this.stats() };
    }
    this.mistakes += 1;
    return { kind: 'wrong-action', expected: step };
  }

  /** Switch to yarn index i. */
  pressYarn(i) {
    if (!this.active) return { kind: 'inactive' };
    if (this.blocked) return { kind: 'blocked' };
    if (i < 0 || i >= this.pattern.yarns.length) return { kind: 'unknown' };
    const step = this.step;
    if (step.type === 'yarn' && step.yarn === i) {
      this._start();
      this.currentYarn = i;
      this.idx += 1;
      return { kind: 'yarn', yarn: i };
    }
    if (i === this.currentYarn) return { kind: 'noop' };
    this.mistakes += 1;
    return { kind: 'wrong-action', expected: step };
  }

  /** Rip back the last stitch of the current row ("frogging"). */
  frog() {
    if (!this.active) return { kind: 'inactive' };
    const step = this.step;
    const row = this.rows[step.row];
    if (!row.length) return { kind: 'nothing' };
    const last = row[row.length - 1];
    if (last.wrong) {
      row.pop();
      this.yarnLeft += last.cost;
      this.blocked = false;
      return { kind: 'frogged', wrong: true, row: step.row };
    }
    // A correct stitch: only if we have not turned since (the previous step is that stitch).
    const prev = this.steps[this.idx - 1];
    if (!prev || prev.type !== 'stitch' || prev.row !== step.row) return { kind: 'cant-frog-past-turn' };
    row.pop();
    this.yarnLeft += last.cost;
    this.scores.pop();
    this.idx -= 1;
    return { kind: 'frogged', wrong: false, row: step.row };
  }
}
