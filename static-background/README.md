# static-background

Animated film-grain / TV-static overlay — the grainy texture that fades in
behind navigation menus on sites like [newformcap.com](https://www.newformcap.com/).
Zero dependencies, pure Canvas 2D, ~5 KB.

![demo](open index.html)

## Why it's cheap

- Noise is generated into a **downscaled buffer** (1 px per `cellSize`) and
  stretched to fill with smoothing off — far fewer pixel writes than full-res.
- Refreshes are **throttled to a film-grain frame rate** (`fps`, default 24),
  not 60 fps.
- It **pauses automatically** while hidden or when the browser tab is in the
  background, and honours `prefers-reduced-motion` (renders one still frame).

## Quick start

```html
<div id="menu" style="position:fixed; inset:0;"> … nav links … </div>

<script type="module">
  import { createStaticBackground } from './static-background.js';

  const fx = createStaticBackground({
    container: document.getElementById('menu'),
    opacity: 0.10,
  });

  // wire it to your menu open/close
  openBtn.addEventListener('click', () => fx.show());
  closeBtn.addEventListener('click', () => fx.hide());
</script>
```

Or drop it in with a plain `<script src="static-background.js">` tag — it also
exposes `window.createStaticBackground`.

> The canvas is `position:absolute; inset:0` and fills its `container`, so the
> container must be positioned (`relative`/`fixed`/`absolute`). It sits at
> `z-index: 9999` *inside* the container, so give your menu content a higher
> `z-index` (and `position`) to keep it above the grain.

Open [`index.html`](index.html) for a full working menu-overlay demo with live
controls.

## Options

All options can also be changed at runtime via `fx.set(name, value)`.

| Option | Default | Description |
| --- | --- | --- |
| `container` | `document.body` | Element the canvas fills. |
| `opacity` | `0.10` | Peak opacity of the grain (0–1). |
| `fps` | `24` | Grain refresh rate. Lower = chunkier, more "film". |
| `cellSize` | `1.5` | Size of one noise cell in CSS px. Larger = blockier. |
| `density` | `1` | Fraction of cells lit each frame (0–1). `1` = dense TV snow. |
| `color` | `null` | `[r,g,b]` 0–255 tint, or `null` for neutral grayscale. |
| `image` | `null` | Background image to mix the grain into: a URL string, an `HTMLImageElement`/`HTMLCanvasElement`, or `null`. |
| `imageFit` | `'cover'` | How the image fills the canvas: `'cover'`, `'contain'`, or `'fill'`. |
| `grainBlend` | `'overlay'` | How the grain blends over the image/colour (canvas composite op): `'overlay'`, `'soft-light'`, `'screen'`, `'source-over'`, … |
| `background` | `'transparent'` | Flat colour painted behind the grain (and behind the image). |
| `blendMode` | `'normal'` | CSS `mix-blend-mode` of the whole canvas vs. the page behind it. |
| `fade` | `320` | show()/hide() fade duration in ms. |
| `zIndex` | `9999` | Stacking order of the overlay canvas. |
| `passthrough` | `true` | Let pointer events reach content underneath. |
| `autostart` | `false` | Start visible immediately. |
| `respectReducedMotion` | `true` | Render a single still frame if the user prefers reduced motion. |

## API

```js
const fx = createStaticBackground(options);

fx.show();            // fade in + start animating
fx.hide();            // fade out, then idle (stops the RAF loop)
fx.toggle(force?);    // show/hide, or force a boolean state
fx.start() / fx.stop();   // animation loop control without touching opacity
fx.set(name, value);  // change any option live (returns fx, chainable)
fx.setImage(src);     // set/replace/clear the background image (url | element | null)
fx.resize();          // re-measure the container (auto on ResizeObserver/resize)
fx.visible;           // boolean getter
fx.canvas;            // the underlying <canvas>
fx.destroy();         // stop, detach listeners, remove the canvas
```

## Recipes

```js
// Subtle whole-page film grain, always on, multiplied over content
createStaticBackground({ opacity: 0.05, blendMode: 'overlay', autostart: true });

// Strong, coarse TV-static page background (the demo's default look)
createStaticBackground({ opacity: 0.30, cellSize: 3, density: 1, fps: 24, autostart: true });

// Coarse, slow, sci-fi cyan snow
createStaticBackground({ cellSize: 3, fps: 12, color: [120, 200, 255], opacity: 0.18 });

// Sparse drifting specks instead of dense snow
createStaticBackground({ density: 0.15, opacity: 0.25 });

// Filmic grain mixed over a background photo
const fx = createStaticBackground({
  image: 'hero.jpg', imageFit: 'cover',
  grainBlend: 'overlay', opacity: 0.18, autostart: true,
});
fx.setImage('other.jpg');   // swap the photo at any time
fx.setImage(null);          // remove it (grain falls back to transparent)
```
