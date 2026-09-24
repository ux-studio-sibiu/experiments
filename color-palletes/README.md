# color-palletes

A playground for 300 community palettes from
[Adobe Color › Explore](https://color.adobe.com/explore), in the same editing
chrome as `font-experiments` and `svg-backgrounds`. Plain HTML, CSS and JS: no
build step, no dependencies. Open `index.html`.

## What it does

- **Library**: every palette as a strip. Filter by **topic** or search by
  name, creator or tag.
- **Colours**: edit any colour with the picker or by typing a hex. You can
  move colours up or down, remove them, add one, reverse the order, shuffle,
  sort by lightness, or reset to the original. Each row shows the role it
  plays in the sample layout.
- **Adjust**: hue, saturation and lightness shift the whole palette. Editing
  a colour directly bakes the current shift into the palette first.
- **View**: stripes (columns or rows, click a band to copy its hex), a
  gradient, or a **sample** composition. The sample assigns roles by
  lightness: the lightest colour is the page, the darkest is the ink, and
  the most saturated are the accents.
- **Export**: CSS custom properties, a hex list, JSON or a `linear-gradient`.
- Keys: `←` `→` step through, `R` random, `1` `2` `3` switch layouts, `H`
  hides the panel. `#<id>` in the URL opens a palette directly.

## Data

`palettes.js` holds `{ id, name, by, colors, topics, tags }` for each
palette. It was collected from the rendered Explore page, 24 palettes per
search, across 15 searches: summer, neutral palette, primary colors,
vaporwave, spring, neutral vintage, synthwave, happy, luxury, travel, autumn,
winter, pastel, retro and ocean.

Clean-up applied:
- Duplicates are merged, and their topics combined.
- Palettes with fewer than 3 distinct colours or more than 8 colours are
  dropped.
- Names lose "Copy of" / "color theme_" prefixes.
- Creators' tags are lowercased, with obvious junk removed.
- The final 300 are picked round-robin, about 20 per topic.

Palettes are user-made, so names and quality vary.

The palettes belong to their creators on Adobe Color. This is for personal
prototyping, not redistribution.
