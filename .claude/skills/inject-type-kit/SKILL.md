---
name: inject-type-kit
description: >-
  Add the randomize-studio typography editor (type-kit/type-kit.js - the
  Shift+T panel that sets the face, weight, size, leading, tracking, case,
  alignment and colour of any text block, with previewed font rows and a
  two-face randomizer) to any other web project, whatever its stack: plain
  HTML, Next.js, React/Vite, Vue/Nuxt, Astro, SvelteKit, WordPress, Rails, or
  anything that serves static files. Use whenever the user says "add the type
  kit to <project>", "inject the typography editor", "let me edit the fonts on
  this site in the browser", "put the font panel on these pages", "load
  type-kit.js", or asks how the typography editor can be used outside its own
  demo page.
---

# Inject the type kit into a project

The kit is one classic script plus plain files - no build, no dependencies, no
framework. Bringing it into a project is three things: **serve a small folder
of static files, add one `<script>` tag, and name the page's text blocks.**

It is idle until opened, and it cleans up after itself: closing the panel
restores every element's `style` attribute and its original copy, and removes
every node, listener and stylesheet it added. Nothing it does touches the
project's own CSS, markup or build.

It is the sister of `inject-texture-kit`. That one edits what is behind the
words; this one edits the words. They can be used together - see **Both kits
on one page** at the end.

## 1. Copy the files - keep the folder shape

The kit finds the studio relative to **its own script address**
(`new URL('../randomize-studio/', document.currentScript.src)`), so the default
shape is the two folders side by side. Copy into the project's **static /
public** folder:

```
type-kit/
  type-kit.js                  the editor itself
  kit-shell.css                the panel's chrome (tokens + the frames)

randomize-studio/
  css/panel.css                the floating window
  css/controls.css             its controls
  css/tooltip.css              the hover card
  js/fonts.js                  41 Google families and their real weights
```

About 90 KB, all static, and far smaller than the texture kit - there are no
catalogues of images to carry. The font files themselves come from Google when
the panel is opened.

`demo.css`, `index.html` and `README.md` are the demo page; they are not needed
in another project.

Where "static / public" is, by stack:

| Stack | Put both folders in | Served at |
|---|---|---|
| Plain HTML / any static host | next to the pages | `/type-kit/...` |
| Next.js | `public/` | `/type-kit/...` |
| Vite (React, Vue, Svelte, vanilla) | `public/` | `/type-kit/...` |
| Nuxt | `public/` | `/type-kit/...` |
| Astro | `public/` | `/type-kit/...` |
| SvelteKit | `static/` | `/type-kit/...` |
| Angular | `src/assets/` (or a folder listed in `assets` in `angular.json`) | `/assets/type-kit/...` |
| WordPress | the theme folder | `<theme-url>/type-kit/...` |
| Rails | `public/` | `/type-kit/...` |

If the two folders cannot be siblings, say where the studio is instead:

```html
<script src="/type-kit/type-kit.js" data-studio="/vendor/randomize-studio/" defer></script>
```

## 2. Add one script tag

A **classic script**, loaded by URL - never imported, bundled or turned into a
module. Bundling breaks `document.currentScript`, which is how the kit finds
its files, and a module has no `currentScript` at all.

```html
<script src="/type-kit/type-kit.js" defer></script>
```

Put it before `</body>` on every page whose type should be editable. By stack:

- **Plain HTML, Astro, Rails views, WordPress `footer.php`:** the tag above, in
  the shared layout / footer.
- **Next.js (App Router):** in `app/layout.tsx`, inside `<body>`:
  `<Script src="/type-kit/type-kit.js" strategy="afterInteractive" />`
  (`import Script from "next/script"`). Pages Router: the same in `_app.tsx`
  or `_document.tsx`.
- **Vite / React / Vue / Svelte SPA:** the plain tag in `index.html`.
- **Nuxt:** `app.head.script` in `nuxt.config`:
  `{ src: '/type-kit/type-kit.js', defer: true }`.
- **SvelteKit:** the plain tag in `src/app.html`.
- **Angular:** the plain tag in `src/index.html` (with the `assets/` path).

It is safe on every route of a single-page app: the kit reads the page when it
opens, not when it loads.

### Keeping it out of production (usually wanted)

Loaded, the kit opens for anyone who presses Shift+T. For a design tool that is
normally a development-only thing - wrap the tag in the stack's dev check:

- Next.js: `{process.env.NODE_ENV !== 'production' && <Script ... />}`
- Vite: add the tag from a small inline script guarded by `import.meta.env.DEV`
- Astro: `{import.meta.env.DEV && <script is:inline src="..." defer></script>}`
- Nuxt: add the head entry only when `process.env.NODE_ENV !== 'production'`
- Anything else: the templating language's own environment check

Ask the user before deciding; some want it live as a toy for visitors (the
randomize-studio intro page does exactly that).

## 3. Name the page's text blocks

This is the one step that is not optional, and it is a markup change rather
than a file to edit - unlike the texture kit, whose target list lives in
constants inside the script.

```html
<h1 class="title" data-type-kit="page title">…</h1>
<p class="deck" data-type-kit="deck">…</p>
<div class="prose" data-type-kit="body">…</div>
```

The attribute's value is what the panel lists the block under. Order in the
list follows order in the document. An element without the attribute is still
reachable with **Select element**; it just has to be found on the page.

Pick blocks that are a piece of type, not containers: a heading, a deck, a
byline, a run of paragraphs. A box of paragraphs is one block - set the type on
the box and let the paragraphs inherit it, which is how a run of reading is
set anyway.

Lists need no attribute to be treated as one piece: clicking any item takes the
whole ul or ol, and the kit writes to the items as well as the list so that a
page which styles li still follows. Name a list only if you want it in the
list of blocks by a name of your own.

### The one rule that matters

**Give every named block its type in the project's own stylesheet.** The kit
reads an element's computed type as the starting point, so a block with no type
of its own inherits the body's and arrives in the panel as 16px/400 - which is
not what the page looks like, and not what a roll should start from. The
randomizer also sizes each block relative to its own size, so a title with no
size of its own will not stay bigger than the paragraph under it.

## 4. Check it works

1. Load a page and press **Shift+T**. The panel flies in from the right.
2. The target list should name the blocks from step 3, in document order.
3. Select one: the family, weight, size, leading and tracking shown must match
   what the page's stylesheet sets. If they say 16px/400 for a heading, step 3's
   rule was not followed.
4. Press **Randomize** in the titlebar: two faces are paired across the page,
   one for the display blocks and one for the text.
5. Alt-click one block, then Ctrl+Alt-click another: the first block's type
   lands on the second, with the size carried as a ratio of each block's own
   rather than as a number.
6. Select a block and press the down arrow: the family list walks one row at a
   time.
7. Press **Esc** twice, then close. Every block must be back to the page's own
   type and copy.

## 5. Getting the result out

- **Copy CSS** (the element section) writes every block that has been edited as
  ordinary rules, with the `@import` lines for the families used at the top.
  Paste into the project's stylesheet. A project that only wants the result can
  take that and delete the kit.
- **Copy params** does the selected block alone, as JSON with the webfont URL
  and an instruction addressed to you. Prefer it when the user hands you one
  block at a time: it names the selector, and says to change the rule that
  already styles it rather than adding another.

When applying either, **edit the existing rule for that selector**. Appending a
new rule at the end of a stylesheet works by source order and then quietly
stops working the first time someone reorders the file.

## Both kits on one page

They coexist, with two adjustments:

1. Give the type kit another letter, because the texture kit has Shift+T:

   ```html
   <script src="/randomize-studio/intro/texture-kit.js" defer></script>
   <script src="/type-kit/type-kit.js" data-key="Y" defer></script>
   ```

2. Nothing else. Each announces itself when it opens (`texture-kit:open` /
   `type-kit:open`) and closes the other, because both take clicks on the page
   to choose what they are editing and only one can have them.

`randomize-studio/intro/index.html` is the worked example of both together.

## What it cannot take back

Two things, and neither does anything:

- `js/fonts.js` declares `FONTS` and `CATS` with `const`, and a classic
  script's top-level declarations cannot be undeclared. They stay, inert, and a
  second open reuses them.
- Font faces fetched from Google stay in the document head and the browser
  cache. Dropping them would only mean fetching them again next time.

If the project already has a global called `FONTS`, that is the one collision
worth checking for before adding the kit.
