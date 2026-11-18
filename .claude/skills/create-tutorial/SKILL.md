---
name: create-tutorial
description: >-
  Turn an effect (a Codrops article, a site you want to reproduce, or an effect
  already in this collection) into a short step-by-step tutorial: 4-5 numbered,
  runnable steps that each add one idea, written like the learn-angular lessons
  (eyebrow, live demo, controls, "how it fits together", gotcha notes, next
  link). Use whenever the user asks for a "tutorial", "lessons", "step by step",
  "walkthrough", "a plan in steps", or "teach me how to build" an effect.
---

# Create a step-by-step tutorial

A tutorial here is an effect built **in public, in 4-5 steps**. Every step is a
working page you can open, poke at and read, and each one adds a single new
idea on top of the last. The last step ends in the same shape as any other
effect (see the **extract-effect** skill): a canonical module, a demo with a
slider panel, a README. Apply **design-principles** throughout.

The writing model is `../learn-angular/src/app/pages/lesson-*/` (e.g.
`lesson-three`): an eyebrow with the number, one plain intro paragraph saying
what's new and why, a live demo, a row of controls, a "How it fits together"
list, `.note` boxes for the gotchas hit while building, and a pointer to the
next lesson. Copy that tone: short, concrete, first-hand ("gotcha hit while
building this: ...").

## Phase 1: the plan (always first, then stop)

Write `<effect>/PLAN.md` and wait for the user's go-ahead before building.
The plan holds:

1. **Goal + source.** One sentence, the reference link, and whether this is a
   faithful reproduction or an approximation.
2. **The technique in one paragraph**: what the effect really is underneath.
3. **4-5 steps.** For each one:
   - title and folder (`steps/01-<slug>/`)
   - **New idea**: the one concept this step teaches
   - **You'll see**: what's on screen when the step works (the checkpoint)
   - **Build**: the concrete pieces of code added
   - **Controls**: the sliders/toggles this step introduces
   - **Gotchas**: what is likely to bite
4. **Assets**: the default asset and how a user brings their own.
5. **Folder layout** and how to run it.
6. **Open questions** for the user, if any.

Good step boundaries: each step ends in something visibly different on screen.
If a step can't be seen working on its own, merge it into a neighbour. Steps
are ordered so the boring plumbing comes first and the "wow" lands in the last
two.

## Phase 2: build one step at a time

```
<effect>/
  PLAN.md
  index.html            # tutorial hub, in the effect's root folder: the plan as a page, an Info
                        # link per step, one "latest build" link (built with step 01; unbuilt steps greyed out)
  img/                  # page-specific default assets (see sample-media/README.md)
  vendor/randomize-studio/  # the studio panel, copied in (see House styling)
  shared/build.css      # build pages: studio tokens + stage
  shared/panel-window.js    # drag / minimize for the panel, copied in
  shared/lesson.css     # info pages + hub, in the collection index's look
  steps/
    01-<slug>/info.html # earlier steps keep only their INFO page
    02-<slug>/info.html
    03-<slug>/          # the latest step holds the one working BUILD
      index.html        #   only the effect + its controls, no explanation
      main.js
      info.html         # the INFO: the explanation, kept apart, linking to the build
  <effect>.js           # canonical module, written in the last step
  README.md             # options table + API + recipes (extract-effect template)
```

- **Build and info are separate files in the same folder.** `index.html` +
  `main.js` are the product: the effect full-screen and a controls panel (with
  "How it works" → `info.html` and "All steps" → hub links), nothing else.
  `info.html` is the lesson. The build never carries explanation text.
- **One build, carried forward.** Only the latest step has a build. Starting a
  new step, move `index.html` + `main.js` from the previous step's folder into
  the new one (look before moving: only move files this tutorial made), add the
  new idea, and repoint the "latest build" links: the hub's, and every earlier
  `info.html`'s "Open the latest build". Earlier steps keep their `info.html`
  only, with their code shown as excerpts, so nothing is lost. The last step's
  build is the final product.
- **Changes to an earlier step's feature go in the one build**, then in that
  step's `info.html`.
- **Mark what's new.** In `main.js`, wrap the step's new code in
  `// STEP 03 ->` / `// <- STEP 03` comments. In `info.html`, show those excerpts
  in `<pre><code>` blocks under "What changed", next to the explanation.
- **One new idea per step.** If an explanation needs "and also...", that second
  thing belongs in another step.
- **Every step has controls** for the params it introduces, and keeps the
  controls from earlier steps.
- **Shared step chrome** (`build.css`, `lesson.css`) goes in
  `<effect>/shared/` and steps link it with `../../shared/...`. That stays
  inside the effect folder, so it still works when only that folder is served.
  Anything from another folder (three.js addons, the type kit...) gets copied
  into the effect folder too, never linked out of it (workspace CLAUDE.md).
- **Uploaded assets survive refreshes and carry across steps.** When the effect
  takes the user's own file, keep it in IndexedDB through a shared
  `shared/saved-image.js` (save / load / clear, silent on failure; see
  `interactive-particles/shared/`). Store the original `File`, not a resized
  copy. Start each build with the saved file, falling back to the default, and
  have the "default" button clear it. It's plumbing, so it stays outside the
  `STEP` markers.
- **Panel settings survive a refresh while the tab is open.** Each build calls
  `restoreUi(panel)` from a shared `shared/saved-ui.js` (sessionStorage, one
  record per page; see `interactive-particles/shared/`) after its handlers are
  bound. It reads every named range / checkbox / radio, so new controls need no
  extra code.
- **Every slider gets fine tuning.** `fineTune(panel)` from a shared
  `shared/fine-tune.js` puts a small stacked ▲ / ▼ at the end of each slider
  row, after the value (one step, Shift for ten, hold to repeat, wheel over it),
  firing bubbling `input` events so the handlers and saved-ui see it. Call it
  before `restoreUi`. Handlers must find their value label with
  `input.closest('.row').querySelector('output')`, not `nextElementSibling`.
- **A copy-prompt button sits beside minimize** (`#copyPrompt`,
  `data-mark="copy"`, `shared/copy-button.js`). It copies a prompt that rebuilds
  the effect as it looks now: the stack, the pipeline, the shader formulas and
  every current value, with the user's asset left out to be attached
  separately. `promptText()` lives in the build's `main.js` and grows with each
  step.
- **Libraries** load from a pinned CDN URL through an import map, the same
  version the rest of the repo uses (three.js: `three@0.170.0` on jsdelivr).
- **Run it** with a `.claude/launch.json` entry (static `http-server` on the
  effect folder), because ES modules don't load over `file://`.
- **Page anatomy.** Build (`index.html`): `main.stage` (canvas + badge) →
  the studio `aside.panel` (see House styling), its last `.btnrow.step-links`
  linking "How it works" → `info.html` and "All steps" → hub. Info (`info.html`):
  `p.eyebrow` (Step 02 of 05) → `h1` → intro `p` → "Open the build" link →
  `h2` Try it (what each control does) → `h2` What changed (code excerpts) →
  `h2` How it fits together (`ul`) → `.note` gotchas → prev / next links.
- Follow the workspace CSS rules: no BEM `__`/`--` classes, hyphenated names,
  `is-` for state, straight quotes only.

## House styling: MUST follow

Tutorials look like the rest of the collection. Never invent a new panel, a new
palette or new controls styles. The panel, icon and input conventions (titlebar
save / copy / minimize, fine-tune arrows, mode switches, naming, persistence)
are in the **ui-conventions** skill; follow it for every build page.

**Build pages use the randomize-studio panel**, the same one as
`static-background/`, `effect/` and `background-experiments/`:

1. Copy `static-background/vendor/randomize-studio/` (css/panel.css,
   css/controls.css, patterns/diagonal.svg) into `<effect>/vendor/` and
   `static-background/panel-window.js` into `<effect>/shared/`. These are copies,
   never `../../` links out of the effect folder.
2. `shared/build.css` carries the studio tokens block (`--panel`, `--bg`, `--ink`,
   `--muted`, `--faint`, `--wash`, `--ui-mono`, `--ui-sans`, `--lbl`, `--ctl`,
   and the `--icon-*` marks it uses) copied from `static-background/style.css`,
   plus only what the page adds (the stage, the badge, the step links).
3. Load Archivo + JetBrains Mono from Google Fonts, then `panel.css`,
   `controls.css`, `build.css`, then `panel-window.js` (a plain script) before the
   module.
4. Markup, exactly the studio's structure:
   ```html
   <button id="panelShow" data-mark="plus">Maximize edit panel</button>
   <aside class="panel" id="panel">
     <div class="phead"><b>02 · Step name</b><span class="spacer"></span>
       <button id="panelToggle" class="iconbtn" data-mark="minus" title="Minimize"></button></div>
     <div class="pbody">
       <div class="grp"><h3>Section</h3>
         <div class="row"><label>param</label><input type="range" ...><output></output></div>
       </div>
     </div>
   </aside>
   ```
   Buttons go in `.btnrow`, uploads are `label.uploadbtn[data-mark="upload"]`
   round a hidden file input, one-of-several choices are `.chips`, pickers are
   `.pat-grid`. Lowercase row labels, as in the other tools.

**Info pages and the hub use the collection directory's look**
(`effects-collection/index.html`): the `--bg / --ink / --muted / --line /
--card` palette with its dark redefinition, system sans, the mono uppercase
`.eyebrow`, the heavy tight `h1` (800 weight, -0.035em), hairline rules between
sections and entries, pill links as the directory's tags, no coloured boxes and
no accent colour. `shared/lesson.css` holds all of it.

Before finishing a step, open the build next to `static-background/` and the
info page next to the collection index: they should look like the same family.

## Phase 3: wrap up

After the last step: write the canonical `<effect>.js` (factory +
`set()` + `destroy()`, per extract-effect), the README, and the hub
`index.html`. Add the effect to the collection's root `index.html` if the other
effects are listed there. Report what's faithful and what's approximated.
