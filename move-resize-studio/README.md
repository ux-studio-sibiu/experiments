# move-resize kit

The layout part of Randomize Studio, as a tool you can drop on a page.

A floating panel that moves and resizes the elements of a page, in the page.
Drag a block to move it, drag a corner or an edge to resize it, roll one
element or every listed one for a nudge off the grid, and copy the result out
as CSS.

It is the third of the kits: `randomize-studio/intro/texture-kit.js` edits what
is behind the elements, `randomize-studio/type-kit/type-kit.js` edits the words
in them, this one edits where they sit and how big they are.

## Trying it

Open `index.html` and press **Edit the layout**, or `Shift+L`, or add `?move-resize`
to the URL.

## Files

    index.html      the demo page
    demo.css        the demo page's own layout - the thing the kit edits
    move-resize-kit.js   the tool
    move-resize-kit.css  the few frame styles the type kit's shell does not have

It reads three stylesheets out of the studio beside it:

    ../randomize-studio/css/panel.css           the floating window
    ../randomize-studio/css/controls.css        the controls in it
    ../randomize-studio/type-kit/kit-shell.css  the tokens, the frame and its handles

## Putting it on a page of your own

1. Copy this folder, and keep `randomize-studio/` somewhere the page can reach.
2. Add the script. Kept beside the studio folder it needs nothing said:

       <script src="/move-resize-studio/move-resize-kit.js" defer></script>

   Kept anywhere else, `data-studio` says where the studio is:

       <script src="/vendor/move-resize-kit/move-resize-kit.js" data-studio="/randomize-studio/" defer></script>

3. Optionally name the blocks you want listed:

       <section class="hero" data-move-resize-kit="hero">…</section>

   The name is what the panel lists it under, and what the titlebar Randomize
   rolls. Any other element is still reachable by clicking it.

4. Or say exactly what may be moved. With `data-select` on the script tag only
   elements matching it can be hovered, clicked, walked to or rolled - every
   other element on the page is left alone:

       <script src="/move-resize-studio/move-resize-kit.js" data-select=".can-move-and-resize" defer></script>

   A click on something that does not match takes the nearest matching
   element around it. The Randomize Studio intro page does this, with the
   class on its reading column's sections and titles.

## Using it

- `Shift+L` opens and closes the panel; `?move-resize` in the URL opens it. A
  different letter: `data-key="M"` on the script tag.
- Anything marked `data-move-resize-kit-open` opens it, and can name the element to
  start on: `data-move-resize-kit-open=".hero"`.
- While it is open, hover frames an element and a click selects it. `Ctrl` /
  `Cmd` or `Shift` gives the click back to the page.
- **The whole selected box is the move handle.** The eight squares resize it
  by **scaling** it: the element and everything inside it - type, images,
  spacing - grow or shrink together, always in the proportion they started
  in. The edge opposite the handle stays where it is. A double-click on a
  square puts the box back.
- **A click inside the selection goes one level in**, to the child under the
  pointer. **Parent** goes one level out, **child** to the first child.
- Arrow keys nudge by 1px, with `Shift` by 10. **Snap** rounds every drag,
  slider and nudge to 4, 8 or 16px.
- The **scale** slider does the same from the panel, from the top left corner.
  The tag under the frame shows the rendered size, the scale and the offset.
- A **lock** holds position or size through a roll.
- **Copy CSS** writes out every element moved or resized as ordinary rules.
  **Copy params** does the selected element alone as a JSON brief for a coding
  agent: an `offset` rather than a `translate` and a plain `scale` factor, so
  the agent can express both in the project's own layout and sizes instead of
  bolting a transform on top.
- `Esc` backs out one step at a time: out of Select element, out of the
  selection, then the panel minimizes.

The three kits close each other when one opens, so only one is ever taking
clicks on the page.

## How it moves things

`translate` for position and `scale` for size, both inline, scaled from the
top left (`transform-origin: top left`). The individual properties rather than
`transform` or `position`, so they cannot clobber a transform the page already
has, and the element stays in the flow: the page around it keeps its shape,
which makes this a preview rather than a rebuild - a scaled element is drawn
bigger without pushing its neighbours. An inline element that is moved or
scaled is promoted to `inline-block`, since an inline box takes no transform.

## What it leaves behind

Nothing. Closing the panel puts each element's `style` attribute back to the
string it had, and the panel, its stylesheet and its listeners go with it.
