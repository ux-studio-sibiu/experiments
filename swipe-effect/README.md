# swipe-effect

A scroll-driven diagonal wipe from one full-screen image to the next, chained into a story. After the
before/after section on [kota.co.uk/work/dka](https://kota.co.uk/work/dka): a slanted edge sweeps across the
frame as you scroll, a thin line in the brand colour riding it, the leaving image darkening as it goes.
Zero dependencies - CSS `clip-path` on a `position: sticky` stage and one scroll listener.

## Quick start

The content stays in the page; the module only drives it. Slides stack first-on-top, and each optional
`.chapter` (same order as the slides) crossfades in step with the wipe.

```html
<section class="nsc-swipe-story">
  <div class="stage">
    <figure class="slide"><img src="dawn.jpg" alt=""></figure>
    <figure class="slide"><img src="noon.jpg" alt=""></figure>
    <figure class="slide"><img src="night.jpg" alt=""></figure>
    <div class="chapter"><h2>Dawn</h2></div>
    <div class="chapter"><h2>Noon</h2></div>
    <div class="chapter"><h2>Night</h2></div>
  </div>
</section>

<script type="module">
  import { createSwipeEffect } from './swipe-effect.js';
  createSwipeEffect({ container: document.querySelector('.nsc-swipe-story') });
</script>
```

Or load it with a plain `<script src="swipe-effect.js">` - it also exposes `window.createSwipeEffect`.

Open [`index.html`](index.html) for the demo, "A day above the treeline", with live sliders. It loads its
photos from `../sample-media/img/`, so serve the collection root (the `swipe-effect` entry in
`.claude/launch.json` does) rather than this folder on its own.

## Options

All options can also be changed at runtime via `fx.set(name, value)`.

| Option | Default | Description |
| --- | --- | --- |
| `container` | - | The section. Required. Its height is set from the slide count and `step`. |
| `stageSelector` / `slideSelector` / `chapterSelector` | `.stage` / `.slide` / `.chapter` | What to drive inside it. |
| `step` | `120` | Scroll per wipe, in % of the screen height. |
| `hold` | `0.3` | Share of each step spent still, split before and after the wipe. |
| `slant` | `20` | How far the top of the edge leads the bottom, in % of the width. `0` is a vertical wipe. |
| `direction` | `'ltr'` | `'ltr'` sweeps left to right, `'rtl'` right to left. |
| `divider` | `0.5` | Width of the edge line in % of the width; `0` hides it. |
| `dividerColor` | `'#7f7d69'` | The line's colour (Kota's DK&A green-grey). |
| `shade` | `0.8` | Darkness on the leaving image at the end of its wipe. |
| `zoom` | `1.08` | The image being uncovered settles from this scale to 1. `1` turns it off. |
| `smooth` | `0.15` | `0` follows the scroll exactly; higher eases toward it. |
| `onUpdate` | `null` | `(progress, index, t)` on every rendered frame - for clocks, counters, progress bars. |
| `respectReducedMotion` | `true` | Under reduced motion: no zoom, no smoothing; the wipe still follows the scroll. |

## API

```js
const fx = createSwipeEffect(options);
fx.set(name, value);      // change any option live (returns fx, chainable)
fx.setSlide(i, source);   // swap slide i for a URL, or an <img>/<canvas>/<video> element
fx.resize();              // re-measure (done on window resize already)
fx.destroy();             // remove listeners and added nodes, give the markup its own styles back
```

## Recipes

```js
// Faithful to Kota: one before/after pair, steep edge, no zoom, no captions
createSwipeEffect({ container, slant: 20, zoom: 1, hold: 0.1, step: 150 });

// A product reveal: vertical edge, thick brand-coloured line, quick steps
createSwipeEffect({ container, slant: 0, divider: 1.5, dividerColor: '#ff4d00', step: 60, shade: 0.4 });

// A timeline that reads right to left, with a live year counter
createSwipeEffect({ container, direction: 'rtl', onUpdate: (p) => (year.textContent = Math.round(1900 + p * 125)) });
```

More ideas: before/after renovation shots, a sketch wiping to the built building, a video slide as the last
chapter (`<video muted loop autoplay>` inside a `.slide`), or one painting's layers (underdrawing, colour, varnish).

> Reproduction, not a copy. The clip-path values follow Kota's GSAP timeline (from `polygon(20% 0, 100% 0,
> 100% 100%, 0% 100%)` to `polygon(120% 0, 100% 0, 100% 100%, 100% 100%)`, a 0.5% line, the cover to 0.8),
> but the pin is CSS `position: sticky` instead of ScrollTrigger, the edge starts fully off the frame so a
> chapter begins whole, and the chaining, captions, zoom and smoothing are additions.
