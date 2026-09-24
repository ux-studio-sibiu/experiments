# icons

A studio for trying an icon out before you commit to it: pick one, set its
size, colour and the tile around it, and see the same icon at the sizes a real
interface is built from. Same editing chrome as `font-experiments` and
`svg-backgrounds`. Plain HTML, CSS and JS: no build step, no dependencies.
Serve the folder and open `index.html`.

## What it does

- **Library** — every icon as a live thumbnail, filtered by set, by tag, or by
  typing a name. <kbd>←</kbd> <kbd>→</kbd> step through what the filter is
  showing; <kbd>R</kbd> picks a random one; the URL hash (`#dashicons/heart`)
  opens one directly.
- **The size ladder** — the same icon at **16 / 20 / 24 / 32 / 48**, under the
  big one. An icon that holds at 48 and falls apart at 16 is a drawing rather
  than an icon, and this is the quickest way to find that out.
- **The tile** — fill, padding, radius, border and shadow, so you are looking at
  the thing you would actually ship rather than a shape on a white page.
- **The contact sheet** — every icon the filter is showing, at one size in one
  colour: the view that answers whether a set belongs together.
- **Stage** — backdrop colour and a checkerboard, for judging a transparent tile.
- **Export** — **Copy SVG** or **SVG** hands you the icon with the size and
  colour you set baked in.

## Sets

| set | icons | by | licence | source |
|---|---|---|---|---|
| Dashicons | 342 | WordPress | GPL-2.0-or-later | [WordPress/dashicons](https://github.com/WordPress/dashicons) |

The licence travels with the files: each set's folder under `sets/` keeps the
`LICENSE` it shipped with, the catalogue records it, and the panel shows it
under **Export** next to whatever is selected. Check it before using an icon in
something you ship — several common sets require attribution, and a copyleft set
like Dashicons has more to say than that.

## Adding a set

1. Put the plain `.svg` files in `sets/<id>/`, with the licence beside them.
2. Add an entry to `SETS` in [`tools/build-catalog.js`](tools/build-catalog.js)
   — id, name, author, source, licence.
3. Run it from this folder:

```bash
node tools/build-catalog.js
```

That regenerates `js/icons-data.js`, which is what the studio reads: each icon
as `{ s: set, n: name, vb: viewBox, d: markup, t: tags }`. The markup is inlined
rather than fetched, because the studio recolours and resizes everything it
draws and 342 requests to show one grid is a page that never settles. Tags come
from the filename prefixes the sets use themselves (`admin-`, `editor-`,
`media-`…), so they mean what the author meant.

## Files

| | |
|---|---|
| `sets/<id>/*.svg` | the icons as they came, plus their licence |
| `tools/build-catalog.js` | scans `sets/`, writes the catalogue |
| `js/icons-data.js` | generated — do not edit by hand |
| `js/app.js` | the studio |
| `css/studio.css` | the shared panel chrome |
| `css/icons.css` | the stage, the ladder, the sheet and the icon grid |
