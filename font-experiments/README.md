# font-experiments

A type-pairing playground: drop a background image behind editable **heading /
subheading / body-columns**, swap Google Fonts live from the CDN, and roll the
dice until a combination clicks. Zero build, zero dependencies — just open
[`index.html`](index.html).

## What it does

- **Live Google Fonts** — ~40 curated families across sans / serif / display /
  mono / handwriting, each loaded on demand straight from `fonts.googleapis.com`
  (`<link>` injected with the correct `ital,wght` axis so no 404/400s).
- **Editable text** — heading, subheading and body are `contenteditable`; click
  and type your own copy.
- **Per-role controls** — font, weight (auto-limited to the family's real
  weights), size, line-height, tracking, case, italic, alignment; body adds a
  **columns** control.
- **Placement** — anchor the content block (v-align / box align) and **nudge it
  freely** with X/Y offset sliders; set its max width.
- **Backgrounds** — **random gradient** (8 generated offline presets, no
  assets), **random photo** (picsum, needs network), or **upload your own**.
  Adjustable **scrim** (dark/light dimmer) and text shadow for legibility.
- **Collapsible panel** — each section folds away; only **Heading** is open by
  default. Click a section header to expand it.
- **Randomize** — one click pairs a characterful heading with a contrasting,
  readable body (different categories), sensible sizes/tracking/case. Press
  **R** anywhere (except while editing text). **🔒 Lock** a section to keep it
  while randomizing the rest. "Fonts only" keeps your sizing. A fresh pairing +
  random photo are generated automatically on every page load.
- **Copy CSS** — exports the current pairing as ready-to-paste CSS plus the
  combined Google Fonts `@import`, so a combination you like becomes code.

## Use

Open `index.html` directly, or serve the folder. Internet access is needed for
the fonts (and the optional random photo); everything else works offline.

> The font catalog lives in the `FONTS` array at the top of the script — add a
> family with its `{n, c, w, i}` (name, category, weights, has-italics) to
> extend it.
