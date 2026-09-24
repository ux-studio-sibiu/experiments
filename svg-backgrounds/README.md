# svg-backgrounds

A playground for 44 of the 48 backgrounds in the
[free SVGBackgrounds.com set](https://www.svgbackgrounds.com/set/free-svg-backgrounds-and-patterns/),
in the same editing chrome as `font-experiments`. Plain HTML, CSS and JS: no
build step, no dependencies. Serve the folder and open `index.html`.

## What it does

- **Library**: every background as a live thumbnail, filterable by tag
  (pattern, gradient, geometric, line art…).
- **Palette**: one swatch per colour found in the SVG (the base
  `background-color` is marked `bg`). Click a swatch to swap that colour.
- **From set**: recolour with any of the 300 palettes in `palettes.js`, or
  pick one at random (`P`). Colours are matched by lightness, darkest to
  darkest. Backgrounds with more shades than the palette get blends between
  its colours. **Rotate** cycles which colour goes where. The picked palette
  stays on as you browse.
- **Adjust**: hue / saturation / lightness shift every colour at once, and
  **scale** resizes the tile of repeating patterns. Full-page (`cover`)
  backgrounds have no tile, so scale is disabled for those.
- **Export**: **Copy CSS** copies the edited declarations. **SVG** downloads
  the pattern layer with your edits baked in.
- Keys: `←` `→` step through, `R` picks a random one, `H` hides the panel. The
  URL hash (`#dalmatian-spots`) opens that background directly.

## Files

- `backgrounds.js`: the scraped data. Each entry has `id`, `name`, `alt`,
  `tags` and the original CSS declarations, taken from the site's
  `free-svg-backgrounds-and-patterns.css`. The three paid entries in that
  set aren't included, and the four `parabolic-*` entries (rectangle, pentagon,
  ellipse, triangle) were dropped by hand; a re-scrape brings those back, so
  drop them again.
- `palettes.js`: a copy of `../color-palletes/palettes.js`, so this folder
  works on its own. If you re-scrape the palettes, copy the file over again.
- `script.js`: colour edits work on the CSS text itself: every `%23rrggbb`
  in the data URI is remapped. That way the stage and the copied CSS always
  match.

## License

The backgrounds belong to SVGBackgrounds.com. The free set needs an
attribution link wherever you use one.
