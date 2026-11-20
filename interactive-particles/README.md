# Interactive Particles

An image turned into thousands of drifting particles; the pointer leaves a fading trail that pushes them aside, and
a new image scatters the old one and assembles itself. A reproduction of the Codrops tutorial
[Interactive Particles with Three.js](https://tympanus.net/codrops/2019/01/17/interactive-particles-with-three-js/)
(Bruno Imbrizi, 2019): the same technique for three.js r170, no build step, no GSAP.

- `interactive-particles.js` is the module to copy.
- `index.html` + `main.js` are the page: the effect full-screen with the studio panel (every control, upload, copy
  prompt).
- `shared/` holds the page's helpers (panel CSS, upload memory, saved settings, fine-tune arrows, copy button), and
  `vendor/` the randomize-studio panel, copied in.

Run it from a server, because ES modules don't load over `file://`. The page's images live in the collection's
`sample-media/img/interactive-particles/`, so serve the **collection root**: the `effects-collection` entry in
`.claude/launch.json` (port 8130), then open `/interactive-particles/`.

## The panel's image section

The first section, Source, offers images as tiles, each a **preset**: a click brings that image on screen with its own look
(every slider, switch and chip). Your upload (the dotted **Upload image** tile at the end of the row, or a photo dropped on the page) gets a
tile of its own after them, and keeps whatever look is on when you pick it. The picked tile is remembered with the
rest of the panel; the upload itself is kept in IndexedDB.

The section is **Source**. Its tiles and the upload are there whatever the source; under them, two tabs pick it,
**image** or **text**, and show that one's options: the image's brightness and contrast, or the text's words,
spacing, line height and colour (the letters are drawn in ink, or white, so the threshold always keeps them; the
colour then tints every particle, the effect's `tint` option). A **text preset** is a tile too, its thumbnail the words drawn; picking it switches to text and fills the
words (`PRESETS` entries with `text:` instead of `file:`). The words are set in Archivo black, centred, and drawn into a picture (ink on paper for dark particles, white on black for light ones, so the
threshold keeps the letters); typing redraws after a short pause, straight to the new letters. Text is drawn
untoned; background, fit / cover and fill edges sit below the tabs and apply to either.

Every section folds: click its header (or Enter on its chevron). Motion and Touch start shut; what you fold is
kept for the tab (`shared/fold.js`, from the design system).

To add an image:
1. Put it (max 1600px, JPEG q82) in `sample-media/img/interactive-particles/`, and a 160px thumbnail with the same
   name in its `thumbs/`.
2. Credit it in that folder's `CREDITS.md` (source, author, licence).
3. Add an entry to `PRESETS` in `main.js`: `{ id, name, file, credit, values }`. `values` are the panel's control
   names with the values to set (`'grid-size': '140', invert: false, background: '#000000', shape: '1'`...); anything
   left out takes the panel's default. The copy button's prompt lists every current value to copy from.

## Use

```html
<script type="importmap">
  { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js" } }
</script>

<div class="hero" style="height: 70vh; background: #000"></div>

<script type="module">
  import { createInteractiveParticles } from './interactive-particles.js';

  const fx = createInteractiveParticles({
    container: document.querySelector('.hero'),
    image: 'portrait.jpg'
  });
</script>
```

The canvas fills the container and follows its size. Images with a dark background work best: dark pixels get no
particle. For a dark subject on a light background, set `invert: true` and a light `background`.

## Options

The page (`index.html`) opens with its own look, the **SURE / SHOT** text preset (`DEFAULT_PRESET` in `main.js`: its
values become the panel's defaults and the effect's starting options, so changing the default look is one edit): text, letter spacing -0.07, line
height 0.8, **dark particles** (`invert: true`) tinted black on yellow `#ffd22e`, `gridSize: 95`, `threshold: 185`,
`cover: 0.33`, `size: 1.05`, `variation: 0`, `random: 0`, `depth: 0`, `speed: 0`, `idle: 0` (still), `touchRadius: 0.17`,
`touchTrail: 0.2`, `touchPush: 10`. What you change is kept for the tab (a refresh keeps
it); a new tab opens with these. A tab's record made under other defaults is dropped, so new defaults always show.

| Option | Default | What it does |
|---|---|---|
| `container` | (required) | element the canvas fills |
| `image` | `null` | first image: a URL, a `File` / `Blob`, or an `<img>` |
| `gridSize` | `240` | longest side of the particle grid in pixels (one particle per pixel, so cost grows with its square) |
| `brightness` | `0` | added to every pixel (-100 to 100) before the threshold, the size and the colour |
| `contrast` | `1` | every pixel scaled about mid-grey first: below 1 flatter, above 1 harder |
| `threshold` | `34` | pixels darker than this (0-255) get no particle |
| `invert` | `false` | keep the dark pixels instead, skipping those lighter than `255 - threshold`; size follows darkness |
| `size` | `1.5` | particle diameter in grid pixels, before brightness and noise scale it |
| `variation` | `1` | how much brightness and noise vary the size: 0 all equal, 1 the original, 2 more contrast |
| `shape` | `0` | 0 circle, 1 square, 2 diamond, 3 ring, 4 cross (`SHAPES` lists the names) |
| `edge` | `0.3` | softness of the shape's edge: 0 crisp, 0.5 a glow |
| `tint` | `''` | one colour every particle takes instead of the image's (`'#c0392b'`); `''` keeps the image's colours |
| `grey` | `false` | particles in grey (the original's look) instead of the image's colours |
| `random` | `2` | scatter from the pixel, in grid pixels |
| `depth` | `4` | drift towards and away from the camera |
| `speed` | `1` | speed of the noise; 0 freezes it |
| `idle` | `1` | the noise's speed while the pointer is away from the canvas, as a share of `speed`: 0 still until pointed at |
| `touchRadius` | `0.15` | size of the pointer's trail dot, as a share of the image width |
| `touchTrail` | `2` | seconds a trail point takes to fade |
| `touchPush` | `20` | how far a touched particle is pushed, in grid pixels |
| `fill` | `false` | particles beyond the image too, so the container's edges are covered: the image continues mirrored past its edges, on a grid half as fine (a quarter of the density), kept by the same threshold; the pointer reaches them too |
| `cover` | `0` | how the image sizes to the container: 0 fits all of it inside with a margin, 1 covers the container edge to edge (cropped), between them in even steps; the camera moves, so the same particles get bigger (none are added) |
| `transition` | `1.2` | seconds for a new image to assemble (the old one scatters in 60% of that); 0 = instant |
| `background` | `'#000000'` | clear colour |
| `respectReducedMotion` | `true` | under `prefers-reduced-motion`: no noise motion, no transitions; a touch still plays out |
| `onUpdate` | `null` | called with `{ width, height, count }` whenever the particles are rebuilt |

## API

```js
const fx = createInteractiveParticles(options);

fx.setImage(source);      // URL, File / Blob or <img>; scatters the current image, assembles the new one. Returns a Promise.
fx.set('shape', 1);       // any option at runtime; gridSize, threshold and invert rebuild, the rest are uniforms
fx.get();                 // a copy of the current options
fx.info();                // { width, height, count } of the current grid, or null before the first image
fx.touchCanvas;           // the 64 x 64 trail texture, to show as a debug preview
fx.destroy();             // stops the loop, removes listeners and observers, frees every GPU resource
```

Also exported: `DEFAULTS` and `SHAPES`, and `window.createInteractiveParticles` for plain `<script type="module">` use.

## Behaviour

- **Performance:** one instanced quad, one draw call. All motion is in the vertex shader; JavaScript sends one
  float (time) and a 64 x 64 texture per frame. `devicePixelRatio` is capped at 2.
- **Budget (a rough guide, not a measurement):** up to 50,000 particles runs smoothly almost anywhere, phones
  included (the original topped out at 57,600). 50,000-100,000 is fine on laptops but older phones may drop frames.
  100,000-150,000 may stutter on integrated GPUs, especially full-screen with large particles. Beyond that, expect
  dropped frames on most non-gaming hardware. Particle size matters as well, because every overlap is blended.
  `fx.info().count` gives the current number, and the build colours it yellow / orange / red.
- **Pauses itself:** an IntersectionObserver stops the loop while the canvas is off screen, and the browser pauses
  background tabs.
- **Cleans up:** geometry, materials, the image texture, the touch texture and the renderer are disposed on every
  swap and in `destroy()`, and the WebGL context is released.

## Recipes

- **Logo or line drawing on white:** `invert: true, background: '#ffffff', shape: 1, edge: 0, variation: 0`. You get
  crisp square ink dots that part under the pointer.
- **Halftone:** `variation: 0, random: 0, depth: 0, speed: 0, shape: 0, edge: 0.1`. An even, still dot screen
  where only the pointer moves anything.
- **Dust portrait:** `size: 0.8, variation: 2, random: 6, depth: 12, grey: true`. The original's grey, looser and
  deeper.
- **Slideshow:** call `fx.setImage(next)` on a timer; every swap scatters and reassembles.

The `STEP 02`-`STEP 05` comments in the module mark the stages the effect was built up in: instancing, shader motion,
the touch texture, and transitions.

## Image credit

The images, their sources and licences are listed in `sample-media/img/interactive-particles/CREDITS.md`. The default
is Walter Gropius, founder of the Staatliches Bauhaus Weimar, around 1919: photographer unknown, **public domain**, via
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:WalterGropius-1919.jpg).
