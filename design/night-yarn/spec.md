# Hooked — Direction 04: Night Yarn

Dark-first. A craft table lit after dark. Files: `design/night-yarn/mockup.html` (static, self-contained; `Night`/`Day` toggle in the top strip, `#light` hash opens it in the day theme), `desktop.png` / `phone.png` (dark, full page), `desktop-light.png`, `_fabric-2x*.png` (2x crops of the fabric stage), `shoot.mjs` (re-takes the screenshots with headless Chromium).

## Concept

Night Yarn is a craft table lit after dark: deep indigo and charcoal surfaces recede so the work itself is the only bright thing in the room. Yarn is rendered as glowing strands with a soft halo, the fabric sits on a velvet mat under a product-shot spotlight, and the hook is a cold metallic highlight that catches that light. A quieter daylight theme is derived from the same tokens for people who want the game on a bright screen; the two share every size, radius and layout, and only the colour and halo tokens change.

## Palette

Dark is the primary theme and is the default. Light is selected with `[data-theme="light"]` (or `prefers-color-scheme: light` when the player has not chosen). Everything that glows is driven by `--halo` (CSS) and `--halo-canvas` (canvas), so the same markup is calm in the day theme.

```css
:root, :root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0e1120;          /* page */
  --bg-2: #151a33;        /* gradient end, completion backdrop */
  --surface: #171b2d;     /* cards, panel, buttons */
  --surface-2: #1f2440;   /* raised surface top, meter tracks, chips */
  --ink: #eef0fa;
  --muted: #a3a9c4;
  --line: #2b3150;
  --accent: #f29bbb;      /* rose: next instruction, expected button ring, primary action */
  --accent-2: #7cd6cf;    /* teal: secondary highlights, links on dark glass */
  --neat: #62d69c;
  --ok: #f0c44f;
  --bad: #ff6f86;
  --rose: #ef98b6;  --teal: #48b9b2;  --mustard: #e9bb45;  --lavender: #ab97e8;   /* yarns, lifted ~6% for dark */
  --on-accent: #0e1120;   /* text on accent/status fills is the page colour, not white */
  --stage-hi: #262c4a; --stage: #161a2c; --stage-lo: #0c0f1c;   /* canvas stage spotlight gradient */
  --mat: #232841; --mat-2: #1a1e33; --mat-shadow: rgba(0,0,0,.65); /* velvet mat under the fabric */
  --key-bg: #121527; --edge-hi: rgba(255,255,255,.07);
  --card-shadow: 0 24px 48px rgba(0,0,0,.45);
  --halo: 60%; --halo-canvas: .55; --noise: .07;
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f4f3fb;  --bg-2: #ebeaf6;
  --surface: #ffffff;  --surface-2: #f1f0f8;
  --ink: #1b1e32;  --muted: #5f6484;  --line: #dcdce9;
  --accent: #b5446c;  --accent-2: #166f6a;
  --neat: #15794b;  --ok: #846000;  --bad: #c42c48;
  --rose: #e58aa8;  --teal: #3aa6a0;  --mustard: #e2b23a;  --lavender: #a08ad8;   /* original yarns, unchanged */
  --on-accent: #ffffff;
  --stage-hi: #ffffff; --stage: #f6f5fc; --stage-lo: #e6e5f2;
  --mat: #ffffff; --mat-2: #f0eff8; --mat-shadow: rgba(40,30,90,.22);
  --key-bg: #ffffff; --edge-hi: rgba(255,255,255,.9);
  --card-shadow: 0 18px 40px rgba(40,30,90,.10);
  --halo: 38%; --halo-canvas: .3; --noise: .05;
}
```

Yarn colours: in dark the four yarns are lifted a few percent in lightness (`#e58aa8 -> #ef98b6`, `#3aa6a0 -> #48b9b2`, `#e2b23a -> #e9bb45`, `#a08ad8 -> #ab97e8`) so the core strand is not swallowed by its own halo; in light they are the originals. Yarn colours are never used as text; they appear as strands, glowing dots and meter fills, always next to a name.

Rule for fills: anything filled with `--accent`, `--neat`, `--ok` or `--bad` uses `--on-accent` / `--on-status` for its text (page colour in dark, white in light). Dark `--on-accent` on `--accent` is 9.1:1; white on the dark accent would be 2.1:1, so white is never used on the rose in the night theme.

## Typography

System stacks only. Inter is in the stack because it is installed on many machines (and on the build box); nothing is fetched.

```css
--font-ui:      "Inter", "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
--font-display: "Iowan Old Style", "Palatino Linotype", "Charter", "Bitstream Charter", Georgia, "Times New Roman", serif;
--font-mono:    ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
```

| Role | Font | Size / weight | Notes |
| --- | --- | --- | --- |
| Wordmark "Hooked" | display | clamp(58px, 9vw, 92px) / 500, -0.025em | rose text-shadow halo 44px |
| Project name on play screen, card titles | display | 27px / 23px, 500 | eyebrow above in UI caps |
| Dialog title | display | 26px / 500 | |
| Grade letter | display | 104px / 500, -0.03em | neat-green glow |
| Stats numbers | display | 26px / 500, tabular | |
| Body, hints, rows | UI | 15 / 13.5px, 400, line-height 1.4–1.45 | |
| "Next" instruction | UI | 19px / 700 | accent; `--bad` with glow when blocked |
| Stitch button abbr / name | UI | 18px 700 / 11px 400 | |
| Eyebrows, section heads (PATTERN, TIME) | UI | 11px / 600, +0.14em, uppercase | muted |
| Chips, key caps, meter ticks | mono | 11.5px 600 / 11px 600 / 10px 500 | |

Headings use the serif at weight 500 only: no bold serif anywhere, which is what keeps the page feeling like a boutique and not a bank.

## Texture and background

1. Page: flat `--bg` with two large radial glows, indigo (`--bg-glow`) top-left and a faint plum (`--bg-glow-2`) right, so the dark is not dead. Both are absolutely positioned pseudo-elements on `body`, not `background-attachment: fixed` (which is slow on phones).
2. Film grain: an inline SVG `feTurbulence` (fractalNoise, baseFrequency .85, 2 octaves) tiled at 180px, `mix-blend-mode: overlay`, opacity `--noise` (7% dark, 5% light). This is what makes the indigo read as velvet rather than a flat hex.
3. Surfaces: `linear-gradient(180deg, --surface-2, --surface)` with a 1px top inner highlight (`--edge-hi`) and a deep soft shadow (`--card-shadow`). Glass, not paper.
4. The stage (canvas card): `radial-gradient(78% 88% at 50% 36%, --stage-hi, --stage 56%, --stage-lo)` plus an inset vignette, so there is a visible pool of light under the fabric. Inside the canvas a second radial spotlight (white at 7.5% dark / 55% light) is painted around the fabric, and the fabric sits on a rounded "velvet mat" (`--mat` -> `--mat-2` vertical gradient) with a 30px blurred drop shadow offset 16px downward, a 1px edge light, a faint 6px diagonal weave hatch at 4% and a 6% baseline per row.
5. Glows: every yarn-coloured thing (dots, meter fills, active yarn button, card corner, chips) carries `0 0 14px color-mix(in srgb, <colour> var(--halo), transparent)`. One token controls all of it.

## 2D stitch glyphs (canvas)

Geometry is unchanged from `js/render.js` (`CELL` 30, same `layout()` / `nextPosition()` / turning-chain placement), so the game logic and the tests are untouched; only `drawStitch()`, `drawHook()` and the scene pass change. The mockup draws its fabric with this exact code (`drawStitch`, `yarnStroke`, `drawPuffs`, `drawHook`, `drawLoop`, `drawWorkingYarn`, `drawMat`, `drawSpot` in `mockup.html`) and the glyph key card shows every variant side by side.

**Shapes** (same chart vocabulary players already know, drawn as rounded yarn, `lineCap`/`lineJoin: round`):

- `ch`: an ellipse `0.4w × 0.36h` centred in the cell.
- `sc`: two legs from the base corners (20% / 80% of the width) bowing slightly outward to the apex at `0.62h`, plus the top loop (ellipse `0.38w × 0.14h` at `0.82h`).
- `hdc`: a post with a gentle S-curve to `0.7h`, one crossbar, top loop.
- `dc`: the same post to `0.72h`, two crossbars, top loop.
- `bo`: three overlapping puffs filled with a radial gradient (light at upper-left, yarn colour mid, 50% toward `--bg` at the rim), sitting on a blurred dark drop shadow and inside a soft halo disc, with the top loop drawn over them. Bobbles are the only filled stitch, so they read as the "heavy" stitch that eats yarn.

**Stroke technique** – every glyph is one path, stroked four times. Key light is upper-left:

| Pass | Offset | Width | Colour / alpha |
| --- | --- | --- | --- |
| 1 halo | 0 | `lw + 1.6`, `shadowBlur 14` | yarn colour at `--halo-canvas` (.55 dark / .3 light) |
| 2 underside shade | +0.9, +1.3 | `lw` | yarn mixed 62% toward `--bg`, alpha .5 |
| 3 core | 0 | `lw` (4.1 neat) | yarn colour |
| 4 top highlight | -0.8, -1.0 | `lw × .36` | yarn mixed 68% toward white, alpha .55 |

`shadowBlur` and shadow offsets are multiplied by the canvas scale because they ignore the transform.

**Tension at a glance** (`t` in -1..1, `q` label):

- neat: width `1 - 0.3t`, height `1 - 0.14t`, no tilt; a deterministic ±0.15 jitter is applied to neat stitches so a perfect row still looks hand-made.
- ok: same formula with |t| ≤ .75; a little wider or narrower, no other change. Subtle on purpose: it only costs 40 points.
- loose (`t < -.75`): 27% wider and 13% taller, strand thinned to 2.9, alpha .72, halo at 55% strength, highlight almost gone, tilted `0.12t` rad. Reads as pale, slack and leaning.
- tight (`t > .75`): 27% narrower and 13% shorter, strand 4.9, core darkened 24% toward `--bg`, highlight thin (28% of width) but bright (.62), tilted the other way. Reads as dense, dark and shiny: a strand pulled hard.
- wrong: drawn in `--bad` regardless of yarn, dashed `[5,4]`, halo at 130% strength, on a radial red disc (`1.4w`, 40% -> 0). It is the only red on the fabric; with the frog button and the "Next" line both turning `--bad`, there is one answer and three things pointing at it.

**Hook**: a 6px shaft stroked with a horizontal metal gradient (`#55524b -> #cfc9ba -> #fbf7ee -> #b3ad9e -> #605c54`) so it reads as a cylinder, a 1.2px white specular line on the left third, a 1px cool rim light (`rgba(150,178,255,.6)`) on the right edge in the night theme, a soft blurred shadow cast onto the fabric, a walnut thumb rest (dark-light-dark wood gradient) and a 9px radial flare at the throat tip: the hook catches the light. The working loop is an ellipse in the current yarn colour drawn with the same four passes; its back half is drawn before the hook and its front half after, so the yarn wraps the throat. The working yarn trails off the near edge of the canvas with a halo at 80% and the same highlight.

The hook sits on the top loop of the last stitch made, not on the next empty slot (change from the prototype): when the last stitch is wrong the hook is literally in the red stitch.

## Layout

Same DOM as `index.html`; only CSS changes, plus one extra line of meter ticks.

- Play grid `minmax(0,1fr) 330px`, gap 20, single column under 860px. Project name becomes serif with a muted uppercase eyebrow ("Improver · two yarns") above it.
- Stage padding 14, radius 18. The canvas is drawn at `devicePixelRatio` (capped at 2) and scaled up to 1.5× its layout size when the column is wide, so the fabric fills the stage on desktop; on a 390px phone it scales down to the column width (no horizontal scroll, checked by `shoot.mjs`).
- Meters are 12px pills with an inset shadow; the neat zone glows; a row of mono ticks (`loose · neat · tight`) sits under the tension meter so the zones are legible before the first hold. The yarn meter fill takes the current yarn's colour and halo, and its label names the yarn ("46% left · Teal").
- Stitch buttons: five glass tiles, 3 columns under 520px. The expected tile gets a 1px accent ring and a 24px accent halo; the frog tile gets the same in `--bad` and breathes (1.4s) while a wrong stitch is on the hook. Yarn buttons show a glowing dot, and the active one borrows its yarn colour for its ring.
- Panel: the "Next" line is 19px/700 accent; blocked turns it `--bad` with a glow. Chips are mono pills; done chips fill with the status colour and page-colour text, the current chip pulses in accent (or `--bad` when blocked), action chips (yarn change, turn, fasten off) are outlined. Done rows strike through in muted. Stats numbers are serif.
- Title: hook-and-loop mark, serif wordmark with a rose halo, three glass cards each with a yarn-coloured glow in its top-right corner, best score in neat green, a "How to play" card, and a footer with Sound and Theme toggles (`M`, `N`).
- Completion: fixed overlay at 50% `--bg` with 2px backdrop blur over the finished fabric (blurred 5px, 70% opacity); dialog 420px max, serif title, 104px glowing grade, two-column stats, "New personal best!" in accent, primary button in accent with a halo.

## Motion and feedback

All transitions respect `prefers-reduced-motion: reduce` (halos stay, movement is removed).

1. Hold: the loop on the hook grows from 8×5.5 to 23×15.5 over the 800ms hold, the hook dips 10px, and the halo pass scales with progress so the loop brightens as it swells. The tension fill takes the colour of the zone it is in (`data-zone`), with a glow in that colour.
2. Release neat: 120ms ring flash (a stroked circle in `--neat` expanding from the hook and fading), the stitch scales in from 0.85 in 120ms (ease-out), a "Neat" toast in `--neat`, the chip fills green. Ok: same without the ring, amber toast "Nearly". Loose/tight: the glyph settles with a 160ms wobble (rotate ±4°), toast in `--bad` "Too loose"/"Too tight".
3. Wrong: canvas shake (existing 300ms), the stitch's red disc pulses 2× at 1.4s, the frog button breathes, the "Next" line turns red with a glow. Nothing else lights up until it is frogged.
4. Frog: the last stitch unravels, 220ms: its highlight pass fades first, then the strand scales to 0.6 and fades, and the working yarn's halo flickers once. Toast "Frogged. Carry on."
5. Turn: the fabric mat slides 6px toward the new row direction and back (240ms), the hook crosses to the other edge along an arc (260ms), and the trailing yarn re-routes.
6. Yarn change: the stage spotlight tint cross-fades to the new yarn (500ms), the yarn meter fill re-colours, and the active yarn button ring moves.
7. Low yarn (<15%): the yarn meter halo pulses (existing `pulse`), and under 5% the fill turns `--bad`.
8. Finish: the stage spotlight brightens 20% for 600ms, the dialog pops in (scale .94 -> 1, 300ms) and the grade letter counts up its glow (text-shadow from 0 to 40px over 500ms).
9. Title cards lift 3px and take their yarn colour as a border on hover/focus.

## 3D treatment (planned view, three.js r160 vendored)

Goal: the same fabric as a product shot on a dark velvet table, orbitable but framed.

- Scene: `scene.background` is `--stage-lo`, `scene.fog = new THREE.Fog(0x0c0f1c, 14, 30)` so the table edge melts into the dark. Ground is a `PlaneGeometry` 40×40 with `MeshStandardMaterial({ color: 0x161a2c, roughness: 1, metalness: 0 })` and a subtle procedural noise bump (canvas-generated 256px texture, `bumpScale 0.02`) for velvet. The fabric rests on a slightly lighter 1cm thick rounded slab (`ExtrudeGeometry` from a rounded-rect `Shape`, colour `--mat`) so it catches the spotlight like the 2D mat.
- Yarn: each stitch is a `TubeGeometry` (radius 0.09 units where one `CELL` is 1 unit, 24 segments along, 8 radial) along a `CatmullRomCurve3` built from the same 2D control points the glyphs use, lifted in Z by a sine so the strand visibly passes over and under neighbours; the dc/hdc post gets a half-twist. Material: `MeshPhysicalMaterial({ color: yarn, roughness: .85, metalness: 0, sheen: 1, sheenRoughness: .55, sheenColor: lighten(yarn, .4), emissive: yarn, emissiveIntensity: .08 })`: the sheen is what makes it read as fibre rather than plastic, and the low emissive gives the "glowing yarn" of the 2D view without post-processing. A 128px canvas texture of two twisted plies (two soft diagonal stripes) is used as `bumpMap` (`bumpScale .015`) and tiled 6× along the tube. Loose stitches get radius .075 and the curve's control points spread by the same `1 - 0.3t`; tight ones radius .1 and `sheenRoughness .35` (shinier); wrong stitches use `--bad` with `emissiveIntensity .25` and a `0.3`-opacity red `PointLight` (distance 2) sitting inside them so they pool red light on the mat. Bobbles are three `SphereGeometry` puffs scaled 1 × .9 × .8 with the same material.
- Lighting: key `SpotLight` warm white `0xffe9c4`, intensity 60 (physical units), from upper-left-front (`-6, 9, 7`), angle 0.45, penumbra .7, `castShadow` with a 2048 map and `shadow.radius 4`; rim `DirectionalLight` cool indigo `0x8ea0ff` intensity 2 from behind-right (`5, 4, -6`) so the edge of every strand and the hook has a blue line; fill `HemisphereLight(0x2a2f55, 0x0b0c16, .6)`. `renderer.toneMapping = ACESFilmicToneMapping`, exposure 1.1, `outputColorSpace SRGB`, soft shadows (`PCFSoftShadowMap`).
- Hook: a `CylinderGeometry` shaft (r .07) bent into the throat with a `TubeGeometry` along a quadratic curve, `MeshPhysicalMaterial({ color: 0xd8d2c3, metalness: .95, roughness: .22, clearcoat: .6 })`; the walnut thumb rest is a capsule in `0x6e4b36`, roughness .6. The working loop is a `TorusGeometry` of yarn around the throat (radius grows with hold progress exactly as in 2D, `emissiveIntensity` rising .08 -> .3 so it brightens as it swells). The trailing yarn is one long `TubeGeometry` to the table edge. A small `PointLight` in the yarn colour (intensity .6, distance 1.5) rides on the loop so the hook tip is lit by its own yarn.
- Camera: `PerspectiveCamera(32)` at a three-quarter view from the front-left, 28° above the table, framed with `Box3.setFromObject(fabric)` so the piece fills 70% of the view; `OrbitControls` with `enableDamping`, `minPolarAngle 0.3`, `maxPolarAngle 1.35` (cannot go under the table), `minDistance/maxDistance` ±40% of the framed distance, pan disabled, `autoRotate` at 0.3 while idle for 3s on the completion screen only. The toggle between 2D and 3D is a segmented control in the stage corner; the 3D view is a view, not a different game: input, meters and the panel are unchanged.
- Environment reflections: no HDR file (nothing is fetched); a `PMREMGenerator` prefilters a tiny `RoomEnvironment`-style scene built in code (two emissive panels, warm and cool) so the hook has something to reflect.
- Budget: a 12×10 fabric is ~130 tubes × 24×8 segments ≈ 25k triangles, fine for integrated GPUs; stitches are merged per yarn colour with `BufferGeometryUtils.mergeGeometries` after placement and rebuilt only on place/frog, so the render loop only animates the hook, the loop and the trailing yarn. Shadows are limited to the spotlight. If WebGL is unavailable the control is hidden and the 2D view stays.

## Accessibility

Contrast (WCAG 2.x, computed from the hex values above):

| Pair | Dark | Light |
| --- | --- | --- |
| ink on bg | 16.5:1 | 14.9:1 |
| ink on surface | 15.0:1 | 16.4:1 |
| muted on bg / on surface | 8.1 / 7.3 | 5.2 / 5.8 |
| accent on bg / on surface | 9.1 / 8.3 | 4.8 / 5.2 |
| accent-2 on bg | 11.1 | 5.4 |
| neat on bg | 10.4 | 4.9 |
| ok on bg | 11.4 | 5.2 |
| bad on bg | 7.0 | 5.0 |
| on-accent text on accent fill | 9.1 (page colour on rose) | 5.2 (white on rose) |
| on-status text on neat / bad fills | 10.4 / 7.0 | 5.4 / 5.5 |

Every text token clears 4.5:1 on both page and surface in both themes; the dark theme clears 7:1 everywhere. The yarn hues as text would fail in light (1.8–2.7:1), so they are only ever used for strands, dots and fills, with the yarn name written next to them.

- Tension and quality are never colour-only: loose/tight/wrong change the glyph's size, weight, dash and tilt; chips carry the stitch abbreviation; the toast names the outcome; the meter ticks label the zones in words.
- The red of a wrong stitch is paired with a dashed strand and a text instruction, so it survives red-green deficiency.
- Halo intensities are tokens; `prefers-contrast: more` sets `--halo: 0%` and raises `--line` to `#3d4466` (dark) / `#b9bacb` (light); `prefers-reduced-motion` disables the pulse, breathe, shake and pop animations.
- Focus rings: 2px `--accent-2` outline with 2px offset on every control (not shown in the static mockup, which has no focus state).
- Key caps (`kbd`) keep their letter in the DOM, and the stitch buttons have the full stitch name, so screen readers get "single crochet, S" rather than "sc".
- The canvas keeps its `aria-label`; the panel's "Next" line is the `aria-live` region that announces each step.

## Risks

- Canvas `shadowBlur` on four passes per stitch costs ~0.3ms per stitch on an integrated GPU; a 130-stitch fabric is still under a frame, but the halo pass should be cached into an offscreen canvas per row and only the current row redrawn each frame.
- `color-mix()` needs Chromium 111 / Safari 16.2 / Firefox 113; older browsers get no halos but keep the colours (every `color-mix` is in a `box-shadow` or `text-shadow`, never in a `color`), so the page degrades to flat.
- The serif stack is the biggest cross-platform variable: Iowan Old Style (macOS), Palatino Linotype (Windows), Charter/Bitstream Charter (Linux), then Georgia. All are old-style serifs at similar x-heights, but line-heights should be set explicitly (they are) so the wordmark does not jump.
- The night theme is only as good as the screen: on cheap LCDs `#0e1120` greys out and the grain can band. Keep the grain at or under 7% and test on a non-OLED laptop.
- The glow language must stay rationed to yarn, state and the accent, or the page becomes a casino. Nothing structural (lines, cards, text) glows.
