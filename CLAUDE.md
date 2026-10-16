# effects-collection notes

## Images and `sample-media/` — MUST follow

Where an image lives depends on who uses it. Full rules and the current layout are in
[`sample-media/README.md`](sample-media/README.md); in short:

- **Specific to one page → inside that page's folder** (e.g. `motion/scroll-brain-teaser/img/`).
  Artwork made for one piece (its glyphs, its paper texture) is too specific for the shared pool.
- **A page that offers a set of sample images (a picker, a gallery of choices) → one folder of its
  own in `sample-media/img/<page-name>/`**, with a `thumbs/` subfolder and a `CREDITS.md`. One
  folder per page, not one per source or theme: no `lines/`, `night/`, `bauhaus/` side by side.
  If it needs an image another page also uses, copy it in rather than pointing into that folder.
- **Every page's images get a folder named after that page** (`sample-media/img/swipe-effect/`,
  `sample-media/img/background-experiments/`, ...), even when another page has the same photo:
  copy it, don't point into the other page's folder. Nothing loose in the `sample-media/img/` root.
- **Keep it tidy.** When an image is dropped from a page, delete its file, its thumbnail and its
  credit line (no orphans), and remove folders left empty. Exception: `sample-media/img/pawson/`
  is kept complete even where no page uses an image; don't prune it. Then grep for the old path and fix every
  reference. That applies only to files created for that page: untracked files you didn't create
  are not yours to delete (see the workspace CLAUDE.md).
