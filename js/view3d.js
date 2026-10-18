// 3D view of the crochet work: the same table seen from a chair. Built on the vendored three.js
// r160; reads the same game, layout and palette tokens as the 2D canvas so the two views agree.
//
//   import { createView3D } from './view3d.js';
//   const view = createView3D(container, { game, getHold: () => holdInfo, theme: 'auto' });
//   view.update();            // once per animation frame while the 3D view is visible
//   view.setGame(game);       // when a project starts (null clears the table)
//   view.setTheme();          // after a data-theme change (re-reads the CSS tokens)
//   view.dispose();           // frees every geometry, material, texture and the renderer
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { CELL, layout, nextPosition } from './render.js';
import { STITCHES } from './patterns.js';
import { stitchCurves, R } from './view3d/stitches.js';
import {
  yarnNormalMap, yarnPlyMap, stripeMap, woodTexture, matTextures, bambooTexture, pinHeadTexture, PIN_CROSS_LAT, mix, mulberry32,
} from './view3d/textures.js';

const DEG = Math.PI / 180;
/** A phone or tablet (coarse pointer): cheaper materials and shadows, a capped pixel ratio, no idle bob. */
const LOW_POWER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const RADIAL = LOW_POWER ? 10 : 16;   // radial segments of every yarn tube (16: round silhouettes even close up)
const HOOK_SPIN = -35 * DEG;          // turns the hook about its shaft so the J of the crook faces the default camera
const LOOP_Y = 0.5;                   // the working loop sits on the throat's neck, just above the J (the crook stays clear)
const HOOK_LIFT = 0.15;               // the bottom of the J rests on top of the cap (1.5 yarn radii), not down in it
const HOOK_DIP = 0.08;                // how far the hook dips into the hole during a hold
const IDLE_MS = 80;                   // with only the idle bob moving, render at most every IDLE_MS
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** Token fallbacks (docs/design-tokens.css) for pages that do not define the CSS variables. */
const FALLBACK = {
  light: {
    bg: '#d4b188', bg2: '#bf9666', bg3: '#e3c9a4', surface2: '#f1e7d4', surface3: '#e9dcc5', ink: '#2f2318',
    bad: '#b23a30', neat: '#4d7536', ok: '#8f6a10', hook1: '#ecd3a4', hook2: '#c69c63', hook3: '#86603a',
    rose: '#e2869f', teal: '#3b9e98', mustard: '#dcae36', lavender: '#9c86d2',
  },
  dark: {
    bg: '#3b2a1e', bg2: '#2a1d14', bg3: '#4c392a', surface2: '#28211b', surface3: '#3b322a', ink: '#f1e6d3',
    bad: '#e46f60', neat: '#8cc278', ok: '#e2b84f', hook1: '#e2c69a', hook2: '#b6895a', hook3: '#6e4c2c',
    rose: '#ee9db5', teal: '#55c0b8', mustard: '#eac35a', lavender: '#b6a3ea',
  },
};
const TOKENS = {
  bg: '--bg', bg2: '--bg-2', bg3: '--bg-3', surface2: '--surface-2', surface3: '--surface-3', ink: '--ink',
  bad: '--bad', neat: '--neat', ok: '--ok', hook1: '--hook-1', hook2: '--hook-2', hook3: '--hook-3',
  rose: '--yarn-rose', teal: '--yarn-teal', mustard: '--yarn-mustard', lavender: '--yarn-lavender',
};

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext(); // only a probe: give the context slot back now (browsers cap live contexts)
    return !!gl;
  } catch { return false; }
}

function documentTheme() {
  const dt = document.documentElement.dataset.theme;
  if (dt === 'dark' || dt === 'light') return dt;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Resolve the palette: CSS tokens when the document is in the same theme, else the fallbacks. */
function readPalette(dark) {
  const fb = FALLBACK[dark ? 'dark' : 'light'];
  const out = { dark, ...fb };
  if (documentTheme() === (dark ? 'dark' : 'light') && typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(document.documentElement);
    Object.entries(TOKENS).forEach(([k, v]) => {
      const val = cs.getPropertyValue(v).trim();
      if (/^#[0-9a-f]{6}$/i.test(val)) out[k] = val.toLowerCase();
    });
  }
  return out;
}

/**
 * Create the 3D view inside `container` (which must have a definite height; the canvas fills it).
 * Options: game (Game | null), getHold() -> { progress, zone } | null while a stitch key is held,
 * theme: 'auto' | 'light' | 'dark' | () => theme, autoLoop: run an internal rAF loop (default false:
 * the host calls update() from its own loop), now(): clock in ms, framing: 'brief' (the final width
 * fills 60% of the frame, brief 9.7; for a big stage) or 'fit' (as close as the whole final piece,
 * ball and hook allow; for a small frame such as the game's mat).
 */
export function createView3D(container, {
  game: initialGame = null, getHold = () => null, theme = 'auto', autoLoop = false, now = () => performance.now(),
  framing = 'brief',
} = {}) {
  // ---------- renderer, scene, camera ----------
  // (No probe context first: if WebGL is missing, constructing the renderer throws, and the caller
  // falls back to 2D.)
  // A phone or tablet goes without MSAA: at its pixel ratio the aliasing barely shows, and it costs
  // ~40% of a frame there.
  const renderer = new THREE.WebGLRenderer({ antialias: !LOW_POWER, alpha: false, powerPreference: 'high-performance' });
  // Pixel shading is the cost: a phone, a tablet or a narrow window gets at most 1.5 device px per
  // css px, and steps down (1.5 -> 1 -> 0.75 on a phone) while frames run slow (see render()).
  let pixelRatio = Math.min(LOW_POWER || window.innerWidth <= 900 ? 1.5 : 2, window.devicePixelRatio || 1);
  const MIN_PIXEL_RATIO = Math.min(pixelRatio, LOW_POWER ? 0.75 : 1);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = LOW_POWER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // re-rendered only when something that casts a shadow moves
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'view3d-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Your crochet work, 3D view');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
  container.appendChild(canvas);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.25;
  controls.minAzimuthAngle = -70 * DEG;
  controls.maxAzimuthAngle = 20 * DEG;
  controls.autoRotateSpeed = 0.3;
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; controls.autoRotate = false; });
  // Render on demand: a frame is drawn only when something changed (see update()).
  let dirty = true;          // the next update() must render
  let shadowsDirty = true;   // ... and re-render the shadow map
  let lastRenderAt = 0;
  const invalidate = (shadows = false) => { dirty = true; if (shadows) shadowsDirty = true; };
  controls.addEventListener('change', () => invalidate());

  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- state ----------
  let game = null;
  let lay = null;
  let cols = 12; let depth = 8;
  let themeOpt = theme;
  let dark = false;
  let pal = readPalette(false);
  const cache = new Map();        // `${row}:${n}` -> stitch entry
  const materials = new Map();    // `${yarn}:${bucket}` -> MeshPhysicalMaterial
  const tex = {};                 // procedural textures
  let lastT = now();
  let lastIdx = 0;
  let finishedAt = null;
  let baseD = 20;
  let freeCamera = false;
  const fx = { pulse: null, nudge: null, follow: null, roll: null, spin: null, flyers: [], confetti: null };
  let fullFrame = null;   // 'fit' framing: { target, d } showing the whole final piece and the ball (completion)
  const hookPos = new THREE.Vector3();
  const homeTarget = new THREE.Vector3();
  let hookBuiltAt = new THREE.Vector3(NaN, NaN, NaN);
  let loopProgressBuilt = -1;
  let ballRadius = 0;
  let ballZ = null;        // the ball's z now ('fit': it moves up beside the row being worked)
  let ballTween = null;    // { from, to, start } while it moves to the next row

  // ---------- environment: room reflections, table, lights ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  {
    const room = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshStandardMaterial({ color: 0x7d6c5c, side: THREE.BackSide, roughness: 1 }));
    room.add(box);
    const warm = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshBasicMaterial({ color: 0xfff1dc }));
    warm.position.set(-6, 8, 3); warm.lookAt(0, 0, 0); room.add(warm);
    const cool = new THREE.Mesh(new THREE.PlaneGeometry(6, 10), new THREE.MeshBasicMaterial({ color: 0xdfe6ff }));
    cool.position.set(9, 2, -3); cool.lookAt(0, 0, 0); room.add(cool);
    room.add(new THREE.HemisphereLight(0xffffff, 0x886644, 1.2));
    envRT = pmrem.fromScene(room, 0.04);
    scene.environment = envRT.texture;
    box.geometry.dispose(); box.material.dispose(); warm.geometry.dispose(); warm.material.dispose(); cool.geometry.dispose(); cool.material.dispose();
  }
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffe6c0, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(LOW_POWER ? 1024 : 2048);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.035;   // thin tubes under a low lamp acne without it
  key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(0xdfe7f0, 0.4);
  const rim = new THREE.DirectionalLight(0xb9c6ff, 0.25);
  // A neutral ground colour: a brown one tints every cool yarn (lavender, teal) toward pink.
  const hemi = new THREE.HemisphereLight(0xfff2dc, 0x8a7a6e, 0.5);
  // Dark: the lamp's pool covers the whole mat (brief 9.5), with a soft edge.
  const lamp = new THREE.SpotLight(0xffd39a, 620, 0, 0.6, 0.6, 2);
  lamp.visible = false;
  // One red light for a wrong stitch, moved to it; dark theme only. A light per wrong stitch would
  // change the light count, and so recompile every material, at the very moment the shake plays.
  const wrongLight = new THREE.PointLight(0xffffff, 0, 2, 2);
  wrongLight.visible = false;
  scene.add(key, key.target, fill, fill.target, rim, rim.target, hemi, lamp, lamp.target, wrongLight);

  // The dark theme's cool rim (night-yarn graft) on the yarn, hook and ball only. three.js has no
  // per-object light linking (a rim DirectionalLight would rake the whole oak table and turn it
  // violet), so it is a fresnel term added in those materials' shaders, from the rim light's direction.
  const RIM_DIR = new THREE.Vector3(0.8, 1.0, -1.4).normalize();
  const rimU = { rimColor: { value: new THREE.Color(0xb9c6ff) }, rimStrength: { value: 0 }, rimDir: { value: new THREE.Vector3(0, 0, 1) } };
  function withRim(m) {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, rimU);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform vec3 rimDir;\nvoid main() {')
        .replace('#include <opaque_fragment>', `{
          // the tube's own normal, not the ply-mapped one: a rim on every ridge would read as stripes
          float fres = pow( 1.0 - saturate( dot( nonPerturbedNormal, normalize( vViewPosition ) ) ), 2.5 );
          float side = saturate( dot( nonPerturbedNormal, rimDir ) * 0.6 + 0.4 );
          outgoingLight += rimColor * ( rimStrength * fres * side );
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'yarn-rim';
    return m;
  }

  const tableMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  // Big enough that its edge lies past the fog's far end in both themes (see placeFog()), so a low
  // camera sees the table melt into the room instead of a hard horizon line where the edge is.
  const TABLE_W = 260; const TABLE_D = 180;
  const table = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_W, TABLE_D), tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.04;
  table.receiveShadow = true;
  scene.add(table);

  // Brief: normalScale 0.25; 0.06 (on a coarser weave) keeps it from raking into hard stripes under a low lamp.
  const matMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.06, 0.06) });
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMat);
  mat.rotation.x = -Math.PI / 2;
  mat.receiveShadow = true;
  scene.add(mat);

  const fabric = new THREE.Group();
  scene.add(fabric);

  // ---------- hook ----------
  const hookMat = withRim(LOW_POWER
    ? new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 })
    : new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }));
  const hook = new THREE.Group();       // at the hook's rest point: moves only when the hook really moves
  const hookBody = new THREE.Group();   // the lean (30 deg toward +x, 20 deg toward the camera) and the idle bob
  const hookHead = new THREE.Group();   // the hook itself, turned about its shaft so the J of the crook faces the camera
  let crookDepth = 0.3;                 // how far the bottom of the J hangs below the throat (world y; measured below)
  {
    const profile = [
      [0, 0], [0.09, 0], [0.09, 0.3], [0.12, 0.7], [0.17, 1.0], [0.17, 1.1], [0.22, 1.2], [0.22, 1.5],
      [0.17, 1.6], [0.17, 4.35], [0.15, 4.55], [0.08, 4.67], [0, 4.7],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const lathe = new THREE.LatheGeometry(profile, 28);
    const p = lathe.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const y = p.getY(i);
      if (y >= 1.1 && y <= 1.6) p.setX(i, p.getX(i) * 1.4); // flattened thumb rest
    }
    lathe.computeVertexNormals();
    const shaft = new THREE.Mesh(lathe, hookMat);
    // The crook: a real J. The throat (brief: a 0.22 torus of 0.09 tube) leaves the tip heading down,
    // turns through the bottom and on up-and-out by 50 deg, and the lip carries on 0.24 that way,
    // flaring a little, with a rounded head. The gap between lip and shaft is where the yarn is caught.
    const TR = 0.2; const TUBE = 0.09; const SWEEP = 140 * DEG; const LIP = 0.24;
    const throat = new THREE.Mesh(new THREE.TorusGeometry(TR, TUBE, 10, 18, SWEEP), hookMat);
    throat.rotation.z = -SWEEP;                 // the arc runs from the tip (0, 0) round to the lip
    throat.position.set(-TR, 0, 0);
    const end = new THREE.Vector2(-TR + TR * Math.cos(-SWEEP), TR * Math.sin(-SWEEP));
    const dir = new THREE.Vector2(Math.sin(-SWEEP), -Math.cos(-SWEEP)); // the arc's heading at its end
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, TUBE, LIP, 14, 1, true), hookMat); // open: no caps to z-fight the throat and head
    lip.rotation.z = SWEEP - Math.PI / 2;
    lip.position.set(end.x + (dir.x * LIP) / 2, end.y + (dir.y * LIP) / 2, 0);
    const lipTip = new THREE.Mesh(new THREE.SphereGeometry(0.104, 14, 10), hookMat);
    lipTip.position.set(end.x + dir.x * LIP, end.y + dir.y * LIP, 0);
    [shaft, throat, lip, lipTip].forEach((m) => { m.castShadow = true; m.receiveShadow = true; hookHead.add(m); });
    hookHead.rotation.y = HOOK_SPIN;
    hookBody.rotation.set(20 * DEG, 0, -30 * DEG);
    hookBody.add(hookHead);
    hook.add(hookBody);
    hook.updateMatrixWorld(true);
    const box = new THREE.Box3();
    [throat, lip, lipTip].forEach((m) => box.expandByObject(m));
    crookDepth = -box.min.y;
  }
  scene.add(hook);
  /** Hook-local (hookBody frame) point to world, without the idle bob: where the hook rests. */
  const restToWorld = (v) => v.clone().applyEuler(hookBody.rotation).add(hook.position);

  // Working loop (on the hook, so it bobs with it), working yarn, slip knot.
  const loopMat = withRim(yarnMaterial());
  const loop = new THREE.Mesh(new THREE.BufferGeometry(), loopMat);
  loop.castShadow = true;
  const loopLight = new THREE.PointLight(0xffffff, 0.6, 1.5, 2);
  loopLight.visible = false;
  loop.add(loopLight);
  hookBody.add(loop);
  const workYarn = new THREE.Mesh(new THREE.BufferGeometry(), loopMat);
  workYarn.castShadow = true; workYarn.receiveShadow = true;
  const slipKnot = new THREE.Mesh(new THREE.BufferGeometry(), loopMat);
  slipKnot.castShadow = true;
  const bridge = new THREE.Mesh(new THREE.BufferGeometry(), loopMat);
  bridge.castShadow = true; bridge.receiveShadow = true; bridge.visible = false;
  scene.add(workYarn, slipKnot, bridge);

  // Ball of yarn.
  const ball = new THREE.Group();
  scene.add(ball);

  // Pins for wrong stitches (shared parts). The white x is printed on the glass head (a texture), not
  // stuck on top of it.
  const pinShaftGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.62, 8);
  const pinHeadGeo = new THREE.SphereGeometry(0.15, 18, 14);
  const pinShaftMat = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.35, metalness: 0.85 });
  const pinHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0, emissive: 0xffffff });

  /** The yarn material: sheen is what makes it fibre rather than plastic; phones get the cheaper
   *  standard material (pixel shading is what limits them). */
  function yarnMaterial(extra = {}) {
    return LOW_POWER
      ? new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...extra })
      : new THREE.MeshPhysicalMaterial({ roughness: 0.85, metalness: 0, sheen: 0.7, sheenRoughness: 0.75, ...extra });
  }

  // ---------- palette and theme ----------
  function resolveTheme() {
    const t = typeof themeOpt === 'function' ? themeOpt() : themeOpt;
    if (t === 'dark' || t === 'light') return t;
    return documentTheme();
  }

  function yarnHex(i) {
    const y = game && game.pattern.yarns[i];
    if (!y) return pal.rose;
    const tok = pal[String(y.name || '').toLowerCase()];
    return tok || y.color || pal.rose;
  }

  function bucketOf(s) {
    if (s.wrong) return 'wrong';
    if (s.q === 'ok') return s.t < 0 ? 'ok-' : 'ok+';
    return s.q || 'neat';
  }

  function bucketColor(base, bucket) {
    switch (bucket) {
      case 'ok-': return mix(base, '#fff7e8', 0.07);
      case 'ok+': return mix(base, '#2a1608', 0.07);
      case 'loose': return mix(base, '#fff7e8', 0.10);
      case 'tight': return mix(base, '#2a1608', 0.20);
      case 'core': return mix(base, '#2a1608', 0.16);
      default: return base;
    }
  }

  /**
   * A yarn's albedo, partly white-balanced against the key light (in linear light, at the same
   * luminance), so that under the warm lamp a cool yarn still reads as its token: a lavender lit by
   * 0xffe6c0 alone comes out mauve, a hue 30 deg off.
   */
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  function balanced(hex, out = new THREE.Color()) {
    const c = new THREE.Color(hex);
    const t = key.color; const m = Math.max(t.r, t.g, t.b) || 1;
    const k = 0.6;
    out.setRGB(c.r / (t.r / m) ** k, c.g / (t.g / m) ** k, c.b / (t.b / m) ** k);
    out.multiplyScalar(lum(c) / Math.max(1e-4, lum(out)));
    out.setRGB(Math.min(1, out.r), Math.min(1, out.g), Math.min(1, out.b));
    return out;
  }

  function styleYarnMaterial(m) {
    const { yarn, bucket, plain } = m.userData;
    const hex = bucket === 'wrong' ? pal.bad : bucketColor(yarnHex(yarn), bucket);
    balanced(hex, m.color);
    m.emissive.set(hex);
    m.emissiveIntensity = bucket === 'wrong' ? 0.12 : (dark ? 0.06 : 0);
    m.envMapIntensity = dark ? 0.4 : 0.6;
    if (m.sheenColor) {
      balanced(mix(hex, '#ffffff', 0.35), m.sheenColor);
      m.sheenRoughness = bucket === 'loose' ? 0.9 : bucket === 'tight' ? 0.45 : 0.75;
    }
    // A bobble's dome (and the ball's core) go without the ply maps: on a sphere's UVs the bands and
    // ridges converge into chevrons. (The bobble's loops take the ordinary, twisted material.)
    const smooth = plain || bucket === 'core';
    m.map = bucket === 'wrong' ? tex.stripe : smooth ? null : tex.yarnPly;
    m.normalMap = smooth ? null : tex.yarnNormal;
    m.needsUpdate = true;
  }

  function materialFor(yarn, bucket, plain = false) {
    const k = `${yarn}:${bucket}${plain ? ':plain' : ''}`;
    let m = materials.get(k);
    if (!m) {
      m = withRim(yarnMaterial({ normalMap: tex.yarnNormal, normalScale: new THREE.Vector2(0.4, 0.4) }));
      m.userData = { yarn, bucket, plain };
      styleYarnMaterial(m);
      materials.set(k, m);
    }
    return m;
  }

  function rowZ(r) { return (lay.rows[r].y - lay.rows[0].y) / CELL; }

  // Procedural textures are made once per theme (and the mat once per pattern and theme) and kept, so
  // pressing N again, or a new project with the same layout, swaps them instead of repainting them.
  const themeTex = {};                                   // 'light' | 'dark' -> { wood, woodRough, bamboo, stripe, pinHead }
  let matTex = { key: '', light: null, dark: null };     // the current layout's mat, per theme
  const disposeTex = (o) => o && Object.values(o).forEach((t) => t && t.isTexture && t.dispose());

  function buildMat() {
    const depthU = lay ? depth : 8;
    const colsU = lay ? cols : 12;
    const zs = lay ? lay.rows.map((_, r) => rowZ(r)) : [];
    const key = `${colsU}|${depthU}|${zs.map((z) => z.toFixed(3)).join(',')}`;
    if (matTex.key !== key) {
      disposeTex(matTex.light); disposeTex(matTex.dark);
      matTex = { key, light: null, dark: null };
    }
    const th = dark ? 'dark' : 'light';
    if (!matTex[th]) matTex[th] = matTextures(pal, { cols: colsU, depth: depthU, rowZ: zs, anisotropy: maxAniso }); // the mat is seen at grazing angles
    const built = matTex[th];
    matMat.map = built.map;
    matMat.normalMap = built.normalMap;
    matMat.needsUpdate = true;
    mat.geometry.dispose();
    mat.geometry = new THREE.PlaneGeometry(built.width, built.depth);
    mat.position.set(colsU / 2, 0, -depthU / 2);
  }

  let booted = false;
  function applyTheme() {
    const wasDark = dark;
    dark = resolveTheme() === 'dark';
    pal = readPalette(dark);
    const th = dark ? 'dark' : 'light';
    const bg2 = new THREE.Color(pal.bg2);
    scene.background = bg2;
    // Dark: the lamp-lit table falls off into the room (brief 9.6). Light: a far, faint fog only so the
    // table edge melts into the background instead of showing as a hard horizon line. three.js mixes
    // the fog in after the output colour conversion and converts the fog colour to the output space
    // for that itself, so it is the same (working-space) colour as the background: given as raw sRGB
    // numbers instead, it was converted twice and the far table faded to a pale band at the horizon.
    scene.fog = new THREE.Fog(bg2.clone(), 1, 2);
    placeFog();
    renderer.toneMappingExposure = dark ? 1.0 : 1.05;

    // Dark (brief 9.5/9.9): darker wood, a warmer key, the lamp's pool on the mat, and the cool rim on
    // the strands only (the shader rim above; the rim DirectionalLight would rake the oak violet).
    key.color.set(dark ? 0xffd39a : 0xffe6c0);
    key.intensity = dark ? 1.1 : 2.2;
    rim.intensity = dark ? 0 : 0.25;
    rimU.rimStrength.value = dark ? 0.5 : 0;
    hemi.intensity = dark ? 0.3 : 0.5;
    lamp.visible = dark;
    loopLight.visible = dark;
    wrongLight.visible = dark;
    wrongLight.color.set(pal.bad);

    if (!tex.yarnNormal) { tex.yarnNormal = yarnNormalMap(); tex.yarnPly = yarnPlyMap(); }
    if (!themeTex[th]) {
      const wood = woodTexture(pal, { size: window.innerWidth <= 600 ? 512 : 1024, anisotropy: Math.min(8, maxAniso) });
      wood.map.repeat.set(TABLE_W / wood.unitsPerTile, TABLE_D / wood.unitsPerTile);
      wood.roughnessMap.repeat.copy(wood.map.repeat);
      themeTex[th] = { wood: wood.map, woodRough: wood.roughnessMap, bamboo: bambooTexture(pal), stripe: stripeMap(pal.bad), pinHead: pinHeadTexture(pal.bad) };
    }
    Object.assign(tex, themeTex[th]);
    tableMat.map = tex.wood; tableMat.roughnessMap = tex.woodRough;
    // Dark: the lamp is very warm (0xffd39a); white-balanced, the oak stays brown instead of going red.
    if (dark) balanced('#ffffff', tableMat.color); else tableMat.color.set(0xffffff);
    // The room's environment map is a daylight one: under the lamp its cool panel would glaze the far
    // table violet at grazing angles, so the wood (and the linen) take very little of it in the dark.
    tableMat.envMapIntensity = dark ? 0.15 : 1;
    tableMat.needsUpdate = true;
    // The linen holds its --surface-2 value under the lamp (as the 2D mat does), not a black hole.
    matMat.emissive.set(pal.surface2);
    matMat.emissiveIntensity = dark ? 1.0 : 0;
    matMat.envMapIntensity = dark ? 0.15 : 1;
    hookMat.map = tex.bamboo; hookMat.envMapIntensity = dark ? 0.4 : 0.6; hookMat.needsUpdate = true;
    buildMat();
    materials.forEach((m) => styleYarnMaterial(m));
    loopMat.normalMap = tex.yarnNormal; loopMat.normalScale.set(0.4, 0.4); loopMat.map = tex.yarnPly;
    loopMat.envMapIntensity = dark ? 0.4 : 0.6; loopMat.needsUpdate = true;
    pinHeadMat.map = tex.pinHead; pinHeadMat.emissiveMap = tex.pinHead; pinHeadMat.emissiveIntensity = dark ? 0.25 : 0.05;
    pinHeadMat.needsUpdate = true;
    loopProgressBuilt = -1; hookBuiltAt.set(NaN, NaN, NaN);
    ballRadius = 0;
    // The lamp and the loop and wrong-stitch lights switch with the theme, which changes the light
    // count and so every program: compile them now (the pin and a wrong stitch's striped yarn too),
    // while the theme changes, not on the first wrong stitch afterwards, with the shake playing.
    if (booted && dark !== wasDark) warm();
    invalidate(true);
  }

  /** Compile every program the scene can need, including the pin's and a wrong stitch's (they are
   *  first needed at the worst moment: a wrong stitch, with the shake playing), and upload their
   *  textures. `async`: let the browser compile in parallel (KHR_parallel_shader_compile) and
   *  resolve when done, so a first start does not freeze the page in one long task. */
  function warm(async = false) {
    const group = new THREE.Group();
    group.position.set(0, -30, 0); // under the table: never seen, even for the one frame it might be
    group.add(buildPin([0, 0, 0]));
    group.add(new THREE.Mesh(pinHeadGeo, materialFor(0, 'wrong')));
    scene.add(group);
    let done = null;
    try {
      // (without the extension compileAsync gains nothing, and three.js warns about it)
      if (async && renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) done = renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch { /* compiled on first use instead */ }
    scene.remove(group);
    const upload = () => [tex.stripe, tex.pinHead].forEach((t) => { try { if (t) renderer.initTexture(t); } catch { /* uploaded on first use */ } });
    if (!done) { upload(); return Promise.resolve(); }
    return done.then(upload, upload);
  }

  // ---------- layout mapping (2D px -> cell units) ----------
  /** Frame of the i-th stitch of row r (or of a hypothetical next stitch when i === placed.length). */
  function frameFor(r, placed, i, s) {
    const row = lay.rows[r];
    const z0row = rowZ(r);
    const pos = nextPosition(lay, r, placed.slice(0, i));
    const h = STITCHES[s.st].height / CELL;
    if (s.st === 'ch' && !row.foundation) {
      const edge = r % 2 === 0 ? lay.left - CELL * 0.85 : lay.left + row.slots * CELL - CELL * 0.15;
      return { cx: (edge + CELL / 2 - lay.left) / CELL, z0: z0row - (pos.turningIndex * 11) / CELL, h, dir: pos.dir, dipZ: 0, lift: pos.turningIndex * 0.5 * R, turning: true };
    }
    const below = r > 0 ? lay.rows[r - 1] : null;
    const dipZ = below ? ((below.foundation ? 0.5 : 0.16) * below.height) / CELL : 0;
    return { cx: (pos.x + CELL / 2 - lay.left) / CELL, z0: z0row, h, dir: pos.dir, dipZ, lift: 0, turning: false };
  }

  // ---------- geometry ----------
  /** The tube(s) for one stitch path. An open path also gets a rounded end at each end (a small
   *  sphere), so where a leg goes under the work there is yarn, not a hollow, knife-edged ring. */
  function tubeFor(curve, radius, wrong) {
    const path = new THREE.CatmullRomCurve3(curve.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), curve.closed, 'catmullrom', 0.4);
    const g = new THREE.TubeGeometry(path, curve.segs, radius, RADIAL, curve.closed);
    const len = path.getLength();
    const tile = wrong ? 1 / 3 : 2 * Math.PI * radius; // one ply tile wraps once round the tube; stripes 3 per unit
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, (uv.getX(i) * len) / tile);
    if (curve.closed) return [g];
    const ends = [0, 1].map((u) => {
      const e = new THREE.SphereGeometry(radius, RADIAL, Math.max(4, RADIAL / 2 - 1));
      const p = path.getPointAt(u);
      e.translate(p.x, p.y, p.z);
      return e;
    });
    return [ends[0], g, ends[1]];
  }

  /** Tube along a curve with the ply texture tiled once per wrap of yarn (as tubeFor does), so the
   *  working loop, working yarn, bridge and slip knot carry the same twist as the stitches. */
  function yarnTube(curve, segs, radius, closed) {
    const g = new THREE.TubeGeometry(curve, segs, radius, RADIAL, closed);
    scaleUV(g, curve.getLength() / (2 * Math.PI * radius), 1);
    return g;
  }

  function scaleUV(g, su, sv) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
  }

  /** Hand-rolled merge (BufferGeometryUtils is not vendored): one mesh per stitch. */
  function mergeGeometries(list) {
    let nv = 0; let ni = 0;
    list.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; });
    const pos = new Float32Array(nv * 3); const nor = new Float32Array(nv * 3); const uv = new Float32Array(nv * 2);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0; let io = 0;
    list.forEach((g) => {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let k = 0; k < gi.length; k += 1) idx[io + k] = gi[k] + vo;
      vo += g.attributes.position.count; io += gi.length;
      g.dispose();
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  // The pin leans 35 deg from vertical toward the upper-left; its head is turned so the one printed
  // x faces the default camera (azimuth -25, elevation 40) squarely.
  const PIN_LEAN = new THREE.Euler(-25 * DEG, 0, 25 * DEG);
  const PIN_HEAD_Q = (() => {
    // the printed x's own frame on the sphere (u = 0.25): out of the glass, up the sphere, along u
    const fwd = new THREE.Vector3(0, Math.sin(PIN_CROSS_LAT), Math.cos(PIN_CROSS_LAT));
    const up = new THREE.Vector3(0, Math.cos(PIN_CROSS_LAT), -Math.sin(PIN_CROSS_LAT));
    const src = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, fwd), up, fwd);
    // ... turned to face the camera, upright on screen (an x, not a +), in the leaning pin's frame
    const inv = new THREE.Quaternion().setFromEuler(PIN_LEAN).invert();
    const F = new THREE.Vector3(Math.sin(-25 * DEG) * Math.cos(40 * DEG), Math.sin(40 * DEG), Math.cos(-25 * DEG) * Math.cos(40 * DEG)).applyQuaternion(inv).normalize();
    const U = new THREE.Vector3(0, 1, 0).applyQuaternion(inv);
    U.addScaledVector(F, -U.dot(F)).normalize();
    const dst = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(U, F), U, F);
    const qs = new THREE.Quaternion().setFromRotationMatrix(src);
    return new THREE.Quaternion().setFromRotationMatrix(dst).multiply(qs.invert());
  })();
  function buildPin(p) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(pinShaftGeo, pinShaftMat); shaft.position.y = 0.2; shaft.castShadow = true;
    const head = new THREE.Mesh(pinHeadGeo, pinHeadMat); head.position.y = 0.53; head.castShadow = true;
    head.quaternion.copy(PIN_HEAD_Q);
    g.add(shaft, head);
    g.position.set(p[0], p[1], p[2]);
    g.rotation.copy(PIN_LEAN);
    return g;
  }

  function buildStitch(r, placed, i, t) {
    const s = placed[i];
    const f = frameFor(r, placed, i, s);
    const built = stitchCurves(s, f);
    const parts = built.curves.flatMap((c) => tubeFor(c, c.radius || built.radius, s.wrong));
    let domeCount = 0;
    if (built.dome) {
      // the bobble's puff: a squashed half-dome of the same yarn under its loops (its lower half is
      // under the mat), so no mat shows between them
      const d = new THREE.SphereGeometry(1, 16, 10);
      d.scale(...built.dome.radii);
      d.translate(...built.dome.centre);
      domeCount = d.index.count;
      parts.unshift(d);
    }
    const geo = mergeGeometries(parts);
    const bucket = bucketOf(s);
    let material = materialFor(s.yarn, bucket);
    if (domeCount) {
      // Two materials: the dome goes without the ply maps (on a sphere's UVs the bands converge into
      // chevrons), while the bobble's loops and cap carry the same twist as every other strand, so up
      // close the puff reads as yarn pulled up in loops, not a smooth moulded shell.
      geo.addGroup(0, domeCount, 1);
      geo.addGroup(domeCount, Infinity, 0);
      material = [material, materialFor(s.yarn, bucket, true)];
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(built.origin[0], built.origin[1], built.origin[2]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    fabric.add(mesh);
    const entry = { mesh, s, bucket, cap: new THREE.Vector3(...built.cap), born: t, total: geo.index.count, dir: f.dir, settled: false, dying: null, pin: null };
    if (built.pin) {
      entry.pin = buildPin(built.pin);
      entry.pin.scale.setScalar(1.6);
      fabric.add(entry.pin);
    }
    setDrawFrac(entry, 0);
    return entry;
  }

  function setDrawFrac(entry, frac) {
    const ring = RADIAL * 6; // one tube segment: RADIAL quads of 6 indices
    const count = frac >= 1 ? Infinity : Math.ceil((frac * entry.total) / ring) * ring;
    entry.mesh.geometry.setDrawRange(0, count);
  }

  function removeEntry(entry) {
    fabric.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    if (entry.pin) { fabric.remove(entry.pin); }
  }

  /** The red light sits in the newest wrong stitch still on the work (dark theme; intensity 0 if none). */
  function placeWrongLight() {
    let w = null;
    cache.forEach((e) => { if (e.s.wrong && e.dying == null && (!w || e.s.n > w.s.n)) w = e; });
    wrongLight.intensity = w ? 0.3 : 0;
    if (w) wrongLight.position.set(w.cap.x, 0.3, w.cap.z);
  }

  function stitchKey(r, s) { return `${r}:${s.n}`; }

  /** Build stitches the game has placed and start the frog of ones it took back; true if any changed. */
  function syncFabric(t) {
    let changed = false;
    const seen = new Set();
    game.rows.forEach((placed, r) => {
      placed.forEach((s, i) => {
        const k = stitchKey(r, s);
        seen.add(k);
        if (!cache.has(k)) { cache.set(k, buildStitch(r, placed, i, t)); changed = true; }
      });
    });
    cache.forEach((e, k) => {
      if (!seen.has(k) && e.dying == null) {
        e.dying = t;
        changed = true;
        fx.flyers.push({ from: e.cap.clone(), start: t, mesh: new THREE.Mesh(new THREE.TorusGeometry(0.16, R, 6, 14), [].concat(e.mesh.material)[0]) });
        scene.add(fx.flyers[fx.flyers.length - 1].mesh);
      }
    });
    if (changed) placeWrongLight();
    return changed;
  }

  /** Grow new stitches out of the loop, unravel frogged ones; true while any is still moving. */
  function animateStitches(t) {
    let busy = false;
    cache.forEach((e, k) => {
      if (e.dying != null) {
        busy = true;
        const u = (t - e.dying) / 180;
        if (u >= 1) { removeEntry(e); cache.delete(k); placeWrongLight(); return; }
        setDrawFrac(e, 1 - easeOut(u));
        return;
      }
      const age = t - e.born;
      if (age < 160) {
        busy = true;
        const u = easeOut(age / 160);
        setDrawFrac(e, u);
        if (reducedMotion) return;
        if (e.bucket === 'neat') e.mesh.scale.setScalar(1.08 - 0.08 * u);
        else if (e.bucket === 'loose') e.mesh.scale.set(1, 1, 0.9 + 0.1 * u);
        else if (e.bucket === 'tight') e.mesh.position.x += 0.03 * Math.sin(u * Math.PI) * (u < 0.5 ? 1 : -1) * 0.2;
        if (e.pin) e.pin.scale.setScalar(1.6 - 0.6 * u);
      } else if (!e.settled) {
        busy = true;
        setDrawFrac(e, 1);
        e.mesh.scale.set(1, 1, 1);
        if (e.pin) e.pin.scale.setScalar(1);
        e.settled = true;
      }
    });
    return busy;
  }

  // ---------- ball ----------
  /** [x, y, z] Euler degrees of the wound strands: 14 great circles at spread tilts (as the 2D ball's
   *  BALL_WRAPS), so the core shows only between strands. */
  const BALL_STRANDS = Array.from({ length: 14 }, (_, i) => [(i * 47 + 15) % 180, (i * 83) % 180, (i * 37) % 360]);

  function buildBall(radius) {
    while (ball.children.length) { const c = ball.children.pop(); c.geometry.dispose(); }
    const yarn = game ? game.currentYarn : 0;
    // The core is the yarn deeper in the ball: plain (a ply normal map on sphere UVs converges into
    // chevrons at the poles) and a shade darker, seen only between the strands wound over it.
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), materialFor(yarn, 'core'));
    body.castShadow = true; body.receiveShadow = true;
    ball.add(body);
    BALL_STRANDS.forEach(([ax, ay, az], i) => {
      const torus = new THREE.TorusGeometry(radius * 1.015, R * 0.95, 8, 48);
      scaleUV(torus, (radius * 1.015) / R, 1);
      const strand = new THREE.Mesh(torus, materialFor(yarn, i % 3 === 0 ? 'neat' : 'ok+'));
      strand.rotation.set(ax * DEG, ay * DEG, az * DEG);
      strand.castShadow = i % 2 === 0;
      ball.add(strand);
    });
    ballRadius = radius;
  }

  /** Where the ball rests on the mat. 'fit' (the game's row-following view): beside the row being
   *  worked, a little in front of it, so it stays in frame as the view pans up the work and its
   *  shrinking (the out-of-yarn cue) is always seen. 'brief': by the lower-right corner. */
  const BALL_X = 2.2;                 // the ball's centre, this far right of the last column
  const ballFollows = () => framing === 'fit';
  const ballRadiusNow = () => (14 + 16 * clamp(game ? game.yarnLeft / game.yarnTotal : 1, 0, 1)) / 30;
  /** The ball's resting z beside row r ('fit'), or by the corner ('brief'). */
  function ballZFor(r, radius = ballRadiusNow()) {
    if (!ballFollows() || !lay) return -0.6 * radius - 0.3;
    return rowZ(clamp(r, 0, lay.rows.length - 1)) + 0.6;
  }
  function ballHomeZ() {
    const r = game && game.step ? game.step.row : lay ? lay.rows.length - 1 : 0;
    return ballZFor(r);
  }

  function ballTarget() {
    const radius = ballRadiusNow();
    return { radius, x: cols + BALL_X, z: ballZ == null ? ballHomeZ() : ballZ };
  }

  /** Corners of the ball's box at z = bz (at full size, plus a margin): the framing keeps them in. */
  function ballBoxPoints(bz, out = [], margin = 0.15) {
    const rad = 1; const bx = cols + BALL_X;
    [bx - rad, bx + rad + margin].forEach((x) => [0, 2 * rad + margin].forEach((y) => [bz - rad - margin, bz + rad + margin].forEach((z) => out.push(new THREE.Vector3(x, y, z)))));
    return out;
  }

  /** Keep the ball's size and colour with the yarn, and move it up beside a new row (eased); true if
   *  it changed, moved or is rolling. */
  function syncBall(t) {
    let changed = false;
    const home = ballHomeZ();
    if (ballZ == null || reducedMotion || !ballFollows()) {
      if (ballZ !== home) { ballZ = home; changed = true; ball.userData.dirtyYarn = true; }
    } else if (Math.abs(home - ballZ) > 1e-4 || ballTween) {
      if (!ballTween || ballTween.to !== home) ballTween = { from: ballZ, to: home, start: t };
      const u = clamp((t - ballTween.start) / 600, 0, 1); // with the view's pan on to the next row
      ballZ = ballTween.from + (ballTween.to - ballTween.from) * easeInOut(u);
      if (u >= 1) { ballZ = home; ballTween = null; }
      changed = true;
      ball.userData.dirtyYarn = true;
    }
    const b = ballTarget();
    if (Math.abs(b.radius - ballRadius) > 0.012 || ball.children.length === 0 || ball.userData.yarn !== (game ? game.currentYarn : 0)) {
      buildBall(b.radius);
      ball.userData.yarn = game ? game.currentYarn : 0;
      changed = true;
    }
    ball.position.set(b.x, b.radius, b.z);
    if (fx.roll) {
      const u = clamp((t - fx.roll.start) / 320, 0, 1);
      ball.rotation.z = fx.roll.from + (Math.PI / 2) * easeInOut(u);
      if (u >= 1) fx.roll = null;
      changed = true;
    }
    return changed;
  }

  // ---------- hook, loop and working yarn ----------
  function capOf(r, i) {
    const e = cache.get(stitchKey(r, game.rows[r][i]));
    return e ? e.cap : null;
  }

  /** Top loop of the last stitch made (the working loop comes out of it), or null before the first. */
  function lastCap() {
    const step = game.step;
    for (let r = step ? step.row : lay.rows.length - 1; r >= 0; r -= 1) {
      const placed = game.rows[r];
      if (placed.length) return capOf(r, placed.length - 1);
    }
    return null;
  }

  /** The stitch step the hook is about to work (looking past a yarn change), or null when the next
   *  action is a turn or the fasten-off, or a wrong stitch is on the hook and must be frogged. */
  function workingStep() {
    if (!game.active || game.blocked) return null;
    for (let i = game.idx; i < game.steps.length; i += 1) {
      const st = game.steps[i];
      if (st.type === 'stitch') return st;
      if (st.type !== 'yarn') return null;
    }
    return null;
  }

  /** The next stitch's slot from render.js's nextPosition(): `at` = where the hook stands (the hole it
   *  goes into, between the row below's top loop and the new cap), `cap` = where the new top loop forms. */
  function slotOf(step) {
    const placed = game.rows[step.row];
    const f = frameFor(step.row, placed, placed.length, { st: step.st });
    const y = R + (f.lift || 0);
    if (step.st === 'ch') {
      const c = new THREE.Vector3(f.cx, y, f.z0 - 0.5 * f.h);
      return { at: c, cap: c.clone() };
    }
    return { at: new THREE.Vector3(f.cx, y, f.z0 - 0.4 * f.h), cap: new THREE.Vector3(f.cx, y, f.z0 - 0.84 * f.h) };
  }

  /** Where the slip knot sits before the first chain: slot 0 of the foundation row. */
  function slipKnotAt() {
    const pos = nextPosition(lay, 0, []);
    return new THREE.Vector3((pos.x + CELL / 2 - lay.left) / CELL, R, -0.5 * STITCHES.ch.height / CELL);
  }

  /**
   * Where the hook rests, as in 2D (render.js hookAnchor, brief 6.5): in the top loop of the last
   * stitch made, so a wrong stitch is on the hook and a frog pulls it back one stitch; on the slip knot
   * before the first chain. `cap` = where the next stitch's top loop forms (the hold glides 0.6 of the
   * way there); `from` = the last stitch's top loop, which the working loop comes out of.
   */
  function hookRest() {
    const ws = workingStep();
    const last = lastCap();
    const at = last ? last.clone() : slipKnotAt();
    return { at, cap: ws ? slotOf(ws).cap : at.clone(), from: last, step: ws, slip: !last };
  }

  /** Short strand from the last stitch's top loop up to the loop on the hook. */
  function buildBridge(from, loopPts) {
    let best = loopPts[0]; let bd = Infinity;
    loopPts.forEach((p) => { const d = p.distanceToSquared(from); if (d < bd) { bd = d; best = p; } });
    const a = from.clone(); a.y = R;
    const mid1 = a.clone().lerp(best, 0.35); mid1.y += 0.06;
    const mid2 = a.clone().lerp(best, 0.7); mid2.y += 0.03;
    const curve = new THREE.CatmullRomCurve3([a, mid1, mid2, best], false, 'catmullrom', 0.5);
    bridge.geometry.dispose();
    bridge.geometry = yarnTube(curve, 16, R * 0.92, false);
    bridge.material = materialFor(game.currentYarn, 'neat');
    bridge.visible = true;
  }

  function buildSlipKnot(anchor) {
    const pts = [];
    for (let i = 0; i < 14; i += 1) {
      const th = (i / 14) * Math.PI * 2;
      pts.push(new THREE.Vector3(anchor.x + 0.23 * Math.cos(th), R + 0.03 * Math.sin(2 * th), anchor.z + 0.16 * Math.sin(th)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    slipKnot.geometry.dispose();
    slipKnot.geometry = yarnTube(curve, 24, R, true);
    slipKnot.material = materialFor(game.currentYarn, 'neat');
    slipKnot.visible = true;
  }

  /** Loop half-axes for a hold progress (brief: 0.2 -> 0.5 by 0.32 -> 0.8, opened a touch for the yarn). */
  const loopAxes = (progress) => ({ a: 0.24 + 0.28 * progress, b: 0.34 + 0.46 * progress });

  /** The working loop, in the hook's own frame (it is a child of hookBody): round the shaft LOOP_Y up
   *  from the throat, as 2D draws it (loopShape), so the crook below it is always in view. */
  function buildLoop(progress, zone, spin) {
    const { a, b } = loopAxes(progress);
    const local = [];
    for (let i = 0; i < 24; i += 1) {
      const th = (i / 24) * Math.PI * 2 + spin;
      local.push(new THREE.Vector3(a * Math.cos(th), LOOP_Y - 0.05 * (1 - Math.cos(th)), b * Math.sin(th)));
    }
    const curve = new THREE.CatmullRomCurve3(local, true, 'catmullrom', 0.5);
    loop.geometry.dispose();
    loop.geometry = yarnTube(curve, 32, R, true);
    loop.userData.pts = local.map(restToWorld);
    loopLight.position.copy(local[6]);
    loopLight.position.y += 0.2;
    // Colour steps with the hold zone, as in 2D.
    const yarn = yarnHex(game.currentYarn);
    let hex = yarn;
    if (zone === 'loose' || zone === 'tight') hex = mix(yarn, pal.surface3, 0.35);
    balanced(hex, loopMat.color);
    if (loopMat.sheenColor) balanced(mix(hex, '#ffffff', 0.35), loopMat.sheenColor);
    loopMat.emissive.set(zone === 'neat' ? mix(hex, pal.neat, 0.45) : hex);
    loopMat.emissiveIntensity = (dark ? 0.06 + 0.14 * progress : 0.08 * progress) + (zone === 'neat' ? 0.1 : 0);
    loopLight.color.set(yarn);
  }

  function buildWorkingYarn(fromHook) {
    const b = ballTarget();
    const start = fromHook
      ? restToWorld(new THREE.Vector3(loopAxes(loopProgressBuilt > 0 ? loopProgressBuilt : 0).a, LOOP_Y, 0))
      : (lastCap() || hookRest().at).clone();
    const hx = start.x; const hz = start.z;
    const bx = b.x; const bz = b.z; const rb = b.radius;
    // The yarn never crosses the work: off the loop it drops onto the empty mat just beyond the
    // current row's top loops, lies along it to the right margin, runs down the margin and up onto
    // the ball. A fastened-off tail leaves the last stitch the same way.
    const r = game.step ? game.step.row : lay.rows.length - 1;
    const zTop = rowZ(r) - lay.rows[r].height / CELL - 0.22;
    const edgeX = cols + 0.75;
    const y0 = R;
    const pts = [start];
    if (fromHook) pts.push(new THREE.Vector3(hx + 0.35, Math.max(0.3, start.y * 0.7), (hz + zTop) / 2));
    if (hx < edgeX - 1.6) {
      pts.push(new THREE.Vector3(hx + 1.0, y0, zTop));
      pts.push(new THREE.Vector3(edgeX - 0.6, y0, zTop));
    }
    const zMargin = Math.min(zTop + 0.7, (zTop + bz) / 2);
    pts.push(new THREE.Vector3(edgeX, y0, zMargin));
    pts.push(new THREE.Vector3(edgeX + 0.25, y0, Math.max(zMargin + 0.25, bz - rb * 0.9)));
    pts.push(new THREE.Vector3(bx - rb * 0.55, rb * 0.95, bz - rb * 0.35));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    workYarn.geometry.dispose();
    workYarn.geometry = yarnTube(curve, 64, R * 0.92, false);
    workYarn.material = materialFor(game.currentYarn, 'neat');
  }

  /** Move the hook, rebuild what hangs off it when it really moved; returns { moving, geometry }. */
  function syncHook(t, dt) {
    const active = game.active;
    const step = game.step;
    const rest = hookRest();
    const hold = active && rest.step ? getHold() : null;
    const target = rest.at.clone();
    let dip = 0;
    if (hold) {
      // Pull up a loop: the hook glides 0.6 of the way toward where the new top loop forms and dips.
      const p = clamp(hold.progress, 0, 1);
      target.lerp(rest.cap, 0.6 * p);
      dip = HOOK_DIP * p;
    }
    target.y += crookDepth + HOOK_LIFT - dip; // the bottom of the J rests on the top loop, the whole J in view
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt / 70);
    hookPos.lerp(target, k);
    if (hookPos.distanceToSquared(target) < 1e-7) hookPos.copy(target);
    hook.position.copy(hookPos);
    // The idle bob moves the hook (and the loop on it) inside the hook's group, so it never counts as
    // the hook moving: the working yarn and the bridge are rebuilt only on real moves and holds.
    hookBody.position.y = reducedMotion || LOW_POWER ? 0 : Math.sin(t / 320) * 0.05;
    hook.visible = active;
    hook.updateMatrixWorld(true);

    const foundationEmpty = step && step.row === 0 && game.rows[0].length === 0;
    if (foundationEmpty && !slipKnot.visible) buildSlipKnot(slipKnotAt());
    else if (!foundationEmpty) slipKnot.visible = false;

    const progress = hold ? clamp(hold.progress, 0, 1) : 0;
    const zone = hold ? hold.zone : null;
    const spinning = fx.spin && t - fx.spin.start < 160;
    const spin = spinning ? Math.PI * easeOut((t - fx.spin.start) / 160) : 0;
    const moved = hook.position.distanceToSquared(hookBuiltAt) > 1e-6;
    let rebuilt = false;
    if (active && (moved || hold || spinning || progress !== loopProgressBuilt || loopMat.userData.zone !== zone)) {
      buildLoop(progress, zone, spin);
      loopProgressBuilt = progress;
      loopMat.userData.zone = zone;
      rebuilt = true;
      const from = rest.from;
      if (from && loop.userData.pts) buildBridge(from, loop.userData.pts);
      else bridge.visible = false;
    }
    if (!active) bridge.visible = false;
    if (moved || hold || ball.userData.dirtyYarn) {
      buildWorkingYarn(active);
      ball.userData.dirtyYarn = false;
      rebuilt = true;
    }
    hookBuiltAt.copy(hook.position);
    return { moving: moved || rebuilt, bob: active && !reducedMotion && !LOW_POWER };
  }

  // ---------- events derived from game.idx ----------
  function syncEvents(t) {
    if (game.idx === lastIdx) return false;
    for (let i = lastIdx; i < game.idx; i += 1) {
      const st = game.steps[i];
      if (!st) break;
      if (st.type === 'stitch') fx.spin = { start: t };
      else if (st.type === 'turn') {
        fx.pulse = { start: t };
        if (framing === 'fit') followRow(st.row + 1, t); // pan on to the next row
        else fx.nudge = { start: t, dir: st.row % 2 === 0 ? 1 : -1 };
      } else if (st.type === 'yarn') { fx.roll = { start: t, from: ball.rotation.z }; ball.userData.dirtyYarn = true; }
      else if (st.type === 'finish') finish(t);
    }
    lastIdx = game.idx;
    return true;
  }

  function finish(t) {
    finishedAt = t;
    if (framing === 'fit' && fullFrame) followTo(fullFrame.target, fullFrame.d, t); // the whole piece for the completion turntable
    if (reducedMotion) return;
    const n = 120;
    const geo = new THREE.CapsuleGeometry(0.05, 0.22, 3, 6);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const inst = new THREE.InstancedMesh(geo, m, n);
    inst.castShadow = true;
    const rng = mulberry32(42);
    const parts = [];
    const colors = game.pattern.yarns.map((_, i) => new THREE.Color(yarnHex(i)));
    const origin = lastCap() || new THREE.Vector3(cols / 2, 0, -depth / 2);
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2; const s = 2 + rng() * 4;
      parts.push({
        p: new THREE.Vector3(origin.x + (rng() - 0.5) * 2, 0.5, origin.z + (rng() - 0.5) * 2),
        v: new THREE.Vector3(Math.cos(a) * s, 6 + rng() * 6, Math.sin(a) * s),
        r: new THREE.Euler(rng() * 6, rng() * 6, rng() * 6),
        w: new THREE.Vector3((rng() - 0.5) * 12, (rng() - 0.5) * 12, (rng() - 0.5) * 12),
      });
      inst.setColorAt(i, colors[i % colors.length]);
    }
    inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    fx.confetti = { inst, parts, start: t, last: t };
  }

  /** Turn pulse, camera nudge, frog curls, confetti, completion turntable; true while any runs. */
  function animateFx(t, dt) {
    const dts = dt / 1000;
    const busy = !!(fx.pulse || (fx.nudge && !freeCamera) || fx.follow || fx.flyers.length || fx.confetti || (fx.spin && t - fx.spin.start < 200));
    if (fx.follow) {
      // Pan (and dolly) the view: the camera moves with its target, so a view the player turned keeps
      // its angle; only where it looks, and from how far, change.
      const f = fx.follow;
      const u = reducedMotion ? 1 : clamp((t - f.start) / 600, 0, 1);
      const e = easeInOut(u);
      const tgt = f.fromT.clone().lerp(f.toT, e);
      const off = camera.position.clone().sub(controls.target);
      off.setLength(f.fromD + (f.toD - f.fromD) * e);
      controls.target.copy(tgt);
      camera.position.copy(tgt).add(off);
      homeTarget.copy(tgt);
      if (u >= 1) fx.follow = null;
    }
    if (fx.pulse) {
      const u = clamp((t - fx.pulse.start) / 300, 0, 1);
      const sx = reducedMotion ? 1 : 1 - 0.04 * Math.sin(u * Math.PI);
      fabric.scale.x = sx;
      fabric.position.x = (cols / 2) * (1 - sx);
      if (u >= 1) fx.pulse = null;
    }
    if (fx.nudge && !freeCamera) {
      const u = clamp((t - fx.nudge.start) / 600, 0, 1);
      const off = reducedMotion ? 0 : 0.3 * Math.sin(u * Math.PI) * fx.nudge.dir;
      controls.target.x = homeTarget.x + off;
      if (u >= 1) { controls.target.x = homeTarget.x; fx.nudge = null; }
    }
    fx.flyers = fx.flyers.filter((f) => {
      const u = (t - f.start) / 420;
      if (u >= 1) { scene.remove(f.mesh); f.mesh.geometry.dispose(); return false; }
      const b = ballTarget();
      const e = easeInOut(u);
      f.mesh.position.set(f.from.x + (b.x - f.from.x) * e, 0.2 + Math.sin(u * Math.PI) * 1.2, f.from.z + (b.z - f.from.z) * e);
      f.mesh.rotation.set(u * 9, u * 6, 0);
      return true;
    });
    if (fx.confetti) {
      const c = fx.confetti;
      const u = (t - c.start) / 1200;
      if (u >= 1) {
        scene.remove(c.inst); c.inst.geometry.dispose(); c.inst.material.dispose(); fx.confetti = null;
      } else {
        const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const sc = new THREE.Vector3(1, 1, 1);
        c.parts.forEach((p, i) => {
          p.v.y -= 14 * dts;
          p.p.addScaledVector(p.v, dts);
          if (p.p.y < 0.05) { p.p.y = 0.05; p.v.y *= -0.3; p.v.x *= 0.8; p.v.z *= 0.8; }
          p.r.x += p.w.x * dts; p.r.y += p.w.y * dts; p.r.z += p.w.z * dts;
          q.setFromEuler(p.r);
          m4.compose(p.p, q, sc);
          c.inst.setMatrixAt(i, m4);
        });
        c.inst.instanceMatrix.needsUpdate = true;
      }
    }
    if (finishedAt != null && !userMoved && !freeCamera && t - finishedAt > 3000 && !reducedMotion) controls.autoRotate = true;
    return busy || controls.autoRotate;
  }

  /** Fog from just beyond the work to the far table (brief at the default distance of ~20: dark
   *  28 -> 60, light 40 -> 80), kept relative to the camera's distance so a far phone camera does not
   *  fog the piece itself. */
  function placeFog() {
    if (!scene.fog) return;
    // Light: closes in by baseD + 60, before the table's edge (90 u behind the work) and before the
    // far wood turns to a bright band of grazing reflection at the horizon.
    scene.fog.near = baseD + (dark ? 8 : 20);
    scene.fog.far = baseD + (dark ? 40 : 60);
  }

  // ---------- camera ----------
  function frameCamera() {
    const aspect = camera.aspect || 1;
    const hFov = 2 * Math.atan(Math.tan((35 * DEG) / 2) * aspect);
    // "phone" framing is for a narrow portrait stage (3d.html on a phone); the game's mat on a phone is
    // landscape (about 340 x 250), which the 'fit' framing suits.
    const phone = phoneStage();
    // phone: a gentler turn and a higher view keep the work square and large in a narrow, tall frame
    const az = phone ? -12 : -25; const el = phone ? 62 : 40;
    controls.target.set(cols / 2, 0, -depth / 2);
    fullFrame = null;
    if (framing === 'fit' && !phone && lay) {
      // The game's mat (small, about 2:1): close enough that the row being worked fills ~60% of the
      // width (brief 9.7), at one distance for the whole project, the view panning to each new row
      // as the work is turned. The ball moves up beside the row being worked, so it is always in the
      // frame (its shrinking is the out-of-yarn cue). The whole piece comes back into view for the
      // completion turntable.
      const dFull = fitView(az, el, { mx: 0.95, my: 0.92, d0: 4, centre: true });
      fullFrame = { target: controls.target.clone(), d: clamp(dFull, 4, 60) };
      baseD = clamp(Math.max(...lay.rows.map((_, r) => rowFrame(r, az, el).d)), 4, 60);
      const r = game && game.step ? game.step.row : lay.rows.length - 1;
      controls.target.copy(game && game.status === 'done' ? fullFrame.target : rowFrame(r, az, el, baseD).target);
      if (game && game.status === 'done') baseD = fullFrame.d;
    } else if (framing === 'fit' || phone) {
      // As close as the whole final piece, the ball and the hook's crook allow, with that extent
      // centred in the frame (so a tall phone stage is filled, not letterboxed).
      baseD = clamp(fitView(az, el, { mx: phone ? 0.88 : 0.95, my: phone ? 0.9 : 0.92, d0: 4, centre: true, phone }), 4, 90);
    } else {
      // A big stage: the final width fills 60% of the frame (brief 9.7), backed off if need be.
      const d0 = clamp((1.05 * (Math.max(cols, 6) / 0.6)) / (2 * Math.tan(hFov / 2)), 8, 60);
      baseD = clamp(fitView(az, el, { mx: 0.96, my: 0.92, d0, centre: false }), 8, 60);
    }
    homeTarget.copy(controls.target);
    placeCamera(az, el, baseD);
    controls.minDistance = 0.6 * baseD;
    controls.maxDistance = 1.8 * baseD;
    controls.update();
    placeFog();
    invalidate(true);
  }

  /** Row r's band (turning chains to the right margin, two rows below it to just beyond it, at mat
   *  level and crook height) and the whole ball, which sits beside the row being worked. */
  function rowPoints(r) {
    const row = lay.rows[r];
    const z0 = rowZ(r); const z1 = z0 - row.height / CELL;
    const zn = Math.min(0.6, z0 + 1.8); const zf = z1 - 1.0;
    const pts = [];
    [-1.2, cols + 0.9].forEach((x) => [zn, zf].forEach((z) => [0, 1.0].forEach((y) => pts.push(new THREE.Vector3(x, y, z)))));
    return ballBoxPoints(ballZFor(r, 1), pts);
  }

  /** { target, d } framing row r: centred on its band; fitted to it, or at distance `dFixed`. */
  function rowFrame(r, az, el, dFixed = null) {
    const saved = controls.target.clone();
    const zc = rowZ(r) - lay.rows[r].height / CELL / 2;
    controls.target.set(cols / 2, 0, zc);
    const d = fitView(az, el, { mx: 0.95, my: 0.92, d0: 3, centre: true, pts: rowPoints(r), fixed: dFixed });
    const out = { target: controls.target.clone(), d };
    controls.target.copy(saved);
    return out;
  }

  /** Ease the view to frame row r (at the project's working distance). */
  function followRow(r, t) {
    if (!lay || r >= lay.rows.length || freeCamera) return;
    const az = -25; const el = 40;
    followTo(rowFrame(r, az, el, baseD).target, baseD, t);
  }

  function followTo(target, d, t) {
    if (freeCamera) return;
    fx.follow = { start: t, fromT: controls.target.clone(), toT: target.clone(), fromD: camera.position.distanceTo(controls.target), toD: d };
    fx.nudge = null;
  }

  /** The final piece's extent: turning chains to the ball, the foundation to the last row, at mat
   *  level and at the height of the hook's crook and loop (the hook's handle may leave the frame).
   *  'fit': the ball beside the first row and beside the last (it travels with the work). A phone
   *  stage also takes in the whole mat, so the frame is a composed table, not a cropped one. */
  function framePoints(phone) {
    const pts = [];
    [-1.2, cols + 0.9].forEach((x) => [0.6, -depth - 0.4].forEach((z) => [0, 1.0].forEach((y) => pts.push(new THREE.Vector3(x, y, z)))));
    if (ballFollows() && lay) {
      ballBoxPoints(ballZFor(0, 1), pts); ballBoxPoints(ballZFor(lay.rows.length - 1, 1), pts);
    } else {
      const bx = cols + (phone ? 3.6 : 3.4); // the ball (centre cols + 2.2, radius up to 1) with a margin
      [0.7, -2.3].forEach((z) => [0, 2].forEach((y) => pts.push(new THREE.Vector3(bx, y, z))));
    }
    if (phone) [-3, cols + 3].forEach((x) => [3, -depth - 3].forEach((z) => pts.push(new THREE.Vector3(x, 0, z))));
    return pts;
  }

  /**
   * The smallest distance >= d0 at which framePoints() project inside +-mx, +-my of the frame from
   * (azimuth, elevation); with `centre`, controls.target is also moved (on the table plane) so the
   * extent sits in the middle of the frame. Returns the distance.
   */
  function fitView(azDeg, elDeg, { mx, my, d0, centre, phone = false, pts: points = null, fixed = null }) {
    const az = azDeg * DEG; const el = elDeg * DEG;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const pts = points || framePoints(phone);
    const probe = new THREE.PerspectiveCamera(camera.fov, camera.aspect || 1, 0.1, 400);
    const v = new THREE.Vector3();
    const place = (d) => {
      probe.position.copy(controls.target).addScaledVector(dir, d);
      probe.lookAt(controls.target);
      probe.updateMatrixWorld();
    };
    const fits = () => pts.every((p) => { v.copy(p).project(probe); return Math.abs(v.x) <= mx && Math.abs(v.y) <= my; });
    const fitD = (from) => {
      if (fixed) return fixed;
      let d = from;
      for (let i = 0; i < 160; i += 1, d *= 1.02) { place(d); if (fits()) return d; }
      return d;
    };
    let d = fitD(d0);
    if (!centre) return d;
    const right = new THREE.Vector3(); const up = new THREE.Vector3();
    for (let pass = 0; pass < 4; pass += 1) {
      place(d);
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      pts.forEach((p) => { v.copy(p).project(probe); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); });
      const halfH = d * Math.tan((camera.fov * DEG) / 2); const halfW = halfH * probe.aspect;
      right.setFromMatrixColumn(probe.matrixWorld, 0); up.setFromMatrixColumn(probe.matrixWorld, 1);
      controls.target.addScaledVector(right, ((x0 + x1) / 2) * halfW).addScaledVector(up, ((y0 + y1) / 2) * halfH);
      controls.target.addScaledVector(dir, -controls.target.y / dir.y); // back onto the table along the view ray
      d = fitD(Math.max(d0, d * 0.8));
    }
    return d;
  }

  /** A portrait stage on a phone (3d.html): its own framing, the whole mat in view. */
  const phoneStage = () => container.clientWidth > 0 && container.clientWidth <= 600 && (camera.aspect || 1) < 1.2;

  /** The distance at which the whole extent (framePoints) stays in frame from every azimuth at
   *  elevation `elDeg`, round the current target: the turntable keeps the ball in at every angle. */
  let orbitMemo = { key: '', d: 0 };
  function orbitDistance(elDeg) {
    const key = [elDeg, baseD, camera.aspect, controls.target.x, controls.target.z, cols, depth].map((v) => (+v).toFixed(3)).join('|');
    if (orbitMemo.key === key) return orbitMemo.d;
    let d = baseD;
    const phone = phoneStage();
    for (let az = 0; az < 360; az += 15) d = Math.max(d, fitView(az, elDeg, { mx: 0.94, my: 0.9, d0: d, centre: false, phone }));
    orbitMemo = { key, d };
    return d;
  }

  function placeCamera(azDeg, elDeg, d) {
    const az = azDeg * DEG; const el = elDeg * DEG;
    const tg = controls.target;
    camera.position.set(tg.x + d * Math.sin(az) * Math.cos(el), tg.y + d * Math.sin(el), tg.z + d * Math.cos(az) * Math.cos(el));
    camera.lookAt(tg);
  }

  function aimLights() {
    const c = new THREE.Vector3(cols / 2, 0, -depth / 2);
    key.position.set(c.x - 12, 24, c.z + 10); key.target.position.copy(c);
    fill.position.set(c.x + 15, 12, c.z + 8); fill.target.position.copy(c);
    rim.position.set(c.x + 8, 10, c.z - 14); rim.target.position.copy(c);
    lamp.position.set(c.x - 6, 15, c.z + 5); lamp.target.position.set(c.x + 0.5, 0, c.z + 0.5);
    const ext = Math.max(cols, depth) / 2 + 5;
    const sc = key.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 80;
    sc.updateProjectionMatrix();
    table.position.set(c.x, -0.04, c.z);
  }

  // ---------- public API ----------
  function resize() {
    const w = container.clientWidth; const h = container.clientHeight;
    if (!w || !h) return;
    const prevAspect = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (!userMoved && !freeCamera && Math.abs(prevAspect - camera.aspect) > 1e-3) frameCamera();
    invalidate();
  }

  function setGame(g) {
    cache.forEach((e) => removeEntry(e));
    cache.clear();
    fx.flyers.forEach((f) => { scene.remove(f.mesh); f.mesh.geometry.dispose(); });
    fx.flyers = [];
    if (fx.confetti) { scene.remove(fx.confetti.inst); fx.confetti.inst.geometry.dispose(); fx.confetti.inst.material.dispose(); fx.confetti = null; }
    fx.pulse = null; fx.nudge = null; fx.roll = null; fx.spin = null;
    fabric.scale.set(1, 1, 1); fabric.position.set(0, 0, 0);
    game = g;
    lastIdx = g ? g.idx : 0;
    finishedAt = g && g.status === 'done' ? now() - 4000 : null;
    controls.autoRotate = false;
    userMoved = false;
    ball.userData.yarn = -1;
    ball.rotation.set(0, 0, 0);
    ballZ = null; ballTween = null;
    if (g) {
      lay = layout(g.pattern);
      cols = lay.cols;
      depth = lay.rows.reduce((s, r) => s + r.height, 0) / CELL;
    } else {
      lay = null; cols = 12; depth = 8;
    }
    // The yarn materials are cached by yarn index, and index 0 of the new project is another yarn
    // (the scarf's Teal, the coaster's Rose): recolour them, or a project started after another one
    // is worked in the previous project's colours.
    materials.forEach((m) => styleYarnMaterial(m));
    buildMat();
    aimLights();
    hook.visible = !!g; loop.visible = !!g; workYarn.visible = !!g; slipKnot.visible = false; ball.visible = !!g; bridge.visible = false;
    hookPos.set(cols / 2, 0.5, 0);
    hookBuiltAt.set(NaN, NaN, NaN);
    loopProgressBuilt = -1;
    placeWrongLight();
    if (g) {
      // Fill the cache before the first frame so an in-progress game appears fully built.
      const t = now();
      syncFabric(t);
      cache.forEach((e) => { e.born = t - 1000; });
      hookPos.copy(hookRest().at); hookPos.y += crookDepth + HOOK_LIFT;
    }
    freeCamera = false;
    controls.minAzimuthAngle = -70 * DEG; controls.maxAzimuthAngle = 20 * DEG;
    controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.25;
    frameCamera();
  }

  function setTheme(next) {
    if (next !== undefined) themeOpt = next;
    applyTheme();
  }

  /** Place the camera by angles (degrees) round `target` ([x, y, z] in cell units, 'hook', or the
   *  fabric centre by default). `free` lifts the orbit limits (turntable, screenshots). `distance`:
   *  units, null for the framing's own, or 'orbit' for one that keeps everything in at any azimuth. */
  function setCamera({ azimuth = -25, elevation = 40, distance = null, free = false, target = null } = {}) {
    freeCamera = free;
    controls.autoRotate = false;
    if (free) {
      controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = 0.02; controls.maxPolarAngle = 1.5;
      controls.minDistance = 1; controls.maxDistance = 4 * baseD;
    } else {
      controls.minAzimuthAngle = -70 * DEG; controls.maxAzimuthAngle = 20 * DEG;
      controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.25;
      controls.minDistance = 0.6 * baseD; controls.maxDistance = 1.8 * baseD;
    }
    if (target === 'hook') controls.target.set(hookPos.x, 0.3, hookPos.z);
    else if (Array.isArray(target)) controls.target.set(target[0], target[1], target[2]);
    else controls.target.set(cols / 2, 0, -depth / 2);
    homeTarget.copy(controls.target);
    const el = free ? clamp(elevation, 2, 89) : clamp(elevation, 18.4, 75.7);
    const d = distance === 'orbit' ? orbitDistance(el) : distance || baseD;
    if (free) controls.maxDistance = Math.max(controls.maxDistance, d * 1.2);
    placeCamera(azimuth, el, d);
    controls.update();
    invalidate();
  }

  function resetCamera() { userMoved = false; frameCamera(); }

  /** Turntable: slow orbit through a full circle. */
  function turntable(on, speed = 2) {
    if (on) {
      freeCamera = true;
      controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
      // back off far enough that the piece and the ball stay in frame all the way round
      const off = camera.position.clone().sub(controls.target);
      const el = Math.asin(clamp(off.y / off.length(), -1, 1)) / DEG;
      const d = Math.max(off.length(), orbitDistance(el));
      controls.maxDistance = Math.max(controls.maxDistance, d * 1.2);
      camera.position.copy(controls.target).add(off.setLength(d));
      controls.autoRotate = true;
      controls.autoRotateSpeed = speed;
      controls.update();
    } else {
      controls.autoRotate = false;
      controls.autoRotateSpeed = 0.3;
      freeCamera = false;
      controls.minAzimuthAngle = -70 * DEG; controls.maxAzimuthAngle = 20 * DEG;
    }
    invalidate();
  }

  /**
   * Advance the view to `now()` and draw it if anything changed: a move, a hold, a stitch growing or
   * unravelling, an effect, the camera (OrbitControls 'change', damping included), a resize or theme.
   * An idle hook only bobs, and that is drawn at most every IDLE_MS. Returns true if it rendered.
   */
  let renderedLast = false;  // did the previous update() render? (frame times are measured between two that did)
  function update() {
    const t = now();
    const rawDt = clamp(t - lastT, 0, 1000);
    const dt = Math.min(rawDt, 100);
    lastT = t;
    let moving = false; let geometry = false; let bob = false;
    if (game) {
      if (syncFabric(t)) geometry = true;
      if (syncEvents(t)) moving = true;
      if (syncBall(t)) geometry = true;
      const h = syncHook(t, dt);
      if (h.moving) geometry = true;
      bob = h.bob;
      if (animateStitches(t)) geometry = true;
    }
    if (animateFx(t, dt)) { moving = true; if (fx.pulse || fx.flyers.length || fx.confetti) geometry = true; }
    // Damping and the turntable by time, not per update: OrbitControls applies dampingFactor once a
    // call, so at 650 ms a frame a short drag would drift (and re-render) for half a minute.
    controls.dampingFactor = 1 - (1 - 0.08) ** (Math.max(4, rawDt) / 16.7);
    controls.update(Math.max(4, rawDt) / 1000); // dispatches 'change' (-> invalidate) while the camera moves or damps
    if (geometry) invalidate(true);
    else if (moving) invalidate();
    if (!dirty && !(bob && t - lastRenderAt >= IDLE_MS)) { renderedLast = false; return false; }
    render(t, dirty, renderedLast);
    renderedLast = true;
    return true;
  }

  const frameGaps = [];
  let lastRenderDirty = false;
  /** Draw now. `chained`: the previous update() drew too, so t - lastRenderAt is a frame time. */
  function render(t = now(), needed = true, chained = false) {
    camera.updateMatrixWorld();
    rimU.rimDir.value.copy(RIM_DIR).transformDirection(camera.matrixWorldInverse);
    if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
    renderer.render(scene, camera);
    // Frames drawn back to back (a hold, an orbit, a stitch growing) slower than ~40 fps: fewer
    // pixels, a step at a time (pixel shading is the cost), decided on 10 frames. Every such gap
    // counts, however long: on a slow device frames take far longer than 250 ms.
    if (needed && lastRenderDirty && chained && t - lastRenderAt < 2000) frameGaps.push(t - lastRenderAt);
    if (frameGaps.length >= 10) {
      const avg = frameGaps.reduce((a, b) => a + b, 0) / frameGaps.length;
      frameGaps.length = 0;
      if (avg > 24 && pixelRatio > MIN_PIXEL_RATIO) {
        pixelRatio = Math.max(MIN_PIXEL_RATIO, pixelRatio > 1.5 ? 1.5 : pixelRatio > 1 ? 1 : 0.75);
        renderer.setPixelRatio(pixelRatio);
        if (container.clientWidth && container.clientHeight) renderer.setSize(container.clientWidth, container.clientHeight, false);
        invalidate();
      }
    }
    lastRenderDirty = needed;
    lastRenderAt = t;
    dirty = false;
  }

  /**
   * Numbers for checking the build: per row, the x of the first/last body stitch (turning chains
   * excluded), its z, and the yarn name; plus where the hook rests and the slot it is working.
   */
  function inspect() {
    if (!game) return null;
    const rows = game.rows.map((placed, r) => {
      const xs = []; const yarns = new Set(); let z = null; const caps = [];
      placed.forEach((s) => {
        const e = cache.get(stitchKey(r, s));
        if (!e || e.dying != null) return;
        yarns.add(game.pattern.yarns[s.yarn] ? game.pattern.yarns[s.yarn].name : String(s.yarn));
        if (s.st === 'ch' && !lay.rows[r].foundation) return;
        xs.push(+(e.mesh.position.x).toFixed(3)); z = +(e.mesh.position.z).toFixed(3);
        if (!s.wrong) caps.push({ yarn: s.yarn, st: s.st, q: s.q, at: e.cap.toArray().map((v) => +v.toFixed(3)) });
      });
      return { row: r, n: placed.length, minX: xs.length ? Math.min(...xs) : null, maxX: xs.length ? Math.max(...xs) : null, z, yarns: [...yarns], caps };
    });
    const rest = hookRest();
    const ws = rest.step;
    return {
      rows,
      hook: { x: +hookPos.x.toFixed(3), z: +hookPos.z.toFixed(3), visible: hook.visible },
      rest: { x: +rest.at.x.toFixed(3), z: +rest.at.z.toFixed(3) },
      working: ws ? { row: ws.row, st: ws.st, i: ws.i } : null,
      crook: crookCover(),
      frame: frameInfo(),
      ball: ballBox(),
      pixelRatio: renderer.getPixelRatio(),
    };
  }

  /** The ball's projected box in canvas css px ({ x0, y0, x1, y1, w, h }: w, h = the canvas). */
  function ballBox() {
    if (!ball.visible) return null;
    camera.updateMatrixWorld();
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    const b = ballTarget();
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    const v = new THREE.Vector3();
    [-1, 1].forEach((sx) => [0, 2].forEach((sy) => [-1, 1].forEach((sz) => {
      v.set(b.x + sx * b.radius, sy * b.radius, b.z + sz * b.radius).project(camera);
      const px = ((v.x + 1) / 2) * w; const py = ((1 - v.y) / 2) * h;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    })));
    const r1 = (q) => +q.toFixed(1);
    return { x0: r1(x0), y0: r1(y0), x1: r1(x1), y1: r1(y1), w, h };
  }

  /** How much of the crook the camera sees: rays from the camera to points on the crook's surface
   *  that face it. `seen` = the share not hidden by anything (the loop, the shaft, the bridge, the
   *  stitches, a pin); `loop` and `stitches` = the shares hidden by the working loop and by the work. */
  function crookCover() {
    if (!hook.visible) return null;
    scene.updateMatrixWorld(true);
    const parts = hookHead.children.slice(1); // throat, lip, lip tip
    const work = fabric.children.filter((o) => o.isMesh || o.isGroup);
    const occluders = [loop, bridge, hookHead.children[0], ...parts, ...work];
    const rc = new THREE.Raycaster();
    const p = new THREE.Vector3(); const n = new THREE.Vector3(); const toCam = new THREE.Vector3();
    let seen = 0; let byLoop = 0; let byWork = 0; let total = 0;
    parts.forEach((m) => {
      const pos = m.geometry.attributes.position; const nor = m.geometry.attributes.normal;
      const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < pos.count; i += 3) {
        p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        toCam.copy(camera.position).sub(p);
        if (n.dot(toCam) <= 0) continue;                 // faces away from the camera
        total += 1;
        rc.set(camera.position, p.clone().sub(camera.position).normalize());
        const d = camera.position.distanceTo(p);
        const hit = rc.intersectObjects(occluders, true).find((h) => h.object.visible !== false);
        if (!hit || hit.distance >= d - 0.02 || parts.includes(hit.object)) { seen += 1; continue; }
        if (hit.object === loop) byLoop += 1;
        else if (hit.object !== bridge && hit.object !== hookHead.children[0]) byWork += 1;
      }
    });
    const share = (k) => (total ? +(k / total).toFixed(3) : 0);
    return { total, seen: share(seen), loop: share(byLoop), stitches: share(byWork) };
  }

  /** The final row's projected width as a share of the canvas width (brief 9.7: about 60%). */
  function frameInfo() {
    if (!lay) return null;
    camera.updateMatrixWorld();
    const zLast = rowZ(lay.rows.length - 1) - (lay.rows[lay.rows.length - 1].height / CELL) * 0.5;
    const a = new THREE.Vector3(0, 0, zLast).project(camera); const b = new THREE.Vector3(cols, 0, zLast).project(camera);
    const ext = [Infinity, -Infinity, Infinity, -Infinity];
    framePoints(phoneStage()).forEach((p) => {
      p.project(camera);
      ext[0] = Math.min(ext[0], p.x); ext[1] = Math.max(ext[1], p.x); ext[2] = Math.min(ext[2], p.y); ext[3] = Math.max(ext[3], p.y);
    });
    return { finalRowWidth: +(Math.abs(b.x - a.x) / 2).toFixed(3), aspect: +camera.aspect.toFixed(3), extent: ext.map((v) => +v.toFixed(3)) };
  }

  function screenshot(type = 'image/png') {
    render(now(), false);
    return canvas.toDataURL(type);
  }

  let raf = 0;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(container);
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const onMq = () => { if (themeOpt === 'auto') applyTheme(); };
  if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
  const mo = typeof MutationObserver === 'function'
    ? new MutationObserver(() => { if (themeOpt === 'auto') applyTheme(); }) : null;
  if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    if (mo) mo.disconnect();
    if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
    controls.dispose();
    cache.forEach((e) => removeEntry(e)); cache.clear();
    const shared = new Set(materials.values());
    scene.traverse((o) => {
      if (o.isLight && o.dispose) o.dispose(); // shadow map render targets
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        [].concat(o.material).forEach((m) => {
          if (shared.has(m)) return;            // the yarn materials are disposed once, below
          Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
          m.dispose();
        });
      }
    });
    // The pins were taken out of the scene with their stitches above: free their shared parts here.
    [pinShaftGeo, pinHeadGeo, pinShaftMat, pinHeadMat].forEach((x) => x.dispose());
    shared.forEach((m) => m.dispose()); materials.clear();
    Object.values(tex).forEach((t) => t && t.dispose && t.dispose());
    Object.values(themeTex).forEach(disposeTex);
    disposeTex(matTex.light); disposeTex(matTex.dark);
    if (envRT) envRT.dispose(); // the render target, not only its texture, holds the GPU memory
    scene.environment = null;
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  // ---------- boot ----------
  applyTheme();
  resize();
  setGame(initialGame);
  booted = true;
  // The boot is split over tasks so the page can paint in between (the 2D | 3D switch shows it is
  // busy): this one built the scene; next the programs compile (in parallel where the browser can),
  // then the big textures upload one per task, and only then is the first frame drawn.
  const nextTask = () => new Promise((r) => setTimeout(r, 0));
  let disposed = false;
  const ready = nextTask()
    .then(() => (disposed ? null : warm(true)))
    .then(async () => {
      const big = [tex.wood, tex.woodRough, matMat.map, matMat.normalMap, tex.bamboo, tex.yarnNormal, tex.yarnPly];
      for (const t of big) {
        if (disposed) return;
        try { if (t) renderer.initTexture(t); } catch { /* uploaded on first use */ }
        await nextTask();
      }
    })
    .catch(() => { /* drawn without the warm-up instead */ });
  if (autoLoop) {
    const loopFn = () => { update(); raf = requestAnimationFrame(loopFn); };
    ready.then(() => { if (!disposed) raf = requestAnimationFrame(loopFn); });
  }

  return {
    ready, // resolves once the programs are compiled and the textures uploaded: show the view then
    update, resize, setGame, setTheme, setCamera, resetCamera, turntable, screenshot, inspect, dispose,
    invalidate, // after changing the scene from outside (lights, materials): draw the next update()
    canvas, scene, camera, controls, renderer,
    get game() { return game; },
    get dark() { return dark; },
    get stitchCount() { return cache.size; },
    get lastRenderAt() { return lastRenderAt; },
  };
}

export { createView3D as createView3d };
