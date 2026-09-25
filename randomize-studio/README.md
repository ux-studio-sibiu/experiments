# randomize-studio

A cover playground: a photograph, a plate and editable **heading / subheading /
body-columns** on a canvas you place them on by hand, with Google Fonts swapped
live from the CDN and a dice for when nothing is working. Zero build, zero
dependencies — just open [`index.html`](index.html).

## The artboard

Everything on the cover is measured in a fixed **1600 × 900** space, and the
whole box is scaled to the window by `max(vw/w, vh/h)` — the same number
`background-size: cover` computes. Type and photograph therefore share one
transform and cannot drift apart, and every number that is saved is
resolution-independent: **a scene reloads identically at any window size**.

The one exception is the top menu, which is site chrome rather than part of the
cover: it is anchored to the screen, so its numbers are screen pixels.

## What it does

- **Blocks on a canvas** — heading, subheading, body and the plate are siblings
  with their own position, box, colour and shadow. Click to select, drag to
  place, double-click to type, drag a corner to resize the box the text flows
  in. <kbd>Ctrl</kbd>-click adds to the selection and they move together; arrow
  keys nudge by one, with <kbd>Shift</kbd> by ten.
- **Live Google Fonts** — ~40 families across sans / serif / display / mono /
  handwriting, loaded on demand with the right `ital,wght` axis.
- **Per-block type** — font, colour, weight (limited to the family's real
  weights), size, length, line-height, tracking, case, italic, alignment;
  body adds **columns**. Typography also has a master font/colour that writes
  through to all three at once.
- **Background, in layers** — the picture (random photo from picsum, a random
  gradient generated offline, or your own upload), a **dynamic SVG** backdrop,
  a **scrim**, an SVG **pattern** overlay tinted and blended over it, and
  animated **grain**. Each layer has its own show / re-roll / lock.
- **Dynamic SVG** — 44 backgrounds from the free
  [SVGBackgrounds.com](https://www.svgbackgrounds.com/set/free-svg-backgrounds-and-patterns/)
  set as a layer of its own: filter the library by tag, recolour it swatch by
  swatch or from any of 300 palettes (matched by lightness, so the drawing keeps
  its form), and shift hue / saturation / lightness or the tile size across all
  of it. The free set needs an attribution link wherever you use one.
- **Web elements** — the furniture of a page rather than the cover itself: the
  **top menu**, and a **CTA** button in one of eleven ready-made shapes (solid,
  studio wipe, outline, pill, ghost, hard shadow, split block, tag, full bar,
  underline, arrow link) with its own label, type, fill and radius. It is a
  block like any other, so it is placed, resized and typed into the same way.
- **Randomize** — one click pairs a characterful heading with a contrasting,
  readable body and lays the stack out. Press <kbd>R</kbd> anywhere except while
  editing text. **Lock** a section or a single layer to hold it through a
  re-roll; "Randomize fonts only" keeps your sizing.
- **Scenes** — save the whole composition. **Save here** keeps it in this
  browser, **Export** writes a `.json` file for [`scenes/`](scenes), and both
  sources appear in one dropdown. `?curated` loads a hand-picked cover instead
  of a random one (`?curated=2` for a specific one).

## Use

Open `index.html` directly, or serve the folder — serving it is what lets the
scenes dropdown list the files in `scenes/`. Internet access is needed for the
fonts and the random photo; everything else works offline.

## Layout

No build step, so the `<script>` order in `index.html` **is** the dependency
graph: a function is hoisted inside its own file but not across files, so each
file may only call into the ones above it while it is loading.

| | |
|---|---|
| `js/fonts.js`, `js/overlay-patterns.js`, `js/static-background.js` | catalogues and the grain effect — no dependencies |
| `js/svg-backgrounds-data.js`, `js/palettes.js` | the 44 backgrounds and the 300 palettes, copied from `../svg-backgrounds` |
| `js/state.js` | what a cover is made of: the model and the lists derived from it |
| `js/artboard.js` | the fixed design space and the cover-scale transform |
| `js/text.js` | the sample copy |
| `js/render.js` | state → DOM: blocks, menu, pattern, `restack()` |
| `js/panel.js` | building the inspector and wiring it back to state |
| `js/interact.js` | select, drag, resize, type, nudge |
| `js/background.js` | descriptors → a picture |
| `js/randomize.js` | the dice, per layer |
| `js/svg-background.js` | the Dynamic SVG layer — a self-contained editor behind one `SVGBG` object |
| `js/cta.js` | the CTA block: eleven button shapes and the knobs around them |
| `js/panel-window.js` | the panel as a floating window |
| `js/scenes.js` | curated presets, saved scenes, the dropdown |
| `js/init.js` | first paint; the only file that runs the app |
| `css/base.css` → `cover.css` → `panel.css` → `controls.css` → `svg-background.css` → `cta.css` | tokens, the cover, the window, the controls, the Dynamic SVG widgets, the button shapes |

> The font catalogue is the `FONTS` array in `js/fonts.js` — add a family with
> its `{n, c, w, i}` (name, category, weights, has-italics) to extend it. The
> pattern catalogue is `js/overlay-patterns.js`, one entry per SVG in
> [`overlay-patterns/`](overlay-patterns) with its natural tile size.
