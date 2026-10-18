# Hooked — Direction 02: Studio Minimal

Mockup: `design/studio-minimal/mockup.html` (self-contained, no external resources).
Screenshots: `desktop.png` (1180 wide, full page), `phone.png` (390 wide, full page), plus per-section crops (`desktop-*.png`, `phone-*.png`) and 2x fabric close-ups (`detail-fabric*.png`).

## Concept

Hooked becomes a design-studio tool for makers: the screen is a printed crochet chart on a clean sheet, with large confident type, generous air and a single vermilion accent that only ever points at the one thing to do next. Every stitch is drawn with the standard chart symbol (oval, x, T, T-with-bar, oval cluster) on a disciplined dot grid, so a sloppy row is visible the way it is in a real chart, not through decoration. Dark mode is the same sheet with the lights off: identical layout, identical glyphs, re-tuned yarn colours.

## Palette

Tokens are defined once on `:root`, redefined under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`. The body always sets an explicit background.

```css
:root {
  --bg: #f6f5f1;        /* warm off-white sheet */
  --surface: #ffffff;   /* fabric sheet, keys, dialog */
  --ink: #17171a;
  --muted: #6a6a70;
  --line: #e3e1db;      /* hairlines, meter tracks */
  --accent: #c43d18;    /* the one accent: next action, current row, title full stop */
  --accent2: #f6ddd3;   /* accent tint for selection backgrounds, never text */
  --neat: #177a4f;
  --ok: #8f6207;
  --bad: #c9323a;
  --rose: #e58aa8;  --teal: #3aa6a0;  --mustard: #e2b23a;  --lavender: #a08ad8;
  --grid-dot: rgba(23, 23, 26, .16);
  --dim: rgba(23, 23, 26, .55);        /* dialog scrim */
  --press: rgba(23, 23, 26, .06);      /* held key */
  --yarn-mix: 0.3;  /* glyph strokes are the yarn colour mixed 30% toward ink (see accessibility) */
  color-scheme: light;
}
[data-theme="dark"] {
  --bg: #121214;
  --surface: #1b1b1f;
  --ink: #f2f1ee;
  --muted: #9a9aa2;
  --line: #2c2c32;
  --accent: #ff7a4f;
  --accent2: #3a241c;
  --neat: #4ccf8f;
  --ok: #e6b43c;
  --bad: #ff6b70;
  --rose: #ee9db3;  --teal: #4fbfb8;  --mustard: #ecc155;  --lavender: #b4a3e8;
  --grid-dot: rgba(242, 241, 238, .18);
  --dim: rgba(0, 0, 0, .62);
  --press: rgba(242, 241, 238, .08);
  --yarn-mix: 0;    /* dark glyphs use the yarn colour as-is */
  color-scheme: dark;
}
```

Yarn colours keep their given light values (swatches match the pattern cards the player already knows); the dark set is lifted ~10% in lightness so a 2px stroke stays above 8:1 on the dark sheet. Text on an accent fill is white in light mode and `#121214` in dark mode (white on the dark accent is only 2.6:1).

## Typography

System stacks only. Inter is first in the stack because it is a common system install (it is on the render box here) but the design is specified so SF Pro, Segoe UI Variable or Roboto fall in without any layout change: tracking is set in em, line-heights are unitless and nothing depends on a glyph width.

```css
--sans:    Inter, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
--display: "Inter Display", "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
--mono:    ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
```

| Role | Face | Size / weight | Notes |
| --- | --- | --- | --- |
| Title wordmark "Hooked." | display | clamp(64px, 11vw, 136px) / 600 | line-height .92, tracking -0.045em, accent full stop |
| Next instruction | display | 30px / 600 (26 on phone) | tracking -0.02em; the kbd sits inline |
| Stats numbers, grade | display | 30px / 600; grade 128px (96 phone) | tabular figures (`font-feature-settings: "tnum"`) |
| Project name | display | 22px / 600 | |
| Body, pattern rows, hints | sans | 14–15px / 400, line-height 1.45–1.5 | |
| Lede on title | sans | 20px / 400 (17 phone), muted, lead-in in ink 500 | |
| Eyebrows (NEXT, PATTERN, TENSION) | sans | 11px / 500, uppercase, tracking .12em, muted | |
| Stitch abbreviations, meter readouts, row numbers, kbd | mono | 11–15px / 500–600 | the chart language: `ch sc hdc dc bo`, `0.30 s`, `51% left` |

Weights used: 400, 500, 600 only. No 700+, no italics.

## Texture and background

None. Flat `--bg`, flat `--surface`, 1px `--line` hairlines instead of cards and shadows. The only texture is functional: a dot grid on the fabric sheet at the stitch pitch (one dot per column centre, one per CELL vertically), drawn on the canvas so it stays aligned with the glyphs at every size. The single shadow in the system is under the completion sheet (`0 24px 60px rgba(0,0,0,.18)`), because it is the one element that floats.

## 2D stitch glyphs (canvas)

Standard chart symbols, drawn with round caps and joins in the stroke colour of the stitch's yarn. All proportions are relative to the stitch cell (w = CELL, h = stitch height × CELL/30, the same table as `STITCHES[].height`).

| Stitch | Symbol | Construction |
| --- | --- | --- |
| ch | oval | ellipse rx .36w, ry .30h, outline only; turning chains stack in the margin at the row's start edge, 11u apart |
| sc | x | two diagonals from (±.28w, −.12h) to (∓.28w, −.86h) |
| hdc | T | stem from −.04h to −.90h, top bar ±.30w |
| dc | T with one bar | as hdc plus a diagonal bar from (−.2w, −.40h) to (+.2w, −.56h) |
| bo | oval cluster | ellipse rx .27w, ry .44h filled with the yarn at 22% alpha, plus three strokes fanning from the base to the top |

Stroke width: `max(1.4, 2.1 × u)` where u = CELL/30, so 2.5px at the desktop CELL of 36 and 1.5px on a phone.

Tension is shown by shape and weight, not by colour, so a neat row is a clean row of identical symbols:

- t (−1 loose … +1 tight) scales width by `1 − 0.24t` and height by `1 − 0.12t`; beyond |t| > .45 the glyph leans by `0.1t` rad. Loose stitches are wider, taller and leaning; tight ones are narrow, short and leaning the other way.
- `loose`: stroke × 0.7 and 78% alpha (the yarn is slack). `tight`: stroke × 1.35 (the yarn is dense). `ok`: shape only, no marker.
- `loose` and `tight` get a 2px dot in `--bad` under the baseline, so a scan down the fabric finds them even at phone scale.
- `wrong`: the symbol of the stitch that was actually made, dashed `[3,3]` in `--bad`, with a 14% `--bad` fill where there is a closed shape, and the Frog key goes red. It can only ever be the last stitch of the current row, which is where the hook is.

Hook: ink-coloured (so it is never confused with yarn), 2.4u stroke, 62u shaft, a quadratic crook to the left and a flat thumb-rest outlined at the top. The working loop is an ellipse in the current yarn around the shaft just above the crook; its radius grows from 5u to 19u with hold progress while the hook dips 10u. The working yarn leaves the loop in one bezier up and off the right edge of the sheet (towards the ball), never down the sheet.

Light mode glyph stroke = yarn mixed 30% toward ink (`--yarn-mix`), which lifts the pale yarns above 3:1 on white; dark mode uses the yarn colour as-is. Swatches in buttons and lists always use the pure yarn colour and are always labelled by name.

The same five symbols are inline SVG in the stitch keys and the chips, so chart, keys and progress strip share one vocabulary.

## Layout

Grid: 8px base, 24px gutter (16 on phones), content max-width 1180px, hairline rules instead of boxes.

Top bar (56px): wordmark, `/` crumb with the project name, `Row 7 of 9`, `Projects Esc`. Replaces the old h2 + link row.

Play screen, two columns `minmax(0,1fr) 352px` with a 48px gap; the panel has a 1px left rule. Under 900px the panel drops below the work with a top rule.

- Fabric: a `--surface` sheet with a hairline border and 6px radius, dot grid inside, two mono corner labels (`13 st × 9 rows`, `hook 4.0 mm`). The canvas is sized to the sheet width; CELL = clamp(20, (width − 32) / (cols + 2), 36), so the chart fills the sheet on desktop and still fits 13 columns at 358px.
- Instruments: Tension and Yarn side by side (stacked under 560px). Each is an eyebrow, a mono readout, a 6px track. Tension shows the ok zone (`--ok` at 30%) and the neat zone (`--neat` at 45%) derived from `HOLD`, a fill that turns `--neat` when inside the neat zone, a 2×16px needle at the release point, and a `loose / neat / tight` scale. Yarn fills in the current yarn colour with `Teal on the hook … empty` under it.
- Keys: five equal cells, 84px tall: symbol, mono abbreviation, name, key cap top-right. The expected key has an accent border, a 2px accent base and accent text; a held key gets `--press`. Under 560px the names hide and the cells are 64px.
- Actions: `turn | frog | yarn swatches` in a `1fr 1fr 3fr` row (2 + 2 on phones). Frog turns `--bad` when a wrong stitch is on the hook. The active yarn gets an ink border and 500 weight.
- Panel: NEXT eyebrow, the instruction in display type with its kbd, one hint line, the chips strip (26px cells: done in ink, ok in `--ok`, loose/tight in `--bad`, current on an accent fill, upcoming at 45%, wrong dashed red, `turn` as a text chip), PATTERN rows (`01`…`09` mono, current row with a 2px accent rule and accent number, done rows at 62%), and the three stats in display type.

Title screen: top bar; hero with the wordmark on the left and the lede bottom-right; a PROJECTS list (number, name + blurb, level, yarn swatches and names, `rows · moves` in mono, best result in mono, arrow); HOW TO PLAY as four numbered columns; a footer. On phones the list collapses to number / name / meta with the arrow spanning the rows.

Completion: `--dim` scrim over the finished play screen, a 500px `--surface` sheet with the project eyebrow, `Finished.`, the grade at 128px beside a two-line note (`New personal best` in accent), a four-row hairline results list, then `Make it again Enter` (ink fill) and `Choose a project Esc` (outline). Buttons stack on phones.

## Motion and feedback

All durations 120–240ms, `ease-out`; everything collapses to 0ms under `prefers-reduced-motion`.

- Hold: the tension fill extends linearly; when it crosses into the neat zone the fill and needle switch to `--neat` (no animation, it should read as instant). The hook dips 10u and the working loop grows over the hold.
- Place: the new glyph is stroked in over 140ms using `setLineDash` with an animated dash offset (drawn like a pen stroke), then the chip fills. Neat gives a short 880Hz tick; ok and off-tension keep their lower tones.
- Off-tension: a 12px ink toast top-centre of the sheet (`Too loose`) for 1.2s; the red dot appears with the glyph.
- Wrong: the sheet shakes ±3px for 240ms, the glyph is drawn dashed red, the toast turns `--bad`, the Frog key and the NEXT block go red (`Fix / Frog the wrong stitch F`). Nothing else on the screen changes colour.
- Frog: the glyph unravels by reversing the same dash animation (160ms) and fades; the chip empties.
- Turn: the hook glides to the opposite edge in 220ms; the current-row rule in the panel moves to the next row and the row number ticks in the top bar.
- Yarn change: the yarn track cross-fades to the new colour in 200ms; the working yarn redraws in the new colour from the hook outward.
- Finish: scrim fades in 200ms, the sheet rises 8px into place; the grade letter fades in after 120ms; result rows draw their hairlines left to right at 40ms intervals.
- Hover and focus on keys, yarns and project rows: border-colour transitions only; focus-visible is a 2px accent outline offset 2px.

## 3D treatment (planned view, three.js r160 vendored)

Framing: the sheet becomes a table. `PerspectiveCamera` with a 32° FOV (a long lens keeps the chart's parallel discipline), placed front-above at ~32° elevation and 10° yaw, target at the centre of the placed fabric; OrbitControls with damping, no pan, polar angle clamped to 20°–70°, zoom clamped so the fabric fills 55–80% of the width. The camera eases to re-centre when a row is turned.

Geometry: each stitch is a `TubeGeometry` along a `CatmullRomCurve3` path (chain = flattened loop, sc = two interlocked loops, hdc/dc = post plus wraps, bobble = five dc paths pulled together at the top), radius 0.38 × CELL/30 units. Tension drives the path: loose spreads the loop by `1 − 0.24t` and thins the tube 15%; tight compacts it and thickens the tube 15%. A wrong stitch uses a `--bad`-tinted material with 40% opacity and a dashed `Line2`-style outline so it reads as "to be removed".

Material: `MeshPhysicalMaterial` with `sheen: 1`, `sheenRoughness: .8`, `sheenColor` set to the yarn lifted 20%, `roughness: .92`, `metalness: 0`, plus a procedural twisted-ply normal map (a 64×64 canvas of two diagonal stripes, `repeat` along the tube) so the yarn reads as plied fibre rather than plastic.

Lighting and environment: `scene.background` = `--bg`; a 2×1.4 `RectAreaLight` key above-left (intensity 6, colour #fff6ec in light mode, #dfe6ff in dark), a `HemisphereLight` (sky = surface, ground = bg, .6), a low cool fill `DirectionalLight` from the right (.3), no fog. The table is a `PlaneGeometry` in `--surface` with the same dot grid baked into a canvas texture, and a `ShadowMaterial` at .08 opacity for soft contact shadows (PCFSoft, radius 4). Dark mode adds a rim light from behind at .4 so the yarn edges separate from the near-black table.

Hook and loop: a `LatheGeometry` hook, matte anodised aluminium in light mode (`metalness .9, roughness .35, color #c9c9cc`) and brushed brass in dark (`#b58a4a`), with a flattened thumb rest; it hangs above the next cell, dips 10u with hold progress and sways 1.5u on a 2s sine. The working loop is a torus-shaped tube in the active yarn around the shaft, scaling its major radius 5u→19u with the hold; the working yarn is a catenary tube from the loop to an off-screen ball at the right. The game camera never looks down the hook: the crook is always seen from the front-left so the open side reads.

## Accessibility

Computed WCAG 2.x contrast ratios for the shipped tokens:

| token | light | on bg | on surface | dark | on bg | on surface |
| --- | --- | --- | --- | --- | --- | --- |
| ink | #17171a | 16.40 | 17.89 | #f2f1ee | 16.57 | 15.20 |
| muted | #6a6a70 | 4.93 | 5.37 | #9a9aa2 | 6.70 | 6.15 |
| accent | #c43d18 | 4.78 | 5.21 | #ff7a4f | 7.26 | 6.66 |
| neat | #177a4f | 4.89 | 5.34 | #4ccf8f | 9.47 | 8.69 |
| ok | #8f6207 | 4.91 | 5.36 | #e6b43c | 9.76 | 8.96 |
| bad | #c9323a | 4.81 | 5.25 | #ff6b70 | 6.76 | 6.20 |
| rose (swatch) | #e58aa8 | 2.26 | 2.46 | #ee9db3 | 9.01 | 8.26 |
| teal (swatch) | #3aa6a0 | 2.70 | 2.94 | #4fbfb8 | 8.44 | 7.75 |
| mustard (swatch) | #e2b23a | 1.81 | 1.97 | #ecc155 | 10.98 | 10.08 |
| lavender (swatch) | #a08ad8 | 2.70 | 2.95 | #b4a3e8 | 8.33 | 7.64 |

- Ink on bg: 16.4:1 light, 16.6:1 dark. Accent on bg: 4.78:1 light, 7.26:1 dark, so the accent may carry small text (the current row number, "New personal best").
- Text on accent fills: white on light accent 5.21:1; dark mode uses `#121214` on the accent (7.26:1), since white would be 2.58:1.
- Every text and semantic token is ≥ 4.5:1 on both bg and surface in both modes (AA for body text, not only large text).
- Light-mode glyph strokes (yarn mixed 30% toward ink) on the white sheet: rose 4.27, teal 4.97, mustard 3.53, lavender 4.92, all above the 3:1 non-text minimum. Pure yarn swatches fall below 3:1 in light mode, which is why a swatch is never the only cue: every swatch is paired with the yarn's name, and the yarn meter readout is text.
- Tension state is never colour-only: loose/tight stitches change shape and weight and carry a dot; wrong stitches are dashed; chips also change symbol state; the meter has a needle and a text readout in ms.
- Hairlines (`--line`) are decorative separators at 1.2–1.35:1 and are not relied on for meaning.
- Focus: 2px accent outline, offset 2px, on every interactive element; the sheet is `role="dialog"` with `aria-labelledby`; the canvas keeps its `aria-label` and the panel text is the accessible description of what is on it.
- Hit targets: keys ≥ 64×64px on phones, yarn and action buttons ≥ 52px tall, project rows are full-width buttons.
- Motion honours `prefers-reduced-motion`; colour scheme honours `prefers-color-scheme` with a `data-theme` override.
