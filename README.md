# effects-collection

Web prototypes, one per folder, each an `index.html` you can open on its own.
No build step anywhere: the pages are HTML, CSS and classic scripts, and the
dev server only has to serve files.

[`randomize-studio/`](randomize-studio) is the largest of them — a cover
playground, plus the two tools lifted out of it that can be dropped onto a page
that is not the studio:

    randomize-studio/intro/texture-kit.js   what is behind the words
    randomize-studio/type-kit/              the words

## Deploying

Vercel, configured by [`vercel.json`](vercel.json). Two settings, and both are
there for a reason worth writing down — the file itself cannot hold the
explanation, because Vercel's schema rejects any property it does not know,
including a `//` comment key.

### `trailingSlash: true`

Keeps a folder URL a folder. Without it Vercel serves `/randomize-studio/intro`
with no slash, and a browser reads that last segment as a **file** — so every
relative URL on the page resolves one directory too high:

    intro.css        becomes  /randomize-studio/intro.css
    ../css/panel.css becomes  /css/panel.css

and the page loads nothing. With it, that URL redirects to
`/randomize-studio/intro/` and relative paths mean what they say. Every page
here is an `index.html` in a folder of its own, so this is the right shape for
all of them.

### The redirects

From the rename of `font-experiments` to `randomize-studio`, so old links and
bookmarks still land.
