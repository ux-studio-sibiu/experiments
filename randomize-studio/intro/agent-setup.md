# Setup notes for a coding agent

These are the instructions the Randomize Studio intro page points at. Each tool
below is plain JavaScript and CSS: no build step, no dependencies, no framework.
Adding one to a project is copying files and adding one `<script>` tag.

Paths are written relative to the site this file came from. If you fetched this
at `https://example.com/randomize-studio/intro/agent-setup.md`, then
`css/panel.css` below means `https://example.com/randomize-studio/css/panel.css`.

---

## texture kit

Backgrounds, patterns and grain on any element you pick, edited in a floating
panel, exported as plain CSS.

### 1. Fetch these

    intro/texture-kit.js          the tool itself
    intro/texture-presets.json    the looks it rolls from

    css/panel.css                 the panel's chrome
    css/controls.css              its controls
    css/svg-background.css        the dynamic-svg layer's controls
    css/tooltip.css               the hover card

    js/svg-backgrounds-data.js    44 svg backgrounds
    js/palettes.js                300 palettes
    js/overlay-patterns.js        the pattern catalogue
    js/static-background.js       the grain

    overlay-patterns/             the pattern svgs themselves (87 files)

The last one is a folder, and **a folder cannot be listed over HTTP** — asking
this site for `overlay-patterns/` is a 404. Two ways to get the names:

- `js/overlay-patterns.js`, which you are fetching anyway, is the catalogue of
  exactly those 87 tiles. Each entry's `n` is the filename without `.svg`.
- Or take the whole folder from the public repo in one request:

      curl -fsSL https://api.github.com/repos/ux-studio-sibiu/experiments/contents/randomize-studio/overlay-patterns \
        | grep '"download_url"' | cut -d'"' -f4 \
        | while read -r u; do curl -fsSL "$u" -O; done

### 2. Keep the layout

`texture-kit.js` resolves everything against **its own folder's parent**, so the
four folders must stay siblings:

    <anywhere>/
      intro/texture-kit.js        (or any folder name - only the parent matters)
      css/
      js/
      overlay-patterns/

### 3. Load it

On every page that should be editable:

    <script src="/your/path/intro/texture-kit.js" defer></script>

That is the whole integration. Nothing else imports it, and it adds nothing to
the page until it is opened.

### 4. Using it

- `Shift+T` opens and closes the panel.
- Any element with `data-texture-kit-open` becomes a button that opens it. The
  attribute's value can name the element to start on:
  `data-texture-kit-open=".hero"`.
- `data-scene="some-scene.json"` on the script tag gives the page a default
  look, applied on every visit and restored when the panel is closed. Export one
  from the panel's Scene section.
- The panel's **Copy CSS** button writes out everything it has made as plain CSS
  rules, to paste into the project's own stylesheet. A project that only wants
  the result can take that and drop the kit entirely.

---

## typography kit

The face, weight, size, leading, tracking, case, alignment and colour of any
text block on the page, edited in the same floating panel, exported as plain
CSS or as a JSON brief.

### 1. Fetch these

    ../type-kit/type-kit.js     the tool itself
    ../type-kit/kit-shell.css   the panel's chrome

    css/panel.css               the panel's look
    css/controls.css            its controls
    css/tooltip.css             the hover card

    js/fonts.js                 41 Google families and their real weights

Note the first two: the type kit is a folder inside `randomize-studio/`, beside
this one. Keep that shape — `type-kit/` within the studio folder — and it finds
the studio on its own, one level up from itself.

### 2. Load it

On every page whose type should be editable:

    <script src="/randomize-studio/type-kit/type-kit.js" defer></script>

If the kit is kept somewhere other than inside the studio folder, say where the
studio is:

    <script src="/vendor/type-kit/type-kit.js" data-studio="/vendor/randomize-studio/" defer></script>

### 3. Name the blocks

    <h1 class="title" data-type-kit="page title">…</h1>

That name is what the panel lists it under. An element without one is still
reachable with **Select element**; it just has to be found on the page.

Give every named block its type in the project's own stylesheet. The kit reads
an element's computed type as its starting point, so a block with no type of
its own inherits the body's and arrives in the panel as 16px/400 — which is not
what the page looks like, and not what a roll should start from.

### 4. Using it

- `Shift+T` opens and closes the panel; `?type` in the URL opens it. On a page
  that also carries the texture kit, give this one another letter:
  `data-key="Y"` on the script tag. The two kits close each other, so only one
  is ever taking clicks on the page.
- Any element with `data-type-kit-open` becomes a button that opens it, and can
  name the block to start on: `data-type-kit-open=".title"`.
- Alt-click takes a block's type, Ctrl+Alt-click (Cmd+Option on a Mac) puts
  it on another. The size carries as a ratio of each block's own size, so a
  heading's look lands on a paragraph without turning it into a heading.
- Up and down walk the family list.
- A list is one block: clicking any item takes the whole ul or ol, and the
  items are written to as well as the list, because a page that styles li has
  a rule on the child that beats anything inherited from the parent.
- Double-click a block to rewrite its copy in place.
- **Copy CSS** writes out every block edited, with the `@import` for the
  families used. **Copy params** does the selected block alone as JSON with the
  webfont URL and an instruction — that one is written for you to act on.
- Closing the panel puts the page back: every `style` attribute restored and
  the original copy with it.

## effects kit

Not built yet. The grain that the texture kit carries is the whole of it today,
so use the texture kit above.
