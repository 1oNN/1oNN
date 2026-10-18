# Hooked — visual direction 3: **Arcade Juice**

Mockup: `design/arcade-juice/mockup.html` (self-contained; `#play`, `#title`, `#done`, `#glyphs`, `#moments`; theme toggle top right, also honours `prefers-color-scheme`).
Screenshots: `desktop.png` (1180 wide, full page), `phone.png` (390 wide, full page), `desktop-dark.png`, plus per-section crops.

## Concept

Hooked is a *game* before it is a craft simulator, so everything on screen is built like a toy: thick ink outlines, hard offset shadows, fat rounded corners and a butter-cream board you could pick up and squeeze. The yarn is drawn as glossy outlined tubes so every stitch reads as a solid, satisfying object, and the game answers every input with a pop, a score, a combo bump or a nudge. Colour is saturated but held together by one plum ink and one cream ground, so the hot pink, electric blue, lime, amber and the four yarns feel like one set of stickers rather than a rainbow.

## Palette

All colour carries the same plum `--ink`/`--outline` edge. Coloured fills never carry coloured text: text on a fill is always `--on-accent` (ink), and coloured text on the ground uses the darker `*-text` variants.

```css
:root {
  /* ground */
  --bg: #ffefd2;            /* butter cream board */
  --bg-dots: rgba(36,27,61,.08);
  --surface: #ffffff;       /* cards, buttons, panel */
  --surface-2: #fff8e9;     /* canvas board, meter troughs */
  --ink: #241b3d;           /* text */
  --outline: #241b3d;       /* 3px outlines + hard shadows */
  --muted: #5d5374;
  --line: #e4d3c2;          /* quiet dividers only */
  --on-accent: #241b3d;     /* text sitting on any coloured fill */
  /* brand */
  --accent: #f03e78;        /* hot pink: expected button, wordmark, primary CTA */
  --accent-text: #c9183c;   /* pink as small text */
  --accent2: #3d6dff;       /* electric blue: current row, focus ring, turn */
  --accent2-text: #2856d9;
  /* feedback */
  --neat: #19b35f;  --neat-text: #0b7a3e;
  --ok:   #ffb020;  --ok-text:   #8a5a00;
  --bad:  #ff3b5c;  --bad-text:  #c9183c;
  /* yarns (re-tuned +10–15% chroma so they sit with the UI colours) */
  --yarn-rose: #ff7aa5;     /* was #e58aa8 */
  --yarn-teal: #1fb8a9;     /* was #3aa6a0 */
  --yarn-mustard: #ffc337;  /* was #e2b23a */
  --yarn-lavender: #9c82ff; /* was #a08ad8 */
  --radius: 18px;
  --shadow-hard: 0 6px 0 var(--outline);
}
:root[data-theme="dark"] {           /* also applied under prefers-color-scheme: dark when no data-theme is set */
  --bg: #1c1538;            /* deep indigo */
  --bg-dots: rgba(255,247,236,.07);
  --surface: #3a2f6b;
  --surface-2: #44387a;
  --ink: #fff7ec;
  --outline: #0e0a1f;       /* outlines stay dark: comic ink on mid-purple cards */
  --muted: #b9afd3;
  --line: #4e4283;
  --on-accent: #0e0a1f;
  --accent: #ff6b9a;  --accent-text: #ff8fb3;
  --accent2: #7b93ff; --accent2-text: #a3b3ff;
  --neat: #35e07f;  --neat-text: #6cf0a8;
  --ok:   #ffc846;  --ok-text:   #ffd97a;
  --bad:  #ff5a73;  --bad-text:  #ff8aa0;
  /* yarns unchanged: they are already bright enough on indigo (5.8–10.8:1) */
}
```

## Typography (system stacks only)

```css
--font-display: ui-rounded, "SF Pro Rounded", "Nunito", "Inter Display", "Inter",
                "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif;
--font-body:    "Inter", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono:    ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

`ui-rounded` gives the toy feel for free on Apple devices; everywhere else the heavy weights of Inter / Segoe UI Variable Display carry the look. Display text is always weight 900, uppercase for labels, `letter-spacing: -0.03em` for the wordmark and `0.08em` for small caps labels.

| Role | Size / weight | Notes |
| --- | --- | --- |
| Wordmark "HOOKED" | `clamp(64px, 14vw, 128px)` / 900 | accent fill, 3px ink text-stroke, 6px hard shadow, -2° tilt |
| Screen title (project name) | 30px / 900 | |
| Next card headline | 28px / 900 | |
| Stitch button abbreviation | 26px / 900 | name 12px/700, key as 12px mono pill |
| Stat numbers | 30px / 900, `font-variant-numeric: tabular-nums` | |
| Combo number | 34px / 900 | |
| Grade | 96px / 900 inside a 12-point star | |
| Body / hints | 15px / 500, line-height 1.45 | |
| Labels (TENSION, YARN, PATTERN) | 12px / 900 uppercase, 0.08em | |
| Pattern rows | 14px / 600; current row 700 | |

## Texture and background

* Ground: flat `--bg` plus a 1.6px polka-dot grid (`radial-gradient` 18px tile at 8% ink). Reads as a game board, prints cleanly, costs nothing.
* Every surface: `3px solid var(--outline)`, radius 18px, `box-shadow: 0 6px 0 var(--outline)` (hard, no blur). Pressed state: `translateY(6px)` and the shadow goes to 0, so buttons physically sink.
* Canvas board (`--surface-2`): the same dot grid at half density, so the fabric sits on "graph paper".
* Meters are troughs: inset 3px outline, zones as flat colour blocks with ink separators, a round ink-outlined knob rides the bar.
* Diagonal 45° stripe (`repeating-linear-gradient`, 10px, 18% white) on the yarn-meter fill and the title band, hinting at wound yarn.
* No gradients on surfaces, no blurred shadows, no transparency except the dim overlay (`rgba(36,27,61,.55)`).

## 2D stitch glyphs

The chart vocabulary of the prototype is kept (oval chain, V single, T half-double, T-with-bars double, puff bobble) so the fabric still reads as a crochet chart, but every glyph is a **yarn tube**:

1. **Ink pass** — the glyph path stroked in `--outline`, width `w + 5`, round caps and joins.
2. **Colour pass** — the same path in the yarn colour, width `w` (base 5px at CELL 38).
3. **Gloss pass** — the same path translated (-0.8, -0.25w) in 55% white at 0.32w, giving a top-left highlight that makes the tube read as round.

| Stitch | Shape (base at the row line, cap loop at 0.82h) | Size |
| --- | --- | --- |
| ch | single fat oval ring rx 0.42w, ry 0.38h | 38 × 16 |
| sc | two legs from the base corners (0.2w, 0.8w) meeting at 0.62h, cap loop above | 38 × 26 |
| hdc | centre post to 0.7h, one bar across at 0.3–0.5h, cap loop | 38 × 32 |
| dc | centre post to 0.72h, two bars, cap loop | 38 × 42 |
| bo | three overlapping filled ovals (left, right, centre-tall) each with its own ink edge and a white gloss dot, cap loop on top | 38 × 34 |

Tension is read from **three cues at once** so it survives colour-blindness and small screens:

| Quality | Width | Stroke | Colour | Extra |
| --- | --- | --- | --- | --- |
| neat | 1.0 | 5px | yarn colour | the last two neat stitches carry a 4-point white sparkle |
| ok | 0.9–1.1 | 5px | yarn colour | none (it still counts as good) |
| loose (t < -0.45) | up to 1.26 wide, 1.12 tall | 4.2px (slack) | yarn mixed 22% white | tilted -6°, cap loop sags 2px |
| tight (t > 0.45) | down to 0.74 wide, 0.9 tall | 6px (bunched) | yarn mixed 18% ink | tilted +6° |
| wrong | 1.0 | 5px | `--bad` fill, dashed ink outline (5/4) | white "✕" badge sticker on the cap loop, red halo ring |

Turning chains stack in the margin at the row start, as now. Foundation chain stays a plain row of rings.

**Hook and working loop.** The hook is a toy: a coral handle (`#ff8a5c`, rounded rect, ink edge, gloss stripe), a pale shaft and a fat ink-edged hook head. The working loop is a yarn-coloured ring around the shaft neck; while a key is held it inflates with hold progress and its colour steps through muted → neat → ok → bad as the hold crosses the zones, so you can watch the loop instead of the meter. The working yarn runs as a 4px tube over the edge of the board to an outlined yarn ball in the bottom corner that shrinks as yarn is used.

## Layout changes

**Play screen** (desktop: `minmax(0,1fr) 340px`, ≤ 900px: one column):

* HUD strip replaces the plain header: round back button, level tag + project name, then **COMBO** sticker, **TIME** tile and the sound button. The combo sticker is yellow at ×3, pink at ×5, blue "ON FIRE" at ×10; a broken combo shows a tilted red "LOST!" sticker for 1.2s.
* Board (canvas) with the toast rendered as an outlined speech bubble at the top centre.
* Tension and yarn as two chunky 30px troughs with a label row above. Tension keeps a faint ghost knob at the last release point for 1.2s.
* Five stitch buttons, 84px tall, in a 5-column grid; 3 columns at ≤ 520px (ch/sc/hdc, dc/bo + frog). Turn and Frog are full-colour (blue, red) action buttons; the yarn switches sit beside them as outlined pills with a colour dot and key.
* Right panel: NEXT card (huge headline, hint), bead chips for the current row, pattern rows with the current row in a blue-edged card, three stat tiles.
* Minimum tap target 56×56; the stitch buttons are 84px tall and full-width on the phone.

**Title screen:** wordmark with a hook swoosh behind it, tagline, three project cards with a level band (lime / amber / blue), yarn dots, meta, best grade badge, and a pink PLAY pill on the card. "How to play" as four numbered sticker cards in a row (stack on phone).

**Completion dialog:** dim overlay, outlined dialog, "FINISHED!" headline, the grade in a 12-point amber star, four stat tiles, best combo, a tilted NEW BEST sticker, two chunky buttons. Confetti falls on a canvas layer behind the dialog.

## Motion and feedback

All timings use `cubic-bezier(.2,1.6,.4,1)` (overshoot) unless noted; everything below collapses to a colour change under `prefers-reduced-motion`.

| Moment | What happens |
| --- | --- |
| Hold | The expected button sinks; the working loop inflates; the knob slides; the neat zone brightens when the knob is inside it; `navigator.vibrate(8)` on entering the green. |
| Stitch placed | The new glyph pops in from scale 1.5 → 1 (180ms); a floating "+100 NEAT!" / "+60 OK" / "+25 LOOSE" label rises 36px and fades (600ms); the sound pitch rises with the combo. |
| Combo | Consecutive neat stitches. The sticker bumps (scale 1.25, 160ms) on each count; tier colour changes at 3 / 5 / 10 with a one-shot ring burst. Any non-neat stitch or wrong stitch breaks it: sticker shakes, goes grey, "LOST!" sticker drops in. |
| Wrong stitch | Board nudge: `translateX(-8, 8, -4, 4)` over 300ms plus a 150ms red inner glow on the board edge; the glyph lands with the dashed edge and ✕ badge; the Frog button turns red and bounces (`translateY` 0 → -6 → 0, 500ms, twice). |
| Frog | Glyph unspools: scales to 0 along its path (160ms) while a short yarn tail flicks back to the hook; a lighter nudge (4px). |
| Turn | Board does a 3D flip `rotateY(0 → 180 → 360)` scaled 0.96 in the middle (350ms); the row list scrolls the next row in with a blue flash. |
| Yarn change | A colour wipe sweeps across the yarn meter and the working yarn tube repaints from the ball up to the hook (250ms). |
| Low yarn | Trough border pulses red; ball icon rattles every 2s. |
| Finish | 1s beat, then 160 confetti pieces in the palette (gravity, spin, 2.8s), star badge pops in with overshoot, stat tiles count up in 400ms. |
| Buttons | Sink 6px on press; expected button carries a bouncing chevron above (`translateY` ±3px, 900ms loop). |

## 3D treatment (three.js r160, vendored, no external assets)

* **Yarn material:** every stitch is a `TubeGeometry` along a `CatmullRomCurve3` sampled from the 2D glyph path (lifted into z with a small sine so legs cross over bars), radius 2.4 (base). Material `MeshToonMaterial` with a 4-step `gradientMap` built in code from a `DataTexture` (values 0.25 / 0.55 / 0.8 / 1), so it cel-shades exactly like the flat 2D fills. The ink edge is an **inverted hull**: a second mesh of the same geometry with `side: BackSide`, `color: --outline`, scaled 1.08 along the tube normals (just `scale.setScalar(1.08)` on the tube since the cross-section is round). Loose stitches use radius 2.1 and 22% lighter colour; tight 2.7 and darker; wrong stitches get the `--bad` colour and a dashed look via a `repeat` texture of ink/transparent stripes on the hull.
* **Lighting:** `HemisphereLight(sky #fff4d6, ground #ffb0c8, 0.9)` + `DirectionalLight(#ffffff, 1.4)` from (-3, 8, 6) with `castShadow` (2048 map, `PCFSoftShadowMap`, bias -0.0005). Toon + hard shadows = sticker look in 3D. No tone mapping (`NoToneMapping`), `sRGB` output.
* **Environment:** a `--surface-2` play-mat plane with `ShadowMaterial` (opacity 0.25) underneath, the dot grid as a small repeating `CanvasTexture`, and a sky dome (`SphereGeometry`, `BackSide`, vertex colours `--bg` at the horizon → a 10% lighter tint at the zenith). Background colour from the current theme tokens, read from CSS at init and on theme toggle.
* **Camera:** `PerspectiveCamera(32°)`, start at elevation 38°, azimuth -22°, dollied so the fabric's bounding box fills 70% of the shorter viewport axis (`fitToBox` on every row change, eased over 400ms). `OrbitControls`: no pan, `minPolarAngle 0.35`, `maxPolarAngle 1.25`, damping 0.08, zoom 0.6–1.8×, `autoRotate` off while a key is held.
* **Hook and working loop:** handle is a `CapsuleGeometry` in coral toon with a dark grip ring, shaft a thin cylinder, head a half `TorusGeometry` bent 180°; the whole group tilts 25° towards the camera so the head is always visible. The working loop is a `TorusGeometry` of yarn colour around the shaft whose tube radius lerps 2.4 → 4.2 with hold progress and whose colour steps through the tension zones; on release it spins 180° about the shaft and the new tube grows from the loop along its curve (160ms) so the stitch visibly comes off the hook. The working yarn is a `TubeGeometry` from the loop over the mat edge to a `SphereGeometry` ball with a spiral `CanvasTexture`.
* **Feedback in 3D:** stitch pop scales the new tube 1.4 → 1 with the same overshoot; the board nudge becomes a 0.3-unit camera shake; confetti is 160 `InstancedMesh` planes in palette colours with per-instance gravity and spin.
* **Fallback:** if `WebGL` is unavailable the 2D canvas stays; the 3D toggle is a HUD button next to sound.

## Accessibility

Contrast (WCAG 2.x relative luminance, computed):

| Pair | Light | Dark |
| --- | --- | --- |
| ink on bg | 14.26 : 1 | 16.29 : 1 |
| ink on surface | 16.16 : 1 | 10.99 : 1 |
| muted on bg | 6.27 : 1 | 8.35 : 1 |
| accent on bg (large text / UI only) | 3.27 : 1 | 6.44 : 1 |
| accent-text on bg (small text) | 5.04 : 1 | 8.10 : 1 |
| accent2 on bg (UI) | 3.84 : 1 | 6.15 : 1 |
| accent2-text on bg | 5.41 : 1 | 8.61 : 1 |
| on-accent on accent (button labels, ≥18px bold) | 4.36 : 1 | 7.14 : 1 |
| on-accent on neat / ok / bad | 5.89 / 8.84 / 4.64 | 11.07 / 12.42 / 6.36 |
| neat-text / ok-text / bad-text on bg | 4.79 / 5.23 / 5.04 | 12.08 / 12.74 / 7.74 |

* Pink and blue as raw text are only used at display sizes (≥ 24px / 900), where 3:1 applies; body-size coloured text uses the `*-text` variants, all ≥ 4.5:1.
* In dark mode the 3px ink outline on a `--surface` card is low-contrast (1.66:1) by design: the card is still bounded by its hard shadow and by the surface/bg step, and every interactive element also has a 3px `--accent2` focus ring at `outline-offset: 3px`.
* Quality never relies on colour alone: loose / tight / wrong change width, stroke and tilt, the wrong stitch carries a ✕ badge, chips carry a glyph (✓ · ~ ✕) as well as a fill, and the toast says it in words. Meters have `aria-valuenow`/`aria-valuetext`; the combo sticker is `aria-live="polite"` with a throttled announcement.
* Tap targets ≥ 56px; stitch buttons 84px; the phone layout keeps all five stitch buttons visible without scrolling the board off screen.
* `prefers-reduced-motion`: no nudge, flip, confetti or bounce; pops become 80ms fades; the hold still animates the knob (it is gameplay information).
* Sound is never the only cue; every sound pairs with a visible toast or glyph change.
