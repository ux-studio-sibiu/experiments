# sample-media

The collection's shared images. Pages reach them with a relative path that climbs out of their own
folder (`../sample-media/img/...`), so serve the **collection root**, not a single page folder,
when previewing a page that uses them.

## What goes where

| The image is... | It lives in |
|---|---|
| used by one page only, made for it (glyphs, a texture, a drawing) | that page's own folder, e.g. `motion/scroll-brain-teaser/img/` |
| one of a set a page offers to choose from (a picker, sample choices) | `sample-media/img/<page-name>/`, one folder per page |
| a photo a page shows (its slides, its default background) | `sample-media/img/<page-name>/` too; a page using another page's photo gets its own copy |

A per-page folder holds everything that page offers, flat:

    sample-media/img/<page-name>/
      some-image.jpg        full size
      thumbs/some-image.jpg the tile in the picker, same file name
      CREDITS.md            source, author and licence of each file

If it needs an image a shared set already has, **copy** it in (with its thumbnail) instead of
pointing into the other folder, so the page's set stays in one place.

## Sizes

- Full size: max **1600px** on the long side, JPEG quality **82** (the Pawson set is 1200px wide).
- Thumbnails: max **160px**, JPEG quality **78**.
- File names: lowercase, hyphenated, saying what the picture is (`shinjuku-taxi.jpg`, not
  `IMG_2041.jpg` or a picsum seed).

## Sources and credits

- Prefer public-domain and CC images, e.g. from Wikimedia Commons (search with its API, download with
  `Special:FilePath/<name>?width=1600`). Look at a contact sheet of candidates before picking.
- Record every file in the folder's `CREDITS.md`: source link, author, licence. CC BY / CC BY-SA
  images must be credited wherever they're shown publicly; public domain and CC0 need nothing.
- Images taken from a studio's own site (e.g. `pawson/`) stay that studio's copyright: demo use only.

## Removing images

When a page stops using an image, delete its file, its thumbnail and its line in `CREDITS.md`, and
remove any folder left empty. Grep for the old path and fix every reference.

## Current layout

| Path | Used by |
|---|---|
| `img/swipe-effect/` | `swipe-effect/` (the five `mountain-day-*` slides) |
| `img/background-experiments/` | `background-experiments/` (its default photo, a copy of the midday slide) |
| `img/fluid-hover/` | `effect/` (Fluid hover's image picker) |
| `img/static-background/` | `static-background/` (its default sample photo) |
| `img/pawson/` | `motion/gallery-navigation/`. Kept **complete** (all 30), including the ones no page shows yet: never prune it as unused. |
