---
name: ui-conventions
description: >-
  The house conventions for control panels, icons and inputs on the demos and tools in this collection (the
  randomize-studio panel): which panel to use, the titlebar buttons and their order, how icons are drawn and
  where to find existing ones, sliders with fine-tune arrows, mode switches, choices, uploads, feedback,
  naming, and what each kind of state persists in. Use whenever adding or changing a panel, a control, a
  button or an icon on any page here, or when the user asks for "an icon", "a toggle", "a slider", "a save /
  copy button", or says a control should look or behave "like the others".
---

# UI conventions: panels, icons, inputs

Collected from the user's own steering. Apply them without being asked, on every page with a panel. For general
interaction quality (timing, motion, accessibility) see **design-principles**; this file is the concrete house
style. The reference implementations are `interactive-particles/` (`shared/build.css`, `shared/*.js`,
`index.html`) and `cubism/` (templates, folding groups, dice).

## The panel

- **Always the randomize-studio panel**, copied in, never linked (workspace CLAUDE.md): `vendor/randomize-studio/`
  (css/panel.css, css/controls.css, patterns/diagonal.svg) plus `panel-window.js`, taken from `static-background/`.
  The page's own CSS carries the studio tokens block (`--panel`, `--bg`, `--ink`, `--muted`, `--faint`, `--wash`,
  `--ui-mono`, `--ui-sans`, `--lbl`, `--ctl`, the `--icon-*` it uses). Never a new panel look or palette.
- **On a dark stage, a 2px white ring outside the black edge**: `.panel { outline: 2px solid var(--bg); }`.
- **A live number with a performance cost** (a particle count, a vertex count) **is coloured by a budget:** plain
  while safe, then **yellow / orange / red** as a filled chip (so it reads on the white badge), with a `title`
  giving the current tier and the whole guide (the numbers and why). The read-out gets `cursor: help`. State the
  estimate's basis honestly: it's a rough guide, not a measurement.
- **Nothing overlaps the panel's corner.** Badges and read-outs on the stage go bottom-left, clear of the panel's
  top-right default spot.

## Titlebar buttons

- **No title text in the titlebar.** It's an empty black bar, the drag handle, with only the icons, pushed to the
  right by `<span class="spacer">`. The page says what it is elsewhere (its own title, its info page).
- Order, left to right: **reset, save, copy, minimize**. All `class="iconbtn"` with a `data-mark`, each with a
  `title` (what it does, and any catch) and an `aria-label`.
- **Reset** (`data-mark="undo"`, the studio's "back to the original colours" arrow): every control back to its
  HTML default (`defaultValue` / `defaultChecked`, through the same events a person fires), and the saved
  settings forgotten. It does not touch the user's asset, which has its own back-to-default button. `refresh` is
  that button's mark, so reset uses `undo`: two identical arrows side by side would be ambiguous.
- **Save** (`data-mark="save"`, the classic floppy disk): stores the current settings as the look the page opens
  with from now on (localStorage, see Persistence).
- **Copy** (`data-mark="copy"`, two overlapping sheets): copies a prompt that rebuilds the effect as it looks now,
  meaning the stack, the pipeline, the shader formulas and every current value. The user's own assets (the image)
  are left out, to be attached separately, and the prompt says so. The prompt text grows with the build.
- **Feedback for an action button: flash inverted for ~900 ms** (`is-copied`, `is-saved`, `is-reset`: `background: var(--bg);
  color: var(--ink)` on the black bar). Flash only when the action really happened: no clipboard or no storage
  means no flash.

## Icons

- **Look for an existing icon before drawing one.** In order:
  1. `randomize-studio/css/base.css` (`--icon-*`: minus, plus, upload, download, refresh, trash, star, cloud,
     undo, redo, info, db-export, expand, randomize...)
  2. other pages' own marks: `static-background/style.css` (copy), `game-dev.ro/app/components/client-components/
     background-tools.scss` (save floppy, eraser, filter, pin)
  3. `icons/js/icons-data.js` (the dashicons set as 20 x 20 paths)
- **How they are drawn:** a 20 x 20 viewBox SVG path in a data URI, used as a mask filled with `currentColor`,
  through the studio's `[data-mark]::before` rule. Then hover inversion and the black titlebar work for free.
  Define it as `[data-mark="name"] { --mark: url("data:image/svg+xml,...") }` in the page CSS, with a comment
  saying where it was taken from.
- **Small glyphs that are not icons** (the slider arrows) are CSS shapes (`clip-path` triangles in
  `currentColor`), not text characters, so they don't depend on a font.

## Inputs

- **Rows:** `<div class="row"><label>name</label> control <output>value</output></div>`. Labels are lowercase and
  short. The value is an `<output>` at the end, and handlers find it with `input.closest('.row').querySelector('output')`,
  never `nextElementSibling`, because other things get inserted beside the input.
- **Sliders get fine tuning:** a small stacked ▲ / ▼ at the end of the row, after the value, from
  `shared/fine-tune.js`. One step per click, Shift for ten, hold to repeat (400 ms, then every 50 ms), the wheel
  over the arrows nudges too. They fire bubbling `input` events, exactly like a drag.
- **Pick ranges that cover the whole expressive range**, including the ends where the effect breaks down. The
  user explores the extremes.
- **One of several:** the studio's `.chips` pills (radio inputs), not a `<select>`.
- **Randomize a section: the studio's dice in its header.** `<button class="iconbtn dice" data-mark="randomize">`
  inside the `h3`, after the title (or after a title switch), which `panel.css` pushes to the right. It rerolls
  only that section, within tasteful ranges, not the sliders' full extremes. Rare or strong effects (invert,
  heavy blur) come by chance, so most rolls stay usable, and values are snapped to each slider's step. A random
  photo is a `data-mark="randomize"` button in the image row ("Random photo", picsum.photos with a fresh
  `/seed/`, as randomize-studio).
- **On / off that changes the mode of a section: a switch that IS the section's title.**
  - The title text names the current state (`light particles` / `dark particles`) and is followed by the knob.
  - Both names sit stacked in one grid cell, the inactive one `visibility: hidden`, so the label always has the
    width of the longer name and **the knob never moves** when it flips.
  - It's a real `<input type="checkbox" role="switch">` inside the label (invisible but focusable). The knob is a
    hairline track with the slider's solid block, filling with ink when on.
- **Uploads:** `label.uploadbtn[data-mark="upload"]` round a hidden file input, plus drag-and-drop on the stage.
  Next to it, a button back to the default asset (`data-mark="refresh"`, named after the default, such as "Panda").

## Naming

- **Succinct and accurate, at most ~20 letters.** Name what the user gets or the state it's in, not the
  mechanism: "dark particles", not "invert" or "use dark pixels".
- A label that toggles shows the current state, not the action.

## Persistence (what survives what)

| What | Where | Lasts |
|---|---|---|
| the user's uploaded asset | IndexedDB, `shared/saved-image.js`, the original `File` | until "back to default"; shared by every page on the origin |
| every control's value | sessionStorage, `shared/saved-ui.js`, one record per page | refreshes, until the tab closes |
| saved settings (save button) | localStorage, same file | for good; a new visit opens with them; reset forgets them |

**Templates** (named looks the user keeps, several of them) go in a section of their own, drawn as game-dev.ro's
background templates (reference: `cubism/`):
- a bordered `.template-list` of `.template-row`s, each a `.row-load` button holding the name and a short date,
  the picked row inverted and carrying its `.row-action[data-mark="trash"]`
- below it a `name` row: a text field and a save `iconbtn` joined into one control (`.name-field`). Enter saves, an
  existing name is updated (the save button's title says which), and an empty name gets a numbered one.
- deleting is irreversible locally, so the trashcan arms on the first click (inverted, "Click again to delete") and
  deletes on a second within ~2.5 s
- stored in localStorage, newest first. A template holds the look **and the picture it was made on**, kept by
  where it came from:
  - a random photo by its picsum `/seed/` address
  - a default by its path
  - an upload as a copy in IndexedDB under `template:<name>`, deleted with the template

  Loading a template brings the picture back. The row's tooltip says which kind it holds. Reset doesn't touch
  templates.

On load: the tab's values, else the saved ones, else the HTML defaults. Everything fails silently (private
window, blocked storage) and the page still works with its defaults.

## Code

- Straight quotes only. No BEM `__` / `--` classes; hyphenated names, `is-` / `has-` for state (workspace
  CLAUDE.md).
- Shared helpers live in the page's own `shared/` folder: copies, never `../../` out of the page's folder.
