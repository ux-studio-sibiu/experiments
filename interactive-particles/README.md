# Interactive Particles

An image turned into thousands of drifting particles; the pointer leaves a fading trail that pushes them aside, and
a new image scatters the old one and assembles itself. A reproduction of the Codrops tutorial
[Interactive Particles with Three.js](https://tympanus.net/codrops/2019/01/17/interactive-particles-with-three-js/)
(Bruno Imbrizi, 2019): the same technique for three.js r170, no build step, no GSAP.

- `interactive-particles.js` is the module to copy.
- `index.html` + `main.js` are the page: the effect full-screen with the studio panel (every control, upload, save,
  reset, copy prompt).
- `shared/` holds the page's helpers (panel CSS, upload memory, saved settings, fine-tune arrows, copy button), and
  `vendor/` the randomize-studio panel, copied in.

Run it from a server, because ES modules don't load over `file://`. Use the `interactive-particles` entry in
`.claude/launch.json` (port 8134), or any static server pointed at this folder.

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
    image: 'img/walter-gropius-1919.jpg'
  });
</script>
```

The canvas fills the container and follows its size. Images with a dark background work best: dark pixels get no
particle. For a dark subject on a light background, set `invert: true` and a light `background`.

## Options

The page (`index.html`) opens with its own look: **dark particles**
(`invert: true`) on a white `background`, `gridSize: 115`, `threshold: 64`, `brightness: -15`, `contrast: 0.9`,
`size: 1.7`, `variation: 0.55`, `random: 0.8`, `depth: 3.4`, `speed: 1.45`, `idle: 1`, `touchRadius: 0.21`,
`touchTrail: 1.9`, `touchPush: 13`. Reset in its panel goes back to those. A look saved with the save button wins
over them, until the page's defaults change: then it is dropped.

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
| `grey` | `false` | particles in grey (the original's look) instead of the image's colours |
| `random` | `2` | scatter from the pixel, in grid pixels |
| `depth` | `4` | drift towards and away from the camera |
| `speed` | `1` | speed of the noise; 0 freezes it |
| `idle` | `1` | the noise's speed while the pointer is away from the canvas, as a share of `speed`: 0 still until pointed at |
| `touchRadius` | `0.15` | size of the pointer's trail dot, as a share of the image width |
| `touchTrail` | `2` | seconds a trail point takes to fade |
| `touchPush` | `20` | how far a touched particle is pushed, in grid pixels |
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

`img/walter-gropius-1919.jpg`: Walter Gropius, founder of the Staatliches Bauhaus Weimar, around 1919. Photographer
unknown. **Public domain**, via
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:WalterGropius-1919.jpg) (540 × 763). The page's
default image; the **Gropius** button in the panel brings it back.
