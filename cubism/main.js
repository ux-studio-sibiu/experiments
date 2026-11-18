// Cubism: a photo cut into screens by overlapping shapes. Every region the shapes make (inside some of them,
// outside the rest) is a screen: the same photo again, with its own move, rotation, scale and filters, like a
// cubist painting showing one subject from several views at once. Canvas 2D, no dependencies, render on demand.
import { saveImage, loadSavedImage, clearSavedImage } from './shared/saved-image.js';
import { bindCopyButton } from './shared/copy-button.js';
import { fineTune } from './shared/fine-tune.js';
import { OVERLAY_PATTERNS } from './vendor/randomize-studio/overlay-patterns.js';
import { arrangement, insideRings } from './geometry.js';

const DEFAULT_IMAGE = 'img/dacia.jpg';
// a region is named by the shapes it is inside: each shape's glyph, numbered when there are several of a kind
const GLYPH = { square: '■', circle: '●', triangle: '▲', rect: '▬', polygon: '⬟', line: '╱' };
const MAX_SHAPES = 30; // a shape is one bit of an area's mask, and the bits must fit a 32-bit number

// A screen's properties, in the panel's groups. PHOTO changes how the photo itself is drawn in the screen; STATIC
// and TEXTURE are overlays on top of it. The values here are "plain": the untouched photo, no overlays.
const PHOTO = { x: 0, y: 0, rot: 0, scale: 1, opacity: 1, blur: 0, hue: 0, sat: 1, bright: 1, contrast: 1, grey: 0, invert: 0, sepia: 0 };
const STATIC = { grain: 0, grainSize: 1.5, grainFps: 24, grainBlend: 'overlay' };
const TEXTURE = { pattern: '', patScale: 1, patOpacity: 0.6, patRotate: 0, patColour: '#000000', patBlend: 'source-over' };
const PLAIN = { ...PHOTO, ...STATIC, ...TEXTURE };
const GROUPS = { position: ['x', 'y', 'rot', 'scale', 'opacity'], colour: ['blur', 'hue', 'sat', 'bright', 'contrast', 'grey', 'invert', 'sepia'], static: ['grain'], texture: ['pattern'] };
// every value a group holds, which its reset puts back to plain
const GROUP_KEYS = { position: GROUPS.position, colour: GROUPS.colour, static: Object.keys(STATIC), texture: Object.keys(TEXTURE) };

// Every texture tile the toolkit has, copied in: the studio's 13 basic ones (vendor/randomize-studio/patterns/) and
// its 87 overlay tiles (vendor/randomize-studio/overlay-patterns/, Steve Schoger's Hero Patterns, CC BY 4.0; see
// README). Black (or currentColor) on transparent, tinted on use. A pattern's id is what a screen stores: the basic
// tiles keep their plain names, the overlay ones are "hero/<name>" (one name, "plus", exists in both sets).
const PATTERNS = [
  ...['checker', 'chevron', 'crosshatch', 'diagonal', 'diamonds', 'dots', 'grid', 'plus', 'polka', 'rings', 'scales', 'triangles', 'waves']
    .map(name => ({ id: name, name, url: `vendor/randomize-studio/patterns/${name}.svg` })),
  ...OVERLAY_PATTERNS.map(p => ({ id: `hero/${p.n}`, name: p.n, url: `vendor/randomize-studio/overlay-patterns/${p.n}.svg`, w: p.w, h: p.h }))
];
const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map(p => [p.id, p]));
const patternUrl = id => PATTERN_BY_ID[id]?.url;

// The opening composition: three shapes over the car and a screen for each region they make. Screens are keyed
// by mask, one bit per shape by its id: bit 0 the square, bit 1 the circle, bit 2 the triangle; 0 is the background
// outside them all. Shape positions are shares of the window (x of its width, y of its height), size a share of its
// shorter side. Drawn shapes (rect, polygon, line) carry their corners as points, in units of half the size, unturned;
// a trimmed shape carries cuts, the stretches of its outline taken away (see objectCurves).
const DEFAULTS = {
  outline: 2,
  outlineColour: '#111111',
  shapes: [
    { id: 0, type: 'square', x: 0.39, y: 0.57, size: 0.46, rot: 0.26 },
    { id: 1, type: 'circle', x: 0.51, y: 0.5, size: 0.5, rot: 0 },
    { id: 2, type: 'triangle', x: 0.45, y: 0.47, size: 0.56, rot: 0 }
  ],
  screens: {
    1: { rot: -6, scale: 1.08, hue: -12 },
    2: { x: -4, scale: 1.35, contrast: 1.2 },
    3: { rot: 14, scale: 1.5, sat: 1.5 },
    4: { rot: 8, scale: 0.9, grey: 1, contrast: 1.3 },
    5: { x: 6, y: -3, sepia: 0.6 },
    6: { rot: -20, scale: 1.8, hue: 140 },
    7: { rot: 30, scale: 2.4, bright: 1.15 }
  },
  selected: '7', // the picked screen's key (see measure)
  // which property groups and folding sections are open (Areas starts shut)
  open: { position: true, colour: false, static: false, texture: false, areas: false, layouts: true },
  // text items, each one screen whatever its letters: { id, text, x, y (shares of the window), size (letter height,
  // a share of the shorter side), rot }. They lie over the shapes' areas and don't cut them.
  texts: [],
  // the areas' names, by key, as typed in the layout view's Areas section; an area without one is called by its number
  areaNames: {},
  // a point inside each area (shares of the window), by key: what keeps an area's key, and with it its screen and name,
  // while its outlines are dragged (see measure)
  areaSpots: {},
  areaLabels: true, // the names written on the canvas in the layout view (the eye in the Areas header)
  template: null, // the name of the template this look was last saved as or loaded from
  help: false, // the info band under the titlebar, open or shut
  randomEffects: [], // the effects checked in the Randomize section (RANDOMIZE.effects names), which its dice rolls
  impact: 'small', // how many areas each rolled effect lands on (a RANDOMIZE.impact name)
  layout: false // the layout view, where the shapes are edited: zoomed out, the frame as a box, shapes free to run past it
};

// ---- state: the tab's copy (sessionStorage), else the defaults ----
const TAB_KEY = 'cubism:state';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function load(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}

// fill in every saved screen, so the controls always have a full set of values to show and change (screens not saved
// yet are made when their area first appears, see screenOf); a state saved before shapes had ids numbers them by place,
// which is the bit they always had
function fromStored(raw) {
  const base = structuredClone(DEFAULTS);
  const s = raw ? { ...base, ...raw } : base;
  const screens = {};
  for (const [key, sc] of Object.entries(s.screens ?? {})) screens[key] = { ...PLAIN, ...sc };
  const shapes = s.shapes.map(({ motion, ...shape }, i) => ({ ...shape, id: shape.id ?? i })); // movement is gone: drop what older states kept
  // keys are strings (an area can be "3.2"); a state saved when screens were plain mask numbers says 7, not "7"
  const selected = String(s.selected);
  delete s.editing; // a state saved when an editing / viewing switch existed: the layout view decides now
  delete s.motion; // a state saved when the shapes could drift
  if (s.randomEffect && !raw?.randomEffects) s.randomEffects = [s.randomEffect]; // a state from when one effect was picked
  delete s.randomEffect;
  return { ...s, shapes, screens, selected, open: { ...base.open, ...s.open }, texts: s.texts ?? [], areaNames: { ...s.areaNames }, areaSpots: { ...s.areaSpots } };
}

let state = fromStored(load(sessionStorage, TAB_KEY));

let keepTimer = 0;
function keep() {
  clearTimeout(keepTimer);
  keepTimer = setTimeout(() => { try { sessionStorage.setItem(TAB_KEY, JSON.stringify(state)); } catch {} }, 150);
}

// ---- canvas ----
const stage = document.querySelector('.stage');
const canvas = stage.querySelector('canvas');
const ctx = canvas.getContext('2d');
const hint = document.querySelector('.stage-hint');
const panel = document.querySelector('.panel');
const field = name => panel.querySelector(`[name="${name}"]`);

let W = 0, H = 0, dpr = 1;
let image = null;
let objectUrl = null;
let imageSource = null; // what the picture came from: a URL (the default, a random photo) or the uploaded File
let regions = []; // the regions that exist now: [{ mask, area, cx, cy }], centres in CSS px

function resize() {
  dpr = Math.min(window.devicePixelRatio, 2); // a 3x screen would draw 9x the pixels for no gain
  W = stage.clientWidth;
  H = stage.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  grainFrames.clear(); // noise is sized to the window
  measure();
  renderLayouts(); // the saved layouts' drawings take the window's shape
  requestRender();
}

// ---- shapes ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; // still grain, no zoom animation

// Only a closed polygon turns or scales as a whole: a circle turned looks the same, and lines, open chains and arcs
// are segments, edited through their nodes alone; a circle keeps the size it was drawn at.
const canTurn = s => s.type !== 'circle' && s.type !== 'line' && !s.open;

// A shape's own units: half its size on the window's shorter side (the circle's radius, the square's half-side).
// Its corners are points in those units, unturned, about its centre.
const radiusOf = s => (s.size * Math.min(W, H)) / 2;
const centreOf = s => ({ x: s.x * W, y: s.y * H });
const TAU = 2 * Math.PI;
const SQUARE = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // corner-first
const TRIANGLE = [0, 1, 2].map(i => [Math.cos(-Math.PI / 2 + (i * TAU) / 3) * 1.2, Math.sin(-Math.PI / 2 + (i * TAU) / 3) * 1.2]); // point-up
// a square or triangle whose corners were moved keeps its kind (and its screens) and carries its own points
const localPoints = s => s.points ?? (s.type === 'square' ? SQUARE : TRIANGLE);
// a line is open; so is any shape that had a piece of its outline trimmed away (open: true), which then runs from one
// cut end to the other through its remaining corners. It still covers its old inside when areas are named.
const isClosed = s => s.type !== 'line' && !s.open;

// the corners in window pixels: scaled, turned and moved
function corners(s) {
  const { x, y } = centreOf(s), r = radiusOf(s), a = s.rot, cos = Math.cos(a), sin = Math.sin(a);
  return localPoints(s).map(([px, py]) => [x + (px * cos - py * sin) * r, y + (px * sin + py * cos) * r]);
}

// is a point inside the shape: the circle by distance, a polygon by crossings (any polygon, convex or not); a line
// has no inside. The whole outline counts, trimmed or not: a trim changes the edges, not what the shape covers.
function contains(s, px, py) {
  if (s.type === 'line') return false;
  if (s.type === 'circle') {
    const { x, y } = centreOf(s);
    return Math.hypot(px - x, py - y) <= radiusOf(s);
  }
  return insideRings([corners(s)], px, py);
}

const maskAt = (px, py) => state.shapes.reduce((mask, s) => (contains(s, px, py) ? mask | (1 << s.id) : mask), 0);

// ---- trims: a shape's outline as a parameter u from 0 to 1 (a share of its length, or of the circle's turn), and
// its cuts as stretches [u0, u1] of it taken away. Shares stay put when the shape moves, turns or scales. ----
const polyLength = (points, closed) => {
  let sum = 0;
  for (let i = 0; i < (closed ? points.length : points.length - 1); i++) sum += Math.hypot(points[(i + 1) % points.length][0] - points[i][0], points[(i + 1) % points.length][1] - points[i][1]);
  return sum;
};

// the cuts sorted and merged, inside 0 .. 1 (a cut over the closed outline's start is split in two)
function mergeCuts(list, closed) {
  const flat = [];
  for (let [a, b] of list) {
    if (closed) {
      const lap = Math.floor(a);
      a -= lap;
      b -= lap;
      if (b > 1) { flat.push([0, Math.min(b - 1, 1)]); b = 1; }
    }
    flat.push([clamp(a, 0, 1), clamp(b, 0, 1)]);
  }
  flat.sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const [a, b] of flat) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged.filter(([a, b]) => b - a > 1e-6);
}

// what's left of the outline: the stretches between cuts (on a closed outline, the last and first join over its start)
function keptOf(s) {
  const kept = [];
  let at = 0;
  for (const [a, b] of s.cuts ?? []) {
    if (a - at > 1e-4) kept.push([at, a]);
    at = Math.max(at, b);
  }
  if (1 - at > 1e-4) kept.push([at, 1]);
  if (isClosed(s) && kept.length > 1 && kept[0][0] === 0 && kept[kept.length - 1][1] === 1) {
    const last = kept.pop();
    kept[0] = [last[0], 1 + kept[0][1]];
  }
  return kept;
}

// the stretch s0 .. s1 (in px along it) of a polyline; on a closed one s1 may run past its end and wrap
function subPolyline(points, closed, s0, s1) {
  const n = points.length, out = [];
  const push = p => { const last = out[out.length - 1]; if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) out.push(p); };
  let at = 0;
  for (let lap = 0; lap < (closed ? 2 : 1); lap++) {
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = points[i], b = points[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > 0 && at + len > s0 && at < s1) {
        const t0 = Math.max(0, (s0 - at) / len), t1 = Math.min(1, (s1 - at) / len);
        push([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0]);
        push([a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]);
      }
      at += len;
    }
  }
  return out;
}

// A shape as the curves geometry.js takes: its whole outline when uncut, else one open curve per stretch left. Each
// curve says which shape it is (id), where it starts on the outline (u0) and the outline's full length in px (L), so a
// piece of it found by the arrangement maps back to the outline: u = u0 + s / L.
function objectCurves(s) {
  const closed = isClosed(s), cut = s.cuts?.length > 0;
  if (s.type === 'circle') {
    const { x, y } = centreOf(s), r = radiusOf(s), a0 = s.rot, L = TAU * r;
    if (!cut) return [{ kind: 'arc', cx: x, cy: y, r, a0, a1: a0 + TAU, closed: true, id: s.id, u0: 0, L }];
    return keptOf(s).map(([u0, u1]) => ({ kind: 'arc', cx: x, cy: y, r, a0: a0 + u0 * TAU, a1: a0 + u1 * TAU, closed: false, id: s.id, u0, L }));
  }
  const points = corners(s), L = polyLength(points, closed);
  if (!cut) return [{ kind: 'poly', points, closed, id: s.id, u0: 0, L }];
  return keptOf(s).map(([u0, u1]) => ({ kind: 'poly', points: subPolyline(points, closed, u0 * L, u1 * L), closed: false, id: s.id, u0, L }));
}

// the shape's outline as drawn: what's left of it after its trims
function pathOf(s) {
  const path = new Path2D();
  for (const c of objectCurves(s)) {
    if (c.kind === 'arc') {
      path.moveTo(c.cx + c.r * Math.cos(c.a0), c.cy + c.r * Math.sin(c.a0));
      path.arc(c.cx, c.cy, c.r, c.a0, c.a1);
    } else {
      path.moveTo(...c.points[0]);
      for (let i = 1; i < c.points.length; i++) path.lineTo(...c.points[i]);
      if (c.closed) path.closePath();
    }
  }
  return path;
}

const pathOfPoints = points => {
  const path = new Path2D();
  path.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) path.lineTo(...points[i]);
  return path;
};

// distance from a point to a polyline, and to a curve (an arc's own stretch, or the nearer of its ends)
function polylineDistance(points, closed, px, py) {
  let best = Infinity;
  for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
    const t = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1), 0, 1);
    best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
  }
  return best;
}

function curveDistance(c, px, py) {
  if (c.kind === 'poly') return polylineDistance(c.points, c.closed, px, py);
  const along = (((Math.atan2(py - c.cy, px - c.cx) - c.a0) % TAU) + TAU) % TAU;
  if (along <= c.a1 - c.a0) return Math.abs(Math.hypot(px - c.cx, py - c.cy) - c.r);
  return Math.min(...[c.a0, c.a1].map(a => Math.hypot(px - c.cx - c.r * Math.cos(a), py - c.cy - c.r * Math.sin(a))));
}

// a shape's name: its glyph, with a small number when there are several of its kind ("●₂")
const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';
function labelOf(s) {
  const same = state.shapes.filter(o => o.type === s.type);
  if (same.length < 2) return GLYPH[s.type];
  return GLYPH[s.type] + String(same.indexOf(s) + 1).replace(/\d/g, d => SUBSCRIPT[d]);
}
const TYPE_NAME = { square: 'square', circle: 'circle', triangle: 'triangle', rect: 'rectangle', polygon: 'polygon', line: 'line' };

// ---- the view: zoom 1 is the window as it is; the layout view shrinks it to a framed box in a larger workspace ----
// Everything is still drawn and edited in window pixels (the "world"); only the camera changes: the world is scaled
// by view.zoom and centred. Sizes that should look the same on screen whatever the zoom (handles, grab zones, hairlines)
// go through screenPx.
const LAYOUT_ZOOM = 0.6;
const WORKSPACE = '#1c1c1e';
const view = { zoom: 1 };
const offsetX = () => (W * (1 - view.zoom)) / 2;
const offsetY = () => (H * (1 - view.zoom)) / 2;
const screenPx = n => n / view.zoom;
let offFrame = []; // areas lying wholly outside the frame (layout view labels them): [{ key, ix, iy }]

// The outlines as edges, the closed areas they make (geometry.js), and from those the screens. An area's key is
// the shapes it is inside (its mask, read at a point surely inside it) and, when that combination falls into several
// separate pieces, the piece's rank by size: "3", "3.2", "3.3"... Enclosed areas inside no shape ("gaps") are "0.1",
// "0.2"...; "0" is the open background. Keying by mask keeps a screen's settings while shapes move, and keeps every
// screen saved before areas existed, since a mask on its own is the key it always had.
function pathOfRings(rings) {
  const path = new Path2D();
  for (const ring of rings) {
    path.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
    path.closePath();
  }
  return path;
}

let faces = []; // every area, in frame or not: [{ key, mask, rings, area, cx, cy, ix, iy, box, path }]
let curves = []; // every shape's outline as curves (objectCurves), as the arrangement last took them
let pieces = []; // the outlines cut at every crossing: [{ curve, s0, s1, points }], what the trim tool picks from

// The frame's edge is an edge like any other: it cuts every outline crossing it, so a piece runs to the frame and no
// further (the trim tool cuts it back to there), and every area is cut in two by it, the part in the frame and the
// part outside. It is not a shape: nothing is inside it for naming, and it can't be grabbed or trimmed.
const FRAME = 'frame';
const frameCurve = () => ({ kind: 'poly', points: [[0, 0], [W, 0], [W, H], [0, H]], closed: true, id: FRAME });

let measureCount = 0; // bumped on every measure: what was snapped to may have moved

function measure() {
  if (!W || !H) return;
  measureCount++;
  curves = [...state.shapes.flatMap(objectCurves), frameCurve()];
  const found = arrangement(curves);
  pieces = found.pieces.filter(p => curves[p.curve].id !== FRAME);
  // in the frame (it can be seen), or outside it (the layout view labels those "off-frame"): the frame cuts every
  // area, so a point inside an area tells which side all of it is on
  const inFrame = f => f.ix > 0 && f.ix < W && f.iy > 0 && f.iy < H;
  faces = found.faces.map(f => ({ ...f, mask: maskAt(f.ix, f.iy), shown: inFrame(f) }));

  // Keys: by mask, plus a piece number when a combination falls into several pieces ("3", "3.2"; inside no shape "0",
  // the background, then the gaps "0.1", "0.2"...). A piece keeps the key it had: each area's spot (a point inside it,
  // as shares of the window) is kept in state.areaSpots, and a piece holding an old spot of its mask takes that key,
  // so its screen and name stay with it however its outlines are dragged, and across reloads. What is left pairs up
  // with the nearest spot left; a piece new to that mask takes the first free key, ranked in the frame first, then
  // biggest first (which is the whole rule on a first visit: the background is then the biggest area inside no shape).
  const keyFor = (mask, i) => (i === 0 ? String(mask) : mask ? `${mask}.${i + 1}` : `0.${i}`);
  const spots = Object.entries(state.areaSpots).map(([key, [x, y]]) => ({ key, mask: Number(key.split('.')[0]), x: x * W, y: y * H }));
  const byMask = new Map();
  for (const f of faces) byMask.set(f.mask, [...(byMask.get(f.mask) ?? []), f]);
  for (const [mask, list] of byMask) {
    list.sort((a, b) => b.shown - a.shown || b.area - a.area);
    const old = spots.filter(o => o.mask === mask), taken = new Set();
    for (const f of list) {
      const hit = old.find(o => !taken.has(o.key) && insideRings(f.rings, o.x, o.y));
      if (hit) { f.key = hit.key; taken.add(hit.key); }
    }
    for (const f of list) {
      if (f.key) continue;
      const near = old.filter(o => !taken.has(o.key)).sort((a, b) => Math.hypot(a.x - f.ix, a.y - f.iy) - Math.hypot(b.x - f.ix, b.y - f.iy))[0];
      if (near) { f.key = near.key; taken.add(near.key); continue; }
      let i = 0;
      while (taken.has(keyFor(mask, i))) i++;
      f.key = keyFor(mask, i);
      taken.add(f.key);
    }
  }
  state.areaSpots = Object.fromEntries(faces.map(f => [f.key, [+(f.ix / W).toFixed(4), +(f.iy / H).toFixed(4)]]));
  for (const f of faces) f.path = pathOfRings(f.rings);
  const background = faces.find(f => f.key === '0' && f.shown);
  if (background) Object.assign(background, { cx: W / 2, cy: H / 2 }); // the background turns about the frame's centre

  offFrame = faces.filter(f => !f.shown);
  const piece = key => Number(key.split('.')[1] ?? 0);
  regions = faces.filter(f => f.shown).sort((a, b) => a.mask - b.mask || piece(a.key) - piece(b.key)); // "0.2" before "0.10"
  // every text item in the frame is one more screen, drawn over the areas (key "t" + its id)
  for (const t of state.texts) {
    const b = textBox(t);
    if (Math.abs(b.cx - W / 2) < W / 2 + b.reach && Math.abs(b.cy - H / 2) < H / 2 + b.reach) regions.push({ key: textKey(t), text: t, cx: b.cx, cy: b.cy, ix: b.cx, iy: b.cy, area: b.w * b.h });
  }

  // the picked screen's area vanished (its shapes no longer overlap): pick the biggest one left
  if (!regions.some(r => r.key === state.selected) && regions.length) state.selected = [...regions].sort((a, b) => b.area - a.area)[0].key;
  renderScreenPick();
  renderAreas();
}

// The screen settings for a key, made the first time an area with that key appears: a piece that split off ("3.2")
// starts as a copy of its combination's main piece ("3"), so a region falling into two still looks as it did, and
// each piece can then be changed on its own; anything else starts plain.
function screenOf(key) {
  if (!state.screens[key]) {
    const [mask, piece] = String(key).split('.');
    state.screens[key] = piece && mask !== '0' ? { ...screenOf(mask) } : { ...PLAIN };
  }
  return state.screens[key];
}

// the screen under a point: a text item's (the topmost whose box holds it), else the area whose rings contain it, else
// the background
function faceAt(x, y) {
  for (let i = state.texts.length - 1; i >= 0; i--) if (insideText(state.texts[i], x, y)) return textKey(state.texts[i]);
  for (const r of regions) if (!r.text && r.key !== '0' && insideRings(r.rings, x, y)) return r.key;
  return '0';
}

// ---- text: one screen per item, its letters the mask. Not vertices: the letters are drawn, never traced. ----
const TEXT_FONT = '"Archivo", "Helvetica Neue", Arial, sans-serif';
const textKey = t => `t${t.id}`;
const fontOf = px => `900 ${px}px ${TEXT_FONT}`;
const measurer = document.createElement('canvas').getContext('2d');

// the item's box in window pixels: centre, width and height of its letters, turn, and how far it reaches from its centre
function textBox(t) {
  const px = t.size * Math.min(W, H);
  measurer.font = fontOf(px);
  const w = Math.max(measurer.measureText(t.text || ' ').width, px * 0.3), h = px * 0.8;
  return { cx: t.x * W, cy: t.y * H, w, h, rot: t.rot, px, reach: Math.hypot(w, h) / 2 };
}

// a point in the item's own frame: unturned, about its centre
function textLocal(t, x, y) {
  const b = textBox(t), cos = Math.cos(-b.rot), sin = Math.sin(-b.rot), dx = x - b.cx, dy = y - b.cy;
  return { lx: dx * cos - dy * sin, ly: dx * sin + dy * cos, b };
}

function insideText(t, x, y) {
  const { lx, ly, b } = textLocal(t, x, y);
  return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
}

// the letters, filled (or stroked) on a context in world coordinates
function letters(g, t, stroke) {
  const b = textBox(t);
  g.save();
  g.translate(b.cx, b.cy);
  g.rotate(b.rot);
  g.font = fontOf(b.px);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) g.strokeText(t.text, 0, b.px * 0.04);
  else g.fillText(t.text, 0, b.px * 0.04); // 'middle' sits a little high for capitals
  g.restore();
}

// A text screen is painted whole on a layer of its own (the photo with the screen's move, filters and overlays), then
// cut to its letters with destination-in, and the layer laid over the picture.
const textLayer = document.createElement('canvas');
const tg = textLayer.getContext('2d');
function drawTextScreen(r, cover, now) {
  if (textLayer.width !== canvas.width || textLayer.height !== canvas.height) { textLayer.width = canvas.width; textLayer.height = canvas.height; }
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.clearRect(0, 0, textLayer.width, textLayer.height);
  tg.setTransform(ctx.getTransform());
  paintScreen(tg, screenOf(r.key), r, cover, now);
  tg.globalCompositeOperation = 'destination-in';
  tg.fillStyle = '#000000';
  letters(tg, r.text);
  tg.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(textLayer, 0, 0);
  ctx.restore();
}

// the box and handles of a text item in the layout view: scale just past its lower right corner, turn above it
function textHandles(t) {
  const b = textBox(t), cos = Math.cos(b.rot), sin = Math.sin(b.rot);
  const at = (lx, ly) => ({ x: b.cx + lx * cos - ly * sin, y: b.cy + lx * sin + ly * cos });
  const k = Math.hypot(b.w / 2, b.h / 2), out = (k + screenPx(SCALE_GAP)) / k;
  return {
    corners: [at(-b.w / 2, -b.h / 2), at(b.w / 2, -b.h / 2), at(b.w / 2, b.h / 2), at(-b.w / 2, b.h / 2)],
    scale: at((b.w / 2) * out, (b.h / 2) * out),
    rotate: at((b.w / 2) * out, (-b.h / 2) * out), // past the upper-right corner, as a shape's
    top: at(b.w / 2, -b.h / 2)
  };
}

// ---- drawing ----
let frame = 0;
function requestRender() {
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); });
}

// the photo sized to cover the window, centred
function coverRect() {
  const s = Math.max(W / image.naturalWidth, H / image.naturalHeight);
  const w = image.naturalWidth * s, h = image.naturalHeight * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

const plainPhoto = sc => Object.keys(PHOTO).every(k => sc[k] === PHOTO[k]);

// ---- static: TV-snow noise, one frame per cell size and fps, shared by every screen using that pair ----
const grainFrames = new Map(); // `${cell}|${fps}` -> { canvas, time }

// A small canvas of random grey, one pixel per cell, stretched over the window with smoothing off: crisp blocks,
// and far fewer pixels to fill than the window. Regenerated only when its fps says a new frame is due.
function grainCanvas(cell, fps, now) {
  const key = `${cell}|${fps}`;
  const frame = grainFrames.get(key);
  const due = !frame || (fps > 0 && !reducedMotion && now - frame.time >= 1000 / fps);
  if (!due) return frame.canvas;
  const canvas = frame?.canvas ?? document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(W / cell));
  canvas.height = Math.max(1, Math.ceil(H / cell));
  const g = canvas.getContext('2d');
  const noise = g.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < noise.data.length; i += 4) {
    const v = Math.random() * 255;
    noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v;
    noise.data[i + 3] = 255;
  }
  g.putImageData(noise, 0, 0);
  grainFrames.set(key, { canvas, time: now });
  return canvas;
}

// While any visible screen has moving grain, keep drawing at the fastest fps asked for; stop when none does.
let grainLoop = 0;
function animateGrain() {
  const moving = !reducedMotion && regions.some(r => screenOf(r.key).grain > 0 && screenOf(r.key).grainFps > 0);
  if (moving && !grainLoop) grainLoop = requestAnimationFrame(function tick() { grainLoop = 0; requestRender(); });
}

// ---- texture: the studio's SVG tiles, loaded once, then tinted and scaled into a canvas pattern ----
const tileImages = new Map(); // name -> <img>
function tileImage(name) {
  let img = tileImages.get(name);
  if (!img) {
    img = new Image();
    img.onload = requestRender;
    img.src = patternUrl(name);
    tileImages.set(name, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const tiles = new Map(); // `${name}|${scale}|${colour}|${dpr}` -> the tinted tile canvas
function patternFor(sc) {
  const img = tileImage(sc.pattern);
  if (!img) return null;
  const key = `${sc.pattern}|${sc.patScale}|${sc.patColour}|${dpr}`;
  let tile = tiles.get(key);
  if (!tile) {
    if (tiles.size > 60) tiles.clear(); // dragging the scale slider makes a tile per step: don't hoard them
    tile = document.createElement('canvas');
    // drawn at device pixels, so a 2x screen gets a sharp tile rather than a stretched one
    tile.width = Math.max(1, Math.round(img.naturalWidth * sc.patScale * dpr));
    tile.height = Math.max(1, Math.round(img.naturalHeight * sc.patScale * dpr));
    const g = tile.getContext('2d');
    g.drawImage(img, 0, 0, tile.width, tile.height);
    g.globalCompositeOperation = 'source-in'; // keep the tile's shape, take the colour
    g.fillStyle = sc.patColour;
    g.fillRect(0, 0, tile.width, tile.height);
    tiles.set(key, tile);
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  pattern.setTransform(new DOMMatrix().rotate(sc.patRotate).scale(1 / dpr)); // back to CSS px, then turned
  return pattern;
}

function filterOf(sc) {
  const parts = [];
  if (sc.blur) parts.push(`blur(${sc.blur}px)`);
  if (sc.hue) parts.push(`hue-rotate(${sc.hue}deg)`);
  if (sc.sat !== 1) parts.push(`saturate(${sc.sat})`);
  if (sc.bright !== 1) parts.push(`brightness(${sc.bright})`);
  if (sc.contrast !== 1) parts.push(`contrast(${sc.contrast})`);
  if (sc.grey) parts.push(`grayscale(${sc.grey})`);
  if (sc.invert) parts.push(`invert(${sc.invert})`);
  if (sc.sepia) parts.push(`sepia(${sc.sepia})`);
  return parts.join(' ') || 'none';
}

// One screen painted on g, already clipped (or about to be masked) to its area: the photo again, moved, then turned
// and scaled around the area's own centre, filtered; then the overlays, which sit still over the screen whatever its
// picture does: the pattern, then the grain.
function paintScreen(g, sc, r, cover, now) {
  if (!plainPhoto(sc) || r.text) {
    g.save();
    g.globalAlpha = sc.opacity;
    g.filter = filterOf(sc);
    g.translate(r.cx + (sc.x / 100) * W, r.cy + (sc.y / 100) * H);
    g.rotate((sc.rot * Math.PI) / 180);
    g.scale(sc.scale, sc.scale);
    g.translate(-r.cx, -r.cy);
    g.drawImage(image, cover.x, cover.y, cover.w, cover.h);
    g.restore();
  }
  const pattern = sc.pattern && sc.patOpacity > 0 ? patternFor(sc) : null;
  g.save();
  if (pattern) {
    g.globalAlpha = sc.patOpacity;
    g.globalCompositeOperation = sc.patBlend;
    g.fillStyle = pattern;
    g.fillRect(0, 0, W, H);
  }
  if (sc.grain > 0) {
    g.globalAlpha = sc.grain;
    g.globalCompositeOperation = sc.grainBlend;
    g.imageSmoothingEnabled = false; // crisp cells
    g.drawImage(grainCanvas(sc.grainSize, sc.grainFps, now), 0, 0, W, H);
  }
  g.restore();
}

// Clip to one area: its own boundary from the arrangement, holes included (even-odd). The background's path is the
// frame with every area cut out.
function clipRegion(region) {
  ctx.clip(region.path, 'evenodd');
}

function draw() {
  const zoom = view.zoom;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = zoom < 1 ? WORKSPACE : '#000000';
  ctx.fillRect(0, 0, W, H);
  // from here on, world coordinates (window pixels), scaled into the view
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * offsetX(), dpr * offsetY());
  if (zoom < 1) drawGrid();
  if (!image) return;

  const cover = coverRect();
  const paths = state.shapes.map(pathOf);

  // the picture exists inside the frame only: in the layout view, what's outside the box is never seen
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(image, cover.x, cover.y, cover.w, cover.h); // the plain photo, under every screen and in its gaps

  const now = performance.now();
  for (const r of regions) {
    if (r.text) { drawTextScreen(r, cover, now); continue; } // a text item: always drawn, its letters are its edge
    const sc = screenOf(r.key);
    if (plainPhoto(sc) && !(sc.pattern && sc.patOpacity > 0) && !(sc.grain > 0)) continue;
    ctx.save();
    clipRegion(r);
    paintScreen(ctx, sc, r, cover, now);
    ctx.restore();
  }
  // the text items' letters outlined, as the shapes are (thinner on small letters)
  if (state.outline > 0) {
    ctx.save();
    ctx.strokeStyle = state.outlineColour;
    ctx.lineJoin = 'round';
    for (const t of state.texts) {
      ctx.lineWidth = Math.min(state.outline, textBox(t).px * 0.04);
      letters(ctx, t, true);
    }
    ctx.restore();
  }
  ctx.restore(); // the frame's clip
  animateGrain();

  // the outlines: inside the frame as drawn; in the layout view they also run on past it, dimmed, so a shape pushed
  // mostly off the frame can still be seen and grabbed
  if (state.outline > 0) {
    ctx.save();
    ctx.lineWidth = state.outline;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.outlineColour === '#000000' || state.outlineColour === '#111111' ? '#8a8a8e' : state.outlineColour;
    if (zoom < 1) {
      ctx.globalAlpha = 0.45; // on the dark workspace a near-black line would vanish: a grey stand-in, dimmed
      for (const path of paths) ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = state.outlineColour;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    for (const path of paths) ctx.stroke(path);
    ctx.restore();
  }

  if (zoom < 1) drawFrame();
  if (editingShown()) drawEditing(paths);
  if (zoom < 1) drawRegionLabels();
}

// ---- the layout view's workspace: a faint grid, the frame with its size, and every region named ----
function drawGrid() {
  const step = 40;
  const x0 = -offsetX() / view.zoom, x1 = (W - offsetX()) / view.zoom;
  const y0 = -offsetY() / view.zoom, y1 = (H - offsetY()) / view.zoom;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = screenPx(1);
  ctx.beginPath();
  for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
  ctx.restore();
}

function drawFrame() {
  ctx.save();
  ctx.lineWidth = screenPx(1.5);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(0, 0, W, H);
  ctx.font = `700 ${screenPx(10)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`FRAME ${Math.round(W)} × ${Math.round(H)}`, 0, -screenPx(6));
  ctx.restore();
}

// each area's name (from the Areas section) large at its centre, black letters in a white halo; off-frame areas get a
// small chip saying so. The area whose row is focused or hovered in the panel lights up.
function drawRegionLabels() {
  const font = size => `700 ${screenPx(size)}px "JetBrains Mono", ui-monospace, monospace`;
  const label = (text, x, y, size, dim) => {
    ctx.font = font(size);
    const w = ctx.measureText(text).width + screenPx(size * 0.8), h = screenPx(size * 1.5);
    ctx.globalAlpha = dim ? 0.6 : 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y + screenPx(size * 0.05));
  };
  const haloed = (text, x, y, size) => {
    ctx.font = font(size);
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.lineWidth = screenPx(size * 0.3);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y);
  };
  ctx.save();
  const lit = areasNow().find(r => r.key === litArea);
  if (lit) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill(lit.path, 'evenodd');
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // at a point surely inside each area (its centroid can fall outside a curved or holed one)
  if (state.areaLabels) areasNow().forEach((r, i) => haloed(areaName(r.key, i), r.ix, r.iy, 30));
  for (const r of offFrame) label(`${nameOf(r.key)} off-frame`, r.ix, r.iy, 10, true);
  ctx.restore();
}

// ---- the layout view's edit overlay: the shapes dashed, their nodes and handles ----
const HANDLE = 7; // half the size of a handle, and how close the pointer must come to grab one
const SCALE_GAP = 16; // how far past its corner the scale handle sits
const NODE = 4; // half the size of a node (a corner, a line's end, a circle's centre)
const SNAP = 10; // how close the pointer must come to snap to a node, an edge, or to grab a node
const TRIM_RED = '#ff3b30';

// The corner the scale handle sits on, in the shape's own units: of its farthest corners, the one nearest the lower
// right (the square's first, the triangle's second, a line's end); 45 degrees round the circle.
function scaleCorner(s) {
  if (s.type === 'circle') return [Math.SQRT1_2, Math.SQRT1_2];
  return cornerToward(localPoints(s), Math.PI / 4);
}

// The corner the rotate handle sits on: likewise, the one nearest the upper right (the square's, the triangle's top),
// never the scale handle's own corner.
function rotateCorner(s) {
  const scale = scaleCorner(s);
  return cornerToward(localPoints(s).filter(p => p !== scale), -Math.PI / 4);
}

// of the corners farthest out (within 10%), the one whose direction from the centre is nearest the angle
function cornerToward(points, angle) {
  const far = Math.max(...points.map(p => Math.hypot(...p)));
  const off = ([x, y]) => Math.abs(Math.atan2(Math.sin(Math.atan2(y, x) - angle), Math.cos(Math.atan2(y, x) - angle)));
  const outer = points.filter(p => Math.hypot(...p) > far * 0.9);
  return (outer.length ? outer : points).sort((a, b) => off(a) - off(b))[0];
}

function handlesOf(s) {
  const { x, y } = centreOf(s), r = radiusOf(s), turn = s.rot, cos = Math.cos(turn), sin = Math.sin(turn);
  const at = ([px, py], d) => ({ x: x + (px * cos - py * sin) * d, y: y + (px * sin + py * cos) * d });
  // scale and rotate: each just past its corner, outward from the centre, so the corner itself stays free to be
  // dragged as a node
  const past = p => (Math.hypot(...p) * r + screenPx(SCALE_GAP)) / Math.hypot(...p);
  const sk = scaleCorner(s), rk = canTurn(s) ? rotateCorner(s) : null;
  // radius (circles and arcs only): a diamond just outside the outline, in the middle of what's left of it (45 degrees
  // round a whole circle); dragging it offsets the outline in or out about the same centre, as Archicad's offset
  let radius = null;
  if (s.type === 'circle') {
    const kept = keptOf(s), mid = s.cuts?.length && kept.length ? (kept[0][0] + kept[0][1]) / 2 : 0.125;
    const a = turn + mid * TAU, d = r + screenPx(SCALE_GAP);
    radius = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, edge: { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r } };
  }
  return {
    radius,
    // only a closed polygon has these (see canTurn)
    scale: canTurn(s) ? at(sk, past(sk)) : null,
    rotate: rk ? at(rk, past(rk)) : null,
    top: rk ? at(rk, r) : null, // the rotate handle's stem starts at its corner
    turnFrom: rk ? Math.atan2(rk[1], rk[0]) : 0 // the corner's direction in the shape's own frame
  };
}

// a path drawn solid and bright over everything: a black line under a thinner white (or red) one
function strokeBright(path, colour = '#ffffff') {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = screenPx(5);
  ctx.strokeStyle = '#000000';
  ctx.stroke(path);
  ctx.lineWidth = screenPx(2.5);
  ctx.strokeStyle = colour;
  ctx.stroke(path);
  ctx.restore();
}

function drawEditing(paths) {
  ctx.save();
  ctx.lineWidth = screenPx(1);
  ctx.setLineDash([screenPx(6), screenPx(4)]);
  for (const path of paths) {
    ctx.strokeStyle = '#000000';
    ctx.lineDashOffset = 0;
    ctx.stroke(path);
    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = screenPx(5);
    ctx.stroke(path);
  }
  ctx.restore();

  if (tool === 'select' && !hoveredPiece) {
    // the outline in hand (Delete removes it) and the one the pointer is on, solid and bright: what a drag would move
    for (const s of new Set([drag?.shape, hovered, shapeById(activeId)].filter(Boolean))) strokeBright(pathOf(s));
    drawHandles();
    if (drag?.kind === 'radius') drawOffset(drag.shape, drag.r0);
  }
  // trim: the piece under the pointer, in red: what a click cuts away
  if (hoveredPiece) strokeBright(pathOfPoints(hoveredPiece.points), TRIM_RED);
  drawTexts();
  if (draft) drawDraft();
  if (snapMark) drawSnapMark(snapMark);
}

// while a radius is dragged: the outline it started as, dashed faint, and the radius with the offset so far beside
// the handle ("r 180 · -24"), in window px
function drawOffset(s, r0) {
  const c = centreOf(s), h = handlesOf(s).radius, r = radiusOf(s), d = Math.round(r - r0);
  ctx.save();
  ctx.lineWidth = screenPx(1);
  ctx.setLineDash([screenPx(2), screenPx(4)]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `700 ${screenPx(11)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  const text = `r ${Math.round(r)} · ${d > 0 ? '+' : ''}${d}`, x = h.x + screenPx(HANDLE + 6), y = h.y;
  ctx.lineJoin = 'round';
  ctx.lineWidth = screenPx(4);
  ctx.strokeStyle = '#000000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// each text item's box dashed, the picked one bright, with its scale and turn handles (select tool only)
function drawTexts() {
  for (const t of state.texts) {
    const h = textHandles(t), box = pathOfPoints([...h.corners, h.corners[0]].map(p => [p.x, p.y]));
    if (t.id === activeText || t === hoveredText) strokeBright(box);
    ctx.save();
    ctx.lineWidth = screenPx(1);
    ctx.setLineDash([screenPx(6), screenPx(4)]);
    ctx.strokeStyle = '#000000';
    ctx.stroke(box);
    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = screenPx(5);
    ctx.stroke(box);
    ctx.restore();
    if (tool !== 'select') continue;
    const hs = screenPx(HANDLE);
    ctx.save();
    ctx.lineWidth = screenPx(2);
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(h.top.x, h.top.y);
    ctx.lineTo(h.rotate.x, h.rotate.y);
    ctx.stroke();
    ctx.fillRect(h.scale.x - hs, h.scale.y - hs, hs * 2, hs * 2);
    ctx.strokeRect(h.scale.x - hs, h.scale.y - hs, hs * 2, hs * 2);
    ctx.beginPath();
    ctx.arc(h.rotate.x, h.rotate.y, hs, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawHandles() {
  // the nodes: a small square on every corner and line end, a cross on a circle's centre; the one under the pointer bigger
  ctx.save();
  ctx.lineWidth = screenPx(1.5);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';
  for (const s of state.shapes) {
    for (const n of nodesOf(s)) {
      const hs = screenPx(hoveredNode?.shape === s && hoveredNode.node === n.i ? NODE + 2 : NODE);
      if (n.i === -1) {
        ctx.beginPath();
        ctx.moveTo(n.x - hs, n.y); ctx.lineTo(n.x + hs, n.y);
        ctx.moveTo(n.x, n.y - hs); ctx.lineTo(n.x, n.y + hs);
        ctx.lineWidth = screenPx(3); ctx.stroke();
        ctx.lineWidth = screenPx(1.5); ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.strokeStyle = '#000000';
      } else {
        const picked = activeNode?.id === s.id && activeNode.node === n.i; // the node Delete would remove: filled black
        ctx.fillStyle = picked ? '#000000' : '#ffffff';
        ctx.strokeStyle = picked ? '#ffffff' : '#000000';
        ctx.fillRect(n.x - hs, n.y - hs, hs * 2, hs * 2);
        ctx.strokeRect(n.x - hs, n.y - hs, hs * 2, hs * 2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
      }
    }
  }
  ctx.restore();

  ctx.save();
  ctx.lineWidth = screenPx(2);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';
  for (const s of state.shapes) {
    const h = handlesOf(s);
    const hs = screenPx(HANDLE); // the same size on screen at any zoom
    if (h.radius) {
      // a circle's or arc's radius: a diamond on a short stem out from the outline
      ctx.beginPath();
      ctx.moveTo(h.radius.edge.x, h.radius.edge.y);
      ctx.lineTo(h.radius.x, h.radius.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h.radius.x, h.radius.y - hs); ctx.lineTo(h.radius.x + hs, h.radius.y);
      ctx.lineTo(h.radius.x, h.radius.y + hs); ctx.lineTo(h.radius.x - hs, h.radius.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (!canTurn(s)) continue; // a segment or a circle has no scale or turn handle
    ctx.fillRect(h.scale.x - hs, h.scale.y - hs, hs * 2, hs * 2);
    ctx.strokeRect(h.scale.x - hs, h.scale.y - hs, hs * 2, hs * 2);
    ctx.beginPath(); // the rotate handle's stem
    ctx.moveTo(h.top.x, h.top.y);
    ctx.lineTo(h.rotate.x, h.rotate.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(h.rotate.x, h.rotate.y, hs, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// the shape being drawn: its outline as it would be made, or a polygon's corners so far and the rubber band to the
// pointer, its first corner ringed once a click there would close it
function drawDraft() {
  const dot = (x, y, size) => {
    const hs = screenPx(size);
    ctx.fillRect(x - hs, y - hs, hs * 2, hs * 2);
    ctx.strokeRect(x - hs, y - hs, hs * 2, hs * 2);
  };
  ctx.save();
  ctx.lineWidth = screenPx(1.5);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';
  if (draft.type === 'polygon') {
    strokeBright(pathOfPoints([...draft.points, draft.hover]));
    const [fx, fy] = draft.points[0];
    if (draft.points.length >= 3) {
      ctx.beginPath();
      ctx.arc(fx, fy, screenPx(HANDLE + 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const [x, y] of draft.points) dot(x, y, 3.5);
  } else {
    const shape = shapeFromDraft(draft);
    if (shape) strokeBright(pathOf(shape));
    dot(draft.x0, draft.y0, 3); // where the drag began: a line's end, a rectangle's corner, the circle's centre
  }
  ctx.restore();
}

// ---- pointer: the layout view draws, trims, moves, scales and turns shapes; full size moves the picked screen's picture ----
function hitHandle(px, py) {
  for (let i = state.shapes.length - 1; i >= 0; i--) {
    const h = handlesOf(state.shapes[i]);
    if (h.radius && Math.hypot(px - h.radius.x, py - h.radius.y) <= screenPx(HANDLE + 3)) return { kind: 'radius', shape: state.shapes[i] };
    if (!h.scale) continue;
    if (Math.hypot(px - h.scale.x, py - h.scale.y) <= screenPx(HANDLE + 3)) return { kind: 'scale', shape: state.shapes[i] };
    if (h.rotate && Math.hypot(px - h.rotate.x, py - h.rotate.y) <= screenPx(HANDLE + 3)) return { kind: 'rotate', shape: state.shapes[i] };
  }
  return null;
}

// A shape is grabbed by its outline only, within EDGE px either side of the line; its inside belongs to the screens.
// A trimmed outline is grabbed by what's left of it.
const EDGE = 10;

// the shape whose outline is nearest the pointer, if one is within reach
function hitShape(px, py) {
  let hit = null, nearest = screenPx(EDGE); // the grab zone stays EDGE px on screen at any zoom
  for (const c of curves) {
    if (c.id === FRAME) continue;
    const d = curveDistance(c, px, py);
    if (d <= nearest) { nearest = d; hit = { kind: 'move', shape: shapeById(c.id) }; }
  }
  return hit?.shape ? hit : null;
}

// the piece of outline nearest the pointer (between two crossings, or a crossing and a loose end), if within reach
function hitPiece(px, py) {
  let hit = null, nearest = screenPx(EDGE);
  for (const p of pieces) {
    const d = polylineDistance(p.points, false, px, py);
    if (d <= nearest) { nearest = d; hit = p; }
  }
  return hit;
}

// the pointer in world coordinates: back through the view's offset and zoom
const local = e => {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - offsetX()) / view.zoom, y: (e.clientY - rect.top - offsetY()) / view.zoom };
};

let drag = null;
let hovered = null; // the shape whose outline or handle is under the pointer (layout view only)
let hoveredPiece = null; // the piece the trim tool would cut
let activeId = null; // the shape last taken in hand: Delete removes it
let tool = 'select';
let draft = null; // a shape being drawn: { type, x0, y0, x1, y1 }, or a polygon's { type, points, hover }
const shapeById = id => state.shapes.find(s => s.id === id) ?? null;

// with Shift held, a point on a 15 degree step round where its line starts
function snapAngle(x0, y0, x, y, e) {
  if (!e.shiftKey) return [x, y];
  const step = Math.PI / 12, a = Math.round(Math.atan2(y - y0, x - x0) / step) * step, len = Math.hypot(x - x0, y - y0);
  return [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len];
}

// a drawn draft as a shape (centre, size, turn, corners in its own units), or null while it is too small to keep
function shapeFromDraft(d) {
  const shorter = Math.min(W, H), least = screenPx(4);
  const at = (x, y, unit) => ({ x: x / W, y: y / H, size: (2 * unit) / shorter });
  if (d.type === 'line') {
    const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
    if (len < least) return null;
    return { type: 'line', ...at((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, len / 2), rot: Math.atan2(d.y1 - d.y0, d.x1 - d.x0), points: [[-1, 0], [1, 0]] };
  }
  if (d.type === 'rect') {
    const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
    if (Math.min(w, h) < least) return null;
    const unit = Math.max(w, h) / 2, a = w / 2 / unit, b = h / 2 / unit; // exact, not rounded: a corner snapped onto another must land on it
    return { type: 'rect', ...at((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, unit), rot: 0, points: [[a, b], [-a, b], [-a, -b], [a, -b]] };
  }
  if (d.type === 'circle') {
    const r = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
    return r < least ? null : { type: 'circle', ...at(d.x0, d.y0, r), rot: 0 };
  }
  // a polygon: about the middle of its corners' box, in units of its farthest corner
  const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const unit = Math.max(...d.points.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  if (unit < least) return null;
  return { type: 'polygon', ...at(cx, cy, unit), rot: 0, points: d.points.map(([x, y]) => [(x - cx) / unit, (y - cy) / unit]) };
}

function newId() {
  for (let id = 0; id < MAX_SHAPES; id++) if (!state.shapes.some(s => s.id === id)) return id;
  return null;
}

function addShape(shape) {
  const id = newId();
  if (id === null) { say(`At most ${MAX_SHAPES} shapes: delete one to draw another`); return; }
  remember();
  state.shapes.push({ id, ...shape });
  activeId = id;
  shapesChanged();
}

function deleteShape(id) {
  if (!shapeById(id)) return;
  remember();
  state.shapes = state.shapes.filter(s => s.id !== id);
  shapesChanged();
}

// The stretches [u0, u1] of a cornered shape's outline as open chains of corners in its own units: where a stretch
// starts and stops, a new corner. Those cut ends are real nodes from then on, to drag, join or delete like any corner.
function chainsOf(s, kept) {
  const pts = localPoints(s), closed = isClosed(s), L = polyLength(pts, closed);
  return kept.map(([u0, u1]) => subPolyline(pts, closed, u0 * L, u1 * L)).filter(chain => chain.length >= 2);
}

// The shape cut down to the chains left: it keeps the first (opened), and any other becomes a shape of its own, the
// same kind, as Archicad splits a polyline trimmed in its middle. Returns false when none is left.
function splitIntoChains(s, chains, shapes, nextId) {
  if (!chains.length) return false;
  s.points = chains[0];
  if (s.type !== 'line') s.open = true;
  delete s.cuts;
  for (const chain of chains.slice(1)) {
    const id = nextId();
    if (id === null) break; // no ids left: the rest of it is dropped
    shapes.push({ ...structuredClone(s), id, points: chain });
  }
  return true;
}

// cut a piece out of its shape's outline; a shape with nothing left of it is gone. A circle keeps its cuts (what's
// left is arcs, their ends nodes that slide round it); a cornered shape opens into chains.
function trimPiece(piece) {
  const c = curves[piece.curve], s = shapeById(c?.id);
  if (!s) return;
  remember();
  const a = c.u0 + piece.s0 / c.L, b = c.u0 + piece.s1 / c.L;
  if (s.type === 'circle') {
    s.cuts = mergeCuts([...(s.cuts ?? []), [a, b]], true);
    if (!keptOf(s).length) state.shapes = state.shapes.filter(o => o !== s);
  } else {
    const kept = isClosed(s) ? [[b, a + 1]] : [[0, a], [b, 1]];
    const before = state.shapes.length;
    if (!splitIntoChains(s, chainsOf(s, kept.filter(([u0, u1]) => u1 - u0 > 1e-6)), state.shapes, newId)) state.shapes = state.shapes.filter(o => o !== s);
    else for (const o of [s, ...state.shapes.slice(before)]) recentre(o);
  }
  activeNode = null;
  shapesChanged();
}

// A state or template saved when cornered shapes kept their trims as cuts: open them into chains, as a trim does now.
function openTrimmed(shapes) {
  const nextId = () => { for (let id = 0; id < MAX_SHAPES; id++) if (!shapes.some(o => o.id === id)) return id; return null; };
  for (const s of [...shapes]) {
    if (s.type === 'circle' || !s.cuts?.length) continue;
    if (!splitIntoChains(s, chainsOf(s, keptOf(s)), shapes, nextId)) shapes.splice(shapes.indexOf(s), 1);
  }
  return shapes;
}

function finishPolygon() {
  const shape = draft.points.length >= 3 ? shapeFromDraft(draft) : null;
  draft = null;
  if (shape) addShape(shape);
  else requestRender();
}

// after any change to the set of shapes or their geometry: areas, panel and undo buttons follow
function shapesChanged() {
  hovered = null;
  hoveredText = null;
  if (!state.texts.some(t => t.id === activeText)) activeText = null;
  screenPickKey = ''; // a text's option carries its words
  showTextField();
  hoveredNode = null;
  hoveredPiece = null;
  if (!shapeById(activeId)) activeId = null;
  const nodeShape = shapeById(activeNode?.id);
  if (activeNode && (!nodeShape || !nodesOf(nodeShape).some(n => n.i === activeNode.node))) activeNode = null;
  measure();
  showUndo();
  requestRender();
  keep();
}

// ---- undo / redo: the shapes as they were before each change, up to 100 steps (screens and the rest are not in it) ----
const history = [], future = [];
const undoButton = panel.querySelector('.shapes-undo');
const redoButton = panel.querySelector('.shapes-redo');

const snapshot = () => structuredClone({ shapes: state.shapes, texts: state.texts });
const restore = snap => { state.shapes = snap.shapes; state.texts = snap.texts; };

function remember() {
  history.push(snapshot());
  if (history.length > 100) history.shift();
  future.length = 0;
  showUndo();
}

function undo() {
  if (!history.length) return;
  draft = null;
  future.push(snapshot());
  restore(history.pop());
  shapesChanged();
}

function redo() {
  if (!future.length) return;
  draft = null;
  history.push(snapshot());
  restore(future.pop());
  shapesChanged();
}

// a reset or a loaded template starts the history afresh: undo goes back through edits, not across looks
function forget() {
  history.length = 0;
  future.length = 0;
  showUndo();
}

function showUndo() {
  undoButton.disabled = !history.length;
  redoButton.disabled = !future.length;
}

undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);

// ---- text items in the layout view: placed with the text tool, moved by their box, scaled and turned by handles ----
let activeText = null; // the picked text item's id: the words field edits it, Delete removes it
let hoveredText = null;
const textField = field('text-content');
const textRow = textField.closest('.row');

function hitText(x, y) {
  if (tool !== 'select') return null;
  for (let i = state.texts.length - 1; i >= 0; i--) {
    const t = state.texts[i], h = textHandles(t);
    if (Math.hypot(x - h.scale.x, y - h.scale.y) <= screenPx(HANDLE + 3)) return { kind: 'textScale', text: t };
    if (Math.hypot(x - h.rotate.x, y - h.rotate.y) <= screenPx(HANDLE + 3)) return { kind: 'textRotate', text: t };
  }
  for (let i = state.texts.length - 1; i >= 0; i--) if (insideText(state.texts[i], x, y)) return { kind: 'textMove', text: state.texts[i] };
  return null;
}

// pick a text item (or none); typing straight away goes into its words when asked
function pickText(id, focus) {
  activeText = id;
  showTextField();
  if (focus && id !== null) { textField.focus(); textField.select(); }
  requestRender();
}

// the words field shows in the shapes section while a text item is picked
function showTextField() {
  const t = state.texts.find(o => o.id === activeText);
  textRow.hidden = !t || !editingShown();
  if (t && document.activeElement !== textField) textField.value = t.text;
}

function addText(x, y) {
  remember();
  let id = 0;
  while (state.texts.some(t => t.id === id)) id++;
  state.texts.push({ id, text: 'Text', x: x / W, y: y / H, size: 0.16, rot: 0 });
  // a new text screen starts visibly apart from the photo around it
  state.screens[`t${id}`] = { ...PLAIN, scale: 1.6, contrast: 1.25, bright: 1.1 };
  shapesChanged();
  pickText(id, true);
}

function deleteText(id) {
  remember();
  state.texts = state.texts.filter(t => t.id !== id);
  activeText = null;
  shapesChanged();
}

// typing the words: one undo step per visit to the field
textField.addEventListener('focus', () => { if (activeText !== null) remember(); });
textField.addEventListener('input', () => {
  const t = state.texts.find(o => o.id === activeText);
  if (!t) return;
  t.text = textField.value;
  screenPickKey = '';
  measure();
  requestRender();
  keep();
});
textField.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') textField.blur(); });

// ---- tools: the chips in the shapes section, and a key each ----
const TOOL_KEYS = { v: 'select', l: 'line', r: 'rect', c: 'circle', p: 'polygon', x: 'text', t: 'trim' };

function setTool(name) {
  tool = name;
  hoveredText = null;
  draft = null;
  snapMark = null;
  hoveredNode = null;
  hovered = null;
  hoveredPiece = null;
  for (const radio of panel.querySelectorAll('[name="tool"]')) radio.checked = radio.value === name;
  // the shapes are edited in the layout view: picking a drawing tool goes there (select alone, or Esc, doesn't)
  if (name !== 'select' && !state.layout) {
    setLayout(true);
    keep();
  }
  showMode();
  requestRender();
}

for (const radio of panel.querySelectorAll('[name="tool"]')) radio.addEventListener('change', () => setTool(radio.value));

window.addEventListener('keydown', e => {
  if (e.target.matches?.('input[type="text"], textarea')) return; // typing a template name
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
    e.preventDefault();
    if (key === 'y' || e.shiftKey) redo();
    else undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (draft) { draft = null; requestRender(); } else setTool('select');
  } else if (e.key === 'Enter' && draft?.type === 'polygon') {
    finishPolygon();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (draft?.type === 'polygon') {
      draft.points.pop(); // the last corner
      if (!draft.points.length) draft = null;
      requestRender();
    } else if (editingShown() && activeText !== null) {
      deleteText(activeText);
    } else if (editingShown() && activeNode) {
      deleteNode(shapeById(activeNode.id), activeNode.node);
    } else if (editingShown() && activeId !== null) {
      deleteShape(activeId);
    }
  } else if (TOOL_KEYS[key] && !e.repeat) {
    setTool(TOOL_KEYS[key]);
  }
});

// ---- nodes and snapping, as in Archicad: a shape's corners (a line's ends, a circle's centre) are nodes. Dragging one
// moves that corner alone, and a dragged node or a drawn point snaps to the other shapes' nodes, to crossings and to
// edges, the frame's included; a node dropped on another node joins it, and from then on dragging either moves both.
// Alt moves freely: no snapping, and a joined node comes away on its own. ----
let snapMark = null; // what the point in hand is snapped to: { x, y, kind: 'node' | 'crossing' | 'edge' }, drawn as a sign
let hoveredNode = null; // the node under the pointer: { shape, node }

// a shape's nodes in window pixels: [{ x, y, i }], i the corner's index (a circle's centre is i = -1)
// A trimmed circle's arcs end in nodes too, i = -(10 + 2k + e) for arc k's start (e 0) or end (e 1).
const arcEnd = (k, e) => -(10 + 2 * k + e);
function nodesOf(s) {
  if (s.type === 'circle') {
    const c = centreOf(s), r = radiusOf(s), a0 = s.rot, nodes = [{ x: c.x, y: c.y, i: -1 }];
    if (s.cuts?.length) keptOf(s).forEach(([u0, u1], k) => [u0, u1].forEach((u, e) => nodes.push({ x: c.x + r * Math.cos(a0 + u * TAU), y: c.y + r * Math.sin(a0 + u * TAU), i: arcEnd(k, e) })));
    return nodes;
  }
  return corners(s).map(([x, y], i) => ({ x, y, i }));
}

function hitNode(px, py) {
  let hit = null, nearest = screenPx(NODE + 4);
  for (let k = state.shapes.length - 1; k >= 0; k--) {
    for (const n of nodesOf(state.shapes[k])) {
      const d = Math.hypot(px - n.x, py - n.y);
      if (d < nearest) { nearest = d; hit = { kind: 'node', shape: state.shapes[k], node: n.i }; }
    }
  }
  return hit;
}

// What can be snapped to, for every shape not in hand: their nodes, the frame's corners, every crossing and loose end
// among them (the arrangement of those shapes alone), and their edges. Kept until the shapes change.
let snapCache = null;
function snapTargets(exclude = new Set()) {
  const key = `${measureCount}|${[...exclude].join(',')}`;
  if (snapCache?.key === key) return snapCache;
  const others = state.shapes.filter(s => !exclude.has(s.id));
  const edges = [...others.flatMap(objectCurves), frameCurve()];
  const nodes = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => ({ x, y, kind: 'node' }));
  for (const s of others) for (const n of nodesOf(s)) nodes.push({ x: n.x, y: n.y, kind: 'node' });
  for (const p of arrangement(edges).pieces) for (const [x, y] of [p.points[0], p.points[p.points.length - 1]]) nodes.push({ x, y, kind: 'crossing' });
  return (snapCache = { key, nodes, edges });
}

// the nearest point of a curve, or null (a point off the end of an arc's stretch)
function nearestOnCurve(c, px, py) {
  if (c.kind === 'arc') {
    const a = Math.atan2(py - c.cy, px - c.cx);
    if ((((a - c.a0) % TAU) + TAU) % TAU > c.a1 - c.a0) return null;
    const x = c.cx + c.r * Math.cos(a), y = c.cy + c.r * Math.sin(a);
    return { x, y, d: Math.hypot(px - x, py - y) };
  }
  let best = null;
  const n = c.points.length;
  for (let i = 0; i < (c.closed ? n : n - 1); i++) {
    const [ax, ay] = c.points[i], [bx, by] = c.points[(i + 1) % n];
    const t = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1), 0, 1);
    const x = ax + t * (bx - ax), y = ay + t * (by - ay), d = Math.hypot(px - x, py - y);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}

// a node or crossing within reach wins (nodes first: they're listed first); else a point on the nearest edge
function snapPoint(x, y, targets) {
  let best = null, nearest = screenPx(SNAP);
  for (const n of targets.nodes) {
    const d = Math.hypot(x - n.x, y - n.y);
    if (d < nearest) { nearest = d; best = n; }
  }
  if (best) return { ...best };
  nearest = screenPx(SNAP * 0.8);
  for (const c of targets.edges) {
    const p = nearestOnCurve(c, x, y);
    if (p && p.d < nearest) { nearest = p.d; best = { x: p.x, y: p.y, kind: 'edge' }; }
  }
  return best;
}

// a point being drawn: snapped (and the sign shown), else on Shift's 15 degree steps from the point before it
function drawPoint(x, y, e, from) {
  snapMark = e.altKey ? null : snapPoint(x, y, snapTargets());
  if (snapMark) return [snapMark.x, snapMark.y];
  return from ? snapAngle(from[0], from[1], x, y, e) : [x, y];
}

// ---- moving a node: the corner set from a point in window pixels, back through the shape's turn, size and centre ----
function setNode(s, i, wx, wy) {
  if (i === -1) { s.x = wx / W; s.y = wy / H; return; } // a circle's centre moves the circle
  if (i <= -10) return slideArcEnd(s, i, wx, wy);
  const c = centreOf(s), r = radiusOf(s), a = -s.rot, dx = wx - c.x, dy = wy - c.y;
  const points = localPoints(s).map(p => [...p]);
  points[i] = [(dx * Math.cos(a) - dy * Math.sin(a)) / r, (dx * Math.sin(a) + dy * Math.cos(a)) / r];
  s.points = points;
}

// An arc's end slides round its circle, to the angle of the point: the arcs are what's kept, and the cuts are re-made
// as the gaps between them (two arcs dragged into each other become one).
function slideArcEnd(s, i, wx, wy) {
  const k = Math.floor((-i - 10) / 2), e = (-i - 10) % 2, kept = keptOf(s);
  const c = centreOf(s), a0 = s.rot;
  const u = ((((Math.atan2(wy - c.y, wx - c.x) - a0) / TAU) % 1) + 1) % 1;
  const [u0, u1] = kept[k];
  if (e === 0) kept[k][0] = u1 - ((((u1 - u) % 1) + 1) % 1 || 1); // behind the arc's end, round the way it runs
  else kept[k][1] = u0 + ((((u - u0) % 1) + 1) % 1 || 1);
  const gaps = kept.map(([, end], j) => [end, j + 1 < kept.length ? kept[j + 1][0] : kept[0][0] + 1]);
  s.cuts = mergeCuts(gaps.filter(([g0, g1]) => g1 - g0 > 1e-6), true);
}

function sideLengths(points, closed) {
  const n = points.length, lens = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) lens.push(Math.hypot(points[(i + 1) % n][0] - points[i][0], points[(i + 1) % n][1] - points[i][1]));
  return lens;
}

// ---- adding and removing nodes ----
let activeNode = null; // the node last pressed: { id, node }, what Delete removes

// a point in window pixels as the shape's own units (unturned, about its centre)
function toLocal(s, wx, wy) {
  const c = centreOf(s), r = radiusOf(s), a = -s.rot, dx = wx - c.x, dy = wy - c.y;
  return [(dx * Math.cos(a) - dy * Math.sin(a)) / r, (dx * Math.sin(a) + dy * Math.cos(a)) / r];
}

// Double-click on an edge: a new corner there, on the side nearest the pointer, so the side can be bent. The outline
// doesn't change shape, so trims (shares of its length) stay exactly where they were. A circle has no sides to split.
function insertNode(s, wx, wy) {
  if (s.type === 'circle') { say('A circle has no corners to add: draw a polygon for a bent outline'); return; }
  const pts = corners(s), n = pts.length, sides = isClosed(s) ? n : n - 1;
  let best = null;
  for (let i = 0; i < sides; i++) {
    const p = nearestOnCurve({ kind: 'poly', points: [pts[i], pts[(i + 1) % n]], closed: false }, wx, wy);
    if (!best || p.d < best.d) best = { ...p, i };
  }
  if (Math.min(Math.hypot(best.x - pts[best.i][0], best.y - pts[best.i][1]), Math.hypot(best.x - pts[(best.i + 1) % n][0], best.y - pts[(best.i + 1) % n][1])) < screenPx(NODE * 2)) return; // on a corner already
  remember();
  const points = localPoints(s).map(p => [...p]);
  points.splice(best.i + 1, 0, toLocal(s, best.x, best.y));
  s.points = points;
  activeId = s.id;
  activeNode = { id: s.id, node: best.i + 1 };
  shapesChanged();
}

// the point a share u of the outline falls on, and the share of the nearest point to a given one (own units)
function pointAtShare(points, closed, u) {
  const lens = sideLengths(points, closed), n = points.length;
  let at = u * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (at <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? clamp(at / lens[i], 0, 1) : 0, a = points[i], b = points[(i + 1) % n];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    at -= lens[i];
  }
}

function shareAtPoint(points, closed, [px, py]) {
  const lens = sideLengths(points, closed), n = points.length, total = lens.reduce((a, b) => a + b, 0) || 1;
  let best = null, before = 0;
  for (let i = 0; i < lens.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
    const t = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (lens[i] ** 2 || 1), 0, 1);
    const d = Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay));
    if (!best || d < best.d) best = { d, u: (before + t * lens[i]) / total };
    before += lens[i];
  }
  return best.u;
}

// a corner taken out: its two sides become one. Each cut keeps its ends where they were, as near as the new outline
// allows. A closed shape keeps at least 3 corners and a line at least its 2 ends.
function removeCorner(s, i) {
  const closed = isClosed(s), old = localPoints(s);
  if (old.length <= (closed ? 3 : 2)) return false;
  const ends = (s.cuts ?? []).map(cut => cut.map(u => pointAtShare(old, closed, u)));
  s.points = old.filter((_, k) => k !== i);
  if (ends.length) s.cuts = mergeCuts(ends.map(cut => cut.map(p => shareAtPoint(s.points, closed, p))), closed);
  return true;
}

function deleteNode(s, i) {
  if (!s || i === -1) return;
  if (i <= -10) { say('An arc\'s end slides round its circle: drag it, or Ctrl-click the arc to trim it'); return; }
  remember();
  if (!removeCorner(s, i)) {
    history.pop(); // nothing changed: no undo step
    showUndo();
    say(s.type === 'line' ? 'A line keeps its two ends: click empty space, then Delete removes the line' : 'A shape keeps at least 3 corners');
    return;
  }
  recentre(s);
  activeNode = null;
  shapesChanged();
}

// after a corner moved, the shape's centre goes back to the middle of its corners, so it turns and scales about it
function recentre(s) {
  if (s.type === 'circle') return;
  const pts = localPoints(s), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  if (Math.hypot(mx, my) < 1e-9) return;
  const r = (s.size * Math.min(W, H)) / 2, cos = Math.cos(s.rot), sin = Math.sin(s.rot);
  s.x += ((mx * cos - my * sin) * r) / W;
  s.y += ((mx * sin + my * cos) * r) / H;
  s.points = pts.map(([x, y]) => [x - mx, y - my]);
}

// the nodes that move with a grabbed one: every other shape's node on the same spot (they were joined), unless Alt
function joinedNodes(s, i, alone) {
  const at = nodesOf(s).find(n => n.i === i), moving = [{ shape: s, node: i }];
  if (alone) return moving;
  for (const o of state.shapes) {
    if (o === s) continue;
    for (const n of nodesOf(o)) if (Math.hypot(n.x - at.x, n.y - at.y) < 0.05) moving.push({ shape: o, node: n.i });
  }
  return moving;
}

// Archicad's signs: a tick on a node, a cross on a crossing, the "mercedes" on an edge, beside a ring on the point
function drawSnapMark({ x, y, kind }) {
  const u = screenPx(1);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sign = () => {
    ctx.beginPath();
    ctx.arc(x, y, 5 * u, 0, TAU);
    const sx = x + 11 * u, sy = y - 11 * u;
    if (kind === 'node') { ctx.moveTo(sx - 4 * u, sy); ctx.lineTo(sx - 1 * u, sy + 3 * u); ctx.lineTo(sx + 5 * u, sy - 4 * u); }
    else if (kind === 'crossing') { ctx.moveTo(sx - 4 * u, sy - 4 * u); ctx.lineTo(sx + 4 * u, sy + 4 * u); ctx.moveTo(sx + 4 * u, sy - 4 * u); ctx.lineTo(sx - 4 * u, sy + 4 * u); }
    else {
      ctx.moveTo(sx + 5 * u, sy);
      ctx.arc(sx, sy, 5 * u, 0, TAU);
      for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) { ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * 5 * u, sy + Math.sin(a) * 5 * u); }
    }
  };
  sign();
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

// a drawing tool's press: a drag for a line, a rectangle or a circle, a click per corner for a polygon, a click on a
// piece to trim it
function toolDown(x, y, e) {
  if (tool === 'text') {
    // on a text item: pick it to edit its words; elsewhere: a new one there
    const on = [...state.texts].reverse().find(t => insideText(t, x, y));
    if (on) pickText(on.id, true);
    else addText(x, y);
    return;
  }
  if (tool === 'trim') {
    const piece = hitPiece(x, y);
    if (piece) trimPiece(piece);
    return;
  }
  if (tool === 'polygon') {
    if (!draft) {
      const p = drawPoint(x, y, e);
      draft = { type: 'polygon', points: [p], hover: p };
    } else {
      const first = draft.points[0], last = draft.points[draft.points.length - 1];
      if (draft.points.length >= 3 && Math.hypot(x - first[0], y - first[1]) <= screenPx(HANDLE + 3)) return finishPolygon();
      const p = drawPoint(x, y, e, last);
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > screenPx(3)) draft.points.push(p); // a double-click's second press adds nothing
    }
    requestRender();
    return;
  }
  [x, y] = drawPoint(x, y, e); // a line, rectangle or circle starts on what it snaps to
  draft = { type: tool, x0: x, y0: y, x1: x, y1: y };
  drag = { kind: 'draw' };
  canvas.setPointerCapture(e.pointerId);
}

// a drag-drawn draft follows the pointer: Shift keeps a line on 15 degree steps and a rectangle square
function drawTo(x, y, e) {
  snapMark = e.altKey ? null : snapPoint(x, y, snapTargets());
  if (snapMark) {
    draft.x1 = snapMark.x;
    draft.y1 = snapMark.y;
  } else if (draft.type === 'line') {
    [draft.x1, draft.y1] = snapAngle(draft.x0, draft.y0, x, y, e);
  } else if (draft.type === 'rect' && e.shiftKey) {
    const side = Math.max(Math.abs(x - draft.x0), Math.abs(y - draft.y0));
    draft.x1 = draft.x0 + Math.sign(x - draft.x0 || 1) * side;
    draft.y1 = draft.y0 + Math.sign(y - draft.y0 || 1) * side;
  } else {
    draft.x1 = x;
    draft.y1 = y;
  }
}

// Ctrl-click (Cmd-click on a Mac) trims with any tool, as Archicad's scissors do: while the key is held the cursor is
// a pair of scissors, black over a piece of outline (which lights up red: what the click cuts away, back to the
// nearest crossing either side), white over empty space, where a click does nothing
const cutting = e => editingShown() && (e.ctrlKey || e.metaKey) && !draft;
let pointer = null; // where the pointer last was over the stage, in world coordinates, so the key alone can update it

// what the pointer is over, and what lights up: the piece to trim, the outline or handle to grab, a polygon's next side
function updateHover(e) {
  const scissors = cutting(e);
  stage.classList.toggle('is-cutting', scissors);
  if (!pointer || !editingShown()) return;
  const { x, y } = pointer;
  let piece = null, over = null, handle = null, edge = null, node = null;
  const mark = snapMark;
  snapMark = null;
  if (scissors || tool === 'trim') {
    piece = hitPiece(x, y);
  } else if (tool === 'polygon' && draft) {
    draft.hover = drawPoint(x, y, e, draft.points[draft.points.length - 1]);
    requestRender();
  } else if (tool === 'select') {
    node = hitNode(x, y);
    handle = node ? null : hitHandle(x, y);
    edge = node || handle ? null : hitShape(x, y);
    over = node?.shape ?? handle?.shape ?? edge?.shape ?? null;
    const text = over ? null : hitText(x, y)?.text ?? null;
    if (text !== hoveredText) { hoveredText = text; requestRender(); }
    if (text) edge = { shape: null }; // the move cursor over a text item
  } else {
    drawPoint(x, y, e); // a drawing tool shows what its first point would snap to
  }
  if (mark !== snapMark) requestRender();
  if (node?.shape !== hoveredNode?.shape || node?.node !== hoveredNode?.node) { hoveredNode = node; requestRender(); }
  stage.classList.toggle('is-over-node', !!node);
  stage.classList.toggle('is-over-piece', !!piece);
  stage.classList.toggle('is-over-handle', !!handle);
  stage.classList.toggle('is-over-shape', !!edge);
  if (piece !== hoveredPiece || over !== hovered) {
    hoveredPiece = piece;
    hovered = over; // light up the outline the pointer would grab
    requestRender();
  }
}

// pressing or letting go of Ctrl / Cmd swaps the cursor and the highlight at once, without moving the pointer
for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => { if (e.key === 'Control' || e.key === 'Meta') updateHover(e); });
window.addEventListener('blur', () => updateHover({}));

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const { x, y } = local(e);
  if (cutting(e)) {
    const piece = hitPiece(x, y);
    if (piece) trimPiece(piece);
    return;
  }
  if (editingShown() && tool !== 'select') return toolDown(x, y, e);
  drag = { kind: null, shape: null, lastX: x, lastY: y, startX: x, startY: y, moved: false };
  // layout view: a node, a handle or a shape's outline edits the shape; at full size the press picks the screen under
  // it, and dragging moves that screen's picture
  const hit = editingShown() ? hitNode(x, y) ?? hitHandle(x, y) ?? hitShape(x, y) : null;
  const textHit = editingShown() && !hit ? hitText(x, y) : null;
  if (textHit) {
    Object.assign(drag, textHit);
    activeId = null;
    activeNode = null;
    pickText(textHit.text.id);
  } else if (hit) {
    if (activeText !== null) pickText(null);
    Object.assign(drag, hit);
    if (hit.kind === 'node') {
      // the node and any joined to it move together, snapping to what's around them
      drag.moving = joinedNodes(hit.shape, hit.node, e.altKey);
      // the shapes in hand are left out of what it snaps to, except their own other corners (to merge into a neighbour)
      const targets = snapTargets(new Set(drag.moving.map(m => m.shape.id)));
      const own = drag.moving.flatMap(m => nodesOf(m.shape).filter(n => n.i !== m.node && n.i >= 0).map(n => ({ x: n.x, y: n.y, kind: 'node' })));
      drag.snap = { ...targets, nodes: [...own, ...targets.nodes] };
    }
    if (hit.kind === 'radius') drag.r0 = radiusOf(hit.shape); // the radius it started at, for the offset read-out
    activeId = hit.shape.id;
    activeNode = hit.kind === 'node' && hit.node !== -1 ? { id: hit.shape.id, node: hit.node } : null;
    requestRender(); // the picked node turns black
  } else if (editingShown()) {
    // in the layout view the screens are locked: a press on empty space only lets go of the shape in hand
    if (activeId !== null || activeNode || activeText !== null) { activeId = null; activeNode = null; pickText(null); requestRender(); }
  } else {
    select(faceAt(x, y)); // full size: pick the screen under the pointer, and dragging moves its picture
    drag.kind = 'pan';
  }
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  const { x, y } = local(e);
  if (drag?.kind === 'draw') {
    drawTo(x, y, e);
    requestRender();
    return;
  }
  pointer = { x, y };
  if (!drag) return updateHover(e);
  const dx = x - drag.lastX, dy = y - drag.lastY;
  drag.lastX = x;
  drag.lastY = y;
  if (!drag.moved) {
    if (Math.hypot(x - drag.startX, y - drag.startY) <= 3) return;
    drag.moved = true;
    if (drag.shape || drag.text) remember(); // as it was before this drag: one undo step
  }

  const s = drag.shape;
  if (drag.text) {
    const t = drag.text, b = textBox(t);
    if (drag.kind === 'textMove') { t.x += dx / W; t.y += dy / H; }
    else if (drag.kind === 'textScale') t.size = Math.max(t.size * Math.max(Math.hypot(x - b.cx, y - b.cy) - screenPx(SCALE_GAP), 4) / Math.hypot(b.w / 2, b.h / 2), 0.02);
    else t.rot = Math.atan2(y - b.cy, x - b.cx) - Math.atan2(-b.h, b.w); // the upper-right corner follows the pointer
    measure();
    requestRender();
    return;
  }
  if (drag.kind === 'node') {
    snapMark = e.altKey ? null : snapPoint(x, y, drag.snap);
    const [tx, ty] = snapMark ? [snapMark.x, snapMark.y] : [x, y];
    for (const m of drag.moving) {
      setNode(m.shape, m.node, tx, ty);
    }
  } else if (drag.kind === 'move') {
    s.x += dx / W;
    s.y += dy / H;
  } else if (drag.kind === 'scale') {
    const c = centreOf(s);
    const r = Math.max(Math.hypot(x - c.x, y - c.y) - screenPx(SCALE_GAP), 1) / Math.hypot(...scaleCorner(s));
    s.size = Math.max((2 * r) / Math.min(W, H), 0.03);
  } else if (drag.kind === 'radius') {
    // the offset: the radius follows the pointer's distance from the centre, the centre and the cuts stay put
    const c = centreOf(s);
    s.size = Math.max((2 * (Math.hypot(x - c.x, y - c.y) - screenPx(SCALE_GAP))) / Math.min(W, H), 0.01);
  } else if (drag.kind === 'rotate') {
    const c = centreOf(s);
    s.rot = Math.atan2(y - c.y, x - c.x) - handlesOf(s).turnFrom; // the rotate handle's corner follows the pointer
  } else if (drag.kind === 'pan') {
    const sc = screenOf(state.selected);
    sc.x = clamp(sc.x + (dx / W) * 100, -50, 50);
    sc.y = clamp(sc.y + (dy / H) * 100, -50, 50);
    syncSliders();
  } else {
    return;
  }
  if (s) measure();
  requestRender();
});

function endDrag(e) {
  if (!drag) return;
  if (drag.kind === 'draw') {
    const shape = shapeFromDraft(draft);
    draft = null;
    if (shape) addShape(shape);
    else requestRender();
  } else if (drag.text && drag.moved) {
    shapesChanged();
  } else if (drag.kind === 'node' && drag.moved) {
    // a corner dropped on the corner next to it in its own shape merges into it, as Archicad does
    for (const m of drag.moving) {
      if (m.node < 0) continue;
      const nodes = nodesOf(m.shape), at = nodes[m.node], n = nodes.length;
      const next = nodes[(m.node + 1) % n], prev = nodes[(m.node - 1 + n) % n];
      const ends = isClosed(m.shape) ? [next, prev] : [m.node < n - 1 && next, m.node > 0 && prev].filter(Boolean);
      if (ends.some(o => Math.hypot(o.x - at.x, o.y - at.y) < 0.05)) removeCorner(m.shape, m.node);
    }
    for (const m of drag.moving) recentre(m.shape);
    shapesChanged();
  }
  snapMark = null;
  drag = null;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  keep();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => {
  pointer = null;
  if (drag || (!hovered && !hoveredPiece && !hoveredNode && !snapMark)) return;
  hovered = null;
  hoveredPiece = null;
  hoveredNode = null;
  snapMark = null;
  stage.classList.remove('is-over-shape', 'is-over-handle', 'is-over-piece', 'is-over-node');
  requestRender();
});
canvas.addEventListener('dblclick', e => {
  if (draft?.type === 'polygon') return finishPolygon();
  if (!editingShown() || tool !== 'select' || cutting(e)) return;
  const { x, y } = local(e);
  if (hitNode(x, y)) return;
  const hit = hitShape(x, y);
  if (hit) insertNode(hit.shape, x, y);
});

// the wheel scales the screen under the pointer, at full size
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (editingShown()) return; // the screens are locked while editing the shapes
  const { x, y } = local(e);
  select(faceAt(x, y));
  const sc = screenOf(state.selected);
  sc.scale = clamp(+(sc.scale * Math.exp(-e.deltaY * 0.0015)).toFixed(2), 0.2, 5);
  syncSliders();
  requestRender();
  keep();
}, { passive: false });

// ---- the panel ----
const screenPick = field('screen');
let screenPickKey = '';

// an area's name from its key: the glyphs of the shapes it is inside, and its piece number when the combination falls
// into several separate pieces ("■● 2"); enclosed areas inside no shape are gaps ("gap 1"); "0" is the background
function nameOf(key) {
  if (String(key).startsWith('t')) {
    const words = state.texts.find(t => textKey(t) === key)?.text.trim() || 'text';
    return `"${words.length > 10 ? words.slice(0, 9) + '…' : words}"`;
  }
  const [maskText, piece] = String(key).split('.');
  const mask = Number(maskText);
  const glyphs = mask ? state.shapes.filter(s => mask & (1 << s.id)).map(labelOf).join('') : piece ? 'gap' : 'bg';
  return piece ? `${glyphs} ${piece}` : glyphs;
}

function describe(key) {
  if (String(key).startsWith('t')) return 'A text item: its letters are one screen, drawn over the areas';
  const [maskText, piece] = String(key).split('.');
  const mask = Number(maskText);
  if (!mask) return piece ? 'A gap: inside no shape, closed off from the background by outlines (or the frame)' : 'Outside every shape';
  const inside = `Inside ${state.shapes.filter(s => mask & (1 << s.id)).map(s => `${TYPE_NAME[s.type]} ${labelOf(s)}`).join(' + ')}, outside the rest`;
  return piece ? `${inside} (piece ${piece}: this combination falls into separate areas)` : inside;
}

// a screen as the dropdown names it: an area by its name from the Areas section ("area 3", or what was typed), a text
// item by its words and "(text)"
function screenLabel(key) {
  if (String(key).startsWith('t')) return `${state.texts.find(t => textKey(t) === key)?.text.trim() || 'text'} (text)`;
  return areaName(key, areasNow().findIndex(r => r.key === key));
}

// one option per screen that can be seen; rebuilt only when the screens or their names change
function renderScreenPick() {
  const labels = regions.map(r => screenLabel(r.key));
  const key = regions.map((r, i) => `${r.key}:${labels[i]}`).join(',');
  if (key !== screenPickKey) {
    screenPickKey = key;
    screenPick.replaceChildren(...regions.map((r, i) => {
      const option = document.createElement('option');
      option.value = r.key;
      option.textContent = labels[i];
      option.title = describe(r.key);
      return option;
    }));
  }
  screenPick.value = state.selected;
}

screenPick.addEventListener('change', () => select(screenPick.value));

// ---- areas (layout view): every area in the frame, named "area 1", "area 2"... until renamed, in the screens' order, each name editable ----
const areaList = panel.querySelector('.area-list');
let areaListKey = '';
let litArea = null; // the area whose row is focused or hovered: lit on the canvas
const areasNow = () => regions.filter(r => !r.text);
const areaName = (key, i) => state.areaNames[key] || `area ${i + 1}`;

// the eye in the header shows or hides the names on the canvas (the lit area still lights)
const areaLabelsButton = panel.querySelector('.area-labels');
areaLabelsButton.addEventListener('click', () => {
  state.areaLabels = !state.areaLabels;
  showAreaLabels();
  requestRender();
  keep();
});
function showAreaLabels() { areaLabelsButton.setAttribute('aria-pressed', String(state.areaLabels)); }

function lightArea(key) {
  if (litArea === key) return;
  litArea = key;
  requestRender();
}

// rebuilt only when the set of areas (or what they're made of) changes, and never under the caret: a row being typed in
// stays, and the list catches up once it's left
function renderAreas() {
  const areas = areasNow();
  const key = areas.map(r => `${r.key}:${nameOf(r.key)}`).join(',');
  if (key === areaListKey || areaList.contains(document.activeElement)) return;
  areaListKey = key;
  if (!areas.some(r => r.key === litArea)) litArea = null;
  if (!areas.length) {
    const empty = document.createElement('p');
    empty.className = 'area-empty';
    empty.textContent = 'No areas in the frame.';
    areaList.replaceChildren(empty);
    return;
  }
  areaList.replaceChildren(...areas.map((r, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = areaName(r.key, i);
    input.maxLength = 24;
    input.spellcheck = false;
    input.title = describe(r.key);
    input.setAttribute('aria-label', `Name of area ${i + 1}`);
    input.addEventListener('input', () => {
      const name = input.value.trim();
      if (name && name !== `area ${i + 1}`) state.areaNames[r.key] = name;
      else delete state.areaNames[r.key]; // empty, or its default typed back: it goes by "area <n>"
      renderScreenPick(); // the screen dropdown names areas the same way
      requestRender();
      keep();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') input.blur(); });
    input.addEventListener('focus', () => { lightArea(r.key); input.select(); });
    input.addEventListener('blur', () => {
      input.value = areaName(r.key, i); // a cleared field shows its default again
      lightArea(null);
      renderAreas();
    });
    row.addEventListener('pointerenter', () => lightArea(r.key));
    row.addEventListener('pointerleave', () => { if (document.activeElement !== input) lightArea(null); });
    row.append(input);
    return row;
  }));
}

function select(key) {
  key = String(key);
  if (key === state.selected) return;
  state.selected = key;
  renderScreenPick();
  syncSliders();
  requestRender();
  keep();
}

const decimalsOf = input => (input.step.split('.')[1] ?? '').length;
const showValue = (input, value) => { input.closest('.row').querySelector('output').value = Number(value).toFixed(decimalsOf(input)); };

// the screen's controls show the picked screen's values: sliders, colour wells, blend chips and the tile grid
function syncSliders() {
  const sc = screenOf(state.selected);
  for (const key of Object.keys(PLAIN)) {
    for (const input of panel.querySelectorAll(`[name="${key}"]`)) {
      if (input.type === 'radio') {
        input.checked = input.value === sc[key];
      } else {
        input.value = sc[key];
        if (input.type === 'range') showValue(input, sc[key]);
      }
    }
  }
  showPattern(sc.pattern);
  showActiveGroups();
}

for (const key of Object.keys(PLAIN)) {
  for (const input of panel.querySelectorAll(`[name="${key}"]`)) {
    input.addEventListener(input.type === 'radio' ? 'change' : 'input', () => {
      screenOf(state.selected)[key] = input.type === 'range' ? Number(input.value) : input.value;
      if (input.type === 'range') showValue(input, input.value);
      showActiveGroups();
      requestRender();
      keep();
    });
  }
}

// the texture's tile grid, as the studio's Pattern layer: a "none" tile, then one tile per pattern, the picked one framed
const patternGrid = panel.querySelector('.pattern-grid');
const patternName = panel.querySelector('.pattern-name');
for (const p of [{ id: '', name: 'none' }, ...PATTERNS]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.pattern = p.id;
  button.title = p.name;
  button.setAttribute('aria-label', p.id ? `Pattern: ${p.name}` : 'No pattern');
  if (p.url) {
    button.style.backgroundImage = `url("${p.url}")`;
    // big tiles shrunk to show a few repeats in the swatch, as the studio's grid does
    if (p.w) button.style.backgroundSize = `${Math.min(p.w, 24)}px auto`;
  }
  button.addEventListener('click', () => {
    screenOf(state.selected).pattern = p.id;
    showPattern(p.id);
    showActiveGroups();
    requestRender();
    keep();
  });
  patternGrid.append(button);
}

function showPattern(id) {
  for (const button of patternGrid.children) button.setAttribute('aria-pressed', String(button.dataset.pattern === id));
  patternName.textContent = id ? `${PATTERN_BY_ID[id]?.name ?? id}${id.startsWith('hero/') ? ' (Hero Patterns)' : ''}` : 'none';
  // keep the picked tile in view: the grid scrolls, and the pick can be far down it. The grid alone is scrolled
  // (it is the tiles' offset parent, controls.css), never the panel around it.
  const picked = patternGrid.querySelector('[aria-pressed="true"]');
  if (picked && (picked.offsetTop < patternGrid.scrollTop || picked.offsetTop + picked.offsetHeight > patternGrid.scrollTop + patternGrid.clientHeight)) {
    patternGrid.scrollTop = picked.offsetTop - 4;
  }
}

// the property groups fold open and shut (the studio's .sub / .collapsed); which ones are open is kept with the rest
const subs = [...panel.querySelectorAll('.sub[data-sub]')];
for (const sub of subs) {
  const header = sub.querySelector('h4');
  header.tabIndex = 0;
  header.setAttribute('role', 'button');
  const toggle = () => {
    state.open[sub.dataset.sub] = sub.classList.contains('collapsed');
    showOpenGroups();
    keep();
  };
  header.addEventListener('click', e => { if (!e.target.closest('button')) toggle(); });
  header.addEventListener('keydown', e => { if (e.target === header && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } });

  // the undo arrow in the header: this group's values back to plain for the picked screen (the others stay)
  sub.querySelector('.group-reset').addEventListener('click', e => {
    const sc = screenOf(state.selected);
    for (const key of GROUP_KEYS[sub.dataset.sub]) sc[key] = PLAIN[key];
    flash(e.currentTarget, 'is-reset');
    syncSliders();
    requestRender();
    keep();
  });
}

// sections that fold the same way (data-fold: Areas, Layouts), their header the toggle; kept in state.open too
const folds = [...panel.querySelectorAll('.grp[data-fold]')];
for (const grp of folds) {
  const header = grp.querySelector('h3');
  header.tabIndex = 0;
  header.setAttribute('role', 'button');
  const toggle = () => {
    state.open[grp.dataset.fold] = grp.classList.contains('collapsed');
    showOpenGroups();
    keep();
  };
  header.addEventListener('click', e => { if (!e.target.closest('button')) toggle(); });
  header.addEventListener('keydown', e => { if (e.target === header && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } });
}

function showOpenGroups() {
  for (const [el, name, header] of [...subs.map(s => [s, s.dataset.sub, 'h4']), ...folds.map(g => [g, g.dataset.fold, 'h3'])]) {
    const open = !!state.open?.[name];
    el.classList.toggle('collapsed', !open);
    el.querySelector(header).setAttribute('aria-expanded', String(open));
  }
}

// a group that is changing the picked screen shows a dot after its name, so a folded group still says it's in use
function showActiveGroups() {
  const sc = screenOf(state.selected);
  for (const sub of subs) {
    const group = sub.dataset.sub;
    const active = group === 'static' ? sc.grain > 0
      : group === 'texture' ? !!sc.pattern && sc.patOpacity > 0
      : GROUPS[group].some(k => sc[k] !== PLAIN[k]);
    sub.classList.toggle('is-active', active);
    // its reset has something to do once any of the group's values differ from plain
    sub.querySelector('.group-reset').disabled = GROUP_KEYS[group].every(k => sc[k] === PLAIN[k]);
  }
}

// the undo arrow in the Screen header: the picked screen back to the untouched photo, flashing once it's done
panel.querySelector('.screen-reset').addEventListener('click', e => {
  flash(e.currentTarget, 'is-reset');
  state.screens[state.selected] = { ...PLAIN };
  syncSliders();
  requestRender();
  keep();
});

// ---- randomize: the studio's dice, one in each section's header ----
const rand = (min, max) => min + Math.random() * (max - min);
const chance = p => Math.random() < p;
// a value on its slider's own step, so the slider shows exactly what is applied
const snap = (key, value) => {
  const input = field(key);
  return +(Math.round(value / Number(input.step)) * Number(input.step)).toFixed(decimalsOf(input));
};

// how many regions a set of shapes makes: a quick, coarse version of measure()
function regionCount() {
  const step = Math.max(W, H) / 60;
  const masks = new Set();
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) masks.add(maskAt(x, y));
  return masks.size;
}

// does any shape reach under the panel? (not while it's minimised)
function underPanel() {
  if (document.body.classList.contains('panel-hidden')) return false;
  const p = panel.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  // the panel's edges in world coordinates (through the layout view's zoom, when it's on)
  const left = (p.left - c.left - 8 - offsetX()) / view.zoom, bottom = (p.bottom - c.top + 8 - offsetY()) / view.zoom;
  return state.shapes.some(s => {
    const points = s.type === 'circle'
      ? [[centreOf(s).x + radiusOf(s), centreOf(s).y], [centreOf(s).x + radiusOf(s) * Math.SQRT1_2, centreOf(s).y - radiusOf(s) * Math.SQRT1_2]]
      : corners(s);
    return points.some(([x, y]) => x > left && y < bottom);
  });
}

// With saved layouts, one of them at random (not the one on show, when there's a choice). Without: new positions,
// sizes and turns, clustered round a random point so the shapes overlap. Of a few tries, keep the one that makes the
// most regions (all of them, ideally: 2^shapes, background included) and stays clear of the panel.
panel.querySelector('.shapes-random').addEventListener('click', () => {
  const saved = readLayouts(), now = JSON.stringify(state.shapes);
  if (saved.length) {
    const others = saved.filter(l => JSON.stringify(l.shapes) !== now);
    const list = others.length ? others : saved;
    return loadLayout(list[Math.floor(Math.random() * list.length)]);
  }
  if (!state.shapes.length) return;
  const most = 2 ** state.shapes.filter(isClosed).length; // a line has no inside: it adds no combinations
  const before = state.shapes;
  let best = null, bestScore = -Infinity;
  for (let attempt = 0; attempt < 24 && bestScore < most; attempt++) {
    const cx = rand(0.3, 0.55), cy = rand(0.42, 0.6);
    state.shapes = before.map(s => ({ ...s, x: cx + rand(-0.1, 0.1), y: cy + rand(-0.1, 0.1), size: canTurn(s) ? rand(0.3, 0.6) : s.size, rot: canTurn(s) ? rand(0, Math.PI * 2) : s.rot })); // each keeps its kind and corners; a segment or circle its size, a segment its direction
    const score = regionCount() - (underPanel() ? most : 0); // under the panel only wins if nothing else turns up
    if (score > bestScore) { best = state.shapes; bestScore = score; }
  }
  state.shapes = before;
  remember();
  state.shapes = best;
  shapesChanged();
});

// the picked screen, rerolled: move, turn and scale always change; the colour effects come by chance, so most
// screens stay recognisably the photo and the odd one goes grey, sepia, shifted or inverted
panel.querySelector('.screen-random').addEventListener('click', () => {
  const values = {
    x: rand(-10, 10),
    y: rand(-10, 10),
    rot: rand(-35, 35),
    scale: rand(0.7, 2.5),
    opacity: 1,
    blur: chance(0.2) ? rand(1, 6) : 0,
    hue: chance(0.4) ? rand(-180, 180) : 0,
    sat: rand(0.6, 1.8),
    bright: rand(0.85, 1.25),
    contrast: rand(0.85, 1.5),
    grey: chance(0.3) ? rand(0.5, 1) : 0,
    invert: chance(0.08) ? 1 : 0,
    sepia: chance(0.2) ? rand(0.3, 0.8) : 0
  };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  // the overlays, each on about a quarter of rolls: a light grain, or a pattern in black or white
  const overlays = {
    ...(chance(0.25) && { grain: rand(0.1, 0.45), grainSize: pick([1, 1.5, 2, 3, 4]), grainBlend: pick(['overlay', 'soft-light', 'screen']) }),
    ...(chance(0.25) && { pattern: pick(PATTERNS).id, patScale: rand(0.5, 3), patOpacity: rand(0.2, 0.7), patRotate: rand(0, 360), patColour: pick(['#000000', '#ffffff']), patBlend: pick(['source-over', 'multiply', 'overlay', 'screen']) })
  };
  const numbers = Object.entries({ ...values, ...overlays }).map(([key, value]) => [key, typeof value === 'number' ? snap(key, value) : value]);
  state.screens[state.selected] = { ...PLAIN, ...Object.fromEntries(numbers) };
  syncSliders();
  requestRender();
  keep();
});

// ---- the Randomize section: rolls across every area's screen (text items keep theirs) ----
// The knobs to tune, in one place. Ranges are [min, max], drawn evenly, then put on the slider's own step.
//   positions: what "Positions" rolls on every screen (move and scale); rotation: what "Rotation" rolls.
//   cover:     how much of each area the photo must still cover after a position or rotation roll (0.8 = 80%);
//              each screen is rolled up to `tries` times, and keeps the first roll that covers enough, else the best.
//   impact:    how many areas each effect lands on, by the impact dropdown's choice (never more than there are).
//   effects:   one entry per checkbox in the effect dropdown. The dice puts every checked entry's keys back to plain on
//              every screen, then rolls each entry on `impact` screens of its own, each key within its range. A key
//              with `chance` below 1 is only rolled on that share of those screens.
const RANDOMIZE = {
  positions: { x: [-10, 10], y: [-10, 10], scale: [0.7, 2.5] },
  rotation: { rot: [-35, 35] },
  cover: 0.8,
  tries: 24,
  impact: { small: 3, medium: 6, large: 10 },
  effects: {
    colour: { keys: { hue: { range: [-180, 180] }, sat: { range: [0.8, 1.8], chance: 0.5 } } },
    blur: { keys: { blur: { range: [1, 8] } } },
    sepia: { keys: { sepia: { range: [0.4, 1] } } },
    contrast: { keys: { contrast: { range: [1.2, 2.2] } } }
  }
};

const screensToRoll = () => areasNow().map(r => screenOf(r.key));
const shuffled = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// How much of an area the photo covers with the screen's move, turn and scale: points on a grid over the area, each
// taken back through the screen's transform (about the area's centre, as paintScreen draws it) to see whether it
// lands on the photo.
function coverOf(r, sc) {
  const cover = coverRect(), cos = Math.cos((-sc.rot * Math.PI) / 180), sin = Math.sin((-sc.rot * Math.PI) / 180);
  const mx = (sc.x / 100) * W, my = (sc.y / 100) * H, b = r.box, step = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 16;
  let inside = 0, onPhoto = 0;
  for (let y = b.y0 + step / 2; y < b.y1; y += step) {
    for (let x = b.x0 + step / 2; x < b.x1; x += step) {
      if (x < 0 || x > W || y < 0 || y > H || !insideRings(r.rings, x, y)) continue; // only what the frame shows
      inside++;
      const dx = (x - r.cx - mx) / sc.scale, dy = (y - r.cy - my) / sc.scale;
      const px = r.cx + dx * cos - dy * sin, py = r.cy + dx * sin + dy * cos;
      if (px >= cover.x && px <= cover.x + cover.w && py >= cover.y && py <= cover.y + cover.h) onPhoto++;
    }
  }
  return inside ? onPhoto / inside : 1;
}

// new values for these keys on every area's screen, each kept to rolls where the photo still covers enough of it
function rollCovered(ranges) {
  for (const r of areasNow()) {
    const sc = screenOf(r.key), was = { ...sc };
    let best = null, bestCover = -1;
    for (let i = 0; i < RANDOMIZE.tries && bestCover < RANDOMIZE.cover; i++) {
      const roll = Object.fromEntries(Object.entries(ranges).map(([key, [min, max]]) => [key, snap(key, rand(min, max))]));
      const covered = image ? coverOf(r, { ...was, ...roll }) : 1;
      if (covered > bestCover) { best = roll; bestCover = covered; }
    }
    Object.assign(sc, best);
  }
}

// one effect: cleared from every area, then rolled on as many as the impact says, picked at random
function rollEffect(name) {
  const effect = RANDOMIZE.effects[name];
  if (!effect) return;
  const screens = screensToRoll();
  for (const sc of screens) for (const key of Object.keys(effect.keys)) sc[key] = PLAIN[key]; // cleared everywhere first
  const count = Math.min(screens.length, RANDOMIZE.impact[state.impact] ?? RANDOMIZE.impact.small);
  for (const sc of shuffled(screens).slice(0, count)) {
    for (const [key, { range: [min, max], chance: p = 1 }] of Object.entries(effect.keys)) if (chance(p)) sc[key] = snap(key, rand(min, max));
  }
}

function afterRoll(button) {
  flash(button, 'is-reset');
  syncSliders();
  requestRender();
  keep();
}

panel.querySelector('.random-positions').addEventListener('click', e => { rollCovered(RANDOMIZE.positions); afterRoll(e.currentTarget); });
panel.querySelector('.random-rotation').addEventListener('click', e => { rollCovered(RANDOMIZE.rotation); afterRoll(e.currentTarget); });

// their resets: those keys back to plain on every area's screen
const resetAll = keys => { for (const sc of screensToRoll()) for (const key of keys) sc[key] = PLAIN[key]; };
panel.querySelector('.reset-positions').addEventListener('click', e => { resetAll(Object.keys(RANDOMIZE.positions)); afterRoll(e.currentTarget); });
panel.querySelector('.reset-rotation').addEventListener('click', e => { resetAll(Object.keys(RANDOMIZE.rotation)); afterRoll(e.currentTarget); });

// the effect dropdown: checkboxes, "all" checking or clearing every one; the dice and the reset act on what's checked
const effectPick = panel.querySelector('.effect-pick');
const effectBoxes = [...effectPick.querySelectorAll('[name="randomEffect"]')];
const effectAll = effectPick.querySelector('input[value="all"]');
const effectRoll = panel.querySelector('.effect-roll');
const effectReset = panel.querySelector('.effect-reset');
const impactInput = field('impact');
const checkedEffects = () => state.randomEffects.filter(name => RANDOMIZE.effects[name]);

for (const box of effectBoxes) {
  box.addEventListener('change', () => {
    state.randomEffects = effectBoxes.filter(b => b.checked).map(b => b.value);
    showRandomEffect();
    keep();
  });
}
effectAll.addEventListener('change', () => {
  state.randomEffects = effectAll.checked ? effectBoxes.map(b => b.value) : [];
  showRandomEffect();
  keep();
});
// shut when a click lands anywhere outside it
document.addEventListener('pointerdown', e => { if (effectPick.open && !effectPick.contains(e.target)) effectPick.open = false; });

effectRoll.addEventListener('click', () => {
  for (const name of checkedEffects()) rollEffect(name);
  afterRoll(effectRoll);
});
effectReset.addEventListener('click', () => {
  resetAll(checkedEffects().flatMap(name => Object.keys(RANDOMIZE.effects[name].keys)));
  afterRoll(effectReset);
});

impactInput.addEventListener('change', () => { state.impact = impactInput.value; keep(); });
// the impact options name their counts from the config, so tuning it there keeps the labels true
for (const option of impactInput.options) option.textContent = `${option.value} (${RANDOMIZE.impact[option.value]} areas)`;

function showRandomEffect() {
  const picked = checkedEffects();
  for (const box of effectBoxes) box.checked = picked.includes(box.value);
  effectAll.checked = picked.length === effectBoxes.length;
  effectAll.indeterminate = picked.length > 0 && picked.length < effectBoxes.length;
  effectPick.querySelector('summary').textContent = effectAll.checked ? 'all' : picked.length > 2 ? `${picked.length} effects` : picked.join(', ') || 'none';
  effectPick.classList.toggle('is-empty', !picked.length);
  effectRoll.disabled = effectReset.disabled = !picked.length; // nothing checked: nothing to roll
  impactInput.value = state.impact;
}

// What the mouse and keys do, per view and tool, for the info band: a title, then one bullet per gesture. Static
// markup (keys in <kbd>), so it goes in as HTML.
const LAYOUT_COMMON = [
  '<kbd>Ctrl</kbd>-click a piece of outline to trim it, with any tool',
  '<kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> or <kbd>Ctrl</kbd>+<kbd>Y</kbd> redoes',
  'Tools: <kbd>V</kbd> select, <kbd>L</kbd> line, <kbd>R</kbd> rect, <kbd>C</kbd> circle, <kbd>P</kbd> polygon, <kbd>X</kbd> text, <kbd>T</kbd> trim; <kbd>Esc</kbd> goes back to select',
  'Screens are locked here: zoom back in (the expand button) to edit them'
];
const HELP = {
  viewing: ['Screens', [
    'Click an area to pick its screen',
    'Drag to move its picture',
    'Wheel to scale it',
    'The expand button in the titlebar edits the shapes'
  ]],
  layout: ['Layout · select', [
    'The white box is the frame',
    'Drag an outline to move a shape',
    'Square handle scales, round handle turns a closed shape',
    'Diamond handle on a circle or arc offsets it: a smaller or bigger radius, same centre',
    'Drag a corner to move it; drop it on another to join them (<kbd>Alt</kbd>: no snapping)',
    'Double-click an edge to add a corner',
    '<kbd>Delete</kbd> removes the picked corner, else the shape',
    'Drag a text\'s box to move it; its handles scale and turn it',
    ...LAYOUT_COMMON
  ]],
  line: ['Layout · line', ['Drag from one end to the other', '<kbd>Shift</kbd> keeps it on 15° steps', ...LAYOUT_COMMON]],
  rect: ['Layout · rectangle', ['Drag from corner to corner', '<kbd>Shift</kbd> makes it square', ...LAYOUT_COMMON]],
  circle: ['Layout · circle', ['Drag from the centre out', ...LAYOUT_COMMON]],
  polygon: ['Layout · polygon', [
    'Click each corner',
    'Click the first corner, double-click or press <kbd>Enter</kbd> to close',
    '<kbd>Backspace</kbd> drops the last corner, <kbd>Esc</kbd> cancels',
    '<kbd>Shift</kbd> keeps a side on 15° steps',
    ...LAYOUT_COMMON
  ]],
  trim: ['Layout · trim', ['Click a piece of outline (between two crossings) to cut it away', ...LAYOUT_COMMON]],
  text: ['Layout · text', [
    'Click to place a text and type its words in the text field',
    'Click a text to edit its words',
    '<kbd>Enter</kbd> or <kbd>Esc</kbd> leaves the field',
    ...LAYOUT_COMMON
  ]]
};

// the info button opens and shuts the band; its open state is kept with the rest
const helpButton = panel.querySelector('.infobtn');
const helpBand = document.getElementById('help');
let helpShown = '';

function showHelp() {
  helpButton.setAttribute('aria-expanded', String(!!state.help));
  helpBand.hidden = !state.help;
  const which = !state.layout ? 'viewing' : tool !== 'select' ? tool : 'layout';
  if (which === helpShown) return;
  helpShown = which;
  const [title, items] = HELP[which];
  helpBand.innerHTML = `<p class="help-title">${title}</p><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

helpButton.addEventListener('click', () => {
  state.help = !state.help;
  showHelp();
  keep();
});

// a passing message on the stage (loading, a refused edit), gone after a few seconds
let sayTimer = 0;
function say(text, ms = 3500) {
  hint.textContent = text;
  hint.hidden = !text;
  clearTimeout(sayTimer);
  if (text && ms) sayTimer = setTimeout(() => { hint.hidden = true; }, ms);
}

// ---- the layout view: the button in the shapes header zooms out to LAYOUT_ZOOM and back, animated ----
const layoutButton = panel.querySelector('.layout-toggle');
let zoomAnimation = 0;

function zoomTo(target, animate) {
  cancelAnimationFrame(zoomAnimation);
  const from = view.zoom, start = performance.now(), duration = animate && !reducedMotion ? 320 : 0;
  const step = now => {
    const p = duration ? Math.min((now - start) / duration, 1) : 1;
    view.zoom = from + (target - from) * easeInOut(p);
    measure(); // the off-frame regions depend on how much workspace is in view
    requestRender();
    if (p < 1) zoomAnimation = requestAnimationFrame(step);
  };
  if (duration) zoomAnimation = requestAnimationFrame(step);
  else step(start);
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function setLayout(on, animate = true) {
  state.layout = on;
  layoutButton.setAttribute('aria-pressed', String(on));
  showMode();
  zoomTo(on ? LAYOUT_ZOOM : 1, animate);
}

layoutButton.addEventListener('click', () => {
  setLayout(!state.layout);
  keep();
});

// Two modes, by zoom. The layout view edits the shapes: their outlines dashed, nodes and handles, the tools, and the
// screens locked. At full size the screens are edited: a press picks one, a drag moves its picture, the wheel scales
// it, and the shapes are just drawn. A minimised panel means "just look at it": no overlay even in the layout view.
const editingShown = () => state.layout && !document.body.classList.contains('panel-hidden');

// panel-window.js minimises by toggling body.panel-hidden: redraw with or without the overlay when it does
new MutationObserver(() => { showMode(); requestRender(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

// In the layout view the panel shows only the sections marked data-view="layout" (shapes, areas): the screens are
// locked, and image and templates have nothing to do with the geometry. Zooming back in swaps them: the rest
// comes back and the layout sections, whose tools only work in the layout view, go.
const groups = [...panel.querySelectorAll('.pbody > .grp')];

function showMode() {
  const editing = editingShown();
  for (const group of groups) group.hidden = (group.dataset.view === 'layout') !== state.layout;
  if (!editing) activeText = null;
  showTextField();
  stage.classList.toggle('is-editing', editing);
  stage.classList.toggle('is-drawing', editing && ['line', 'rect', 'circle', 'polygon'].includes(tool));
  stage.classList.toggle('is-trimming', editing && tool === 'trim');
  stage.classList.remove('is-over-shape', 'is-over-handle');
  hovered = null;
  showHelp();
}

const outlineInput = field('outline');
outlineInput.addEventListener('input', () => {
  state.outline = Number(outlineInput.value);
  showValue(outlineInput, outlineInput.value);
  requestRender();
  keep();
});

const colourInput = field('outline-colour');
colourInput.addEventListener('input', () => {
  state.outlineColour = colourInput.value;
  requestRender();
  keep();
});

// put the whole state onto the panel (on load and after a template loads)
function showState() {
  outlineInput.value = state.outline;
  showValue(outlineInput, state.outline);
  colourInput.value = state.outlineColour;
  // the layout view as the state has it: straight there on load, animated when it changes later
  layoutButton.setAttribute('aria-pressed', String(state.layout));
  const zoom = state.layout ? LAYOUT_ZOOM : 1;
  if (view.zoom !== zoom) zoomTo(zoom, W > 0);
  showMode();
  showOpenGroups();
  showAreaLabels();
  showRandomEffect();
  syncSliders();
  renderTemplates();
  showUndo();
}

// ---- titlebar: undo, redo and the layout view (wired above), copy ----
function flash(button, className) {
  button.classList.add(className);
  clearTimeout(button.flashTimer);
  button.flashTimer = setTimeout(() => button.classList.remove(className), 900);
}

// a prompt that rebuilds the composition as it is now, the photo left out
function promptText() {
  const round = v => +v.toFixed(3);
  const shapes = state.shapes.map(s => ({
    id: s.id, type: s.type, x: round(s.x), y: round(s.y), size: round(s.size), rotationDeg: round((s.rot * 180) / Math.PI),
    ...(s.points && { points: s.points }), ...(s.cuts?.length && { cuts: s.cuts.map(c => c.map(round)) })
  }));
  const screens = Object.fromEntries(regions.map(r => [nameOf(r.key), Object.fromEntries(Object.entries(screenOf(r.key)).filter(([k, v]) => v !== PLAIN[k]))]).filter(([, sc]) => Object.keys(sc).length));
  return `Recreate this cubist photo effect. I'll attach the photo separately.

Stack: one full-window <canvas>, Canvas 2D, no libraries; devicePixelRatio capped at 2; render on demand (requestAnimationFrame only after a change).

How it works
1. Draw the photo to cover the window (scale = max(W / imageWidth, H / imageHeight), centred).
2. Shapes overlap it, each with an id (0..29, its bit in an area's mask): square, circle, triangle, and drawn ones: rect, polygon (closed) and line (open, with no inside). Positions are shares of the window (x of the width, y of the height); size is a share of the shorter side and is the diameter, so the shape's unit r = size x shorter side / 2 (the square's half-side, the circle's radius; the triangle is equilateral, point-up at rotation 0, its corners at 1.2 r). Drawn shapes carry their corners as points in units of r, unturned, about the centre (a line is [-1,0] to [1,0]). Rotation turns the shape about its centre. Trimming a cornered shape rewrites it: the stretch left of its outline (u running 0..1 along the perimeter from the first corner) becomes its points, with open: true, the cut ends new corners (a second stretch, from trimming the middle of an open chain, becomes a new shape with a new id). An opened shape's inside, for naming areas, is its corners closed up. A circle instead keeps cuts: stretches [u0, u1] of its turn (from its rotation) taken away; what's left is drawn as arcs, whose ends are nodes that slide round the circle.
3. The outlines (what's left of them) become edges and every closed area they make is a "screen" (a planar arrangement): find every crossing exactly (segment-segment, segment-circle, circle-circle, arcs filtered to their angle range; a polyline's own segments too), add each open curve's ends as nodes, cut each outline into pieces between consecutive crossings (curved pieces as polylines, a point every ~3 px; both areas either side share the same points), and at each node order the pieces leaving it by their exact direction (the polygon side's direction, or the circle's tangent; a crossing on a corner uses the side after it leaving and the side before it arriving). Peel away pieces with a loose end, repeatedly (a stub bounds nothing). Walk the network: arriving at a node by a piece, leave by the piece just before the way back in that angular order; each walk closes a ring. Rings with positive signed area (shoelace, in window coordinates) bound areas; negative ones are the outside edge of a group of touching shapes and become a hole in the smallest area containing them. Ignore areas under 4 px². Each area is named by the shapes it is inside (a bit mask, bit = shape id; lines never count), read at a point surely inside it (the middle of the widest inside stretch on a few scanlines); a combination that falls into several separate pieces is several screens ("3", "3.2"...); enclosed areas inside no shape are gaps ("0.1"...); "0" is the background (the biggest area in the frame inside no shape). Each screen turns and scales around its area's centroid.
4. Draw the plain photo first, then each screen that isn't plain: ctx.save(); clip to its area (a Path2D of its rings, the 'evenodd' rule, so holes stay out); set globalAlpha = opacity and ctx.filter = blur(px) hue-rotate(deg) saturate() brightness() contrast() grayscale() invert() sepia(); translate to the region centre plus the move (x % of window width, y % of window height), rotate (deg), scale, translate back by the region centre; draw the covered photo again; ctx.restore().
5. Stroke the shape outlines: ${state.outline}px, ${state.outlineColour}.

Interaction: two modes, by zoom. A layout view (zoomed out to 60%, the frame as a white box on a dark workspace) edits the shapes, shown dashed with nodes and handles: a shape is grabbed only by its outline (within 10 px either side of the line; the outline under the pointer lights up solid white) to move it, a square handle on a corner scales it, a round handle just past another corner of a closed polygon (the one nearest the upper right, never the scale handle's) rotates it, that corner following the pointer (lines and open chains never turn or scale as a whole: no handles; a circle or arc has instead a diamond handle just outside the middle of what is left of it, which sets its radius about the same centre, an offset, with a dashed ghost of the start radius and an "r 180 · -24" read-out while dragged). Tools (chips, and keys V L R C P T): select; line (drag end to end, Shift for 15 degree steps); rectangle (drag corner to corner, Shift for a square); circle (drag from the centre); polygon (click corners, close on the first one, double-click or Enter); trim (click a piece of outline between two crossings to add it to that shape's cuts; a shape with nothing left is deleted). Nodes (every corner, line end, and a circle's centre) are drawn as small squares; dragging one moves that corner alone (the shape gets its own points, its centre re-set to the middle of its corners afterwards; a circle's centre moves the circle); the scale handle sits just past its corner. A dragged node and every drawn point snap, within 10 px, to the other shapes' nodes and the frame's corners, then crossings and loose ends (from the arrangement of the other shapes), then the nearest point on an edge, shown by a tick, a cross or a "mercedes" sign; Alt skips snapping. Nodes on the same spot are joined: dragging one moves all of them (Alt pulls one away). Double-clicking an edge inserts a corner at the nearest point of the nearest side (the perimeter is unchanged, so cut shares stay valid; a line becomes a polyline; circles have none). Pressing a corner picks it; Delete removes the picked corner (else the shape), as does dropping a corner on its neighbour in the same shape; at least 3 corners stay on a closed shape, 2 on a line; deleting an open chain's end corner drops its last side; a circle's arc ends can't be deleted. Collinear segments are split where an end of one lies on the other, and a straight piece duplicating another between the same nodes is dropped, so shared sides make clean areas. Text items (the text tool, key X; state.texts: { id, text, x, y as shares of the window, size = letter height as a share of the shorter side, rot }) are each one screen, key "t" + id, drawn over the areas without cutting them: the screen is painted whole on an offscreen layer (photo moved / turned / scaled about the text's centre, filters, overlays), cut to the letters with globalCompositeOperation 'destination-in' and fillText (900 weight Archivo, centred), and laid over the picture; the letters are outlined with the shapes' outline (at most 4% of the letter height). Picking at full size tests the text's turned box. In the layout view a text has a dashed box, a scale handle past its lower-right corner and a turn handle past its upper-right one; its words are edited in a field in the shapes section; Delete removes it. Ctrl-click (Cmd-click) trims with any tool, as Archicad's scissors: while the key is held the cursor is a scissors (black over a piece, white over empty space) and the piece under it is highlighted red. The frame's rectangle is an edge in the arrangement too (not a shape, never grabbed or trimmed): outlines are cut where they cross it and every area is split into its part in the frame and its part outside; the background ("0") is the biggest area in the frame inside no shape, other such areas are gaps. Delete removes the shape last grabbed; undo / redo (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y) step through snapshots of the shapes, up to 100. There the screens are locked (no picking, panning or wheel-scaling) and the panel shows only the shapes section; picking a drawing tool goes there. At full size the shapes are only drawn, the panel shows everything but the shapes section, and a press picks the screen under the pointer and dragging moves that screen's picture. At full size the wheel scales the screen under the pointer. A panel edits the picked screen's move x / y, rotate, scale, opacity, blur, hue, saturate, brightness, contrast, grey, invert and sepia.

Current shapes
${JSON.stringify(shapes, null, 2)}

Current texts
${JSON.stringify(state.texts.map(({ id, text, x, y, size, rot }) => ({ id, text, x: +x.toFixed(3), y: +y.toFixed(3), size: +size.toFixed(3), rotationDeg: +((rot * 180) / Math.PI).toFixed(1) })), null, 2)}

Areas: in the layout view a panel section lists every area in the frame (in the screens' order), each a text field holding its name ("area 1", "area 2"... until renamed); the layout view writes each area's name large (30 px, black in a white halo, no chip) at its inside point, and the row focused or hovered lights its area. Current names (by area, the rest go by "area <n>"):
${JSON.stringify(Object.fromEntries(areasNow().map((r, i) => [nameOf(r.key), areaName(r.key, i)])), null, 2)}

Overlays, drawn inside each screen's clip after its photo and not moved with it:
- texture: one of the randomize-studio pattern SVGs (black or currentColor on transparent; the screen's pattern id names it: 13 basic tiles by plain name, 87 Hero Patterns by Steve Schoger as "hero/<name>"), drawn into a tile canvas at patScale x devicePixelRatio, tinted with globalCompositeOperation 'source-in' and patColour, made a repeating pattern with setTransform(rotate(patRotate deg) then scale(1 / devicePixelRatio)), filled over the window at globalAlpha patOpacity with globalCompositeOperation patBlend
- static: random grey noise, one pixel per grainSize CSS px, regenerated grainFps times a second (0 = still), drawn stretched over the window with imageSmoothingEnabled false, at globalAlpha grain with globalCompositeOperation grainBlend

Current screens (only the values that differ from plain: ${Object.entries(PLAIN).map(([k, v]) => `${k} ${v === '' ? 'none' : v}`).join(', ')})
${JSON.stringify(screens, null, 2)}`;
}

bindCopyButton(document.getElementById('copyPrompt'), promptText);

// ---- layouts: the shapes alone (with their texts, area names and spots), kept in this browser, newest first ----
// Shown as small drawings, the frame's shape with the outlines in black on white, drawn afresh from the stored shapes
// (shares of the window) whenever the list is shown: no picture is stored. Loading one is an undo step.
const LAYOUTS_KEY = 'cubism:layouts';
const LAYOUT_THUMB = 64; // a drawing's longer side in CSS px; the other follows the window's shape
const layoutList = panel.querySelector('.layout-list');
const layoutSave = panel.querySelector('.layout-save');
const layoutArming = { id: null, timer: 0 }; // the layout whose trashcan was clicked once

const readLayouts = () => load(localStorage, LAYOUTS_KEY) ?? [];
function writeLayouts(list) {
  try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// the outlines (and texts' letters) of a set of shapes, drawn small: white, the frame's edge, then black lines
function drawLayout(canvas, layout) {
  const k = LAYOUT_THUMB / Math.max(W, H), w = Math.round(W * k), h = Math.round(H * k); // fits a LAYOUT_THUMB square
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  g.beginPath();
  g.rect(0, 0, W, H);
  g.clip(); // outlines run on past the frame; only the frame is drawn
  g.strokeStyle = g.fillStyle = '#000000';
  g.lineWidth = 1 / k;
  g.lineJoin = 'round';
  for (const s of layout.shapes) g.stroke(pathOf(s));
  for (const t of layout.texts ?? []) letters(g, t, false);
}

function saveLayout() {
  const list = readLayouts();
  list.unshift({ id: Date.now(), ...structuredClone({ shapes: state.shapes, texts: state.texts, areaNames: state.areaNames, areaSpots: state.areaSpots }) });
  if (!writeLayouts(list)) return; // storage blocked: nothing saved, nothing to flash
  renderLayouts();
  flash(layoutSave, 'is-saved');
}

function loadLayout(layout) {
  remember();
  const copy = structuredClone(layout);
  state.shapes = copy.shapes;
  state.texts = copy.texts ?? [];
  state.areaNames = copy.areaNames ?? {};
  state.areaSpots = copy.areaSpots ?? {};
  draft = null;
  areaListKey = '';
  shapesChanged();
}

function deleteLayout(id) {
  writeLayouts(readLayouts().filter(l => l.id !== id));
  renderLayouts();
}

// A saved thumbnail (a layout, a photo): a button that loads it, and in its corner, under the pointer, a trashcan that
// arms on the first click (the tile turns red) and deletes on a second within 4 s. arming is its list's { id, timer }.
function thumbTile(arming, id, label, content, onLoad, onDelete, rerender) {
  const tile = document.createElement('div');
  tile.className = arming.id === id ? 'thumb is-armed' : 'thumb';
  const loadButton = document.createElement('button');
  loadButton.type = 'button';
  loadButton.className = 'thumb-load';
  loadButton.title = `Load ${label}`;
  loadButton.setAttribute('aria-label', `Load ${label}`);
  loadButton.append(content);
  loadButton.addEventListener('click', onLoad);
  const trash = document.createElement('button');
  trash.type = 'button';
  trash.className = 'row-action';
  trash.dataset.mark = 'trash';
  trash.title = arming.id === id ? 'Click again to delete' : `Delete ${label}`;
  trash.setAttribute('aria-label', `Delete ${label}`);
  trash.addEventListener('click', () => {
    clearTimeout(arming.timer);
    if (arming.id === id) { arming.id = null; return onDelete(); }
    arming.id = id;
    arming.timer = setTimeout(() => { arming.id = null; rerender(); }, 4000);
    rerender();
  });
  tile.append(loadButton, trash);
  return tile;
}

// a list's empty state: one muted line
function thumbsEmpty(list, text) {
  const empty = document.createElement('p');
  empty.className = 'thumb-empty';
  empty.textContent = text;
  list.replaceChildren(empty);
}

function renderLayouts() {
  if (!W || !H) return; // drawn once the window is measured (resize)
  const list = readLayouts();
  if (!list.length) return thumbsEmpty(layoutList, 'No layouts yet: press save to keep these shapes.');
  layoutList.replaceChildren(...list.map(l => {
    const when = new Date(l.id).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const canvas = document.createElement('canvas');
    drawLayout(canvas, l);
    return thumbTile(layoutArming, l.id, `the layout saved ${when} (Ctrl+Z undoes)`, canvas, () => loadLayout(l), () => deleteLayout(l.id), renderLayouts);
  }));
}

layoutSave.addEventListener('click', saveLayout);

// the struck-through frame in the header: every shape and text off, the areas' names with them; one undo step
panel.querySelector('.layout-clear').addEventListener('click', e => {
  if (!state.shapes.length && !state.texts.length) return;
  remember();
  state.shapes = [];
  state.texts = [];
  state.areaNames = {};
  state.areaSpots = {};
  draft = null;
  areaListKey = '';
  flash(e.currentTarget, 'is-reset');
  shapesChanged();
});

// ---- templates: named looks kept in this browser (localStorage), newest first ----
// A look is the composition (shapes, texts, every screen, the area names, the outline) and the
// picture it was made on. The picture is kept by what it came from: a random photo by its picsum /seed/ address
// (the same seed always gives the same photo) and the default by its path, both a few bytes in the template; an
// uploaded file can't be fetched back from anywhere, so a copy goes to IndexedDB under the template's own key.
// The mode and the panel's folding are not part of a template.
const TEMPLATES_KEY = 'cubism:templates';
const LOOK_KEYS = ['shapes', 'texts', 'screens', 'areaNames', 'areaSpots', 'outline', 'outlineColour'];
const templateList = panel.querySelector('.template-list');
const templateName = field('template-name');
const templateSave = panel.querySelector('.template-save');
let armed = null; // the template whose trashcan was clicked once: a second click within a moment deletes it
let armTimer = 0;

const readTemplates = () => load(localStorage, TEMPLATES_KEY) ?? [];
function writeTemplates(list) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

const lookOf = s => ({ ...Object.fromEntries(LOOK_KEYS.map(k => [k, structuredClone(s[k])])) });

function nextName(list) {
  let n = list.length + 1;
  while (list.some(t => t.name === `template ${n}`)) n++;
  return `template ${n}`;
}

const photoKey = name => `template:${name}`; // where a template's uploaded photo is kept in IndexedDB

// the picture, as a template keeps it: { url } for an address, { stored: true } for a copied upload, or none
async function photoOf(name) {
  if (typeof imageSource === 'string') {
    await clearSavedImage(photoKey(name)); // an earlier version of this template may have stored an upload
    return { url: imageSource };
  }
  if (imageSource instanceof Blob && await saveImage(imageSource, photoKey(name))) return { stored: true };
  return null; // no picture yet, or storage refused it: the template keeps the look alone
}

// save under the typed name, or a numbered one; a name already in the list is updated in place
async function saveTemplate() {
  const list = readTemplates();
  const name = templateName.value.trim() || nextName(list);
  const entry = { name, saved: Date.now(), look: lookOf(state), photo: await photoOf(name) };
  const at = list.findIndex(t => t.name === name);
  if (at >= 0) list[at] = entry;
  else list.unshift(entry);
  if (!writeTemplates(list)) return; // storage blocked: nothing saved, nothing to flash
  state.template = name;
  templateName.value = name;
  renderTemplates();
  flash(templateSave, 'is-saved');
  keep();
}

function loadTemplate(t) {
  const { moving, ...look } = structuredClone(t.look); // moving: a template saved when the shapes could drift
  state = fromStored({ ...state, texts: [], ...look, template: t.name });
  openTrimmed(state.shapes);
  screenPickKey = '';
  areaListKey = ''; // the names come with the template
  forget();
  draft = null;
  activeId = null;
  measure();
  showState();
  requestRender();
  templateName.value = t.name;
  keep();
  restorePhoto(t);
}

// put the template's picture back, and make it the remembered one (as if picked by hand); a template saved
// without a picture, or whose upload is gone, leaves the current picture as it is
async function restorePhoto(t) {
  const source = t.photo?.url ?? (t.photo?.stored ? await loadSavedImage(photoKey(t.name)) : null);
  if (!source || source === imageSource || !(await setImage(source))) return;
  if (source === DEFAULT_IMAGE) clearSavedImage();
  else saveImage(source);
}

function deleteTemplate(name) {
  clearTimeout(armTimer); // the pending disarm would only redraw a row that is gone
  clearSavedImage(photoKey(name)); // its uploaded photo, if it kept one
  writeTemplates(readTemplates().filter(t => t.name !== name));
  if (state.template === name) state.template = null;
  armed = null;
  renderTemplates();
  keep();
}

function renderTemplates() {
  const list = readTemplates();
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'template-empty';
    empty.textContent = 'No templates yet: name this look and press save.';
    templateList.replaceChildren(empty);
  } else {
    templateList.replaceChildren(...list.map(t => {
      const row = document.createElement('div');
      row.className = ['template-row', t.name === state.template && 'is-selected', armed === t.name && 'is-armed'].filter(Boolean).join(' ');
      const loadButton = document.createElement('button');
      loadButton.type = 'button';
      loadButton.className = 'row-load';
      const picture = t.photo?.stored ? 'with its uploaded photo'
        : t.photo?.url === DEFAULT_IMAGE ? 'with the Dacia photo'
        : t.photo?.url ? 'with its random photo'
        : '(saved without a photo: the current one stays)';
      loadButton.title = `Load "${t.name}" ${picture}`;
      loadButton.setAttribute('aria-pressed', String(t.name === state.template));
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = armed === t.name ? `delete "${t.name}"? click the trash again` : t.name; // the armed row says what the next click does
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = new Date(t.saved).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      loadButton.append(name, meta);
      loadButton.addEventListener('click', () => loadTemplate(t));
      row.append(loadButton);
      // the picked row carries its trashcan (a row, not one button: a button can't hold another)
      if (t.name === state.template) {
        const trash = document.createElement('button');
        trash.type = 'button';
        trash.className = armed === t.name ? 'row-action is-armed' : 'row-action';
        trash.dataset.mark = 'trash';
        trash.title = armed === t.name ? 'Click again to delete' : `Delete "${t.name}" from this browser`;
        trash.setAttribute('aria-label', `Delete ${t.name}`);
        trash.addEventListener('click', () => {
          if (armed === t.name) return deleteTemplate(t.name);
          armed = t.name;
          clearTimeout(armTimer);
          armTimer = setTimeout(() => { armed = null; renderTemplates(); }, 4000); // long enough to read the row and click again
          renderTemplates();
        });
        row.append(trash);
      }
      return row;
    }));
  }
  showSaveTitle();
}

// the save button says whether it will add a template or update one
function showSaveTitle() {
  const name = templateName.value.trim();
  const exists = name && readTemplates().some(t => t.name === name);
  templateSave.title = exists ? `Update "${name}" with this look` : 'Save this look as a new template in this browser';
}

templateSave.addEventListener('click', saveTemplate);
templateName.addEventListener('input', showSaveTitle);
templateName.addEventListener('keydown', e => { if (e.key === 'Enter') saveTemplate(); });

// ---- the photo: upload, drop, or back to the default; an upload is remembered for the next visit ----
const imagePreview = panel.querySelector('.image-preview');

async function setImage(source) {
  const url = source instanceof Blob ? URL.createObjectURL(source) : source;
  const img = new Image();
  if (!(source instanceof Blob)) img.crossOrigin = 'anonymous'; // a random photo comes from picsum: keep the canvas clean
  img.src = url;
  try {
    await img.decode();
  } catch {
    say('Could not read that image');
    return false;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl); // the previous upload, only once the new one has loaded
  objectUrl = source instanceof Blob ? url : null;
  imageSource = source; // kept so a template can save the picture with the look
  say(''); // a "loading a random photo" message is done
  imagePreview.src = url; // the thumbnail above the buttons
  imagePreview.hidden = false;
  renderPhotos(); // frame the saved photo in use, if it is one
  showPhotoSave();
  image = img;
  showMode();
  requestRender();
  return true;
}

function useFile(file) {
  saveImage(file);
  setImage(file);
}

field('image-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) useFile(file);
  e.target.value = ''; // so picking the same file again still fires change
});

// the struck-through picture in the header: the image cleared, back to the default
panel.querySelector('.image-default').addEventListener('click', e => {
  flash(e.currentTarget, 'is-reset');
  clearSavedImage();
  setImage(DEFAULT_IMAGE);
});

// ---- saved photos: random photos kept by their picsum /seed/ address (the same seed always gives the same photo) ----
const PHOTOS_KEY = 'cubism:photos';
const photoList = panel.querySelector('.photo-list');
const photoSave = panel.querySelector('.image-save');
const photoArming = { id: null, timer: 0 };

const readPhotos = () => load(localStorage, PHOTOS_KEY) ?? [];
function writePhotos(list) {
  try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
const isRandomPhoto = source => typeof source === 'string' && source !== DEFAULT_IMAGE;
const thumbOf = url => url.replace(/\/\d+\/\d+$/, '/128/80'); // the same seed, small

// Save is live only for a random photo not kept yet; its title says why when it isn't
function showPhotoSave() {
  const kept = readPhotos().some(p => p.url === imageSource);
  photoSave.disabled = !isRandomPhoto(imageSource) || kept;
  photoSave.title = kept ? 'This photo is saved already'
    : isRandomPhoto(imageSource) ? 'Keep this random photo (its address) in this browser'
    : 'Only a random photo can be saved: its address brings it back';
}

function renderPhotos() {
  const list = readPhotos();
  photoList.replaceChildren(...list.map(p => {
    const img = document.createElement('img');
    img.src = thumbOf(p.url);
    img.alt = '';
    img.loading = 'lazy';
    const when = new Date(p.saved).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const tile = thumbTile(photoArming, p.saved, `the photo saved ${when}`, img, async () => { if (await setImage(p.url)) saveImage(p.url); }, () => {
      writePhotos(readPhotos().filter(q => q.saved !== p.saved));
      renderPhotos();
      showPhotoSave();
    }, renderPhotos);
    tile.classList.toggle('is-current', p.url === imageSource);
    return tile;
  }));
}

photoSave.addEventListener('click', () => {
  if (!isRandomPhoto(imageSource) || !writePhotos([{ url: imageSource, saved: Date.now() }, ...readPhotos()])) return;
  renderPhotos();
  showPhotoSave();
  flash(photoSave, 'is-saved');
});

// a random photo, as randomize-studio's: picsum.photos with a fresh seed. A /seed/ address gives the same photo
// every time, so it can be remembered across refreshes like an upload (the address is stored, not the pixels).
panel.querySelector('.image-random').addEventListener('click', async () => {
  const url = `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 10)}/1600/1000`;
  say('Loading a random photo…', 0);
  if (await setImage(url)) saveImage(url);
});

stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('is-dragging'); });
stage.addEventListener('dragleave', () => stage.classList.remove('is-dragging'));
stage.addEventListener('drop', e => {
  e.preventDefault();
  stage.classList.remove('is-dragging');
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (file) useFile(file);
});

// ---- start ----
fineTune(panel); // a small ▲ / ▼ at the end of every slider row
openTrimmed(state.shapes); // trims saved as cuts on cornered shapes, from before they opened into chains
showState();
new ResizeObserver(resize).observe(stage);
const saved = await loadSavedImage();
if (!saved || !(await setImage(saved))) await setImage(DEFAULT_IMAGE);
