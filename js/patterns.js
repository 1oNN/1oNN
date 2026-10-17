// Stitch definitions, the pattern mini-language, and the project patterns.
// This module is pure (no DOM) so it can be unit-tested under node.

export const STITCHES = {
  ch:  { id: 'ch',  abbr: 'ch',  name: 'chain',               key: 'c', yarn: 1, height: 14 },
  sc:  { id: 'sc',  abbr: 'sc',  name: 'single crochet',      key: 's', yarn: 2, height: 22 },
  hdc: { id: 'hdc', abbr: 'hdc', name: 'half double crochet', key: 'h', yarn: 3, height: 28 },
  dc:  { id: 'dc',  abbr: 'dc',  name: 'double crochet',      key: 'd', yarn: 4, height: 36 },
  bo:  { id: 'bo',  abbr: 'bo',  name: 'bobble',              key: 'b', yarn: 8, height: 28 },
};

export const KEY_TO_STITCH = Object.fromEntries(
  Object.values(STITCHES).map((s) => [s.key, s.id]),
);

/**
 * Expand a compact row spec into an ordered list of stitch ids.
 *
 *   "ch*9"                 -> 9 chains
 *   "ch sc*8"              -> a turning chain then 8 single crochet
 *   "ch sc [bo sc*2]*3"    -> groups in [...] repeat with *n
 */
export function expand(spec) {
  const tokens = spec.match(/\[|\]\*\d+|\]|[a-z]+\*\d+|[a-z]+/g) || [];
  let pos = 0;

  function parseSeq() {
    const out = [];
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok === '[') {
        pos += 1;
        const inner = parseSeq();
        const close = tokens[pos];
        if (!close || !close.startsWith(']')) throw new Error(`Unclosed group in "${spec}"`);
        pos += 1;
        const reps = close === ']' ? 1 : Number(close.slice(2));
        for (let i = 0; i < reps; i += 1) out.push(...inner);
      } else if (tok.startsWith(']')) {
        return out;
      } else {
        pos += 1;
        const [id, n] = tok.split('*');
        if (!STITCHES[id]) throw new Error(`Unknown stitch "${id}" in "${spec}"`);
        const reps = n ? Number(n) : 1;
        for (let i = 0; i < reps; i += 1) out.push(id);
      }
    }
    return out;
  }

  const result = parseSeq();
  if (pos !== tokens.length) throw new Error(`Unexpected "]" in "${spec}"`);
  return result;
}

/**
 * Turn a pattern into the flat list of player actions ("steps").
 * Each step is one key press the player must make, in order.
 *
 *   { type: 'yarn',   yarn: 1, row }        switch to yarn #2 (keys 1..3)
 *   { type: 'stitch', st: 'sc', row, i }     make a stitch (hold the stitch key)
 *   { type: 'turn',   row }                  turn the work (T / Enter)
 *   { type: 'finish', row }                  fasten off at the very end (T / Enter)
 */
export function buildSteps(pattern) {
  const steps = [];
  let currentYarn = 0;
  pattern.rows.forEach((row, r) => {
    const yarn = row.yarn ?? currentYarn;
    if (yarn !== currentYarn) {
      steps.push({ type: 'yarn', yarn, row: r });
      currentYarn = yarn;
    }
    expand(row.spec).forEach((st, i) => steps.push({ type: 'stitch', st, row: r, i, yarn }));
    const last = r === pattern.rows.length - 1;
    steps.push({ type: last ? 'finish' : 'turn', row: r });
  });
  return steps;
}

/** Ideal yarn needed for the pattern, in yarn units, before any tension waste. */
export function idealYarn(pattern) {
  return pattern.rows.reduce(
    (sum, row) => sum + expand(row.spec).reduce((s, st) => s + STITCHES[st].yarn, 0),
    0,
  );
}

/** Number of fabric columns a row occupies (turning chains sit in the margin). */
export function rowSlots(row) {
  const ids = expand(row.spec);
  if (ids.every((id) => id === 'ch')) return ids.length; // foundation chain
  return ids.filter((id) => id !== 'ch').length;
}

function scRow(n) { return { text: `ch 1, turn. sc in each st across (${n})`, spec: `ch sc*${n}` }; }
function hdcRow(n) { return { text: `ch 1, turn. hdc in each st across (${n})`, spec: `ch hdc*${n}` }; }
function dcRow(n) { return { text: `ch 2, turn. dc in each st across (${n})`, spec: `ch*2 dc*${n}` }; }

export const PATTERNS = [
  {
    id: 'coaster',
    name: 'Mug coaster',
    level: 'Beginner',
    blurb: 'Chains and single crochet only. Learn to hold your tension.',
    yarns: [{ name: 'Rose', color: '#e58aa8' }],
    rows: [
      { text: 'ch 9', spec: 'ch*9' },
      { text: 'sc in 2nd ch from hook and in each ch across (8)', spec: 'sc*8' },
      ...Array.from({ length: 6 }, () => scRow(8)),
    ],
  },
  {
    id: 'scarf',
    name: 'Striped scarf (swatch)',
    level: 'Improver',
    blurb: 'Two yarns, two stitch heights. Change colour when the pattern says.',
    yarns: [{ name: 'Teal', color: '#3aa6a0' }, { name: 'Mustard', color: '#e2b23a' }],
    rows: [
      { text: 'With Teal, ch 13', spec: 'ch*13' },
      { text: 'sc in 2nd ch from hook and in each ch across (12)', spec: 'sc*12' },
      scRow(12),
      { yarn: 1, ...dcRow(12), text: 'Change to Mustard. ch 2, turn. dc in each st across (12)' },
      dcRow(12),
      { yarn: 0, ...scRow(12), text: 'Change to Teal. ch 1, turn. sc in each st across (12)' },
      scRow(12),
      { yarn: 1, ...dcRow(12), text: 'Change to Mustard. ch 2, turn. dc in each st across (12)' },
      dcRow(12),
    ],
  },
  {
    id: 'pouch',
    name: 'Bobble pouch panel',
    level: 'Confident',
    blurb: 'Bobbles eat yarn. Keep every stitch neat or you will run short.',
    yarns: [{ name: 'Lavender', color: '#a08ad8' }],
    rows: [
      { text: 'ch 11', spec: 'ch*11' },
      { text: 'sc in 2nd ch from hook and in each ch across (10)', spec: 'sc*10' },
      { text: 'ch 1, turn. sc, *bo, sc 2* 3 times (10)', spec: 'ch sc [bo sc*2]*3' },
      scRow(10),
      { text: 'ch 1, turn. sc 2, *bo, sc 2* 2 times, bo, sc (10)', spec: 'ch sc*2 [bo sc*2]*2 bo sc' },
      scRow(10),
      hdcRow(10),
      { text: 'ch 1, turn. sc, *bo, sc 2* 3 times (10)', spec: 'ch sc [bo sc*2]*3' },
      scRow(10),
    ],
  },
];
