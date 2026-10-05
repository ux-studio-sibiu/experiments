# Pencil Still Life

The classic academic still life of plaster solids (a cube turned to show two
faces, a tall cylinder behind it, a cone and a sphere, on a bare table), lit
by physically based lights and drawn as pencil on paper. **Your mouse is the
sun**: the key light shines from the cursor, so every shadow swings away from it. The webcam feeds the lighting too.

Serve the collection and open `/3d-lighting-camera/` (the webcam needs
`localhost` or https, and the patterns are fetched from
`../background-experiments/`):

    npx http-server .. -p 8130 -c-1

## How the drawing works

[`drawing-material.js`](drawing-material.js) patches `MeshStandardMaterial`, so
shadows, the spotlight and reflections are computed as normal, then replaces
the final colour:

1. The brightness of the lit result decides how dark the surface is
   (**light to tone**).
2. **Pencil hatching**: three procedural stroke families (45°, -45°, then
   horizontal) switch on one after another as the surface gets darker, and get
   thicker. Strokes wobble and vary in pressure, and they're laid in world space
   with triplanar mapping, so they stick to each face like a hand rendering.
3. **SVG patterns**: any of the 87 patterns in
   `background-experiments/patterns/` is rasterised black on white and laid on a
   surface family the same way. It shows faintly in light (**pattern in light**)
   and fully in shadow, like material notation on a drawing.
4. Graphite grain and a thin **colour wash** of the light's hue go on the paper.
5. Contours: `EdgesGeometry` for creases, plus an inverted hull for the curved
   silhouettes.

Each solid (ground, cube, cylinder, cone, sphere) has its
own pattern, which you pick in the **Surface patterns** folder.

## What the webcam does

| Feature | How |
| --- | --- |
| **Room light** | The feed is shrunk to 80x60 and averaged. Its colour and brightness drive the fill light and tint the key light, which shows up as hatching density and paper wash. |
| **Room in reflections** | The feed becomes a panorama environment that turns with the camera, so the sphere draws your reflection in graphite. |
| **Real flashlight** | The best-scoring bright spot (see *Finding the flashlight*) becomes the sun, so the shadows follow your torch. |
| **Mouse torch** | Off by default (the mouse is the sun). Turn it on in Flashlight for a second, spot light. |

Orbiting changes the view-dependent parts (the sphere's reflections and
highlights) while the diffuse shading stays tied to the fixed lights.

## The sun

The cursor's ray is cut by a plane facing the camera, 2.5 units in front of
the group, and the key light shines from that point toward the table, held
between 6° and 85° of elevation. A pencil-drawn sun and a dashed construction
line mark it. It holds still while a mouse button is down, so orbiting doesn't
move it. Untick **mouse is the sun** to set azimuth and elevation by hand or
let **sun cycle** walk it around.

With the webcam on, the mouse stops being the light (orbiting still works) and
the real flashlight takes over as the sun: its spot in the mirrored frame is
used exactly like the cursor. When the flashlight leaves the frame, the sun
stays where it was and dims to a quarter.

The light lives on one upright plane standing in front of the whole group (just
past the nearest object as seen from the camera, plus a margin, recomputed as
you orbit, so the light can never get in among the objects; a dash-dot line on
the table marks where it meets the ground, toggled by **show light plane**),
square to the view: it turns as you orbit but never tilts. A screen position
maps straight onto it. The ray through that point is cut by the plane, and the
sun shines from there, with depth ignored. The cursor uses this plane, and so
does the flashlight: its spot in the mirrored webcam frame is mapped 1:1 to the
screen, so the sun appears where the torch appears. Below the table edge the
sun is held at 5°.

Keeping it steady:

- **Steadiness**: the torch has to move past a small radius before the
  light follows, so a resting hand doesn't wobble the shadows.
- **Max swing speed** (180°/s) caps how fast the sun can travel.
- A sudden leap across the frame, usually a reflection or a lamp, is only
  believed once it has held for a moment.

## Finding the flashlight on any camera

Hardware exposure controls only exist in some browsers, on some webcams, so
the tracking ([`torch-tracker.js`](torch-tracker.js)) is done in plain
JavaScript on a 160x120 copy of each frame:

1. **Adaptive threshold**: a pixel counts as bright when it stands far above
   the frame's own average (mean + k x spread, **pickiness** = k). Auto-exposure
   and different cameras don't break a fixed cut-off.
2. **Background model**: when the webcam starts, the tracker spends about a
   second learning the room (keep the torch off), then keeps updating slowly.
   Only pixels much brighter than that background count, so lamps, windows and
   screens are ignored (**ignore room lights**). Under the tracked torch the
   background doesn't update, so holding it still doesn't fade it away.
   **Re-learn the room** starts it again.
3. **Spot scoring**: every bright spot is found and scored on how far it rises
   above the background, how much of it is clipped white, how colourless it is
   (**prefer white light**: LED torches are white, bulbs warm, screens blue),
   how round it is, and its size (**min / max spot size**).
4. **Continuity**: the tracked spot is preferred. A different spot has to win
   for 4 frames in a row before the tracker switches, so a reflection flash
   can't steal the light.

The webcam preview shows what the tracker sees: a faint ring on every
candidate and a red crosshair on the chosen one.

Opening the camera degrades gracefully. It asks for 640x480 at 30 fps as
preferences, then for less, then for any camera at all. A camera picker
appears when there's more than one. A rear camera isn't mirrored. Failures
get a plain message: permission denied, no camera, camera busy in another app,
or not on https/localhost.

### Auto-exposure and backlight

Webcams brighten and darken the whole picture on their own, worst of all with
a window behind you. The tracker:

- waits for the exposure to settle (brightness steady for 10 frames, at most
  3 s) before learning the room
- remembers how bright the frame was when it learned it, and scales the
  background by the camera's current brightness before comparing. Clipped
  areas such as a window stay clipped at any exposure, so they never count.

Where the browser and camera allow it (mostly Chrome with standard USB
webcams), **Webcam › Camera hardware** shows the camera's own controls: lock
exposure, exposure compensation, exposure time, brightness and contrast. Only
the ones the camera supports appear, and changing one re-learns the room.
Lowering the exposure, or locking it once it has settled, gives the cleanest
tracking. A torch seen against an already clipped window can't be told apart
from it, so keep the torch in front of a darker part of the frame.

## Panels

The instructions card can be dragged by its title, and stays inside the window.
It ends with a collapsed **Scene properties** section:

- **add color**: one of 22 palettes from `color-palletes/` (12 soft, 10 bold), dealt out at random
  to the four solids and the floor (the floor softened toward white; very dark
  colours skipped). Every pick or reshuffle changes who gets which colour. The
  picker shows every palette as a colour strip next to its name; picking a
  palette again (the current one included) reshuffles it.
  **none** turns them white again.
- **material**: one SVG pattern for all four solids
- **contrast**, **brightness**, **pencil density**
- **ink** colour, **outlines**, **show sun**
- a folded subsection per solid (**Cube**, **Cylinder**, **Cone**,
  **Sphere**) with its own:
  - **pattern** (overrides the shared material), with a small colour swatch
    at the end of the row that tints that solid's paper
  - **shade** (darker or lighter than the light alone would make it)
  - **hatch scale** (stroke spacing for that solid, against the global pencil density)
  - **size** (scales the solid; it stays resting on the table)
  - **pattern scale** (only shown once a pattern is picked)

Open the page with `?tune` (e.g. `/3d-lighting-camera/?tune`) for the full
**Tuning** panel, floating at the top right: the tone curve, patterns per
object, light intensities, webcam reflections, camera hardware and every
flashlight-tracking setting. Use it to set up before a presentation.
