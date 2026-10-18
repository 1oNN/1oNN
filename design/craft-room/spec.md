# Hooked — visual direction 1: Cosy craft room

Files in this folder:

- `mockup.html` — self-contained static mockup (play screen mid-project, components and states, title screen, completion dialog, evening mode). No external resources.
- `desktop.png` / `phone.png` — full-page renders at 1180×820 and 390×844. `desktop-viewport.png` is the above-the-fold crop, `dark.png` the evening-mode section, `fabric-2x.png` / `fabric-2x-dark.png` the fabric mat at 2× for the glyph treatment.

## Concept

The game is played on a well-lit craft table: the whole page is a warm oak tabletop, and every piece of interface is something that would sit on it — a linen mat under the work, a printed pattern leaflet, paper tags for the stitch buttons, a sewing pin marking your last stitch, a wooden hook and a wound ball of yarn. Everything structural is a warm neutral (wood, linen, cream paper, walnut ink) so the four yarn colours are the only saturated things on the table and your eye goes straight to the work. Stitches are drawn as plied yarn rather than chart symbols, so the fabric reads as a real swatch whose sloppy stitches look sloppy.

## Palette

Light is the daytime table; dark is the same table under a lamp in the evening. Both are tokens on `:root`; dark is applied under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]` (the mockup also exposes it as `.theme-dark` so both can be shown on one page).

```css
:root {
  color-scheme: light;
  --bg: #d4b188;          /* oak tabletop, mid tone      */
  --bg-2: #bf9666;        /* grain shadow                */
  --bg-3: #e3c9a4;        /* lamp-lit highlight          */
  --surface: #fbf6ec;     /* paper                       */
  --surface-2: #f1e7d4;   /* linen mat under the work    */
  --surface-3: #e9dcc5;   /* chips, meter grooves        */
  --ink: #2f2318;         /* walnut ink                  */
  --table-ink: #4f3a2a;   /* small text sitting on wood  */
  --muted: #7b6553;
  --line: #d6c3a6;
  --accent: #9a4a2b;      /* clay: next step, primary button, row numbers */
  --accent-2: #a8743a;    /* honey: the "next" ring on a tag */
  --neat: #4d7536;        /* moss   */
  --ok: #8f6a10;          /* ochre  */
  --bad: #b23a30;         /* brick  */
  --yarn-rose: #e2869f;
  --yarn-teal: #3b9e98;
  --yarn-mustard: #dcae36;
  --yarn-lavender: #9c86d2;
  --hook-1: #ecd3a4; --hook-2: #c69c63; --hook-3: #86603a;   /* beech hook, light→shadow */
  --shadow-ink: 60, 35, 15;                                  /* rgb triplet for warm shadows */
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* same values as below */ } }
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #3b2a1e; --bg-2: #2a1d14; --bg-3: #4c392a;
  --surface: #302822; --surface-2: #28211b; --surface-3: #3b322a;
  --ink: #f1e6d3; --table-ink: #d9c8ae; --muted: #b4a28c; --line: #4f4236;
  --accent: #e0a070; --accent-2: #c08b58;
  --neat: #8cc278; --ok: #e2b84f; --bad: #e46f60;
  --yarn-rose: #ee9db5; --yarn-teal: #55c0b8; --yarn-mustard: #eac35a; --yarn-lavender: #b6a3ea;
  --hook-1: #e2c69a; --hook-2: #b6895a; --hook-3: #6e4c2c;
  --shadow-ink: 0, 0, 0;
}
```

Yarn re-tuning: Rose `#e58aa8 → #e2869f` (a touch warmer and deeper so it is not candy pink on cream), Teal `#3aa6a0 → #3b9e98` (slightly deeper), Mustard `#e2b23a → #dcae36` (slightly less neon), Lavender `#a08ad8 → #9c86d2`. In dark mode all four are lifted ~10% so they still glow against dark linen. `js/patterns.js` keeps its own hex values; the renderer should read the tokens (`getComputedStyle(canvas).getPropertyValue('--yarn-teal')`) when it draws, with the pattern hex as the fallback, so both schemes use the right ink.

Accent is used only for: the "next" instruction, row numbers in the leaflet, the primary button, the `next` flag on a tag, and link underlines. Nothing else on the table is saturated except yarn.

## Typography

System stacks only. The display face is a warm old-style serif (what a printed pattern leaflet is set in); the UI face is the platform sans.

```css
--font-display: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, "Bitstream Charter", Georgia, Caladea, "DejaVu Serif", serif;
--font-body: system-ui, -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
```

| Role | Face | Size / weight |
| --- | --- | --- |
| Title "Hooked" | display | clamp(50px, 8vw, 78px) / 700, letter-spacing −0.012em, hand-drawn yarn underline (inline SVG path in `--yarn-rose`) |
| Screen titles (project name, "Fastened off!") | display | 30px / 700; the parenthetical in 0.7em italic 400 muted |
| Leaflet title, card names | display | 22px / 700 |
| Next instruction | display | 20px / 700 in `--accent` (`--bad` when blocked) |
| Tag abbreviation (`sc`, `dc`) | display | 22px / 700 (19px on phone) |
| Pattern rows | display | 15px / 400, line-height 1.35; done rows struck through in `--muted` |
| Stats numerals, grade stamp | display | 24px / 700 tabular; stamp 66px |
| Body, hints, blurbs | body | 16px / 400 line-height 1.5; hints 14px muted |
| Eyebrows ("Pattern", "Tension", card level) | body | 11px / 700, letter-spacing .16em, uppercase |
| Keys, chips, meter scale | mono | 12px / 700 chips, 11px scale |

The renders were checked on a Linux Chromium where the stacks resolve to Bitstream Charter, Inter and DejaVu Sans Mono; on macOS they resolve to Iowan Old Style, SF and SF Mono, on Windows to Palatino Linotype, Segoe UI and Consolas. All three sets were considered when choosing sizes. A Google Fonts link (e.g. Fraunces + Nunito) may be added as a progressive enhancement but nothing depends on it.

## Texture and background

All texture is CSS, no image files.

- **Tabletop** (`.table`): five stacked backgrounds on `--bg`: a warm radial "lamp" highlight at top-left (`rgba(255,244,222,.55)`), a dark radial fall-off at bottom-right, a near-horizontal `repeating-linear-gradient(0.6deg, …)` with uneven stripe widths for grain, a second repeating gradient every 226px with a 2px dark + 1px light line for plank seams, and a vertical `linear-gradient(--bg-3, --bg 38%, --bg-2)`.
- **Noise**: a `::before` layer with an SVG data URI (`feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"` through an `feColorMatrix` leaving 16% alpha), `mix-blend-mode: multiply`, opacity .5 (light) / .35 (dark). This single layer gives wood its tooth and keeps the gradients from banding.
- **Paper** (`.paper`, cards, tags, dialog): `--surface` with two 1px crosshatch `repeating-linear-gradient`s at 3px pitch (alpha .045) for a laid-paper feel; 1px `--line` border, radius 10px, shadow = `0 1px 0 rgba(255,255,255,.65) inset, 0 1px 2px rgba(ink,.18), 0 12px 28px -12px rgba(ink,.45)` so the sheet lifts off the table.
- **Linen mat** (`.mat`): `--surface-2` with the same crosshatch at alpha .06, padding 14px, and a `::after` 1px dashed hem inset 7px.
- **Rubber stamp** (grade): `filter: url(#rough)` with a small inline SVG `feTurbulence` + `feDisplacementMap scale="3.2"` to rough the ink edge, rotated −9°, `mix-blend-mode: multiply` (screen in dark).
- **Washi tape** on the how-to card: a translucent striped rectangle rotated −2°, in 55% yarn-mustard.

## 2D stitch treatment (canvas)

Geometry stays what `js/render.js` already computes (`CELL = 36`, row heights ch 14 / sc 24 / hdc 30 / dc 40 / bo 30, turning chains stacked 11px apart in the margin, even rows left→right, odd rows right→left). What changes is the ink.

**Yarn stroke.** Every glyph is a `Path2D` stroked three times, round caps and joins:

1. shadow: translate (0.6, 1.7), width `w + 1`, colour = yarn mixed 60% toward warm dark `#2a1608` at 50% alpha;
2. body: width `w` (5.2px for a neat stitch), yarn colour;
3. ply highlight: translate (−0.3, −0.24 w), width `0.3 w`, yarn mixed 62% toward warm white `#fff7e8` at 80% alpha, **dashed** `[1.1 w, 0.8 w]` with `lineDashOffset` seeded by the stitch index so the twist does not line up between neighbours.

The shadow gives each cord an edge against the mat (this is also what keeps pale yarns readable, see accessibility), the dashed highlight reads as the twist of the plies.

**Glyphs** (base-centre at the row baseline, `w` = cell width, `h` = stitch height). Every stitch except a chain ends in a *cap*: a horizontal ellipse (rx .33 w, ry 4.6) sitting at the top, so a finished row has a run of top loops the next row visibly sits in.

- `ch` — one ellipse, rx .4 w, ry .38 h. Foundation chains lie flat along the bottom; turning chains stack upward at the row's start edge.
- `sc` — a plump arch (cubic Bézier from (.2 w, 0) up to .8 h and back down to (.8 w, 0)) plus the cap.
- `hdc` — a post to the cap with one diagonal wrap bar across the middle.
- `dc` — a post to the cap with two wrap bars at .28 h and .5 h.
- `bo` — three overlapping puffs (left, right, then centre on top) filled with a radial gradient (light at upper-left, yarn in the middle, 22% darker rim), each with a soft 3px shadow and a 1px darker outline, then the cap. Bobbles are the only filled shapes, so they pop forward as they do in real fabric.

**Quality at a glance.** `t` is the tension in [−1, 1]; width scales by `1 − 0.24 t`, height by `1 − 0.1 t`.

- *neat* (|t| ≤ .45): as above.
- *nearly* (ok): same shape, colour nudged ±6–8% toward light (loose side) or dark (tight side).
- *loose* (t < −.45): wider and a little taller, 12% paler at 80% alpha, stroke 4.7px, tilted by `0.14 t`, and a small slack loop (5×3 ellipse) hanging off the base. Reads as "baggy and gappy".
- *tight* (t > .45): narrower, cap squeezed to 82%, 22% darker, stroke 5.6px, tilted the other way. Reads as "pinched and dense".
- *wrong*: drawn in `--bad`, dashed `[6, 4]`, with a brick pin head (7.5px, white ×) stuck in up-left of the stitch; the toast and the leaflet say what to do. A wrong `dc` in an `sc` row also sticks out above the row because it keeps its own height.

**The rest of the scene.** A soft drop shadow (blur 16, offset 9, 32% warm ink) is drawn under the union of placed-stitch rectangles and then knocked out with `destination-out`, so only the halo remains and the mat shows through the holes in the fabric. The hook is beech: a 7px shaft with a 3-stop horizontal gradient (`--hook-1/2/3`), a wider thumb-rest, grain lines, a 1px warm-white edge highlight, a "5 mm" size mark, a J-shaped throat stroked with the same gradient, and a 7px blurred shadow offset (4, 6). It leans 30° to the right of vertical. The working loop is a 6×9.5 ellipse of yarn around the throat, growing to 15×24 as you hold; the working yarn leaves the loop, arcs *over* the top of the work and comes down into a wound ball at the mid-right of the mat whose radius is 20 + 20 × (yarn left). The ball is a radial gradient clipped to a circle with six wound strands (3.4px dark at 34%, 1.2px light at 50%) and a gloss.

Scaling: the canvas is drawn at `min(2, devicePixelRatio)` × (CSS width / layout width), so it is crisp at any width; the mat caps it at 720px wide. The layout padding is trimmed to `PAD 18, MARGIN 30, BALL_ROOM 86` so a 10-column piece still fills a 390px phone.

## Layout changes

- **Title**: a yarn-ball-and-hook mark (inline SVG, 108px), the title with the hand-drawn underline, tagline in `--table-ink`; "Choose a pattern" heading; cards become pattern leaflets with a small labelled skein per yarn, a moss serif grade in the "Best" line, and ±0.35° rotations so they look laid down rather than aligned by a grid; the how-to is an index card held by washi tape. Footer: sound toggle and a small mono wordmark.
- **Play**: two columns (`minmax(0,1fr) 332px`, 22px gap), single column under 900px. Work column: eyebrow "Improver · row 6 of 6" over the project title, "Back to projects" link; the linen mat with the canvas and the toast pinned at its top-left (never over the hook); a paper strip with both meters; five stitch tags; then `turn`, `frog` and the yarn buttons. The tension meter shows the `HOLD` zones as patches (ok 11.9–68.1%, neat 23.1–56.9% of `HOLD.max`), the fill is a strand of the current yarn with a knot at its end, and after each release a sewing pin stays where you let go with its head in the quality colour. The yarn meter gets a shrinking ball icon. Under 560px tag names hide (abbr + key only), the action row becomes `1fr 1fr 2fr`, and yarn buttons collapse to ball + key.
- **Pattern leaflet**: header (eyebrow "Pattern", title, meta line), the next instruction, hint, row chips (wrong stitch shown as a dashed brick chip in place), "Rows" with the current row under a highlighter-pen band (skewed translucent ochre `::before`) and done rows struck through, and a dashed-rule stats footer.
- **Completion**: dimmed table (`--dim`), a paper card with eyebrow (project), "Fastened off!", a one-line compliment, the rubber-stamp grade (ring + inner ring + "neatly made"), a two-column stats list with the yarn ball icon on "Yarn left", "New personal best" in clay, and primary/secondary buttons with thick bottom edges.
- **Buttons**: paper tags with a punched hole at top-left and a 3px bottom edge that compresses to 1px on press (`translateY(2px)`). The expected tag wears a 3px honey ring and a small `next` flag; the frog tag wears a brick ring and `now` when a wrong stitch is on the hook. Disabled tags go to 66% opacity and lose their lift.

## Motion and feedback

All timings ease-out unless noted; everything is disabled under `prefers-reduced-motion`.

- **Hold**: the hook dips up to 9px and the working loop grows with hold progress; the meter strand extends with a 50ms linear transition; the hook idles with a 1.5px sinusoidal bob (period 320ms) so the scene is never dead.
- **Release — neat**: the stitch scales 1.15 → 1 over 120ms and the ply highlight flashes once (dash offset sweeps). *Nearly*: same with a 2px lateral wobble. *Loose*: the stitch droops into place (height from 90% over 200ms) and the slack loop drops out. *Tight*: snaps in with a 1-frame 1px jolt. A paper-label toast drops in from −6px with a −1.4° settle (150ms) and leaves after 1.4s.
- **Wrong stitch**: existing canvas shake (300ms), the brick pin "pushes in" (scale 1.6 → 1, 160ms), toast in brick, frog tag gains its ring, all stitch tags dim.
- **Frog**: the stitch unravels — stroke dash offset animates along its path (180ms) while a short curl of yarn flies back toward the ball; the pin pops out.
- **Turn**: the fabric does a quick `scaleX(1 → .96 → 1)` with a slight skew (250ms) as if flipped, the hook slides to the other edge (300ms), the leaflet's highlighter band moves to the next row and the done row's strike-through draws left to right (200ms).
- **Yarn change**: the ball rolls (rotate 0 → 90°) and swaps colour, the meter fill crossfades, the active yarn button gets its ink ring.
- **Low yarn** (< 15%): the fill pulses at 1s; the ball icon shrinks with the percentage.
- **Fasten off**: 900ms pause, overlay dims, the dialog pops (scale .92 → 1, 250ms), the stamp thuds down 150ms later (scale 1.6 → 1, rotate −14° → −9°), yarn-snippet confetti in the project's yarn colours for 1.2s.
- **Title**: cards lift 3px and straighten on hover; the hero underline draws itself once on load (600ms).

## 3D treatment (three r160, vendored, OrbitControls)

The 3D view is the same table seen from a chair: the piece lies on the linen mat, the hook stands in the working loop, the ball sits to the right.

- **Scene and environment**: `scene.background` = table colour; a 2.4 m × 1.6 m tabletop plane with a procedural canvas wood texture (same stripe + noise recipe as the CSS, 1024², also used as a roughness map at 0.6) receiving shadows; a 0.9 m × 0.6 m linen mat plane raised 2 mm (`MeshStandardMaterial`, roughness 1, a 4px-pitch crosshatch normal map at strength 0.25); no fog. Environment lighting comes from a 256×128 procedural equirect (warm cream sky at the top, oak at the bottom) run through `PMREMGenerator`, `scene.environment` at intensity 0.6, so there is soft sheen without an HDR file.
- **Lights**: a warm key `DirectionalLight(#ffe6c0, 2.2)` from upper-left (−1.2, 2.4, 1.0) with PCF soft shadows (2048 map, bias −0.0005, radius 4) — the "lamp"; a cool fill `DirectionalLight(#dfe7f0, 0.4)` from the right so the ply shading reads; `HemisphereLight(#fff2dc, #8a6a4e, 0.5)`. `ACESFilmicToneMapping`, exposure 1.05, `SRGBColorSpace`. In dark mode the key drops to 1.4 and warms to `#ffd39a`, the hemisphere to 0.3, and the lamp spot becomes visible as a `SpotLight` pool on the table.
- **Yarn material**: `MeshPhysicalMaterial` with `color` from the yarn token (converted with `color.convertSRGBToLinear()`), `roughness 0.85`, `metalness 0`, `sheen 0.6`, `sheenRoughness 0.8`, `sheenColor` = yarn lightened 40% — sheen gives the fibrous soft-edge look. A procedural 256×64 canvas normal map of diagonal ridges (ply twist, ~45°, repeat 6 per cm along the tube) at `normalScale 0.5`. Quality: loose = same radius, tube path scaled 1.24 wide with a sag, material `color` lightened 10%; tight = path 0.76 wide, colour darkened 20%; wrong = `--bad` with a 1:1 stripe texture on `map` so it reads "dashed" in 3D too, plus a small brick pin mesh.
- **Stitch geometry**: every stitch is a `TubeGeometry` (radius 1.6 mm, 10 radial segments) along a `CatmullRomCurve3`: ch = a closed loop; sc = arch + cap loop; hdc/dc = post + 1/2 wraps as a short helix around the post + cap; bo = five short tubes bulging outward between the same two points. Stitches of one row are merged into one geometry per yarn/quality bucket for draw-call sanity (a 12×9 swatch is ~110 stitches). The row stacking uses the same `layout()` numbers mapped at 1 px = 0.6 mm.
- **Hook**: `LatheGeometry` from a profile (tip 1.8 mm, shaft 5 mm, thumb-rest flattened by scaling x 1.4 on that segment, 140 mm long) + a `TorusGeometry` quarter for the throat; `MeshStandardMaterial` with a wood canvas texture (longitudinal grain), roughness 0.45, slight `clearcoat 0.3`; it stands in the working loop leaning 30° toward the camera-right, casts a shadow onto the fabric.
- **Working loop and yarn**: the loop is a tube on a dynamic curve around the hook throat whose control points scale with hold progress (updated each frame; `geometry.dispose()` + rebuild at ≤ 60 Hz is fine at 32 segments). The working yarn is a tube along a Bézier that rises over the top edge of the work and drops into the ball. The ball is a sphere with a wound-strand normal map plus six real tubes wrapped around it; its radius follows yarn left.
- **Camera**: `PerspectiveCamera(35°)` at a three-quarter view from front-left, elevation ~40°, target the centre of the placed rows, distance chosen so the piece's full final width fills 60% of the frame width and the hook sits in the upper third. `OrbitControls` with `enablePan false`, `minPolarAngle 0.25`, `maxPolarAngle 1.25`, zoom 0.6–1.8, damping 0.08; the camera eases (300ms) to keep the hook in frame on turn. On phone the elevation rises to ~55° and the distance fits the width.
- **No post-processing** (no EffectComposer in the vendored build): the paper/grain feel comes from the textures and the tone mapping; a 2D CSS noise overlay on the canvas element at 25% does the rest.

## Accessibility

WCAG 2.1 contrast, computed from the tokens above (relative luminance, sRGB).

| Pair | Light | Dark | Use |
| --- | ---: | ---: | --- |
| ink on surface (paper) | 14.18 | 11.71 | body text |
| ink on bg (table) | 7.60 | 11.07 | project title, links |
| table-ink on bg | 5.30 | 8.35 | eyebrows, tagline, footer on wood |
| muted on surface | 5.09 | 5.84 | hints, meta, done rows |
| accent on surface | 5.75 | 6.49 | next instruction, row numbers |
| accent on bg | 3.08 | 6.14 | **not used for text on wood in light** (links use ink + accent underline) |
| surface on accent | 5.75 | 6.49 | primary button, `next` flag |
| bad on surface / surface on bad | 5.51 | 4.64 | blocked instruction, wrong chip, frog ring |
| neat on surface / surface on neat | 4.98 | 6.96 | neat chips, stamp, pin head |
| ok (ochre) on surface / surface on ok | 4.60 | 7.71 | nearly chips, meter zone (at 30% alpha, non-text) |
| accent-2 on surface | 3.73 | 4.87 | 3px "next" ring (non-text, ≥ 3:1) |
| rose / teal / mustard / lavender on surface | 2.39 / 2.99 / 1.92 / 2.89 | 6.97 / 6.62 / 8.57 / 6.48 | yarn as graphic objects only |

- All text passes AA (≥ 4.5:1) in both schemes; `--muted` and `--accent` are never placed directly on the wood in the light scheme (that is why `--table-ink` exists).
- Yarn colours are never used for text. As graphic objects, pale yarns on cream are below 3:1 on their own, so every stroke carries a dark warm shadow outline (yarn mixed 60% toward `#2a1608`) and the meter fills carry a 1px `rgba(60,35,15,.35)` edge; the boundary of each stitch and fill is therefore ≥ 3:1 against the mat in both schemes. Which yarn is in use is also stated in words ("51% left · Teal", the active yarn button, the leaflet row text).
- Quality is never colour-only: loose/tight/wrong differ in shape (width, tilt, slack loop, dashes, pin), in the toast words, and in the chip labels; the pin head on the meter is paired with "last stitch: too loose".
- Focus: tags and cards use `:focus-visible` with the same ring as `.expected` (3px, honey/accent) so keyboard players see the ring they already know.
- Motion: all animation and transitions are removed under `prefers-reduced-motion: reduce`; the canvas shake and the hook bob are included.
- Touch targets: tags are ≥ 64×64 on phone; yarn buttons ≥ 48px tall.
- The leaflet's row list keeps its native `<ol>` semantics; the toast region is `aria-live="polite"`; the meters are decorative (`aria-hidden`) with their values in the adjacent text.

## Risks

- The yarn-stroke technique strokes every path three times; a full 12×9 swatch is ~110 glyphs × 3 strokes per frame plus the hook — fine on desktop, but on low-end phones the renderer should cache the placed fabric to an offscreen canvas and only redraw the hook, loop, ball and the newest stitch each frame.
- Mustard on cream is the weakest yarn/mat pair (1.9:1); it relies on the shadow outline. If a fifth yarn is added, keep it ≥ 2.4:1 on `--surface-2` before outline.
- Serif rendering differs across platforms (Charter vs Iowan vs Palatino); sizes were chosen to tolerate the wider Palatino metrics, but the title underline SVG spans the h1 box and should be re-checked on Windows.
- `color-mix()` is used for translucent zone/ring colours; it needs Chromium 111+, Safari 16.2+, Firefox 113+. A fallback `rgba()` per token is trivial if older browsers matter.
- The CSS `filter: url(#rough)` on the grade stamp forces a repaint on the dialog's pop animation; keep the stamp out of the animated element if it stutters on phones.
