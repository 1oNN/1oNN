# Hooked — final design brief

Design direction for the Hooked crochet game, decided after a three-lens review of four mockups (`design/*`). This is the single source of truth for two engineers working in parallel:

- **Engineer A (2D)** restyles `index.html`, `css/style.css`, `js/render.js` and the DOM glue in `js/main.js`.
- **Engineer B (3D)** builds `js/view3d.js` on the vendored three.js r160 (`vendor/three/three.module.min.js`, `vendor/three/OrbitControls.js`) as an alternative *view* of the same game.

The token file both of you read is `docs/design-tokens.css` (copy its `:root` blocks verbatim into `css/style.css`; the 3D view reads the same tokens from `getComputedStyle`). Nothing in this brief changes `js/patterns.js` or `js/game.js`; `npm test` and `scripts/smoke.mjs` must keep passing, so keep every element id and class the smoke test touches (section 10).

---

## 1. Decision: "Cosy craft room", lit Night Yarn's way after dark

### Scores

| Candidate | Craft authenticity | Usability (phone hard constraint) | Delight | Total |
| --- | ---: | ---: | ---: | ---: |
| **craft-room** | **8.5** | **8** | 8 | **24.5** |
| night-yarn | 6.5 | 6.5 | **8.5** | 21.5 |
| studio-minimal | 7 | 7 | 5.5 | 19.5 |
| arcade-juice | 5 | 6 | 6 | 17 |

**Winner: `craft-room`.** It wins on total, wins the craft lens outright, and is one of only two directions that keep the fabric, both meters and every control inside one 390×844 viewport with ≥ 64 px stitch targets (night-yarn and arcade-juice both push turn/frog below the fold with 3-column tiles). I checked the renders myself: `design/craft-room/fabric-2x.png` is the only fabric of the four where the next row visibly sits in the previous row's top loops, where the ball shrinks with the yarn meter, and where a wrong stitch has a pin in it; `design/craft-room/phone.png` (first 844 px) shows mat, meters, five tags and the action row all above the fold.

### Why not the others

- **night-yarn** has the most shareable frame (`_fabric-2x.png`: lit strands on velvet) and the right idea about where the hook sits, but neon halos are the opposite of fibre, the crook of the hook is hidden behind the loop so it reads as a stylus, there is no ball, and its 3-column phone tiles fail the fold constraint.
- **studio-minimal** is the most chart-correct (it alone fixed hdc = T, dc = T-with-one-bar) and has the cleanest hierarchy, but 1.5 px symbols and 2 px red dots vanish on a phone, there is no hook/yarn/fabric relationship to feel, and it is the closest to a generic design tool.
- **arcade-juice** has the best meter and the most salient "next" cue, but its outlined glossy rings make the fabric read as beads, and the combo/LOST!/+100 grammar fights the game's no-rush craft premise.

### What is grafted in (explicit list)

From **studio-minimal**: the corrected chart convention (hdc = plain post, dc = post with one bar); the chart symbol as inline SVG inside every stitch key and chip; the `13 st × 9 rows` / `hook 5.0 mm` corner labels on the mat; the tension readout in words and seconds (`single crochet · 0.30 s`) and `Teal on the hook`; a compact top bar carrying `Row 6 of 9` and the back control; the one-accent rule (only the next action is coloured); the hairline results list on the completion card; each new glyph drawn in as a pen stroke (dash offset) and reversed on frog.

From **night-yarn**: the hook sits in the top loop of the *last stitch made* (so a wrong stitch is literally on the hook and frogging pulls the hook back one stitch); the sc path (two legs to an apex under a top loop) replacing the plump arch; a single soft top highlight instead of the dashed ply; faint per-row baselines + a dot grid on the mat as a blocking-mat gauge; LOOSE / NEAT / TIGHT ticks under the tension meter; the state-aware readout (`frog first · then hold a stitch key`); the frog tag breathing while blocked; `prefers-contrast: more` handling; the yarn named in the yarn-meter label; in the **dark theme only**, a rationed halo (`--halo`) on yarn strands and meter fills, the lamp as a visible spot pool, a cool rim light in 3D, a yarn-coloured point light riding the working loop, a red point light inside a wrong stitch, and auto-rotate on the completion screen only.

From **arcade-juice**: the tension trough thickened to 18 px with solid zone blocks, a round knob and a ghost knob at the last release; a bouncing chevron above the expected tag and a *filled* (tinted) expected state; 44 px round back and sound buttons; the "Uh oh" blocking card pattern (headline + one sentence) for the wrong-stitch state; the working yarn routed from the hook *down* to a ball at a lower corner instead of arcing over the work; the loose stitch's cap loop sagging 2 px; the neat/loose/tight/wrong glyph matrix as a "How to read your fabric" card; the working loop's colour stepping through the tension zones and `navigator.vibrate(8)` on entering the green; in 3D, the loop spinning 180° on release while the new tube grows out of it; a soft-grip hook as a later unlock.

Not grafted (on purpose): combo meter, score pop-ups, sparkles, LOST! stickers, 3 px ink outlines, neon halos in the light theme, white-sheet dot grid as the whole surface.

---

## 2. Concept in one paragraph

The game is played on a lamp-lit oak craft table. Every piece of interface is a thing on that table: a linen blocking mat under the work (with a faint gauge grid), a printed pattern leaflet, paper tags for the stitch keys, a sewing pin marking the last release on the tension meter, a beech hook with a 5 mm size mark, and a wound ball of yarn that shrinks as you use it. Everything structural is a warm neutral (oak, linen, cream paper, walnut ink); the four yarn colours and one clay accent are the only saturated things on the table, and the accent only ever points at the next action. Stitches are plied yarn, not chart symbols, so a sloppy row looks sloppy; the chart symbols live in the keys and chips so the game quietly teaches chart reading. After dark the same table sits under a lamp: darker wood, warmer key light, and a small halo on the yarn so it stays the brightest thing in the room without turning into neon.

---

## 3. Colour tokens

Copy from `docs/design-tokens.css`. Light is the daytime table; dark is the same table under the lamp. Dark is applied under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`; `N` toggles `data-theme` and the choice is saved in `localStorage` (`hooked.theme`).

```css
:root {
  color-scheme: light;
  --bg: #d4b188;            /* oak tabletop, mid tone */
  --bg-2: #bf9666;          /* grain shadow */
  --bg-3: #e3c9a4;          /* lamp-lit highlight */
  --surface: #fbf6ec;       /* paper */
  --surface-2: #f1e7d4;     /* linen mat under the work */
  --surface-3: #e9dcc5;     /* chips, meter grooves, disabled tags */
  --surface-next: #f7e3bb;  /* tinted paper of the expected tag */
  --ink: #2f2318;           /* walnut ink */
  --table-ink: #4f3a2a;     /* the only non-ink text allowed on wood */
  --muted: #6b5543;         /* secondary text on paper/linen/chips only */
  --line: #d6c3a6;
  --accent: #9a4a2b;        /* clay: next instruction, primary button, row numbers, next flag */
  --accent-2: #a8743a;      /* honey: 3px "next" ring on a tag (non-text) */
  --neat: #4d7536;  --ok: #8f6a10;  --bad: #b23a30;
  --yarn-rose: #e2869f; --yarn-teal: #3b9e98; --yarn-mustard: #dcae36; --yarn-lavender: #9c86d2;
  --hook-1: #ecd3a4; --hook-2: #c69c63; --hook-3: #86603a;   /* beech hook light → shadow */
  --shadow-ink: 60, 35, 15; --dim: rgba(47, 35, 24, .5);
  --halo: 0%; --halo-canvas: 0; --noise-strength: .5; --linen-strength: .045;
  --radius: 10px; --paper-shadow: 0 1px 0 rgba(255,255,255,.65) inset, 0 1px 2px rgba(60,35,15,.18), 0 12px 28px -12px rgba(60,35,15,.45);
  --font-display: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, "Bitstream Charter", Georgia, Caladea, "DejaVu Serif", serif;
  --font-body: system-ui, -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
}
/* dark (both selectors carry the same block) */
  --bg: #3b2a1e; --bg-2: #2a1d14; --bg-3: #4c392a;
  --surface: #302822; --surface-2: #28211b; --surface-3: #3b322a; --surface-next: #4a3a24;
  --ink: #f1e6d3; --table-ink: #d9c8ae; --muted: #b9a78f; --line: #4f4236;
  --accent: #e0a070; --accent-2: #c08b58;
  --neat: #8cc278; --ok: #e2b84f; --bad: #e46f60;
  --yarn-rose: #ee9db5; --yarn-teal: #55c0b8; --yarn-mustard: #eac35a; --yarn-lavender: #b6a3ea;
  --hook-1: #e2c69a; --hook-2: #b6895a; --hook-3: #6e4c2c;
  --shadow-ink: 0, 0, 0; --dim: rgba(0, 0, 0, .55);
  --halo: 35%; --halo-canvas: .3; --noise-strength: .35; --linen-strength: .07;
```

### Contrast (WCAG 2.x relative-luminance ratios, computed from these exact hex values; re-check with any WCAG calculator if a token changes)

| Pair | Light | Dark | Rule |
| --- | ---: | ---: | --- |
| ink on bg (wood) | **7.60** | **11.07** | ≥ 7:1 required: project title, back link on wood |
| ink on surface (paper) | 14.18 | 11.71 | body text |
| ink on surface-2 (linen) / surface-3 (chips) | 12.46 / 11.28 | 12.84 / 10.15 | corner labels, chip text |
| ink on surface-next | 12.12 | 8.85 | text on the expected tag |
| table-ink on bg / bg-3 | 5.30 / 6.67 | 8.35 / 6.66 | eyebrows, tagline, footer on wood |
| muted on surface / surface-2 / surface-3 | **6.49 / 5.70 / 5.16** | **6.19 / 6.79 / 5.36** | ≥ 4.5:1 required; hints, meta, done rows, tag names |
| muted on bg | 3.47 | 5.85 | **never put `--muted` on wood in light; use `--table-ink`** |
| accent on surface / surface-2 | 5.75 / 5.05 | 6.49 / 7.13 | next instruction, row numbers |
| accent on bg | 3.08 | 6.14 | not text in light (links on wood are ink + accent underline) |
| surface on accent | 5.75 | 6.49 | primary button label, `next` flag |
| bad on surface / surface on bad | 5.51 | 4.64 | blocked instruction, wrong chip, frog ring |
| neat on surface / surface on neat | 4.98 | 6.96 | neat chips, stamp, pin head |
| ok on surface | 4.60 | 7.71 | nearly chips |
| accent-2 on surface | 3.73 | 4.87 | 3 px ring only (non-text ≥ 3:1) |
| rose / teal / mustard / lavender on surface-2 | 2.10 / 2.62 / 1.69 / 2.53 | 7.65 / 7.27 / 9.41 / 7.11 | yarn is never text; every stroke carries the dark shadow pass so its *edge* is ≥ 3:1 on the mat |

Yarn hex values in `js/patterns.js` stay as they are (they are the fallback); the renderer reads `--yarn-*` from the canvas' computed style and maps pattern yarn names (`Rose`, `Teal`, `Mustard`, `Lavender`) to tokens, falling back to the pattern hex for any other name.

---

## 4. Typography (system stacks only; no font is fetched)

| Role | Face | Size / weight | Notes |
| --- | --- | --- | --- |
| Title "Hooked" | display | `clamp(48px, 9vw, 76px)` / 700, `letter-spacing: -0.012em`, `line-height: 1` | hand-drawn underline: inline SVG path, 12 px tall, stroked in `--yarn-rose` 5 px round caps, draws itself on load (600 ms) |
| Screen titles (project name, "Fastened off!") | display | 26px / 700 (22px on phone) | parenthetical in `0.7em` italic 400 `--table-ink` |
| Leaflet title, card names | display | 22px / 700 | |
| Next strip + leaflet next line | display | 18px / 700 in `--accent`; `--bad` when blocked | the kbd sits inline |
| Tag abbreviation (`sc`, `dc`) | display | 22px / 700 (19px on phone) | |
| Pattern rows | display | 15px / 400, `line-height 1.35` | done rows struck through in `--muted` |
| Stats numerals | display | 24px / 700, `font-variant-numeric: tabular-nums` | stamp letter 66px |
| Body, hints, blurbs | body | 16px / 400, `line-height 1.5`; hints 14px `--muted` | |
| Eyebrows ("PATTERN", "TENSION", level, "ROW 6 OF 9") | body | **11px** / 700, `letter-spacing .16em`, uppercase | `--muted` on paper, `--table-ink` on wood |
| Keycaps (`kbd`), chips, meter readout | mono | **11px** / 600 keycaps (also on phone), 12px / 700 chips, 12px / 600 readouts | nothing on the page is smaller than 11px |
| Meter ticks `loose · neat · tight` | mono | 11px / 600, uppercase, `letter-spacing .12em` | |
| Corner labels on the mat | mono | 11px / 600 `--ink` at 70% opacity | `13 st × 9 rows`, `hook 5.0 mm` |

Weights used: 400, 700 only (600 for mono). On Linux Chromium the stacks resolve to Bitstream Charter / DejaVu Sans / DejaVu Sans Mono, on macOS to Iowan Old Style / SF / SF Mono, on Windows to Palatino Linotype / Segoe UI / Consolas; sizes above tolerate all three. Do not add a Google Fonts link: the proxy blocks it and the stacks are good.

---

## 5. Background and texture (all CSS, no image files)

**Tabletop** (`body`, or a `.table` wrapper around `#app`): five stacked backgrounds. The `body` must set an explicit `background-color: var(--bg)`.

```css
body {
  background-color: var(--bg);
  color: var(--ink);
  background-image:
    radial-gradient(900px 520px at 16% -6%, rgba(255, 244, 222, .55), transparent 62%),
    radial-gradient(1100px 700px at 104% 108%, rgba(var(--shadow-ink), .28), transparent 60%),
    repeating-linear-gradient(0.6deg, rgba(90, 55, 25, .10) 0 1px, transparent 1px 7px, rgba(90, 55, 25, .05) 7px 9px, transparent 9px 19px, rgba(120, 80, 40, .08) 19px 20px, transparent 20px 33px),
    repeating-linear-gradient(0deg, transparent 0 226px, rgba(50, 25, 5, .25) 226px 228px, rgba(255, 232, 196, .22) 228px 229px, transparent 229px 230px),
    linear-gradient(180deg, var(--bg-3), var(--bg) 38%, var(--bg-2));
  background-attachment: scroll; /* never fixed: slow on phones */
}
/* film grain: one layer, gives the wood its tooth and stops the gradients banding */
body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  opacity: var(--noise-strength); mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");
}
#app { position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 18px 16px 48px; }
```

In the dark theme the lamp is visible: add a sixth layer at the front, `radial-gradient(760px 520px at 30% 0%, rgba(255, 214, 150, .18), transparent 70%)` (the pool of light the 3D `SpotLight` reproduces). Under `prefers-contrast: more` set `--noise-strength: 0` and `--halo: 0%`.

**Paper** (`.paper`, `.tag`, `.yarn-btn`, `.chip`, `.toast`, `.dialog`, `.card`, `.howto`): laid-paper crosshatch over `--surface`.

```css
.paper, .tag, .yarn-btn, .chip, .toast, .dialog, .card, .howto {
  background-color: var(--surface);
  background-image:
    repeating-linear-gradient(0deg, rgba(90, 60, 30, var(--linen-strength)) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(90, 60, 30, var(--linen-strength)) 0 1px, transparent 1px 3px);
}
.paper, .card, .howto, .dialog { border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--paper-shadow); }
```

**Linen blocking mat** (`.mat`, wraps the canvas): the same crosshatch at .06 plus a dashed hem; the gauge grid (dots at every stitch column, a hairline at every row baseline) is drawn *on the canvas* so it stays aligned with the stitches (section 6.6).

```css
.mat {
  position: relative; background-color: var(--surface-2);
  background-image:
    repeating-linear-gradient(0deg, rgba(90, 60, 30, .06) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(90, 60, 30, .06) 0 1px, transparent 1px 3px);
  border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--paper-shadow);
  padding: 12px; display: flex; justify-content: center;
}
.mat::after { content: ""; position: absolute; inset: 7px; border: 1px dashed rgba(90, 60, 30, .28); border-radius: 6px; pointer-events: none; }
:root[data-theme="dark"] .mat::after { border-color: rgba(255, 230, 190, .18); }  /* and the media-query twin */
canvas#fabric { display: block; width: 100%; max-width: 720px; height: auto; }
```

**Rubber stamp** (grade on the completion card): `filter: url(#rough)` using an inline `<svg width="0" height="0">` with `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>`, rotated −9°, `mix-blend-mode: multiply` (`screen` in dark). Keep the stamp outside the element that animates `transform` (it stutters on phones otherwise).

**Washi tape** on the how-to card: `width: 96px; height: 24px; transform: rotate(-2deg); background: repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px), color-mix(in srgb, var(--yarn-mustard) 55%, transparent); box-shadow: 0 1px 2px rgba(var(--shadow-ink), .25);`.

**Highlighter band** on the current pattern row: a `::before` behind the text, `background: color-mix(in srgb, var(--ok) 28%, transparent); transform: skewX(-6deg); inset: 2px -6px;`.

`color-mix()` needs Chromium 111 / Safari 16.2 / Firefox 113; every use is in a background or shadow, never in `color`, so older browsers degrade to flat.

---

## 6. 2D fabric: canvas spec (`js/render.js`)

### 6.1 Geometry and scaling

Keep `CELL = 30` and the `STITCHES[].height` table (ch 14 / sc 22 / hdc 28 / dc 36 / bo 28), `layout()`, `nextPosition()` and the turning-chain placement exactly as they are, except these constants: `PAD = 18`, `MARGIN = 30`, `HOOK_ROOM = 64`, and a new `BALL_ROOM = 72` added to the *right* of the fabric (`width = PAD*2 + MARGIN*2 + cols*CELL + BALL_ROOM`). The canvas is drawn at `k = min(2, devicePixelRatio) × (cssWidth / lay.width)` with `ctx.setTransform(k, 0, 0, k, 0, 0)`; `cssWidth` = the mat's inner width capped at 720. All sizes below are in layout px (pre-scale). `shadowBlur` / `shadowOffset` ignore the transform, so multiply them by `k`.

### 6.2 Yarn stroke (one `Path2D` per glyph, stroked in passes, round caps and joins)

| Pass | When | Offset | Width | Colour / alpha |
| --- | --- | --- | --- | --- |
| 0 halo | dark theme only (`--halo-canvas` > 0) | 0 | `w + 1.6`, `shadowBlur 10·k` | yarn at `--halo-canvas` (.3) |
| 1 shadow | always | (+0.6, +1.7) | `w + 1` | yarn mixed 60% toward `#2a1608`, alpha .5 |
| 2 body | always | 0 | `w` | yarn |
| 3 highlight | always | (−0.3, −0.24·w) | `0.3·w` | yarn mixed 62% toward `#fff7e8`, alpha .5, **solid** (not dashed) |

`w` = 5.2 for neat/ok, 4.7 loose, 5.6 tight, 5.2 wrong. The shadow pass is what keeps pale yarn ≥ 3:1 against the linen; never drop it. Mix in sRGB (`mix(a, b, f)` per channel).

### 6.3 Glyphs

Coordinates: base-centre of the stitch at `(cx, y)` (row baseline), `w = CELL × wScale`, `h = STITCHES[st].height × hScale`, up is −y. Every stitch except `ch` ends in a **cap loop**: ellipse centre `(cx, y − 0.84h)`, `rx 0.33w`, `ry clamp(0.13h, 3.4, 4.8)`. The cap is the "top two loops" the next row is worked into; the next row's base points sit on it.

| Stitch | Path (chart convention corrected: hdc = plain post, dc = one bar; two bars would be a treble) |
| --- | --- |
| `ch` | one ellipse centre `(cx, y − h/2)`, `rx 0.40w`, `ry 0.36h`. Foundation chains lie flat along the bottom row; turning chains stack upward 11 px apart at the row's start edge (unchanged). |
| `sc` | two legs bowing slightly outward: `moveTo(cx − 0.28w, y)`, `quadraticCurveTo(cx − 0.34w, y − 0.40h, cx, y − 0.64h)`, `quadraticCurveTo(cx + 0.34w, y − 0.40h, cx + 0.28w, y)`; then the cap. Apex touches the cap's underside. |
| `hdc` | post with a faint S: `moveTo(cx, y)`, `bezierCurveTo(cx + 0.06w, y − 0.25h, cx − 0.06w, y − 0.50h, cx, y − 0.74h)`; **no bar**; cap. |
| `dc` | same post to `y − 0.76h`; **one** wrap bar `(cx − 0.30w, y − 0.40h) → (cx + 0.30w, y − 0.56h)`; cap. |
| `bo` | three overlapping puffs, filled: left ellipse centre `(cx − 0.18w, y − 0.42h)` `rx 0.30w ry 0.36h`; right `(cx + 0.18w, y − 0.42h)`; centre on top `(cx, y − 0.46h)` `rx 0.30w ry 0.40h`. Each puff: radial gradient (yarn mixed 45% toward `#fff7e8` at the upper-left 30% stop, yarn at 60%, yarn mixed 22% toward `#2a1608` at the rim), `shadowBlur 3·k` warm shadow, 1 px outline in the rim colour. Then the cap. Bobbles are the only filled shapes so they pop forward as in real fabric. |

### 6.4 Tension and quality (read `s.q`, never re-derive thresholds)

`t ∈ [−1, 1]`; `wScale = 1 − 0.24t`, `hScale = 1 − 0.10t`. Apply before building the path.

- **neat**: as above. A deterministic ±0.6 px jitter from `s.n` on `cx` so a perfect row still looks hand-made.
- **ok**: same shape; body colour nudged 7% toward `#fff7e8` when `t < 0`, 7% toward `#2a1608` when `t > 0`.
- **loose** (`q === 'loose'`): `w 4.7`; body lightened 12% at alpha .82; rotated `0.14·t` rad about the base (leans); cap loop sags: centre +2 px down, `ry + 1.5`; a slack loop (ellipse `5 × 3`) hangs off the base at `(cx − 0.18w, y + 1)`. Reads "baggy".
- **tight** (`q === 'tight'`): `w 5.6`; body darkened 22%; rotated `0.14·t` the other way; cap `rx × 0.82`. Reads "pinched".
- **wrong** (`s.wrong`): every pass in `--bad` (shadow pass = bad mixed 60% toward `#2a1608`), `setLineDash([6, 4])`; a brick pin (shaft 1.5 × 14 px at 35° from upper-left, head r 3.75 in `--bad` with a 1 px white ×) pushed into the stitch at `(cx − 0.22w, y − 0.9h)`. A wrong `dc` in an `sc` row keeps its own height and sticks up. In the dark theme the halo pass runs at 1.3× strength for wrong stitches only.

### 6.5 Hook, loop, working yarn, ball

**Hook position (night-yarn graft):** the hook stands in the top loop of the last stitch made.

- Current row has placed stitches → anchor = that stitch's cap centre (for a turning chain: the centre of the top-most turning-chain ellipse).
- Current row empty after a turn → anchor = the cap of the last stitch placed in the previous row (it is at the current row's start edge).
- Foundation row empty → anchor = slot 0's centre; draw a slip knot (ellipse `7 × 5` + a 6 px tail) there.
- During a hold → the hook glides from the anchor toward `nextPosition()` by `progress × 0.6` of the distance and dips 9 px; on release it finishes the move in the place animation. On frog it eases back 180 ms to the previous stitch's cap.

**Hook drawing** (beech, 30° right of vertical, pivot at the throat): shaft 7 px wide × 62 px with a 3-stop gradient across it (`--hook-1`, `--hook-2`, `--hook-3`), a thumb rest 10 px wide × 16 px at 34–50 px up the shaft, three 1 px grain lines at 22% `--hook-3`, a 1 px `rgba(255,247,232,.7)` edge highlight on the lit side, a `5 mm` mark (mono 6 px, rotated with the shaft, 55% `--hook-3`) just below the thumb rest, a J throat: `moveTo(0, −10) quadraticCurveTo(0, 4, −7, 2) quadraticCurveTo(−11, 1, −9, −5)` stroked 4.5 px in the same gradient, with the **crook always visible** (the loop never covers it). A blurred shadow (`shadowBlur 7·k`, offset (4, 6), 28% `--shadow-ink`) falls on the mat. Idle bob: 1.5 px sine, period 320 ms (kept from the prototype).

**Working loop:** an ellipse of yarn around the throat, `6 × 9.5` at rest growing to `15 × 24` with hold progress; drawn with the 6.2 passes, back half before the hook and front half after so the yarn wraps the throat. Its body colour steps with the hold zone (arcade graft): outside the ok zone = yarn mixed 35% toward `--surface-3`; ok zone = yarn; neat zone = yarn with a 1.5 px `--neat` outline. Phone: `navigator.vibrate(8)` once per hold on entering the neat zone.

**Working yarn (arcade graft, physically truthful path):** leaves the loop's right edge and runs *down and right behind the work* to the ball: `moveTo(hx + 4, hy)`, `bezierCurveTo(hx + 0.45·(bx − hx), hy + 26, bx − 28, by − r − 36, bx, by − r)`. It is drawn **before** the placed stitches so the fabric covers it where it crosses (yarn behind fabric shows through the holes, which is correct), stroked with the 6.2 passes at `w 4.4`. Never arc it over the top of the work.

**Ball:** centre `(lay.left + cols·CELL + MARGIN + 6 + 30, row0.y − r)`, radius `r = 14 + 16 × yarnLeft` (max 30). Radial gradient clipped to the circle (yarn lightened 35% at (−0.35r, −0.35r), yarn at 55%, yarn darkened 30% at the rim), six wound strands (great-circle ellipses at 0°, 30°, 60°, 100°, 130°, 160°; 3.4 px dark at 34% then 1.2 px light at 50%), a gloss ellipse, and a soft shadow on the mat. Under 15% yarn the ball is small and the yarn meter pulses; under 5% the meter fill turns `--bad`.

### 6.6 Mat, gauge grid and corner labels

Draw on the canvas, under everything: a dot at every column centre × every row baseline (`r 0.9`, `--ink` at 10%), a hairline at every row baseline across the fabric width (`--ink` at 6%), the fabric's soft drop shadow (blur `16·k`, offset (0, 9), 32% warm ink under the union of placed-stitch rects, knocked out with `destination-out` so only the halo remains and the mat shows through the holes). Corner labels are DOM (`<span class="mat-label tl">13 st × 9 rows</span>`, `<span class="mat-label tr">hook 5.0 mm</span>`) so they stay crisp; the stitch count comes from `layout().cols` and `pattern.rows.length`.

### 6.7 Chart symbols for keys and chips (inline SVG, `viewBox="0 0 24 24"`, `stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"`)

```
ch   <ellipse cx="12" cy="12" rx="8" ry="4.5"/>
sc   <path d="M5 5 19 19 M19 5 5 19"/>
hdc  <path d="M12 4v16 M5 4h14"/>
dc   <path d="M12 4v16 M5 4h14 M8 13.5l8-3.5"/>
bo   <ellipse cx="12" cy="12" rx="5.5" ry="8.5" fill="currentColor" fill-opacity=".22"/><path d="M12 20.5V3.5 M12 20.5 7.5 5 M12 20.5l4.5-15"/>
```

Export them from `js/render.js` as `STITCH_SYMBOLS` so keys, chips and the stitch-guide card share one vocabulary.

---

## 7. Layout

### 7.1 Play screen, desktop (≥ 900 px): two columns `minmax(0, 1fr) 332px`, gap 22

Work column, top to bottom:

1. **Top bar** (52 px): round 44 px paper back button (`#btn-quit`, ← icon, `aria-label="Back to projects"`), eyebrow `IMPROVER · ROW 6 OF 9` in `--table-ink`, project title (display 26px, `--ink`), spacer, round 44 px sound button (`#mute`, ♪, text alternative in `aria-label`), round 44 px theme button (☾ / ☀, key `N`). Row numbers come from `game.step.row`.
2. **Mat** with the canvas, two corner labels, the toast pinned top-left (`.toast`: paper label, `--bad` dot + text, rotated −1.4°, never over the hook: if the hook anchor's x is in the left 40% of the canvas the toast moves to the top-right).
3. **Instruments strip** (`.paper`, padding 14): `TENSION` eyebrow + readout right (`single crochet · 0.30 s` while holding; `last stitch: too loose · 0.09 s` after; `frog first · then hold a stitch key` when blocked; `hold a stitch key` idle); **18 px track** (`--surface-3`, inset 1 px shadow), ok zone block `color-mix(in srgb, var(--ok) 28%, transparent)`, neat zone block `color-mix(in srgb, var(--neat) 45%, transparent)` (positions from `HOLD` as today), the fill is a yarn strand (current yarn, 2 px lighter stripe on top, 1 px `rgba(60,35,15,.35)` edge) with a 14 px round knob at its end while holding, a sewing pin (2 × 16 px shaft, 7 px head in the quality colour) left at the release point until the next hold, and a ghost knob at 40% for 1.2 s; ticks `LOOSE · NEAT · TIGHT` under it (left / centre / right). Then `YARN` eyebrow + `51% left · Teal on the hook` and a 12 px track whose fill is the yarn strand, with the shrinking ball icon (14–22 px) at its left.
4. **Next strip** (36 px, one line, display 18px `--accent`): `Next: single crochet [S]`; blocked: `--bad` `Frog the wrong stitch [F]`. This is the above-the-fold instruction on phones; keep it on desktop too.
5. **Five stitch tags** in one row, gap 8: paper tags (`.tag`, punched hole top-left, 3 px bottom edge in `color-mix(in srgb, var(--line) 70%, var(--muted))` compressing to 1 px on press with `translateY(2px)`), content: chart symbol (24 px, `--muted`; `--accent` when expected), abbreviation (display 22px), name (11px `--muted`), keycap. **Expected** tag: `background-color: var(--surface-next)`, 3 px `--accent-2` ring, a `next` flag (accent fill, surface text, 9px uppercase) at the top-right, and a bouncing chevron (▾ above the tag, `translateY ±3px`, 900 ms loop). **Blocked**: all stitch tags at 66% opacity, no lift. Held: `--surface-3`.
6. **Action row** `1fr 1fr 2fr`, gap 8, 56 px tall: `turn` tag (abbr display 20px, "end of row", `T`), `frog` tag ("rip back", `F`; when blocked it wears a 3 px `--bad` ring, a `now` flag in `--bad` and breathes `scale 1 → 1.02` at 1.4 s), then the yarn buttons (paper pill: 14 px yarn dot with the 6.5 ball shading, name, keycap; active = 2 px `--ink` ring).

Right column, the **pattern leaflet** (`.paper`, rotated −0.35°): eyebrow `PATTERN`, title (display 22px), meta `Improver · 2 yarns · 5 mm hook · 9 rows`; the next instruction (display 18px accent) and a one-line hint; when blocked the two become the **"Uh oh" card** (arcade graft): a `--bad`-tinted block (`color-mix(in srgb, var(--bad) 12%, var(--surface))`, 1 px `--bad` border) with headline `Wrong stitch. Frog it [F]` and one sentence `That was a double crochet where a single belongs. Rip the red stitch back out, then carry on.`; then the row chips (`.chip`: mono 12px, chart symbol + abbr, 26 px tall; done neat/ok/loose/tight filled in the status colour with `--surface` text; current = `--accent` fill, pulsing; wrong = dashed `--bad` outline; `turn` / `fasten off` / yarn names outlined); `ROWS` eyebrow and the `<ol>` with `Row n` in `--accent` display 15px, current row under the highlighter band, done rows struck through in `--muted`; a dashed rule; stats `TIME · NEAT · MISTAKES` (eyebrow + display 24px numerals).

### 7.2 Play screen, phone (≤ 600 px; must fit 390 × 844 with no horizontal scroll)

Single column, 16 px gutters, 8 px vertical gaps:

| Block | Height | Notes |
| --- | ---: | --- |
| Top bar | 52 | 44 px round back, eyebrow `ROW 6 OF 9` + title 20px in one line (title truncates with ellipsis), 44 px round sound; theme button hidden on phone (it is on the title screen) |
| Mat | ≈ 236 | canvas at 342 CSS px wide for a 13-column piece (`lay.width` 558 → `k` ≈ 0.61 × dpr); corner labels 10px |
| Instruments | ≈ 112 | tension track 18 px, yarn 12 px; readout 11px mono |
| Next strip | 36 | |
| Stitch tags | **66** | still five in a row (gap 6); name hidden, abbr 19px, symbol 20 px, keycap 11px |
| Action row | 56 | `1fr 1fr 2fr`; yarn buttons collapse to dot + keycap |
| Leaflet | rest | below the fold is fine: everything needed to play is above it (total ≈ 596 px + gutters) |

Hit targets: tags ≥ 64 × 66, action buttons ≥ 56 tall, round buttons 44, yarn pills ≥ 48 tall. Check with the smoke test (`scrollWidth > innerWidth` must stay false) and by reading `docs/phone.png` at 1:1 after the restyle.

### 7.3 Title screen

Hero: yarn-ball-and-hook mark (inline SVG, 96 px, the ball in `--yarn-rose`, the hook in the `--hook-*` gradient), `Hooked` with the drawn underline, tagline in `--table-ink` (`keep your tension` in display italic `--ink`). `Choose a pattern` heading (display 24px) with `Best results are kept on this device` in `--table-ink` 13px on the right. Three leaflet cards (`.card`, rotated −0.35° / 0.2° / −0.25°): eyebrow level in `--accent`, name (display 22px), blurb (`--muted` 15px), a row of labelled skeins (28 × 14 px rounded rectangle in the yarn colour with two paper bands) + `9 rows · 132 moves` in `--muted`, a dashed rule and `Best A · 94% neat · 1:48` (grade in display `--neat`) or `Not yet made`. Keep `.card` as the clickable element and keep their order (the smoke test clicks `.card:nth-child(2)`). The **How to play** index card (`.howto`) held by washi tape, four numbered steps with keycaps. The **How to read your fabric** card (arcade graft, kept quiet): a 5 × 4 canvas matrix (columns ch sc hdc dc bo, rows neat / loose / tight / wrong) drawn with the exported `drawStitch`, 360 × 200 CSS px, labels in mono 11px. Footer: `Sound: on [M]` and `Theme: day [N]` as links in `--table-ink`, a small mono wordmark.

### 7.4 Completion

Overlay `background: var(--dim)` with `backdrop-filter: blur(2px)` over the finished play screen (the finished fabric stays visible behind). Paper card 420 px: eyebrow (project name, `--accent`), `Fastened off!` (display 30px), one compliment line (`--muted`), the rubber stamp (128 px ring + inner ring, grade 66px display in `--neat`; `--ok` for B, `--bad` for C/D; caption `neatly made` / `nearly there`), then a **hairline results list** (studio graft): four rows `Neatness 96%` / `Mistakes 0` / `Time 2:51` / `Yarn left 23%` separated by 1 px `--line`, label `--muted` 15px, value display 18px tabular right-aligned, the yarn-left row carrying the small ball icon; `New personal best` in `--accent` display 15px; buttons `Make it again [Enter]` (primary: `--accent` fill, `--surface` text, 3 px darker bottom edge) and `Choose a project [Esc]` (paper). The ran-out-of-yarn variant keeps the same card with an empty-ball icon instead of the stamp. Keep `#done`, `#done-title`, `#done-body`, `#btn-again`, `#btn-menu`.

---

## 8. Motion and feedback (ease-out unless noted; all of it off under `prefers-reduced-motion: reduce`, including the hook bob and the canvas shake, but the meter fill still moves because it is gameplay information)

| Moment | 2D | Duration |
| --- | --- | --- |
| Hold | hook glides toward the next slot and dips 9 px; loop grows 6×9.5 → 15×24 and steps colour through the zones; meter strand extends (50 ms linear); knob rides the fill; `vibrate(8)` on entering the neat zone (phone) | continuous over `HOLD.max` 800 ms |
| Place, any quality | the new glyph is **drawn in as a pen stroke**: `setLineDash([len, len])` with `lineDashOffset` animating len → 0 (studio graft) | 140 ms |
| Place, neat | then scale 1.08 → 1 about the base; highlight pass flashes once (alpha .5 → .9 → .5); toast none; 880 Hz tick (existing) | 120 ms |
| Place, ok | 2 px lateral wobble; toast `Nearly` (`--ok` dot) | 160 ms |
| Place, loose | the stitch droops into place: height 90% → 100% and the cap sags 2 px, the slack loop drops out at the end; toast `Too loose` | 200 ms |
| Place, tight | snaps in with a one-frame 1 px upward jolt then settles; toast `Too tight` | 120 ms |
| Toast | paper label drops in from −6 px with a −1.4° settle; leaves after 1.4 s | 150 ms in / 200 ms out |
| Wrong stitch | canvas shake (existing 300 ms); the pin pushes in (scale 1.6 → 1); the halo (dark) pulses 2× at 1.4 s; toast in `--bad`; frog tag gains ring + `now` flag and breathes; stitch tags dim; Uh-oh card replaces the next line; next strip goes `--bad` | 160 ms pin |
| Frog | the stitch unravels: the dash animation reversed (0 → len) while a 14 px curl of yarn flies along the working-yarn path toward the ball; the pin pops out (scale 1 → 1.4 → 0, 160 ms); hook eases back to the previous cap; toast `Frogged. Carry on.` | 180 ms |
| Turn | fabric `scaleX(1 → .96 → 1)` with `skewX(2deg)` at the middle as if flipped; hook slides to the other edge along a shallow arc; leaflet highlighter band moves to the next row and the done row's strike-through draws left → right; top-bar row number ticks | 250 / 300 / 200 ms |
| Yarn change | the ball rolls (`rotate 0 → 90°`) and crossfades to the new colour; meter fill crossfades; working yarn redraws from the ball up to the hook; active yarn pill gets its ink ring; toast `Now using Mustard` | 300 ms |
| Low yarn (< 15%) | yarn fill and ball icon pulse at 1 s; under 5% the fill turns `--bad` | loop |
| Fasten off | 900 ms pause (existing), overlay dims (200 ms), card pops (scale .92 → 1, 250 ms), stamp thuds down 150 ms later (scale 1.6 → 1, rotate −14° → −9°, 220 ms), results hairlines draw in at 40 ms intervals, **yarn-snippet confetti** (120 short 3 px-wide strands, 10–18 px long, in the project's yarn colours, curling as they fall) for 1.2 s | |
| Title | cards lift 3 px and straighten on hover/focus; the hero underline draws itself once on load | 150 / 600 ms |
| Buttons | tags sink 2 px on press; expected chevron bounces; focus-visible = the same 3 px ring the expected tag wears (`--accent-2`, `--bad` on frog) | |

Sounds stay as they are in `main.js`.

---

## 9. 3D view spec (`js/view3d.js`, three r160 vendored, OrbitControls)

The 3D view is the same table seen from a chair: the piece lies on the linen mat, the hook stands in the working loop, the ball sits by the lower-right corner. It is a *view*, not a different game: input, meters, next strip and leaflet are unchanged, and `game` / `lay` / `frame` are the same objects `draw()` receives. A segmented `2D | 3D` control sits in the mat's bottom-right corner (paper, 32 px tall, key `V`); the choice persists in `localStorage` (`hooked.view`). If `canvas.getContext('webgl2') || getContext('webgl')` is null the control is hidden and 2D stays.

### 9.1 Module contract

```js
export function createView3d(container, { getPalette }) -> { update(game, lay, frame), resize(), setTheme(), dispose() }
```

`getPalette()` returns the resolved tokens (`bg`, `bg2`, `surface2`, `ink`, `bad`, `neat`, `ok`, yarn map, hook-1/2/3, halo-canvas) read with `getComputedStyle(document.documentElement)`; call `setTheme()` on `data-theme` mutation and on `matchMedia('(prefers-color-scheme: dark)')` change. `update()` runs inside the existing rAF loop in `main.js` only while the 3D view is visible; it rebuilds stitch meshes only when `game.placedCount` or the frog count changes, and animates the hook, loop, working yarn and ball every frame. `BufferGeometryUtils` is **not** vendored: either keep one `Mesh` per stitch (≤ 140 draw calls, fine) or hand-roll a 20-line merge of `position`/`normal`/`uv` arrays per yarn+quality bucket.

### 9.2 Units and mapping

1 scene unit = `CELL` (30 layout px). The fabric lies flat on the table: `x3 = (px − lay.left) / CELL`, `z3 = (py − row0.y) / CELL` (the foundation chain is nearest the viewer at z ≈ 0, newer rows at negative z), `y3` is up with the mat top at y = 0 and every tube centre at `y = r` unless stated. The hook stands up (+y). Yarn tube radius `r = 0.087` (= 2.6 px, half the 5.2 px 2D stroke) with 8 radial segments.

### 9.3 Yarn material

`MeshPhysicalMaterial({ color, roughness: 0.85, metalness: 0, sheen: 0.7, sheenRoughness: 0.75, sheenColor: lighten(color, .35), emissive: color, emissiveIntensity: light ? 0 : 0.06, normalMap, normalScale: new Vector2(0.5, 0.5) })`, `color` from the yarn token via `new Color(hex)` (three r160 with `ColorManagement.enabled` converts sRGB hex automatically; do **not** also call `convertSRGBToLinear`). Sheen is what makes it read as fibre rather than plastic. `normalMap`: a 256 × 64 `CanvasTexture` of diagonal ridges at 45° (two soft stripes per 32 px, normal-encoded), `RepeatWrapping`, repeat 6 per unit along the tube (set `map.repeat.x` from the curve length). Quality buckets: neat = as is; ok = colour ±7% like 2D; **loose** = same `r`, path scaled by `wScale` / `hScale` with a sag (the apex/cap dropped 0.08 u and the legs bowed 0.06 u outward), colour lightened 10%, `sheenRoughness .9`; **tight** = path compacted, `r 0.1`, colour darkened 20%, `sheenRoughness .45` (shinier, pulled hard); **wrong** = `--bad`, `map` = a 1:1 stripe `CanvasTexture` (6 px bad / 4 px bad darkened 45%) repeated along the tube so it reads dashed in 3D, `emissiveIntensity .12` in both themes, plus the pin (section 9.8).

### 9.4 Stitch path geometry (all `TubeGeometry` along a `CatmullRomCurve3`, `tension 0.4`; `tubularSegments` 24 for ch/sc/hdc, 32 for dc, 16 per bobble loop; coordinates in cell units relative to the stitch's base-centre `(cx, 0, z0)`, `w` and `h` already tension-scaled, `h` = stitch height / CELL)

- **Cap loop** (all but ch): a closed ellipse in a plane tilted 35° from the mat, centre `(cx, r, z0 − 0.84h)`, semi-axes `0.33w` along x and `0.14h` along the tilted axis; 16 points; the next row's base points pass through its centre at `y = r` so rows visibly interlock.
- **ch**: a flattened closed loop: ellipse centre `(cx, r, z0 − 0.5h)`, semi-axes `0.40w` × `0.36h` in the x–z plane, with `y = r ± 0.45r · sin(2θ)` so the strand crosses over itself once at the base; foundation chains lie along z = 0; turning chains stack along z at the row's start edge 11/30 u apart, each lifted `y += 0.5r` over the previous one.
- **sc**: a short post with a V: start at the base-left insertion `(cx − 0.28w, −0.3r, z0)` (dips *into* the cap below), up to the apex `(cx, 1.6r, z0 − 0.64h)` (passes *over*), down the right leg to `(cx + 0.28w, −0.3r, z0)`, then up through the cap loop; legs bow 0.06 u outward at mid-height.
- **hdc**: post from `(cx, −0.3r, z0)` to `(cx, r, z0 − 0.74h)` with a gentle S (x ± 0.06w at ¼ and ½), then the cap. No wrap.
- **dc**: post to `z0 − 0.76h` with **one wrap**: a single helix turn around the post between `0.40h` and `0.56h` (radius `1.4r`, 10 points, climbing with the post), then the cap. (A treble, if ever added, gets two turns.)
- **bo**: five short tubes from the base point `(cx, −0.3r, z0)` to the cap centre, loop *k* (k = −2..2) bulging sideways `x = cx + 0.36w · sin(k · 30°)` and **forward out of the fabric** `y = r + 0.55w · (0.6 + 0.4 cos(k · 30°))` at its midpoint, so the puff stands proud of the mat; each loop 16 segments; then the cap over the top.

Each row's stitches alternate direction with `lay` (even rows +x, odd rows −x); mirror the sc/dc paths accordingly so the wrap leans with the row.

### 9.5 Lighting rig

- **Key** (the lamp): `DirectionalLight(0xffe6c0, light ? 2.2 : 1.4)` at `(−1.2, 2.4, 1.0) × 10` units aimed at the fabric centre; `castShadow`, `shadow.mapSize 2048`, `shadow.bias −0.0005`, `shadow.radius 4`, `PCFSoftShadowMap`, the ortho shadow camera fitted to the mat. Dark: colour `0xffd39a`, plus a visible `SpotLight(0xffd39a, 500, 0, 0.5, 0.6, 2)` at `(−8, 14, 6)` targeting the mat so the lamp pool shows on the table (the 2D dark gradient's twin).
- **Fill**: `DirectionalLight(0xdfe7f0, 0.4)` from `(1.5, 1.2, 0.8) × 10`, no shadow, so the ply shading reads.
- **Rim** (night-yarn graft): `DirectionalLight(0xb9c6ff, light ? 0.25 : 0.6)` from behind-right `(0.8, 1.0, −1.4) × 10`, so every strand and the hook get a cool edge against the dark mat.
- **Hemisphere**: `HemisphereLight(0xfff2dc, 0x8a6a4e, light ? 0.5 : 0.3)`.
- **Environment**: `PMREMGenerator.fromScene()` on a tiny code-built room (a 20 u box, `BackSide`, two emissive panels: warm cream `0xfff1dc` above-left, cool `0xdfe6ff` right, intensity 1) → `scene.environment`; r160 has no `Scene.environmentIntensity`, so set `envMapIntensity 0.6` (dark: 0.4) on every yarn, hook and ball material. No HDR file.
- `renderer.toneMapping = ACESFilmicToneMapping`, `toneMappingExposure 1.05` (dark 1.0), `outputColorSpace = SRGBColorSpace`, `setPixelRatio(min(2, dpr))`, antialias on. No post-processing (no EffectComposer in the vendored build); a CSS noise overlay on the 3D canvas at 20% opacity (`body::before` already covers it).

### 9.6 Environment (table, mat, ball)

- `scene.background` = `--bg-2`; `scene.fog = new Fog(bg2, 28, 60)` (dark only; none in light).
- **Table**: `PlaneGeometry(80, 54)` at y = −0.04 with a procedural 1024² canvas wood texture (the same stripe recipe as the CSS: 0.6° grain stripes on `--bg` with `--bg-2`/`--bg-3` streaks, plank seams every 226 px, `feTurbulence`-like noise via `Math.random` pixels at 16% alpha) as `map`, the same texture's luminance as `roughnessMap` (`roughness 0.6`), `MeshStandardMaterial`, `receiveShadow`.
- **Linen blocking mat**: `PlaneGeometry(cols + 6, rows_depth + 6)` raised to y = 0 (table at −0.04 so the mat edge shows), `MeshStandardMaterial({ color: surface2, roughness: 1 })`, a 4 px-pitch crosshatch `normalMap` at `normalScale 0.25`, and the **gauge grid** baked into its `map` (dots at every cell, hairlines at every row baseline, `--ink` at 8%) so 2D and 3D share the blocking-mat idea. `receiveShadow`.
- **Ball**: `SphereGeometry(rBall, 32, 24)` with `rBall = (14 + 16 × yarnLeft) / 30`, yarn material plus six real wound tubes (`TorusGeometry(rBall × 1.02, r, 8, 48)` rotated to six great circles), sitting at the 2D ball position with its centre at `y = rBall`; it rolls 90° on a yarn change.

### 9.7 Camera

`PerspectiveCamera(35, aspect, 0.1, 200)`. Default: a three-quarter view from front-left: azimuth −25° (from +z toward −x), elevation 40°, target = centre of the *final* fabric extent (so the frame does not jump as rows are added), distance chosen so the final width fills 60% of the frame width and the hook sits in the upper third: with `vFov = 35°`, `hFov = 2·atan(tan(vFov/2) · aspect)`, `d = 1.05 · (cols / 0.6) / (2 · tan(hFov/2))`, clamped to `[8, 60]` units. On phones (viewport ≤ 600) elevation 55° and distance fitted to width. `OrbitControls`: `enablePan false`, `enableDamping true`, `dampingFactor 0.08`, `minPolarAngle 0.25`, `maxPolarAngle 1.25` (never under the table), `minDistance 0.6 × d`, `maxDistance 1.8 × d`, `autoRotate` only on the completion screen after 3 s idle at `autoRotateSpeed 0.3` (night-yarn graft). On turn the camera eases 300 ms (lerp target x by ± 0.3 u) to keep the hook in frame, then returns. The camera never looks down the hook: azimuth is clamped to [−70°, 20°] so the open side of the crook always reads.

### 9.8 Hook, working loop, feedback

- **Hook** (bamboo/beech): `LatheGeometry` from a 12-point profile, length 4.7 u (140 mm at 30 px ≈ 18 mm/cell), tip radius 0.06, shaft 0.17, a thumb rest at 1.1–1.6 u from the tip scaled `x 1.4` on those vertices (flattened), end slightly rounded; the throat is a quarter `TorusGeometry(0.22, 0.09, 8, 12, π/2)` welded at the tip plus a small lip cylinder, so the **crook is a real J** seen from the front-left. Material `MeshPhysicalMaterial({ map: bambooTexture, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 })`; `bambooTexture` = 256 × 1024 canvas, longitudinal grain lines in `--hook-2`/`--hook-3` on `--hook-1`, one darker node ring just above the thumb rest, and a tiny `5 mm` text stamp. It stands in the working loop leaning 30° toward +x and 20° toward +z (the camera), pivot at the throat, `castShadow` onto the fabric, idle bob 0.05 u at 320 ms. Later unlocks (not for v1): aluminium shaft + walnut thumb rest (`metalness .95, roughness .22, clearcoat .6`; rest `0x6e4b36`) and a coral soft-grip ergonomic hook (capsule handle `0xff8a5c`, `roughness .7`).
- **Working loop**: a tube on a dynamic closed curve around the throat (ellipse semi-axes `0.2 → 0.5 u` and `0.32 → 0.8 u` with hold progress, the far half passing behind the shaft), rebuilt each frame at 32 segments (`geometry.dispose()` on every rebuild). Its material is the yarn material with `emissiveIntensity` rising `.06 → .2` in dark (`0 → .08` in light) as it swells, and its colour stepping through the zones as in 2D. A yarn-coloured `PointLight(color, 0.6, 1.5 u, 2)` rides on the loop in the dark theme only, so the hook tip is lit by its own yarn. The hook dips 0.3 u and glides 0.6 of the way to the next slot during the hold, exactly as in 2D.
- **Release**: the loop spins 180° about the shaft axis (160 ms) while the new stitch's tube **grows out of the loop along its curve** (`TubeGeometry.drawRange` from 0 → full over 160 ms, ease-out), so the stitch visibly comes off the hook; neat: scale 1.08 → 1; loose: the tube settles from 90% depth with a sag; tight: a 0.03 u jolt; wrong: the tube lands red, the pin is pushed in (scale 1.6 → 1) and the red `PointLight(bad, 0.3, 2 u, 2)` fades up inside it (dark only; in light the pin and the stripes carry it). Frog: `drawRange` runs back to 0 (180 ms) while a 0.5 u curl of yarn flies along the working-yarn curve to the ball; the hook eases back to the previous cap.
- **Working yarn**: one `TubeGeometry` (48 segments) along the same cubic as 2D mapped into 3D, passing `y = 0.6r` (under the fabric where it crosses, so the yarn runs *behind* the work) to the ball's surface. Rebuilt per frame while holding, otherwise only on hook moves.
- **Turn**: the fabric group does `scaleX 1 → .96 → 1` with the hook arcing to the far edge (300 ms). **Fasten off**: `autoRotate` after 3 s; the confetti is 120 `InstancedMesh` short tubes in the project's yarn colours with per-instance gravity and spin (1.2 s).

### 9.9 Dark/light in 3D

Everything colour-bearing is read from the palette in `setTheme()`: `scene.background`, fog, table and mat textures regenerated from `--bg/--bg-2/--bg-3/--surface-2`, key/rim/hemisphere intensities and colours, `environmentIntensity`, exposure, `emissiveIntensity` (yarn 0 / .06, loop .08 / .2, wrong .12 / .12), the spot lamp and the loop/wrong point lights (dark only). Never bake a theme colour into a material at module load.

---

## 10. Engineering constraints and contract (both engineers)

- No CDN, no web fonts, no fetched assets; everything local. System font stacks only.
- Keep `npm test` and `CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/smoke.mjs` passing. The smoke test relies on: `.card` buttons in `#cards` in pattern order, `#play`, `#done`, `window.__crochet.game` / `.start` / `.PATTERNS`, keyboard keys c/s/h/d/b/t/f/1/2, and `document.documentElement.scrollWidth <= innerWidth` at 390 px. Keep these ids too, since `main.js` queries them: `#fabric`, `#toast`, `#tension-fill`, `#tension-label`, `#zone-ok`, `#zone-neat`, `#yarn-fill`, `#yarn-label`, `#stat-time`, `#stat-neat`, `#stat-mistakes`, `#buttons`, `#yarn-buttons`, `#btn-turn`, `#btn-frog`, `#btn-quit`, `#btn-again`, `#btn-menu`, `#mute`, `#next`, `#hint`, `#chips`, `#rows`, `#project-name`, `#done-title`, `#done-body`.
- `js/patterns.js` and `js/game.js` are untouched. `render.js` keeps exporting `CELL`, `layout`, `nextPosition`, `drawStitch`, `draw`, and adds `STITCH_SYMBOLS` and a `palette` refresh hook (`setPalette(obj)`), so the 3D engineer and the stitch-guide card can reuse them. `drawStitch(ctx, s, g, color, opts)` gains an optional `opts = { halo, progress }` for the halo strength and the pen-stroke draw-in.
- Phone: 390 px wide with 16 px gutters, no horizontal scroll, all play controls in the first 844 px (section 7.2). Look at `docs/phone.png` at 1:1 before calling it done.
- Performance: cache the placed fabric to an offscreen canvas and redraw only the mat overlays, hook, loop, working yarn, ball and the newest/animating stitch per frame (a 13 × 9 swatch is ~120 glyphs × 3–4 passes). In 3D rebuild stitch geometry only on place/frog.
- Accessibility: all text passes the ratios in section 3; quality is never colour-only (shape, dashes, pin, words); `.toast` stays `aria-live="polite"`; `#next` is the live region for the step; meters are `aria-hidden` with values in the adjacent text; focus-visible rings as in section 8; `prefers-reduced-motion` and `prefers-contrast: more` as described; the 3D canvas gets `aria-label="Your crochet work, 3D view"` and the 2D canvas stays focusable.
- Theme toggle (`N`) sets `data-theme` on `<html>`; both engineers re-read tokens on change.

## 11. Open questions for playtest (not blockers)

1. The sc glyph: the V-under-a-cap replaces craft-room's arch on the craft judge's advice; if crocheters read it as a triangle, bow the legs 0.10 w instead of 0.06 w before considering the arch again.
2. Ball at the lower-right only: if odd rows' turning chains crowd it, move the ball 0.5 cell further right rather than back over the work.
3. Dark-theme halo at 35% / .3: raise to 45% / .4 only if the lamp pool makes the yarn look dull on cheap LCDs; never apply it in light.
