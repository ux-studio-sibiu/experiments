# Cubism

A photo cut into **screens** by overlapping shapes. Every region the shapes make (inside some of them, outside
the rest) shows the same photo again with its own move, rotation, scale and filters, the way a cubist painting
shows one subject from several views at once. You can upload your own photo; the default is `img/dacia.jpg`.

Canvas 2D, no libraries. Run it from a server, because ES modules don't load over `file://`: use the `cubism`
entry in `.claude/launch.json` (port 8135), or any static server pointed at this folder.

## Using it

- **Two modes, by zoom.** At full size you edit the **screens**: a press picks the screen under it, dragging moves its
  picture, the wheel scales it, and the panel shows everything but the shapes section. The **layout view** (the
  expand button in the titlebar, or a drawing tool's key) is where you edit the **shapes**; click the button again
  to zoom back in.
- **In the layout view:**
  - a shape is grabbed by its **outline** only, within 10 px either side of the line, and the outline under the
    pointer lights up. Drag it to move the shape.
  - a closed polygon (square, triangle, rectangle, polygon) has a square handle just past a corner, which scales it,
    and a round handle just past another corner (the one nearest the upper right), which turns it. Lines and open chains have neither: they're reshaped through their
    nodes alone.
  - **Offset** (circles and arcs): a diamond handle on a short stem just outside the outline, in the middle of what's
    left of it (45° round a whole circle). Drag it in or out to make the radius smaller or bigger about the same
    centre, as Archicad's offset; the cuts stay where they are along the turn. While dragging, the start radius shows
    as a faint dashed circle and a read-out gives the radius and the offset so far (`r 180 · -24`, in px). One undo
    step.
  - **the screens are locked:** a press inside doesn't pick or move a screen, and the wheel does nothing. The panel
    shows only the shapes and areas sections; at full size it swaps back to the rest.
  - **Areas** (a section of its own, folding like the studio's: shut at first, its header opens it): a name field per area in the frame, in the screens' order, holding
    "area 1", "area 2"… until you type over it; clear it to go back to the default. The names are written large on
    the canvas, black in a white halo (the eye at the right of the section's header shows or hides them), and the row under the pointer or being typed in lights its area. The list
    follows the shapes as you edit them. Names are kept with the state and in templates.
  - **Layouts** (the last section, folding, open at first): the save button keeps the shapes as they are (with the texts, area names and
    which area is which) in this browser. Each saved layout shows as a small black-on-white drawing of its outlines
    in the frame's shape, newest first; no picture. Click one to load it (Ctrl+Z undoes); its trashcan, in the corner
    under the pointer, deletes it on a second click. Screens are not part of a layout: they stay with their areas.
    **Clear** (the struck-through frame beside save) takes every shape and text off, with their area names, to start
    a layout from nothing; Ctrl+Z undoes it. Saved layouts stay.
  - **Nodes,** as in Archicad: every corner, line end and circle centre has a small square (a cross for the centre).
    Dragging one moves that corner alone; a square or triangle reshaped this way keeps its name and screens. A circle's
    centre moves the circle. The scale handle sits just past its corner, so the corner stays free.
  - **Snapping:** a dragged node, and every point the drawing tools place, snaps to the other shapes' nodes and the
    frame's corners (a tick), to crossings and loose ends (a cross), and onto edges (the "mercedes" sign), within
    10 px. A node dropped on another node **joins** it: from then on dragging that spot moves both. **Alt** moves
    freely, without snapping, and pulls a joined node away on its own.
  - **Adding a corner:** double-click an edge (Archicad's "insert new node"). The new corner lands on the side under
    the pointer and is picked, ready to drag; the outline keeps its shape until you do. A line
    becomes a bent line this way. A circle has no corners to add.
  - **Removing a corner:** click a corner to pick it (it turns black), then press Delete. Or drop it onto the corner
    next to it in its own shape, and the two merge. A closed shape keeps at least 3 corners, an open one its 2 ends;
    deleting an end corner shortens the line by its last side.
  - **Delete** (or Backspace) removes the picked corner, or else the shape last grabbed
- **Tools** (a toolbar of icons in the shapes section, as in Photoshop or Archicad: arrow, line, rectangle, circle, polygon, T, scissors; hover one for its name and key). Picking a drawing tool goes to the layout view, and a tool stays
  picked after use:
  - **select (V):** the moves above
  - **line (L):** drag from one end to the other; Shift keeps it on 15° steps. A line is open: it has no inside, but it
    splits every area it crosses, end to end. A loose end inside an area just stops there.
  - **rect (R):** drag from corner to corner; Shift makes it square
  - **circle (C):** drag from the centre out
  - **polygon (P):** click each corner. Click the first one again (it's ringed once that would close it),
    double-click or press Enter to close; Backspace drops the last corner, Esc cancels. Shift keeps a side on 15° steps.
  - **trim (T):** the piece of outline under the pointer turns red: a stretch between two crossings, or between a
    crossing and a loose end. A click cuts it away, as Archicad's trim does, and the areas either side merge. A shape
    with nothing left is deleted.
  - **Ctrl-click** (Cmd-click on a Mac) trims with any tool, as in Archicad: hold the key and the cursor becomes
    scissors, black over a piece of outline (it lights up red) and white over empty space, where a click does
    nothing. The click cuts the piece back to the nearest crossing on either side, so the two areas it parted
    become one. Holding the key hides the handles, and a press never moves anything.
  - **A trim leaves nodes at the cut ends,** as in Archicad. A square, triangle, rectangle or polygon opens into a
    chain running from one cut end round its corners to the other; trimming the middle of an open chain or a line
    splits it in two, the second part a shape of its own. The cut ends drag, snap, join and delete like any corner
    (Delete or Backspace). A trimmed circle becomes arcs: their ends are nodes that slide round the circle (drag two
    arcs into each other and they become one); they can't be deleted, since an arc has no side to drop.
  - **The frame's edge cuts too:** an outline crossing the frame stops there as a piece, so trimming the part inside
    leaves the part outside, and the frame closes off areas with the outlines meeting it. A line drawn across a corner
    makes that corner an area of its own (`gap 1`). The frame itself can't be grabbed or trimmed.
  - **text (X):** click to place a text item and type its words (the `text` field that shows in the shapes section
    while one is picked; Enter or Esc leaves it). Click a text with this tool to edit its words. With select, drag
    its box to move it; the square handle past its corner scales it and the round one past its upper-right corner turns it. Delete removes
    the picked text. A text is **one screen**, however many letters it has: its letters are the mask, never traced
    into nodes. It lies over the shapes' areas without cutting them, starts a little zoomed and brighter so it shows,
    and its letters get the outline too (at most 4% of their height). Typing its words is one undo step.
  - **Esc** drops a drawing in progress, or goes back to select.
- **Undo / redo** (the arrows in the titlebar, Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y): every change to the shapes (drawing,
  trimming, deleting, a drag, the dice), up to 100 steps. Screens are not part of it. A loaded template
  starts it afresh.
- **The layout view itself:** zooms out to 60%, animated.
  - The window becomes a white-framed box with its size, on a dark workspace with a faint grid.
  - The photo and screens draw only inside the box, as they will really be seen.
  - Shapes can run past the box: their outlines stay visible outside it, dimmed, and can still be grabbed.
  - Every area is labelled, large, with its name or number from the Areas section. Regions that exist only outside the box are
    labelled "off-frame": they make no screen, because nothing outside the frame is ever seen.
  - The shapes' outlines, nodes and handles show here, staying the same size on screen whatever the zoom.
  - Minimising the panel hides them, to just look.
- **Screen:** a dropdown with one entry per closed area that can be seen, named as in the Areas section ("area 3",
  or the name you typed there), and one per text item, its words followed by "(text)". The area's make-up (inside
  which shapes) is in the entry's tooltip. A combination that falls into separate pieces is a screen per piece, each
  starting as a copy of the first. The picked screen's properties sit in four folding groups, the studio's sub-layers.
  A group that changes the screen shows a dot, even when folded. Each group's header ends in an undo arrow that puts
  just that group back to plain for the picked screen (greyed when it is plain already).
  - **Position:** move x / y (% of the window), rotate, scale, opacity
  - **Colour:** blur, hue, saturate, brightness, contrast, grey, invert, sepia
  - **Static:** film grain / TV snow over the screen, as static-background and the studio's Static FX layer.
    Amount, cell size, fps (0 = still) and mix (overlay, soft-light, screen, normal).
  - **Texture:** an SVG pattern tiled over the screen, as the studio's Pattern layer, with scale, opacity,
    rotation, colour and blend. Every tile the toolkit has, copied in, 100 in all:
    - the studio's 13 basic tiles (`vendor/randomize-studio/patterns/`)
    - its 87 overlay tiles (`vendor/randomize-studio/overlay-patterns/`, catalogue in `overlay-patterns.js`), which
      are Hero Patterns

  The overlays stay still over the screen while its picture moves. The undo arrow in the Screen header (**plain
  screen**, beside the dice) puts everything back to the untouched photo.
- **outline / line colour:** the shapes' drawn edges, and 0 hides them.
- **The dice** (in the section headers, as in randomize-studio):
  - **Shapes** loads one of the saved layouts at random (never the one on show, when there are two or more; Ctrl+Z
    undoes). With none saved, it gives new positions, sizes and turns, clustered so the shapes overlap: of up to 24
    tries it keeps the one making the most regions.
  - **Screen** rerolls the picked screen. Move, turn and scale always change. Colour effects come by chance: a hue
    shift 40% of the time, grey 30%, blur and sepia 20%, invert 8%.
- **Randomize all** (full size, under the screen section): rolls across every area's screen at once (text items keep
  theirs).
  - **position** (a row: its undo arrow, then its dice): the dice gives a new move and scale for every area (the turn
    stays); the arrow puts every area's move and scale back to plain.
  - **rotation** (likewise): a new turn for every area (move and scale stay); the arrow puts every turn back to 0.
  - Both keep the photo covering at least 80% of each area: each screen is rolled up to 24 times, keeping the first
    roll that covers enough (or the one covering most), so no area is left mostly showing the plain photo beneath.
  - **effect**: a dropdown of checkboxes (all, colour, blur, sepia, contrast; "all" checks or clears them all). The
    dice clears every checked effect from every area, then puts each on its own random set of areas; the undo arrow
    before it just clears the checked effects (both greyed while none is checked). Colour is a hue shift, with a
    saturation change on about half of them.
  - **impact**: how many areas each effect lands on: small (3), medium (6) or large (10), never more than there are.
  - What the rolls draw from (each value's range, how many screens an effect lands on, the share a value is rolled
    on, how much of an area the photo must cover) is the `RANDOMIZE` config at the top of the section in `main.js`, meant to be tuned there.
- **Image:** a thumbnail of the photo in use sits above the buttons.
  - **Upload** (or drop a photo on the page).
  - **Random photo:** a photo from picsum.photos with a fresh seed, as randomize-studio's button. It needs a
    network connection.
  - **Save:** keeps the random photo on show, by its picsum `/seed/` address (no pixels stored), in this browser. It's
    greyed for an upload, the default, or a photo already saved. Saved photos show under the buttons as small
    thumbnails, newest first, the one on show framed: click one to put it back; its trashcan, in the corner under the
    pointer, deletes it on a second click.
  - **Clear** (the struck-through picture in the section header): back to the default photo (Dacia).
- **Templates:** named looks kept in this browser, newest first. A template holds the shapes and texts,
  every screen with its overlays, the outline, and **the picture it was made on**. Loading it brings the picture
  back as well.
  - **Random photo:** its picsum `/seed/` address (the same seed always gives the same photo).
  - **Dacia:** its path.
  - **Uploaded photo:** a copy of the file in IndexedDB under the template's own key, deleted with the template.

  A row's tooltip says which kind it holds. Templates saved before pictures were kept load the look alone.
  - Type a name and press save (or Enter). Saving under an existing name updates it, and an empty name gets a
    numbered one.
  - A row loads its template.
  - The picked row's trashcan deletes it, on a second click within a moment.
- **Titlebar:** info on the left (opens a band listing what the mouse and keys do in the current view and tool;
  passing messages, such as a refused edit, show briefly at the bottom left of the stage), then undo, redo, the
  layout view, copy (a prompt that rebuilds the composition, photo not included),
  minimize.
- **Fine-tuning:** click a slider's value (it greys under the pointer) for a ▲ / ▼ pair beside it: a step per click,
  ten with Shift, repeating while held, the wheel too. A click outside the row puts it away.

## How it works

1. The photo is drawn to cover the window.
2. **Shapes,** stored as shares of the window so they follow its size: `x`, `y`, `size` (of the shorter side) and
   `rot`, plus an `id`, the shape's bit in an area's mask (ids are reused, at most 30 shapes). The square, circle and
   triangle are built in; drawn rectangles, polygons and lines keep their corners as `points` in the shape's own units
   (half its size), unturned. "Is this point inside" is a crossing test on the polygon, or a distance test for the
   circle; a line has no inside.
   - **Trims** on a cornered shape rewrite its corners: the stretch left (a share of the perimeter, worked out in the
     shape's own units) becomes `points` with `open: true`, its cut ends new corners; a second stretch becomes a new
     shape. An opened shape still covers its old inside (its corners closed up) when areas are named. A circle keeps
     `cuts`, stretches `[u0, u1]` of its turn taken away, and draws what's left as arcs. States and templates saved
     with cuts on cornered shapes are opened this way when they load.
   - **Undo** keeps a copy of the shapes before each change.
3. **Edges and closed areas** (`geometry.js`). The outlines become edges:
   - every crossing is found exactly (segment–segment, segment–circle, circle–circle, arcs checked against their
     range, a polyline against itself; no curve library is needed for straight sides and circles)
   - the frame's rectangle goes in as one more closed curve, so outlines are cut where they cross it and every area
     falls into a part in the frame and a part outside (the background is the biggest area in the frame inside no
     shape; the others inside no shape are gaps)
   - each outline is cut into pieces between crossings, and an open curve's ends become nodes
   - pieces with a loose end are peeled away, repeatedly: a stub bounds nothing. The trim tool picks from all the
     pieces, loose ones included, and maps the one clicked back to its shape's outline.
   - the network is walked, always leaving a node by the next edge in angular order (by each edge's exact
     direction there), which traces every closed area
   - the outside edge of a group of shapes sitting inside another area becomes that area's hole

   Each area is a screen, keyed by the shapes it is inside (read at a point surely inside it) plus a piece number,
   which keeps screens saved before areas existed. A piece keeps its number while its outlines are dragged: a point
   inside each area is remembered (`areaSpots`, kept with the state and in templates), and the piece holding an old
   point takes its key, so screens and names stay with their areas. Only a piece new to its combination gets a fresh
   number. Each screen turns and scales around its area's centroid. This
   reruns on every move of a shape.
4. **Drawing:** the plain photo first, then each screen that isn't plain:
   - clip to its area: a `Path2D` of its rings, `evenodd`, so holes stay out
   - set `globalAlpha` and `ctx.filter`
   - transform about the area's centre
   - draw the photo again

   Gaps a moved screen leaves show the plain photo beneath.
   **Text screens** are drawn after the areas: the screen is painted whole on an offscreen layer (photo, filters,
   overlays, about the text's centre), cut to the letters with `destination-in` and `fillText` (Archivo 900), then
   laid over the picture. At full size a press inside a text's turned box picks its screen (listed as `word (text)`, key
   `t<id>`).
5. **Overlays,** inside the same clip:
   - **Texture:** the pattern SVG is drawn into a tile canvas at `patScale × devicePixelRatio` and tinted with
     `source-in`. It becomes a repeating `createPattern` (turned by `setTransform`), filled at the screen's opacity
     and blend.
   - **Static:** a small canvas of random grey, one pixel per cell, stretched over the window with smoothing off.
     There's one noise frame per cell size and fps pair, shared by every screen using it, and remade only when its
     fps says so.
6. Rendering happens only after a change (one `requestAnimationFrame`), at `devicePixelRatio` up to 2. Moving
   grain keeps a frame loop running, which stops once no visible screen has moving grain. Under
   `prefers-reduced-motion` the grain stays still.

## Persistence

| What | Where | Lasts |
|---|---|---|
| your uploaded photo, or a random photo's picsum address | IndexedDB (`shared/saved-image.js`, database `cubism`) | until **clear** (the Image header) puts the default back |
| shapes, screens, outline, mode | sessionStorage `cubism:state` | refreshes, until the tab closes |
| layouts | localStorage `cubism:layouts` | for good; deleted one by one |
| saved photos | localStorage `cubism:photos` (picsum addresses) | for good; deleted one by one |
| templates | localStorage `cubism:templates` (a random or default picture as its address) | for good; deleted one by one from the list |
| a template's uploaded photo | IndexedDB, database `cubism`, key `template:<name>` | until that template is deleted |

## Notes

- `ctx.filter` (blur and the colour effects) works in Chromium and Firefox. Older Safari versions ignore it: the
  transforms still work, the filters don't show.
- Sides lying along each other (two shapes sharing a side, a side along the frame) are split where an end of one
  lies on the other, and the shared stretch is kept once, so joined shapes make clean areas.
- A state or template saved before shapes had ids numbers them by place, which is the bit they always had.

## Credits

- **Texture tiles:** the 87 overlay tiles (`vendor/randomize-studio/overlay-patterns/`) are
  [Hero Patterns](https://heropatterns.com) by Steve Schoger, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). They're copied from randomize-studio. The 13 basic tiles
  (`vendor/randomize-studio/patterns/`) are randomize-studio's own.
- **Default photo:** `img/dacia.jpg`, the image the page was made with.
