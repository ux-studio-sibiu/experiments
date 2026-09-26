---
name: inject-texture-kit
description: >-
  Add the randomize-studio texture editor (intro/texture-kit.js - the
  Shift+T panel with Dynamic SVG, Pattern and Static FX layers, presets and
  scenes) to any other web project, whatever its stack: plain HTML, Next.js,
  React/Vite, Vue/Nuxt, Astro, SvelteKit, WordPress, Rails, or anything that
  serves static files. Use whenever the user says "add the texture kit to
  <project>", "inject the randomize ui", "put the texture editor on this
  site", "make these sections editable with the studio panel", "load
  texture-kit.js on every page", or asks how the editor can be used outside
  randomize-studio.
---

# Inject the texture kit into a project

The kit is one classic script plus plain files - no build, no dependencies,
no framework. Bringing it into a project is three things: **serve a small
folder of static files, add one `<script>` tag, and (optionally) tell the kit
which elements are the page's bands.** Everything else it does by itself.

It is idle until opened, and it cleans up after itself: closing the panel
restores every element's `style` attribute exactly and removes every node,
canvas, listener and stylesheet it added. Nothing it does touches the
project's own CSS, markup or build.

## 1. Copy the files - keep the folder shape

The kit finds everything relative to **its own script address**
(`new URL('../', document.currentScript.src)` at the top of
`intro/texture-kit.js`), so the folder must keep this shape. Copy these from
`effects-collection/randomize-studio/` into the project's **static / public**
folder, under a `randomize-studio/` directory:

```
randomize-studio/
  intro/texture-kit.js           the editor itself
  intro/texture-presets.json     optional - presets that ship with the site
  js/svg-backgrounds-data.js     the 44 Dynamic SVG backgrounds
  js/palettes.js                 the 300 palettes
  js/overlay-patterns.js         the pattern catalogue (tile sizes)
  js/static-background.js        the grain (Static FX)
  css/panel.css                  the studio's panel look ...
  css/controls.css               ... its controls ...
  css/svg-background.css         ... and the Dynamic SVG widgets
  overlay-patterns/*.svg         the 87 pattern tiles
  patterns/diagonal.svg          the panel's hatched shadow
```

About 700 KB, all static. The two big catalogues and the grain only
download the first time the panel is opened, not on page load.

Copying the whole `randomize-studio/` folder also works (the studio app comes
along, which is harmless); the list above is the minimum.

Where "static / public" is, by stack:

| Stack | Put `randomize-studio/` in | Served at |
|---|---|---|
| Plain HTML / any static host | next to the pages | `/randomize-studio/...` |
| Next.js | `public/` | `/randomize-studio/...` |
| Vite (React, Vue, Svelte, vanilla) | `public/` | `/randomize-studio/...` |
| Nuxt | `public/` | `/randomize-studio/...` |
| Astro | `public/` | `/randomize-studio/...` |
| SvelteKit | `static/` | `/randomize-studio/...` |
| Angular | `src/assets/` (or a folder listed in `assets` in `angular.json`) | `/assets/randomize-studio/...` |
| WordPress | the theme folder | `<theme-url>/randomize-studio/...` |
| Rails | `public/` | `/randomize-studio/...` |

## 2. Add one script tag

A **classic script**, loaded by URL - never imported, bundled or turned into
a module. Bundling breaks `document.currentScript`, which is how the kit
finds its files, and a module has no `currentScript` at all.

```html
<script src="/randomize-studio/intro/texture-kit.js" defer></script>
```

Put it before `</body>` on every page that should be editable. By stack:

- **Plain HTML, Astro, Rails views, WordPress `footer.php`:** the tag above,
  in the shared layout / footer.
- **Next.js (App Router):** in `app/layout.tsx`, inside `<body>`:
  `<Script src="/randomize-studio/intro/texture-kit.js" strategy="afterInteractive" />`
  (`import Script from "next/script"`). Pages Router: the same in `_app.tsx`
  or `_document.tsx`.
- **Vite / React / Vue / Svelte SPA:** the plain tag in `index.html`.
- **Nuxt:** `app.head.script` in `nuxt.config`:
  `{ src: '/randomize-studio/intro/texture-kit.js', defer: true }`.
- **SvelteKit:** the plain tag in `src/app.html`.
- **Angular:** the plain tag in `src/index.html` (with the `assets/` path).

It is safe on every route of a single-page app: the kit reads the page when
it opens, not when it loads.

### Keeping it out of production (usually wanted)

Loaded, the kit opens for anyone who presses Shift+T. For a design tool that
is normally a development-only thing - wrap the tag in the stack's dev check:

- Next.js: `{process.env.NODE_ENV !== 'production' && <Script ... />}`
- Vite: add the tag from a small inline script guarded by `import.meta.env.DEV`
  in `main.ts` (create the `<script>` element and append it).
- Astro: `{import.meta.env.DEV && <script is:inline src="..." defer></script>}`
- Nuxt: add the head entry only when `process.env.NODE_ENV !== 'production'`.
- Anything else: the templating language's own environment check.

Ask the user before deciding; some want it live as a toy for visitors (the
randomize-studio intro page does exactly that).

## 3. Tell it which elements are the page's bands (optional, recommended)

Out of the box on another page the kit offers **page** in its target list,
and **Pick** reaches any element. Click-to-select, hover, copy/paste
(Alt-click, Ctrl+Alt-click) and the titlebar Randomize only work on the
elements in the target list - so for those to work, name the page's main
blocks.

The list lives in four constants near the top and middle of
`randomize-studio/intro/texture-kit.js`, currently set for the intro page.
Edit the project's copy:

```js
// the named blocks, in page order; '  ' indents a child under its parent
const PRESETS = [
  ['page', 'body'],
  ['header', '.site-header'],
  ['hero', '.hero'],
  ['footer', 'footer'],
];
// every element matching this is listed too, numbered (e.g. repeated sections)
const SECTIONS = 'main > section';
// containers Randomize clears instead of texturing (they only show in gaps)
const CONTAINERS = ['body', 'main'];
// the rules drawn between sections, which "no dividers" hides; a selector that
// matches nothing is fine if the page has none (never an empty string - it
// becomes the selector of a rule)
const DIVIDERS = 'main > section + section::before';
```

Pick the page's real **full-width bands** - the blocks a texture should fill
edge to edge. A block that sits inside padding shows the texture only within
its own box; that is the kit working correctly, not a bug. If the project's
bands are inset, suggest moving the padding from the container onto the
bands (see how `intro/intro.css` does it: `.copy > section` carries the
spacing and the rules are drawn with `::before`).

Leaving the constants as they are is fine too: the kit still works through
**Pick**; only the conveniences above need the list.

## What the user gets

Tell the user how to drive it once it is in:

- **Open / close:** Shift+T, or add `?texture` to the URL, or any element
  with a `data-texture-kit-open` attribute (a button: it randomizes the page,
  then brings the panel up a second later).
- **Click** an element in the list to select it; **Esc** deselects, and a
  second Esc minimizes the panel; **double-click** an element to bring the
  panel back.
- **Alt-click** copies an element's look, **Ctrl+Alt-click** (Cmd+Option on a
  Mac) pastes it; **Shift-** or **Ctrl-click** goes through to the page.
- **Q** saves the selected element's look as a preset.
- **Randomize** (titlebar) rolls every listed element; the page-wide palette
  is shared, presets are used half the time (a checkbox in Presets).
- **Presets** and **Scenes** are kept in the browser's localStorage
  (`randomizeStudio.texturePresets`, `randomizeStudio.textureScenes`) and can
  be downloaded / imported as JSON. A downloaded presets file dropped in as
  `randomize-studio/intro/texture-presets.json` ships those presets with the
  site (read-only in the panel; only when the site is served, not from disk).

## Keeping a look: Copy CSS

**Copy CSS** writes what is on screen as `::before` / `::after` rules to
paste into the project's stylesheet. Two things to fix when pasting:

- Pattern rules point at `url("../overlay-patterns/<name>.svg")`, which is
  right for `randomize-studio/intro/intro.css` and nowhere else. Change the
  path to where the tiles are served, e.g. `/randomize-studio/overlay-patterns/`
  (or copy the few tiles used into the project's own assets).
- Static FX (the grain) is a canvas and has no CSS form; the export leaves a
  comment with the `createStaticBackground({...})` settings from
  `js/static-background.js` if the user wants it permanently.

## Check it works

1. Load a page and press Shift+T: the panel appears top right, in the
   studio's black-and-white style (not unstyled buttons - if it is unstyled,
   the `css/` folder is not being served at the expected path).
2. The network tab shows `css/panel.css`, `css/controls.css`,
   `css/svg-background.css` and the four `js/` catalogues loading `200`
   from `/randomize-studio/...`. A `404` means the folder shape was changed
   or the script was bundled.
3. Select an element (click, or Pick), turn on Dynamic SVG and Pattern: the
   pattern tiles appear (they come from `overlay-patterns/`).
4. Close the panel (x or Shift+T): the page is exactly as it was.

## Don't

- Don't import or bundle `texture-kit.js`, or add `type="module"`.
- Don't copy `css/panel.css` & co. into the project's own styles: the panel
  loads them inside a shadow root, which is what keeps them off the page.
- Don't rename or flatten the `randomize-studio/` folders - the kit's paths
  are relative to its own location.
- Don't edit the original in `effects-collection/randomize-studio/` for one
  project's targets - change the project's copy.
