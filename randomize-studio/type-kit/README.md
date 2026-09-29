# type kit

The typography half of Randomize Studio, as a tool you can drop on a page.

A floating panel that edits the type of the blocks on a page, in the page: the
face, the weight, the italic, the size, the leading, the tracking, the case,
the alignment and the colour. Roll one block, roll one group of properties, or
roll the whole page — which pairs two faces, one for the display blocks and one
for the text, and rolls every block against the one that suits it.

It is the sister of `randomize-studio/intro/texture-kit.js`: that one edits what
is behind the words, this one edits the words.

## Trying it

Open `index.html` and press **Edit the type**, or `Shift+T`, or add `?type` to
the URL. The page is a six-block editorial column — kicker, title, deck, byline,
body, pull quote — one of each job typography has to do.

## Files

    index.html      the demo page
    demo.css        the demo page's own type - the thing the kit edits
    type-kit.js     the tool
    kit-shell.css   the panel's chrome inside its shadow root

It reads three stylesheets and one script out of the studio beside it:

    ../randomize-studio/css/panel.css        the floating window
    ../randomize-studio/css/controls.css     the controls in it
    ../randomize-studio/css/tooltip.css      the hover card
    ../randomize-studio/js/fonts.js          41 families, their real weights

## Putting it on a page of your own

1. Copy this folder, and keep `randomize-studio/` somewhere the page can reach.
2. Add the script, with `data-studio` pointing at the studio:

       <script src="type-kit/type-kit.js" data-studio="/randomize-studio/" defer></script>

3. Name the blocks you want listed:

       <h1 class="title" data-type-kit="title">…</h1>

   The name is what the panel lists it under. An element without one is still
   reachable with **Select element**, it just has to be found on the page.

4. Give every such block its type in your own stylesheet. The kit reads an
   element's computed type as its starting point, so a block with no type of its
   own inherits the body's and comes back to the panel as 16px/400 — which is
   not what your page looks like, and not what a roll should start from.

## Using it

- `Shift+T` opens and closes the panel. `?type` in the URL opens it.
- Anything marked `data-type-kit-open` opens it. The attribute can name the
  block to start on: `data-type-kit-open=".title"`.
- While it is open, every listed block answers the pointer: hover to frame,
  click to edit. `Ctrl`/`Cmd` or `Shift` gives the click back to the page.
- `Esc` backs out one step at a time — out of Select element, out of the
  selection, then the panel minimizes.
- **Alt-click** takes a block's type; **Ctrl+Alt-click** (`Cmd+Option` on a
  Mac) puts it on another. The cursor says which before you press. The copied
  look stays until the next copy, so one Alt-click can be pasted onto block
  after block.

  The size travels as a *ratio*, not a number. A face is a face wherever it
  lands, but 64px is not a look — it is a decision about one block. What
  carries is how far the block was moved from the size its own stylesheet
  gives it, so a title set to 1.35× its page size lands on a paragraph as
  1.35× *that paragraph's* page size. Two blocks the page sets at the same size
  still come out identical. It is how the dice already works here, so the two
  agree.
- **Up and down walk the family list**, within whatever the category chips are
  showing, stopping at each end rather than wrapping. Holding one down reads
  the page through the catalogue. A field or a slider under the pointer keeps
  its own arrows.
- **A list is one block.** Clicking any item takes the whole `<ul>` or `<ol>` —
  nobody sets the third bullet in a different face from the second, and a tool
  that makes you click four items to change four items is a tool that will be
  used to produce a list set four ways. The nearest list, so a list nested
  inside an item stays its own block.

  The items are written to as well as the list. Setting the type on the `<ul>`
  and letting them inherit it is how it ought to work and is not how it works:
  a page that styles `li` has a rule on the child, and a rule on the child
  beats type inherited from the parent.
- **Double-click a block** to rewrite its copy in place. Type is judged on the
  words it is setting, and the words on a demo page are never the words you are
  shipping. `Esc`, or a click anywhere else, puts the caret away. Paste arrives
  as plain text, so a heading cannot turn up wearing another page's markup.
- A **lock** holds a group through everyone else's roll.
- **Copy CSS** writes out every block that has been edited as ordinary rules,
  with the `@import` line for the families used, to paste into your own
  stylesheet. A project that only wants the result can take that and drop the
  kit entirely.
- **Copy params** does the selected block alone, as a brief for a coding agent:
  the values as JSON, the webfont URL, and a line saying what to do with them.
  A stylesheet tells a person what the type is; an agent also needs to know
  which element, where the font comes from, and that it should change the rule
  that already exists rather than add another. If the copy was rewritten on the
  page, the new text is in there too.

## What it leaves behind

Nothing. Every edit is an inline style; closing the panel puts each element's
`style` attribute back to the string it had, and the panel, its stylesheets and
its listeners go with it.

**Copy you typed goes back too.** Closing restores each block's original markup
along with its type — the kit is a way of looking at a page, not a way of saving
one — and **Clear** does the same for one block at a time. Take the words with
you through **Copy params** before you close, or they are gone.

Two things cannot be taken back, and neither does anything: `fonts.js` declares
`FONTS` and `CATS` with `const`, and a classic script's top-level declarations
cannot be undeclared; and any font face fetched from Google stays in the
document head, where dropping it would only mean fetching it again next time.
