---
name: update-scenes
description: >-
  Bring the randomize-studio scene files back in step: fill in layers and
  fields that older scenes were saved before, and rewrite the scenes/index.json
  manifest. Use whenever a scene was added, renamed, moved between folders or
  deleted, whenever a new layer or field was added to js/state.js, and whenever
  the user says "update the scenes", "rerun the scene tools", "rebuild the
  scene index", "my new scene does not show up", or "an old scene loads wrong".
---

# Update the scene files

`randomize-studio/scenes/` holds whole covers as JSON. Two things drift out of
step with it, and each has a tool. Run them in this order, from the
`randomize-studio` folder.

```bash
cd randomize-studio && node tools/upgrade-scenes.js --dry
```

```bash
cd randomize-studio && node tools/upgrade-scenes.js && node tools/build-scenes-index.js
```

Always do the `--dry` pass first and read what it lists. It names each file it
would touch and the layers and fields it would add, so a surprise there is a
signal to stop and look rather than a diff to skim afterwards.

## What each one fixes

**`tools/upgrade-scenes.js`** completes old scenes. A scene saved before a layer
existed says nothing about it. The panel treats a missing key as the default
rather than as "keep what is on screen", so those files already load correctly
-- this writes the missing layers in so each file describes the whole cover on
its own, whatever the app grows next. Defaults come out of `js/state.js`, so
that file stays the single place that says what a cover starts as: add a layer
or a field there, run this, and every scene catches up.

**`tools/build-scenes-index.js`** rewrites `scenes/index.json`. The scene list
normally reads the dev server's own directory listing and needs no upkeep at
all. A static host, a server with indexes turned off, or the page opened
straight off the disk has no listing, and there the panel reads this manifest
instead. It is a snapshot, so it goes stale the moment a scene is added or
renamed -- which looks exactly like a scene that is not being read.

## After running

- Reload the studio and check the Scene section: every folder under `scenes/`
  has a heading, an empty folder says so, and the count matches what is on disk.
- Load one of the upgraded scenes and confirm the layers it never knew about
  are off rather than left over from whatever was on screen before.
- The rescan button (next to the scene name field) says which route the panel
  used. If it mentions `index.json`, the manifest is what is being read, so it
  has to be current.

## Gotchas

- Both tools are run from `randomize-studio`, not the repo root. They look for
  `scenes/` and `js/state.js` beside them and exit with a message otherwise.
- `scenes/index.json` is generated. Never hand-edit it -- rerun the tool.
- The upgrader only adds what is missing; it never overwrites a value a scene
  already sets. It is safe to run twice.
- Scenes are tracked in git, so the upgrade shows up as a normal diff. Read it
  before committing, the same as any other change.
