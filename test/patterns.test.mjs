import test from 'node:test';
import assert from 'node:assert/strict';
import { expand, buildSteps, idealYarn, rowSlots, PATTERNS, STITCHES, KEY_TO_STITCH } from '../js/patterns.js';

test('expand handles repeats and groups', () => {
  assert.deepEqual(expand('ch*3'), ['ch', 'ch', 'ch']);
  assert.deepEqual(expand('ch sc*2'), ['ch', 'sc', 'sc']);
  assert.deepEqual(expand('ch sc [bo sc*2]*2'), ['ch', 'sc', 'bo', 'sc', 'sc', 'bo', 'sc', 'sc']);
  assert.deepEqual(expand('[sc dc]*2 hdc'), ['sc', 'dc', 'sc', 'dc', 'hdc']);
});

test('expand rejects unknown stitches and unbalanced groups', () => {
  assert.throws(() => expand('xx*2'), /Unknown stitch/);
  assert.throws(() => expand('[sc dc'), /Unclosed/);
  assert.throws(() => expand('sc]'), /Unexpected/);
});

test('every pattern row keeps a consistent width', () => {
  for (const p of PATTERNS) {
    const widths = p.rows.map(rowSlots);
    const foundation = widths[0];
    for (let r = 1; r < widths.length; r += 1) {
      assert.equal(widths[r], foundation - 1, `${p.id} row ${r + 1} should be ${foundation - 1} wide`);
    }
  }
});

test('buildSteps emits yarn changes, stitches, turns and a final finish', () => {
  const scarf = PATTERNS.find((p) => p.id === 'scarf');
  const steps = buildSteps(scarf);
  assert.equal(steps[0].type, 'stitch');
  assert.equal(steps.at(-1).type, 'finish');
  assert.equal(steps.filter((s) => s.type === 'turn').length, scarf.rows.length - 1);
  const yarnChanges = steps.filter((s) => s.type === 'yarn').map((s) => s.yarn);
  assert.deepEqual(yarnChanges, [1, 0, 1]);
  // a yarn change happens before that row's first stitch
  const firstChange = steps.findIndex((s) => s.type === 'yarn');
  assert.equal(steps[firstChange + 1].type, 'stitch');
  assert.equal(steps[firstChange + 1].row, steps[firstChange].row);
});

test('idealYarn sums stitch costs', () => {
  const coaster = PATTERNS.find((p) => p.id === 'coaster');
  // 9 ch + 8 sc + 6 rows of (1 ch + 8 sc)
  const expected = 9 * 1 + 8 * 2 + 6 * (1 + 8 * 2);
  assert.equal(idealYarn(coaster), expected);
});

test('stitch keys are unique', () => {
  const keys = Object.values(STITCHES).map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(KEY_TO_STITCH.s, 'sc');
});
