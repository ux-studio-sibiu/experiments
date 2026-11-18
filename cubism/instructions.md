# Cubism: instructions for making changes

How the page is put together, and how to change it without breaking anything. `README.md` says what the page does
for someone using it. This file is for whoever edits the code. Line numbers are approximate (as of 2026-11-03), so
search for the section comment, not the number.

## Files

| File | Lines | What it holds |
|---|---|---|
| `index.html` | ~170 | The stage (`<main class="stage">`: canvas, passing-message hint, drop hint), the info band and the whole panel markup. No logic. |
| `main.js` | ~2520 | Everything else: state, shapes, drawing, pointer and keys, panel wiring, templates, image. ES module with a top-level `await`. |
| `geometry.js` | ~370 | Pure maths with no DOM or state: `arrangement(curves)` turns outlines into closed areas (faces), and `insideRings`. |
| `style.css` | ~240 | Tokens (`:root`, taken from the studio's base.css), stage cursors, and the page's additions to the studio panel. Native CSS nesting. |
| `shared/panel-window.js` | 80 | Classic script, not a module. Drags the panel by its titlebar and minimizes it by toggling `body.panel-hidden`. |
| `shared/fine-tune.js` | ~75 | `fineTune(panel)` adds a ▲ / ▼ pair after every `.row > input[type=range]`, shown only once the row's value (`output`) is clicked (`.row.is-tuning`). |
| `shared/copy-button.js` | 16 | `bindCopyButton(button, getText)` copies text and flashes `is-copied`. |
| `shared/saved-image.js` | 42 | IndexedDB `cubism` / store `images`: `saveImage`, `loadSavedImage`, `clearSavedImage` (key `current`, or `template:<name>`). |
| `vendor/randomize-studio/` | | Local copies of the studio's `css/panel.css` and `css/controls.css`, the 13 `patterns/` tiles, the 87 `overlay-patterns/` tiles (Hero Patterns) and their catalogue `overlay-patterns.js`. |
| `img/dacia.jpg` | | The default photo (`DEFAULT_IMAGE`). |

Run it from a server, because ES modules don't load over `file://`. Use the `cubism` entry in `../.claude/launch.json`
(`npx http-server cubism -p 8135 -c-1`). The page is linked from `../index.html` as `/cubism`.

Load order in `index.html`: Google Fonts (Archivo, JetBrains Mono), then `panel.css`, `controls.css`, `style.css`,
then `shared/panel-window.js` (classic), then `main.js` (module).

## The model in one paragraph

**Shapes** (`state.shapes`) are outlines over the photo. `geometry.js` cuts all outlines, plus the window's frame,
into a planar arrangement of closed **areas** (faces). Each area is named by a bit **mask** of the closed shapes it
lies inside (bit = `shape.id`, at most 30 shapes), plus a piece number when one combination splits apart. That name
is the area's **key**: `"0"` is the background, `"5"` means inside shapes 0 and 2, `"5.2"` is its second piece,
`"0.1"` is a gap, and `"t<id>"` is a text item. Each key has a **screen** (`state.screens[key]`), a set of
properties that redraws the photo clipped to that area with its own transform, filters and overlays. Text items
(`state.texts`) are extra screens drawn over the areas. Their letters are the mask, and they never cut areas.

## State

- **`DEFAULTS`** (main.js ~40) defines the shape of `state`: `outline`, `outlineColour`, `shapes`, `screens`,
  `selected`, `open` (which sub-groups are unfolded), `texts`, `areaNames` (by area key;
  missing = "area <n>"), `areaSpots` (a point inside each area by key, shares of the window: `measure()` gives a
  piece the key of the old spot it holds, so keys, screens and names survive drags), `areaLabels` (names drawn on the canvas), `help` (info band open), `template`, `layout`.
- **A shape** looks like `{ id, type, x, y, size, rot, points?, open?, cuts? }`.
  - `x` is a share of the window's width, `y` a share of its height.
  - `size` is a share of the shorter side and is the diameter. The shape's unit is `r = size * min(W, H) / 2`.
  - `rot` is in radians.
  - `points` are corners in units of `r`, unturned, about the centre. Square and triangle use the built-in `SQUARE` /
    `TRIANGLE` when they have no `points`.
  - `open: true` means a trimmed chain.
  - `cuts` holds `[u0, u1]` stretches removed, and only a circle keeps them.
  - `type` is one of `square circle triangle rect polygon line`, with glyphs in `GLYPH` and names in `TYPE_NAME`.
- **A screen** is `PLAIN = { ...PHOTO, ...STATIC, ...TEXTURE }` (main.js ~17-20). Plain values mean the untouched
  photo. `GROUPS` maps the panel's sub-groups to the keys that light their "active" dot.
- **`fromStored(raw)`** is the single entry point for any stored state (tab or template). It merges onto
  `DEFAULTS`, fills each screen to `PLAIN`, and **migrates old formats**: shapes without
  ids, numeric `selected`, the removed `editing` flag, and the removed movement (`state.motion`, `shape.motion`). `openTrimmed()` then converts old `cuts` on cornered shapes
  into open chains.
- **`keep()`** writes `state` to sessionStorage (debounced by 150 ms). **Call it after every change** to `state`.

| Storage | Key | Content |
|---|---|---|
| sessionStorage | `cubism:state` | the whole `state`, per tab |
| localStorage | `cubism:layouts` | `[{ id (saved time), shapes, texts, areaNames, areaSpots }]`, drawn as thumbnails by `renderLayouts` / `drawLayout` |
| localStorage | `cubism:photos` | `[{ url, saved }]`, random photos by picsum address; thumbnails via `thumbTile` (shared with layouts) |
| localStorage | `cubism:templates` | `[{ name, saved, look, photo }]`, where `look` = `LOOK_KEYS` (older ones also carry an ignored `moving`) |
| IndexedDB `cubism/images` | `current`, `template:<name>` | the uploaded File, or a picsum URL string |

## main.js map (search for these `// ----` headers)

| ~Line | Section | Key functions |
|---|---|---|
| 1-66 | constants, `PATTERNS`, `DEFAULTS` | |
| 68-112 | state: load, `fromStored`, `keep` | |
| 114-137 | canvas | `resize` (dpr capped at 2, calls `measure` and `requestRender`) |
| 193-352 | shapes and trims | `corners`, `contains`, `maskAt`, `keptOf`, `objectCurves(s)` (shape to curves for geometry), `pathOf(s)` (Path2D), `labelOf` |
| 353-447 | view and arrangement | `view.zoom`, `LAYOUT_ZOOM = 0.6`, **`measure()`** (rebuilds `curves`, `pieces`, `faces`, `regions`, keys, then `renderScreenPick` (screen dropdown; `screenLabel`)), **`screenOf(key)`** (creates screens lazily), `faceAt` |
| 448-519 | text | `textBox`, `insideText`, `letters`, `drawTextScreen` (offscreen layer + `destination-in`), `textHandles` |
| 520-725 | drawing | `requestRender` (one rAF), `coverRect`, grain (`grainCanvas`, `animateGrain`), texture (`tileImage`, `patternFor`), `filterOf`, **`paintScreen`**, **`draw()`** |
| 726-958 | layout overlay | `drawGrid`, `drawFrame`, `drawRegionLabels`, `handlesOf`, `drawEditing`, `drawTexts`, `drawHandles`, `drawDraft` |
| 959-1143 | pointer basics and shape ops | `hitHandle`, `hitShape`, `hitPiece`, `shapeFromDraft`, `newId`, `addShape`, `deleteShape`, `trimPiece`, `splitIntoChains`, `finishPolygon`, **`shapesChanged()`** |
| 1144-1189 | undo / redo | `remember()` (call **before** a shape change), `undo`, `redo`, `forget`, `showUndo` (snapshot = shapes + texts) |
| 1190-1252 | text items in layout | `hitText`, `pickText`, `addText`, `deleteText` |
| 1253-1307 | tools and keys | `TOOL_KEYS`, `setTool`, the global `keydown` (~1276) |
| 1308-1557 | nodes and snapping | `nodesOf`, `hitNode`, `snapTargets`, `snapPoint`, `setNode`, `slideArcEnd`, `insertNode`, `deleteNode`, `recentre`, `joinedNodes`, `drawSnapMark` |
| 1558-1815 | drawing tools and the pointer | `toolDown`, `drawTo`, `updateHover`, canvas `pointerdown` (~1656), `pointermove` (~1700), `endDrag`, `dblclick` (~1794), `wheel` (~1804) |
| 1816-1980 | panel: screens and areas | `nameOf`, `describe`, `renderScreenPick` (screen dropdown; `screenLabel`), `renderAreas` (Areas list; `areasNow`, `areaName`, `litArea`), `select`, `syncSliders`, the generic `PLAIN` input wiring (~1892), pattern grid, sub-group folding, `showActiveGroups`, Plain screen |
| 1981-2072 | dice and hints | `snap(key, v)` (rounds to the slider's step), `regionCount`, `underPanel`, shapes dice (a saved layout when any, else a roll), screen dice, the Randomize section (**`RANDOMIZE`** config: position and rotation ranges, `cover` / `tries`; `impact` counts (small / medium / large); per effect per-key `range` / `chance`; the effect dropdown of checkboxes (`state.randomEffects`) and impact select (`state.impact`); `rollCovered` with `coverOf` (share of an area the transformed photo still covers), `rollEffect`), `HELP` (info band text per view and tool), `showHelp`, `say(text)` (passing stage message) |
| 2073-2143 | layout view and outline | `zoomTo`, `setLayout`, `editingShown`, `showMode` (hides later groups in layout), outline inputs |
| ~2230 | panel state | **`showState()`** (pushes the whole state to the panel) |
| 2244-2280 | titlebar | `flash`, **`promptText()`**, copy (the undo / redo / layout buttons sit in the titlebar but are wired in their own sections) |
| 2309-2462 | templates | `LOOK_KEYS`, `saveTemplate`, `loadTemplate`, `restorePhoto`, `deleteTemplate`, `renderTemplates` |
| 2464-2513 | image | `setImage(source)`, upload, clear (back to the default), random picsum, saved photos (`renderPhotos`, `showPhotoSave`), drag and drop |
| 2515-end | start | `fineTune`, `openTrimmed`, `showState`, ResizeObserver, load saved image or the default |

## The update cycle (what to call after what)

- **Shape geometry changed** (moved, drawn, trimmed, deleted): call `remember()` *before* the change, then
  `shapesChanged()` after it. That runs `measure()`, `showUndo()`, `requestRender()` and `keep()`, and
  clears stale hover and active refs.
- **Screen property changed**: `screenOf(state.selected)[key] = v`, then `showActiveGroups()`, `requestRender()`,
  `keep()`. Use `syncSliders()` when you replace a whole screen.
- **Picked screen changed**: `select(key)`.
- **Whole state replaced** (a template): `state = fromStored(...)`, `screenPickKey = ''`, `forget()`, `measure()`,
  `showState()`, `requestRender()`, `keep()`.
- **Never draw directly.** Call `requestRender()`. Rendering is on demand, and the only loops are moving grain
  (`animateGrain`) and the layout zoom animation, which stop themselves.
- **Mode**: `state.layout` is the layout view (shapes are edited, screens locked, only the `data-view="layout"` groups show; at full size they hide and the rest show).
  `editingShown()` = layout and panel not minimized. `showMode()` updates stage classes, the info band (`showHelp`) and hidden groups.

## Recipes

### Add a property to every screen (a slider in Position, Colour, Static or Texture)
1. Add the key with its plain value to `PHOTO`, `STATIC` or `TEXTURE` (main.js ~17-19). If it should light the
   group's dot, add it to `GROUPS` (or to the special cases in `showActiveGroups`).
2. Add a `.row` with `<input name="<key>">` and an `<output>` in that group's `.sub-body` in `index.html`. The
   generic loop over `Object.keys(PLAIN)` wires it, `syncSliders` shows it, and `fineTune` adds the arrows.
   Radio chips work too (`name` = key, `value` = option).
3. Use it in `paintScreen` (and in `filterOf` for a CSS filter). Remember that `draw()` skips screens that are plain
   with no overlay: extend that test if the new key draws something on an otherwise plain screen.
4. If the dice should roll it, add it to the `.screen-random` handler.
5. Mention it in `promptText()` and in `README.md`.

Old saved screens pick up the new key from `PLAIN` in `fromStored`, so no migration is needed.

### Add a state field (not per screen)
Add it to `DEFAULTS`. Show it in `showState()`, wire its input with `keep()`. If templates should carry it, add it to
`LOOK_KEYS`. If old stored states need converting, do it in `fromStored`.

### Add a shape type or drawing tool
- `GLYPH` and `TYPE_NAME` entries, and the type in `canTurn` / `isClosed` if it is open or round.
- A chip in `.tool-chips` (`index.html`), a key in `TOOL_KEYS`, its bullets in `HELP`, and the cursor class in
  `showMode` (`is-drawing`).
- `toolDown` / `drawTo` / `drawDraft` for the drag preview, and `shapeFromDraft` for the result.
- `objectCurves(s)` so geometry sees it (only `poly` and `arc` curves exist), `pathOf(s)` to stroke it, `contains`
  for its inside, and `nodesOf` for its nodes.
- README sections "Tools" and "How it works", plus `promptText()`.

### Add a panel section or button
Follow the `ui-conventions` skill (`../.claude/skills/ui-conventions/SKILL.md`): a `.grp` with an `h3`, dice as
`iconbtn dice` with `data-mark="randomize"`, a mode switch as the `h3` itself (`.toggle` with `.when-off` /
`.when-on`), and icons as 20 x 20 masks in `currentColor`, added as `--icon-*` / `[data-mark]` in `style.css`
(reuse an existing one first). Groups marked `data-view="layout"` (Shapes, Areas) show only in the layout view; the others only at full size
(`showMode`).

### Change the geometry
`geometry.js` is standalone: input curves, output `{ faces, pieces }`. Keep it free of DOM and state. Its
tolerances (`EPS`, `ARC_STEP`, the 4 px² sliver cutoff) are deliberate (see the comments). Keys and masks are
worked out in `measure()`, not in geometry.

## Checklist before finishing a change

- **Conventions** (workspace `CLAUDE.md`): straight quotes only. No BEM `__` / `--` class names (use `is-`/`has-`
  for state and a plain second class for a variant). Hyphenated multi-word classes. Kits are copied into `vendor/`,
  never linked with `../..`. Don't delete untracked files you didn't create. Don't commit unless asked.
- **Code style** (match the file): `//` comments that explain *why*, in plain sentences. Short arrow helpers.
  Section headers as `// ---- name ----`. Wrap storage access in `try` / `catch`. Keep it free of dependencies.
- **Keep three descriptions in step**:
  1. `README.md` (user-facing behaviour and "How it works")
  2. `promptText()` (the copyable prompt describes the algorithm and the controls)
  3. the `title` attributes and the `HELP` bullets
- **Backwards compatibility**: sessionStorage, localStorage and templates hold old states. Any rename or reshape goes
  through `fromStored` (and `openTrimmed` for shapes), never a breaking change.
- **Undo** covers shapes and texts only. Wrap new shape edits in `remember()` + `shapesChanged()`.
- **Shape geometry** in window pixels goes through `centreOf` / `radiusOf` / `corners`, not raw `x` / `y` / `size`.
- **Images**: images for this page only go in `cubism/img/` (see `../sample-media/README.md`).
- Per the workspace's fast-iteration rule, routine style, markup and small JS edits don't need a server run. Run the
  `cubism` preview only for structural changes or when asked.
