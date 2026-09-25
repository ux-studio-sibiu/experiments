/* state — what a cover is made of.
   The model and the lists derived from it: which blocks exist, which of them
   hold copy, which are layers inside a section. Everything else reads this.
   
   Loaded first: every other file assumes `state`, `els`, `$` and the role
   lists already exist. */

/* ============================ state ============================ */
const state = {
  // A background DESCRIPTOR, never a URL: a picsum seed, a gradient preset name
  // or a bundled image path, resolved to a URL at paint time. A URL would not
  // survive a save — picsum's ?random= is a cache-buster that hands back a
  // different photo each call, and a gradient's data: URI is ~100KB of base64.
  // How it is fitted is not a choice: centred cover, stated once in the CSS.
  // `sat` and `blur` are treatment rather than content: they belong to the
  // picture, not to which picture it is, so they survive a re-roll of the
  // photograph itself.
  bg: { enabled: true, kind: "photo", seed: 'studio', preset: null, src: null, sat: 1, blur: 0 },
  // A drawn background from the svgbackgrounds.com set, with the edits made to
  // it: which colours were swapped, which palette was laid over it, and the
  // shift applied to the lot. All scalars and a flat map, so it saves and
  // reloads like everything else. The editor is js/svg-background.js.
  svgbg: { enabled: false, id: null, overrides: {}, hue: 0, sat: 0, light: 0, scale: 1, palette: null, palRot: 0 },
  scrim: { enabled: true, amount: 0.35, color: 'dark' },
  // Grain. In state like every other layer now, rather than living only in the
  // instance and its inputs — a sub-layer has to be readable to be rollable.
  fx: { enabled: false, opacity: 0.12, fps: 24, cell: 2 },
  // Not a container, and no longer a panel section either: these are the
  // parameters the stack was last laid out with. Randomize rolls them and
  // restack() reads them; from then on each block owns its own position, which
  // is why there is nothing here to adjust by hand.
  layout: { align: 'left', vAlign: 'center', colW: 940, margin: 54 },
  // A texture laid over the menu bar: an SVG tile from ./overlay-patterns/ used
  // as a mask, tinted and blended. Top-level rather than nested inside
  // `topmenu`, so every block's state stays flat and a shallow copy of one is
  // still a whole copy of it — this object is cloned explicitly on save.
  pattern: { enabled: false, name: 'polka-dots', scale: 1, opacity: 0.35, color: '#ffffff', blend: 'normal', rotate: 0 },
  // The plate: a flat rectangle behind the type, which is what the old card
  // was, except it is now a block of its own and can be placed anywhere.
  plate: { enabled: false, x: 54, y: 240, boxW: 940, boxH: 380, color: '#000000', alpha: 0.36 },
  //                                         x, y and the box are artboard px; every block carries its own
  heading:    { enabled:true, font:'Playfair Display', weight:700, size:96, lh:1.04, ls:-0.01, italic:false, transform:'none', align:'left', amount:5,   color:'#ffffff', shadow:true, x:54, y:250, boxW:940, boxH:40 },
  subheading: { enabled:true, font:'Inter',           weight:500, size:22, lh:1.35, ls:0.18,  italic:false, transform:'uppercase', align:'left', amount:11, color:'#ffffff', shadow:true, x:54, y:400, boxW:940, boxH:30 },
  body:       { enabled:true, font:'Inter',           weight:400, size:18, lh:1.7,  ls:0,     italic:false, transform:'none', align:'left', columns:2, amount:180, color:'#ffffff', shadow:true, x:54, y:470, boxW:940, boxH:40 },
  // `anchor` is which point of the WINDOW x and y are measured from — two
  // letters, vertical then horizontal, from 'tl' to 'br'. It is what makes a
  // saved position survive a different window: a bar anchored 'br' stays in the
  // bottom-right corner rather than at some number of pixels that only meant
  // the corner on the screen it was saved from.
  topmenu:    { enabled:true, anchor:'tl', links:4, font:'Inter', weight:500, size:14, ls:0.08, transform:'uppercase', align:'spread', gap:28, pad:28, color:'#ffffff', shadow:true, brand:true, bg:'#0b0b0d', bgA:0, x:0, y:0, boxW:null, boxH:null },
  // The call to action. `style` names one of the ten shapes in css/cta.css; the
  // padding around the label follows `size`, and a box of your own comes from
  // the corner handles. Off until you ask for it: a cover does not always want
  // a button on it.
  cta:        { enabled:false, text:'Get started', style:'solid', font:'Inter', weight:600, size:16, ls:0.04,
                transform:'none', color:'#ffffff', bg:'#000000', bgA:1, radius:4, shadow:false, x:54, y:650, boxW:null, boxH:null },
};
/* The cover as it starts, kept whole and untouched.

   A scene describes the WHOLE cover, so a scene that does not mention a layer
   means that layer is off — not that it keeps whatever is on screen. Scenes
   saved before a layer existed say nothing about it, and without a default to
   fall back to, loading an old one leaves the newer layers from the cover you
   were just looking at sitting on top of it. */
const DEFAULTS = structuredClone(state);

const locks = { heading:false, subheading:false, body:false, bg:false, topmenu:false, plate:false, cta:false,
                background:false, typography:false, webelements:false, scrim:false, pattern:false, fx:false, svgbg:false };
const $ = (id) => document.getElementById(id);

// One source of truth for what the cover is made of. ROLES drives the panel
// (it carries the section headings); the rest are derived, so adding a block
// means touching this and nothing else.
//
// Three lists because there are three genuinely different capabilities: copy you
// can type into, anything with a font, and anything you can place on the cover.
// The plate has no text and no font but is placed and resized like the rest.
const ROLES = [['heading','Heading'],['subheading','Subheading'],['body','Body / columns']];
const TEXT_ROLES = ROLES.map(([r]) => r);
const TYPE_BLOCKS = [...TEXT_ROLES, 'topmenu', 'cta'];
const BLOCKS = [...TYPE_BLOCKS, 'plate'];

/* ---- sub-layers ----
   A section can be made of several independent layers: the background is a
   picture with a scrim, a pattern and grain stacked over it. Each wants the
   three controls a section header has — show, re-roll, lock — and this is the
   only place that knows they exist.

   Everything else is already generic. The eye, dice and lock handlers all work
   off data attributes, so a NEW layer needs exactly three things: a state
   object with `enabled`, an entry here naming its parent section and how to
   roll it, and the markup (a `.sub` with an `h4` carrying the three buttons and
   a `.sub-body`). Nothing below has to change.

   The roll functions are hoisted declarations defined further down, with the
   rest of the randomizers. Declaration order IS roll order, and for the type it
   matters: the body and the subheading are picked to sit against the heading,
   so the heading goes first. */
const SUBLAYERS = {
  bg:         { of: 'background', roll: () => randomBg() },   // the picture itself
  svgbg:      { of: 'background', roll: () => SVGBG.roll() },
  scrim:      { of: 'background', roll: () => rollScrim() },
  pattern:    { of: 'background', roll: () => rollPattern() },
  fx:         { of: 'background', roll: () => rollFx() },
  heading:    { of: 'typography', roll: (fontsOnly) => rHeading(fontsOnly) },
  body:       { of: 'typography', roll: (fontsOnly) => rBody(fontsOnly) },
  subheading: { of: 'typography', roll: (fontsOnly) => rSub(fontsOnly) },
  // The plate has nothing to roll: it is a rectangle, and where it goes is
  // either where you put it or wrapped around the text, which its own dice
  // does. It is here so that it counts as a layer of Typography — locking the
  // section holds the plate too, and rollable() is what reads that.
  plate:      { of: 'typography', roll: () => {} },
  topmenu:    { of: 'webelements', roll: (fontsOnly) => rTopMenu(fontsOnly) },
  cta:        { of: 'webelements', roll: () => CTA.roll() },
};
// A layer is rolled only if neither it nor the section holding it is locked.
// Works for a plain section too, where there is no parent to consult.
const rollable = (k) => !locks[k] && !locks[SUBLAYERS[k]?.of];

// The panel ids the three copy roles use are their own names; the menu's are
// prefixed `tm`. One map, so the two do not need two copies of every function.
const UI = { heading:'heading', subheading:'subheading', body:'body', topmenu:'tm', plate:'plate', cta:'cta' };

const els = Object.fromEntries(BLOCKS.map(k => [k, $(k)]));

// Fixed parts of the stage, looked up once: render() runs on every slider tick.
const bgLayer = $('bgLayer'), scrimEl = $('scrim');

const hexRgba = (hex, a) => {
  const h = hex.replace('#',''); const f = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(f, 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
};
// trim trailing zeros for slider value read-outs (e.g. 0.150 -> "0.15", 0 -> "0")
const fmt = (v) => (+v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
