import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, tensionFromHold, gradeFor } from '../js/game.js';
import { PATTERNS } from '../js/patterns.js';

const coaster = PATTERNS.find((p) => p.id === 'coaster');
const scarf = PATTERNS.find((p) => p.id === 'scarf');
const NEAT = 320;

function play(game, holdMs = NEAT, tick = () => {}) {
  // Play every remaining step perfectly.
  while (game.active) {
    tick();
    const s = game.step;
    if (s.type === 'stitch') game.pressStitch(s.st, holdMs);
    else if (s.type === 'yarn') game.pressYarn(s.yarn);
    else game.pressTurn();
  }
}

test('tension zones', () => {
  assert.equal(tensionFromHold(320).q, 'neat');
  assert.equal(tensionFromHold(200).q, 'neat');
  assert.equal(tensionFromHold(130).q, 'ok');
  assert.equal(tensionFromHold(40).q, 'loose');
  assert.equal(tensionFromHold(700).q, 'tight');
  assert.ok(tensionFromHold(40).t < 0 && tensionFromHold(700).t > 0);
});

test('a perfect run finishes with A+ and uses less yarn than supplied', () => {
  let clock = 0;
  const g = new Game(coaster, { now: () => clock });
  clock = 1000; play(g, NEAT, () => { clock += 500; });
  assert.equal(g.status, 'done');
  const s = g.stats();
  assert.equal(s.neat, 100);
  assert.equal(s.mistakes, 0);
  assert.equal(s.grade, 'A+');
  assert.equal(s.timeMs, 500 * (g.steps.length - 1)); // clock starts on the first action
  clock += 99999;
  assert.equal(g.stats().timeMs, s.timeMs); // frozen once finished
  assert.ok(g.yarnLeft > 0);
  assert.equal(g.rows.flat().length, 9 + 8 + 6 * 9); // foundation, row 2, then 6 rows with a turning chain
});

test('a wrong stitch blocks everything until it is frogged', () => {
  const g = new Game(coaster);
  const r = g.pressStitch('dc', NEAT); // pattern wants ch
  assert.equal(r.kind, 'wrong');
  assert.equal(g.mistakes, 1);
  assert.equal(g.rows[0].length, 1);
  assert.ok(g.rows[0][0].wrong);
  assert.equal(g.pressStitch('ch', NEAT).kind, 'blocked');
  assert.equal(g.pressTurn().kind, 'blocked');
  const yarnBefore = g.yarnLeft;
  assert.deepEqual(g.frog(), { kind: 'frogged', wrong: true, row: 0 });
  assert.ok(g.yarnLeft > yarnBefore);
  assert.equal(g.rows[0].length, 0);
  assert.equal(g.pressStitch('ch', NEAT).kind, 'placed');
});

test('frogging a correct stitch rewinds the step so it can be redone neater', () => {
  const g = new Game(coaster);
  g.pressStitch('ch', 40); // loose
  assert.equal(g.rows[0][0].q, 'loose');
  const idx = g.idx;
  assert.equal(g.frog().kind, 'frogged');
  assert.equal(g.idx, idx - 1);
  assert.equal(g.scores.length, 0);
  g.pressStitch('ch', NEAT);
  assert.equal(g.rows[0][0].q, 'neat');
});

test('cannot frog back across a turn', () => {
  const g = new Game(coaster);
  for (let i = 0; i < 9; i += 1) g.pressStitch('ch', NEAT);
  assert.equal(g.pressTurn().kind, 'turned');
  assert.equal(g.frog().kind, 'nothing'); // new row is empty
  g.pressStitch('sc', NEAT);
  assert.equal(g.frog().kind, 'frogged');
  assert.equal(g.frog().kind, 'nothing');
});

test('turning or changing yarn at the wrong time counts as a mistake without placing anything', () => {
  const g = new Game(scarf);
  assert.equal(g.pressTurn().kind, 'wrong-action');
  assert.equal(g.pressYarn(1).kind, 'wrong-action');
  assert.equal(g.pressYarn(0).kind, 'noop'); // already on yarn 0
  assert.equal(g.mistakes, 2);
  assert.equal(g.rows[0].length, 0);
});

test('yarn change is required where the pattern asks for it', () => {
  const g = new Game(scarf);
  while (g.step.type !== 'yarn') {
    const s = g.step;
    if (s.type === 'stitch') g.pressStitch(s.st, NEAT); else g.pressTurn();
  }
  assert.equal(g.pressStitch('ch', NEAT).kind, 'wrong');
  g.frog();
  assert.equal(g.pressYarn(1).kind, 'yarn');
  assert.equal(g.currentYarn, 1);
  assert.equal(g.pressStitch('ch', NEAT).kind, 'placed');
  assert.equal(g.rows[3][0].yarn, 1);
});

test('consistently loose stitches run the yarn out before the end', () => {
  const g = new Game(PATTERNS.find((p) => p.id === 'pouch'));
  play(g, 20);
  assert.equal(g.status, 'out-of-yarn');
});

test('grades', () => {
  assert.equal(gradeFor(100, 0), 'A+');
  assert.equal(gradeFor(90, 1), 'A');
  assert.equal(gradeFor(75, 3), 'B');
  assert.equal(gradeFor(55, 9), 'C');
  assert.equal(gradeFor(30, 0), 'D');
});
