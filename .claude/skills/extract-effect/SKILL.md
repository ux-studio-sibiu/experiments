---
name: extract-effect
description: >-
  Reproduce / isolate a visual or interactive effect from a website (or
  reference) into this collection as a self-contained, zero-dependency module
  with a live slider panel for tweaking params, an instantly-previewable demo
  HTML, and a copy-paste README. Use whenever the user wants to "copy",
  "reproduce", "recreate", "isolate", "rip", or "extract" an animation /
  shader / canvas / CSS / background / hover / scroll effect from a site and
  add it to effects-collection.
---

# Extract an effect into the collection

This repo is a library of **reusable front-end effects**. Each effect lives in
its own top-level folder and follows one shape so any of them can be dropped
into another project in minutes. When the user asks to copy/reproduce an effect
from a website, produce that shape — don't just dump a one-off snippet.

## The four deliverables (every effect folder has these)

```
<effect-name>/
  <effect-name>.js   # canonical, isolated module — the thing people copy
  index.html         # standalone demo with a live slider panel
  README.md          # options table + API + recipes
```
Plus a one-line entry added to `.claude/launch.json` so it can be previewed.

Templates to start from live next to this file:
- `templates/effect.js`  — factory skeleton
- `templates/demo.html`  — demo + slider-panel skeleton
- `templates/README.md`  — docs skeleton

> See also the **design-principles** skill for interaction timing (instant hover
> feedback, fast/responsive defaults), motion, and accessibility — apply those
> throughout the demo and module.

## Core principles

1. **Isolate aggressively & concisely.** Strip the effect from the source
   site's framework, build tooling, analytics, and unrelated markup. The module
   should be the *smallest* code that reproduces the effect. Prefer **zero
   dependencies** (vanilla Canvas/CSS/WebGL). Only pull in a library (e.g.
   three.js) if the effect genuinely needs it, and load it from a CDN.

2. **Factory function returning a small API.** Export
   `create<EffectName>(options)` that returns
   `{ ...controls, set(name, value), destroy() }`. This is what makes it
   reusable and is the contract the demo + README document.
   - Ship it as an **ES module export AND a `window.` global**, so it works via
     `import` and via a plain `<script>` tag.

3. **Every param is an option *and* live-settable.** Collect all tunables in a
   `DEFAULTS`/`cfg` object. `set(name, value)` updates `cfg` and applies the
   change at runtime. This is what powers the sliders.

4. **Always add a live slider panel** (the part the user specifically values).
   The demo gets a fixed `.controls` panel with one `<input type="range">` (or
   `<select>`) per meaningful param, each wired to `fx.set(...)`. Pick sensible
   `min`/`max`/`step` so the *full expressive range* of the effect is
   explorable. This lets the user dial in the look, then we bake the chosen
   values in as defaults.

5. **Previewable right away.** `index.html` must run by just opening the file.
   Because browsers block sibling ES-module fetches over `file://`, **inline a
   copy of the module's body** into the demo's `<script>` (drop the `export`
   lines), and add a header comment noting the `.js` file is canonical and the
   two must be kept in sync. (See `static-background/index.html` for the
   reference pattern.)

6. **Performance & politeness defaults.** Throttle/`requestAnimationFrame`
   sensibly, cap `devicePixelRatio`, **pause when offscreen / tab hidden**
   (`visibilitychange`), respect `prefers-reduced-motion`, and clean up fully in
   `destroy()` (cancel RAF, remove listeners/observers, dispose GL/canvas).

7. **Showcase the effect in a relevant context — not just a blank page.** The
   demo should *sell* the effect by putting it where it would actually be used,
   and let people feed it their own content. Think about what the effect acts
   on, then give the demo a fitting backdrop and an asset picker:
   - **Pick a representative scene.** A menu/grain overlay → a faux nav + hero.
     A hover-distortion → a sample image *and* a `<input type=file>` picker. A
     text effect → a few headlines at different sizes. A scroll effect → enough
     stacked sections to actually scroll. Match the demo to the effect's job.
   - **Let users drop in local assets.** Whenever the effect consumes content
     (image / video / text / audio / 3D model), add a control to load a **local
     file** via `URL.createObjectURL(file)` so people try it on their own media
     instantly — no upload, no network.
     - Revoke the **previous** object URL when switching, *never* the one you're
       about to hand to the loader (revoking too early cancels the load — this
       is an easy bug; see `static-background`'s image picker for the correct
       pattern).
     - Accept an `HTMLImageElement`/`HTMLCanvasElement`/`HTMLVideoElement`
       directly in the API, not only a URL string, so generated/local sources
       work without a round-trip.
   - **Always offer an offline, asset-free option.** Don't make the showcase
     depend on the network. Generate content procedurally — a canvas gradient,
     an SVG pattern, `<canvas>` text, a tiny inline data-URI, or Web Audio — so
     the demo is fully self-contained. A remote `sample` (e.g. picsum) can be a
     *bonus* button, never the only way to see the effect.
   - **Suggest creative variations** in the README "Recipes" and to the user:
     e.g. for grain — over a photo, a looping `<video>`, live `<canvas>` text,
     or a CSS gradient; as a transition wipe; tinted per brand. Offer a couple
     of presets wired to buttons so the range is one click away.
   - Do **not** commit large or licensed binary assets to the repo. Prefer
     procedural/generated content or the user's own files; if a real sample is
     essential, keep it tiny and license-clean.

## Workflow

1. **Get the source.** Look at the target site. WebFetch usually can't run the
   page's JS — if so, inspect with the browser/preview tools, read the relevant
   script/style, or reproduce from knowledge of the technique. State plainly if
   it's a faithful *reproduction* vs. a byte-for-byte copy.
2. **Identify the technique** (CSS filter / SVG feTurbulence / 2D canvas noise /
   WebGL shader / scroll-linked transform …) and the **tunable params**.
3. **Scaffold** a new `<effect-name>/` folder by copying the three templates.
   Use a short, descriptive kebab-case name.
4. **Implement** the isolated module; fill in `DEFAULTS`, the render loop, and
   `set()` handling per param.
5. **Build the demo**: inline the module, add a slider per param with good
   ranges, wire them to `fx.set`.
6. **Add a launch.json entry** and **preview it** (`preview_start` →
   `preview_click`/screenshot → check `preview_console_logs` for errors). Fix
   anything visible. A static-file server config:
   ```json
   { "name": "<effect-name>", "runtimeExecutable": "npx",
     "runtimeArgs": ["--yes","http-server","<effect-name>","-p","<port>","-c-1"],
     "port": <port> }
   ```
7. **Write the README** from the template: options table, API, 2-3 recipes.
8. **Report** what's faithful vs. approximated, and invite the user to tune the
   sliders so chosen values can be baked in as defaults.

## Quality bar

- Opening `index.html` shows the effect immediately, with working sliders.
- The `.js` file pastes into any project and works with one `create…()` call.
- No console errors. `destroy()` leaves no leaked listeners or RAF loops.
- Names, comment density, and structure match the existing effects in the repo.
