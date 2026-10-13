/* type-kit - the studio's typography controls, laid over a page's own text
   blocks instead of over the artboard.

   The sister of randomize-studio/intro/texture-kit.js, built the same way and
   for the same reason: that kit edits what is BEHIND the words, this one edits
   the words. Between them they are the studio, taken apart into two tools that
   can be dropped into a project one at a time.

   What it borrows from the studio, untouched:

   - css/panel.css and css/controls.css - the floating window, its titlebar,
     its sections and every control in them;
   - js/fonts.js - the catalogue of 41 Google families, their real weights and
     whether each has an italic, plus the loader that fetches one.

   Its own: kit-shell.css (the tokens those sheets read, and the frames round
   the element being edited) and this file.

   The sheets go inside a shadow root, which is what keeps them off the page:
   they style bare `button`, `select` and `input`, and no page should have to
   survive that. The panel floats, drags by its titlebar and minimizes to a
   maximize button exactly as the studio's does, because it IS the studio's.

   Opt-in and self-removing. Nothing happens until it is opened, with ?type in
   the URL, Shift+T, or a press on anything marked data-type-kit-open. Every
   edit is an inline style on the element; closing puts each element's `style`
   attribute back to the string it had, so the page returns to what its own
   stylesheet says it is.

   What it cannot take back: fonts.js declares FONTS and CATS with `const`, and
   a classic script's top-level declarations cannot be undeclared. They stay,
   inert, and a second open reuses them. Any font face fetched from Google
   stays in the document head too - dropping it would only mean fetching it
   again on the next open.

   Nothing is saved. "Copy CSS" writes what is on screen out as ordinary rules,
   with the @import line for the families used, to paste into the page's own
   stylesheet. That is how a setting you like is kept. */

(() => {
  const SELF = document.currentScript;
  // Where the studio is, from this script's own address rather than from the
  // page's - so the kit works from any page that loads it, whatever folder
  // that page is in. One level up, because this folder lives inside the
  // studio's, beside intro/. data-studio overrides it for a project that keeps
  // the studio somewhere else, or nowhere near this.
  const STUDIO = new URL(SELF?.dataset.studio || '../', SELF?.src || location.href).href;
  const HERE = new URL('.', SELF?.src || location.href).href;
  // No tooltip.css: this kit builds no hover card, so every title on it is the
  // browser's own tooltip. The sheet was loaded here for a card that was never
  // written.
  const SHEETS = [STUDIO + 'css/panel.css', STUDIO + 'css/controls.css', HERE + 'kit-shell.css'];

  // The three groups a block's type is edited in. Not an arbitrary split: the
  // face is what you choose, the measure is what you tune, and the treatment
  // is what you do to it afterwards - and each is worth rolling on its own.
  const GROUPS = ['face', 'measure', 'treatment'];

  // What each group owns, which is also what its dice rolls and its lock
  // holds. Every property of a block belongs to exactly one.
  const OWNED = {
    face: ['font', 'weight', 'italic'],
    measure: ['size', 'lh', 'ls'],
    treatment: ['transform', 'align', 'color'],
  };

  /* ============================ the font catalogue ============================ */

  let lib = null;   // { FONTS, CATS, FB, byName, loadFont } once loaded

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error('could not load ' + src)); };
      document.head.append(s);
    });
  }

  async function loadLib() {
    if (lib) return lib;
    // `typeof` rather than a property check: fonts.js declares these with
    // `const` at the top level of a classic script, which puts them in the
    // global LEXICAL scope and not on window. window.FONTS is undefined even
    // when FONTS is right there.
    if (typeof FONTS === 'undefined') await loadScript(STUDIO + 'js/fonts.js');
    lib = { FONTS, CATS, FB, byName, loadFont };
    return lib;
  }

  // A family's stack, with the right generic behind it so a page still reads
  // while Google is being slow.
  const stackFor = (name) => `"${name}", ${lib.FB[lib.byName(name).c] || 'sans-serif'}`;
  // The weight a family actually ships, nearest to the one asked for: asking
  // css2 for a weight a family does not have gets a 400 back and no font.
  const nearestWeight = (name, want) =>
    lib.byName(name).w.reduce((best, w) => Math.abs(w - want) < Math.abs(best - want) ? w : best);

  /* ============================ the elements ============================ */

  // Everything the panel can edit, keyed by the element. An element is read
  // once, the first time it is touched, and from then on the entry is what the
  // panel shows and what the page wears.
  const entries = new Map();

  // What the page says it is: the computed type of the block before the kit
  // has written anything on it. This is the starting point a roll moves away
  // from and the thing Clear puts back, so it is taken before the first edit
  // and never again.
  /* The items of a list the kit is treating as one block.

     Setting the type on a <ul> and letting the items inherit it is how it
     ought to work, and it is not how it works: a page that styles `li` - this
     one does, and most do - has a rule on the child, and a rule on the child
     beats type inherited from the parent. The list would be framed, selected
     and edited, and nothing on screen would move.

     So the items are written to as well. The list is still the unit - one
     entry, one frame, one set of controls - and these are the elements that
     entry has to touch for its one decision to show. */
  const unitKids = (el) => (el.matches('ul, ol') ? [...el.children].filter(c => c.tagName === 'LI') : []);

  /* How large a block may be set. A list has a lower ceiling than everything
     else, because a list is a list: it is several things the reader is meant
     to take in as a set, and past about 40px each item stops being an item and
     becomes a heading with a bullet in front of it. The slider is where the
     rule belongs - it can simply not offer the sizes that break the thing.

     Never below what the page already set, though. A page is allowed to have a
     list at 60px, and a tool whose first act on selecting it is to shrink it
     has overruled the design it was opened to look at. The cap holds the
     slider down, it does not push the block. */
  const SIZE_MAX = 160, LIST_SIZE_MAX = 40;
  const sizeCap = (e) => (e.el.matches('ul, ol') ? Math.max(LIST_SIZE_MAX, e.baseSize) : SIZE_MAX);
  const capSize = (e, n) => Math.min(n, sizeCap(e));

  function read(el) {
    const kids = unitKids(el);
    // A list's own computed type is whatever it inherited, which is not what
    // is on screen when the items carry rules of their own. Read the first
    // item instead: that is the type someone is looking at.
    const cs = getComputedStyle(kids[0] || el);
    const size = parseFloat(cs.fontSize) || 16;
    // The first name in the stack, unquoted. A page setting "Source Serif 4",
    // Georgia, serif should come back to the panel as Source Serif 4 if that
    // is a family the catalogue knows, and as whatever is nearest if not.
    const first = (cs.fontFamily.split(',')[0] || '').trim().replace(/^["']|["']$/g, '');
    const known = lib.FONTS.some(f => f.n === first);
    return {
      el,
      style: el.getAttribute('style'),   // exactly the string to put back, null included
      // Where the block has been moved to, and what it has been resized to.
      // All four are inline styles on the same element as the type, so the
      // style snapshot above already knows how to put them back.
      dx: 0, dy: 0, w: null, h: null,
      kids,
      kidStyles: kids.map(k => k.getAttribute('style')),
      // The copy as the page shipped it. html is what Clear puts back - a block
      // can be a box of paragraphs, and textContent would flatten it into one -
      // and text is only ever compared against, to answer 'has this been
      // rewritten on the page'.
      html: el.innerHTML,
      text: el.textContent,
      font: known ? first : lib.FONTS[0].n,
      weight: parseInt(cs.fontWeight, 10) || 400,
      italic: cs.fontStyle === 'italic',
      size,
      // The two that are ratios on screen but absolute in the computed style.
      lh: cs.lineHeight === 'normal' ? 1.4 : +(parseFloat(cs.lineHeight) / size).toFixed(2),
      ls: cs.letterSpacing === 'normal' ? 0 : +(parseFloat(cs.letterSpacing) / size).toFixed(3),
      transform: cs.textTransform === 'none' ? 'none' : cs.textTransform,
      align: ['left', 'center', 'right', 'justify'].includes(cs.textAlign) ? cs.textAlign : 'left',
      color: hexOf(cs.color),
      // The size the page set, kept for good: a roll moves the block relative
      // to its own size rather than to some absolute idea of "a heading", so a
      // title stays bigger than its deck however many times it is rolled.
      baseSize: size,
      locks: { face: false, measure: false, treatment: false },
    };
  }

  // rgb() to #rrggbb. A colour input takes nothing else, and every computed
  // colour arrives in that form.
  function hexOf(css) {
    const m = css.match(/\d+/g);
    if (!m || m.length < 3) return '#000000';
    return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  }

  const entryFor = (el) => {
    let e = entries.get(el);
    if (!e) { e = read(el); entries.set(el, e); }
    return e;
  };

  // The block wearing what the panel says. Inline, one property at a time, so
  // the page's own rule underneath is only overridden where the kit has
  // something to say - and `style` can be put back verbatim on close.
  function paint(e) {
    lib.loadFont(e.font);
    // The list AND its items (see unitKids). On the list so that anything it
    // holds which is not an item still follows; on the items because a page
    // that styles `li` would otherwise win against the inherited value.
    for (const el of [e.el, ...e.kids]) {
      const s = el.style;
      s.fontFamily = stackFor(e.font);
      s.fontWeight = e.weight;
      s.fontStyle = e.italic ? 'italic' : 'normal';
      s.fontSize = round(e.size) + 'px';
      s.lineHeight = e.lh;
      s.letterSpacing = e.ls ? e.ls + 'em' : 'normal';
      s.textTransform = e.transform;
      s.textAlign = e.align;
      s.color = e.color;
    }

    /* The box, on the block alone - never on a list's items. The type is one
       decision shared by every item; where the list sits and how wide it is
       are the list's own.

       `translate` rather than `transform`, and rather than `position`: it is a
       property of its own, so it cannot be clobbered by a transform the page
       already has, and unlike position it leaves the block in the flow - the
       page underneath keeps the shape it had, which is what makes this a
       preview rather than a rebuild. Nothing is written unless it was moved,
       so an untouched block carries no box properties at all. */
    const s = e.el.style;
    if (e.dx || e.dy) s.translate = `${Math.round(e.dx)}px ${Math.round(e.dy)}px`;
    else s.removeProperty('translate');
    if (e.w != null) s.width = Math.round(e.w) + 'px'; else s.removeProperty('width');
    if (e.h != null) s.height = Math.round(e.h) + 'px'; else s.removeProperty('height');
  }

  // The element exactly as it was. The entry goes with it, so the next touch
  // reads the page afresh rather than the kit's own leftovers.
  /* An element back to the style attribute it had. An empty string counts as
     not having one: `style=""` and no style attribute render identically, so
     writing the empty one back leaves a crumb that says the kit was here and
     changes nothing else. An entry can come to hold one - snapshotted in the
     moment between a restore and the next paint - and the promise this
     function makes is worth more than the distinction. */
  const putStyleBack = (el, was) => {
    if (!was) el.removeAttribute('style');
    else el.setAttribute('style', was);
  };

  function reset(e) {
    // The items first: putting the list's copy back replaces them, and a style
    // restored onto an element that is about to be thrown away is wasted.
    e.kids?.forEach((k, i) => putStyleBack(k, e.kidStyles[i]));
    putStyleBack(e.el, e.style);
    // The copy as well as the type: Clear is the way back from a block that was
    // rewritten by hand as much as from one that was rolled.
    if (e.html !== undefined && e.el.innerHTML !== e.html) e.el.innerHTML = e.html;
    entries.delete(e.el);
  }

  const round = (n) => Math.round(n * 10) / 10;
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  // Rounded back to the step's own precision. Stepping 0.005 up from -0.03 in
  // binary floating point lands on -0.024999999999999998, which is the same
  // number to the eye and a much worse thing to write into a stylesheet.
  const rnd = (lo, hi, step) => {
    const n = lo + Math.round(Math.random() * (hi - lo) / step) * step;
    const dp = (String(step).split('.')[1] || '').length;
    return +n.toFixed(dp);
  };

  /* ============================ the dice ============================ */

  // A block's size decides what kind of thing it is, and that decides what a
  // roll is allowed to do to it. A title can take a display face and tight
  // tracking; a paragraph cannot, and a roll that gives it one has not made a
  // decision, it has made a mess.
  const isDisplay = (e) => e.baseSize >= 28;

  const ROLL = {
    // `pair` is the family the titlebar Randomize has chosen for this kind of
    // block, so every heading on the page lands on the same face and every run
    // of reading on another - which is what pairing type means. A dice on one
    // block alone gets no pair and picks for itself.
    face(e, pair) {
      const big = isDisplay(e);
      const pool = lib.FONTS.filter(f => big ? f.c !== 'mono' : ['sans', 'serif'].includes(f.c));
      e.font = pair || rand(pool).n;
      // Heavier for a title, readable for a paragraph, and always a weight the
      // family actually has.
      e.weight = nearestWeight(e.font, big ? rand([500, 600, 700, 800, 900]) : rand([300, 400, 400, 500]));
      // Italic is a thing you mean, not a coin flip on a paragraph.
      e.italic = big ? false : Math.random() < 0.12;
    },
    measure(e) {
      const big = isDisplay(e);
      // Relative to the size the page set: the hierarchy the page was built
      // with survives the roll, and only the amount of it changes.
      e.size = capSize(e, round(e.baseSize * rnd(big ? 0.8 : 0.9, big ? 1.35 : 1.15, 0.05)));
      // Lines close together for something set large, open for something
      // being read - the one rule of leading that is always true.
      e.lh = big ? rnd(0.95, 1.2, 0.01) : rnd(1.45, 1.8, 0.01);
      e.ls = big ? rnd(-0.03, 0.01, 0.005) : rnd(-0.005, 0.02, 0.005);
    },
    treatment(e) {
      // Only on something short: capitals on a paragraph is not a style, it is
      // a punishment.
      e.transform = e.baseSize <= 16 && Math.random() < 0.35 ? 'uppercase' : 'none';
      if (e.transform === 'uppercase') e.ls = Math.max(e.ls, 0.1);
      // Left, mostly. Centring a column of reading is a decision, not a roll.
      e.align = isDisplay(e) && Math.random() < 0.25 ? 'center' : 'left';
    },
  };

  // One block, whichever groups are not held.
  function rollEntry(e, pair) {
    if (!e.locks.face) ROLL.face(e, pair);
    if (!e.locks.measure) ROLL.measure(e);
    if (!e.locks.treatment) ROLL.treatment(e);
    paint(e);
  }

  // The whole page: two families chosen first, one for the display blocks and
  // one for the text, and then every block rolled against the one that suits
  // it. A page where every block picked its own face is not a page, it is a
  // specimen sheet.
  function rollAll() {
    const display = rand(lib.FONTS.filter(f => f.c !== 'mono')).n;
    const text = rand(lib.FONTS.filter(f => ['sans', 'serif'].includes(f.c))).n;
    for (const [, el] of ui.targets) {
      if (el === document.body) continue;
      const e = entryFor(el);
      rollEntry(e, e.locks.face ? null : (isDisplay(e) ? display : text));
    }
    sync();
    reframe();
    note('Rolled ' + display + ' over ' + text + '.');
  }

  /* ============================ the exported CSS ============================ */

  // A selector that finds this element again in the page's own stylesheet.
  // Its id if it has one, else its classes, else its tag - narrowed by walking
  // up the tree until the selector matches one element and no more.
  function selectorFor(el) {
    if (el === document.body) return 'body';
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const cls = [...node.classList].filter(c => !c.startsWith('is-')).map(c => '.' + CSS.escape(c));
      parts.unshift(cls.length ? cls.join('') : node.tagName.toLowerCase());
      if (cls.length && document.querySelectorAll(parts.join(' > ')).length === 1) break;
    }
    return parts.join(' > ') || 'body';
  }

  // The css2 URL for one family at the one weight a block uses. Both exports
  // carry it: type that arrives without its font is type in the fallback.
  const webfontFor = (e) => {
    const f = lib.byName(e.font);
    const axis = (f.i && e.italic) ? `ital,wght@1,${e.weight}` : `wght@${e.weight}`;
    return `https://fonts.googleapis.com/css2?family=${e.font.replace(/ /g, '+')}:${axis}&display=swap`;
  };

  /* ---- one block, as a brief ----
     Copy CSS hands a stylesheet to a person. This hands one block to a coding
     agent, which wants three things a stylesheet does not say: which element,
     where the font comes from, and what to do with the lot.

     JSON rather than a rule, because an agent is going to have to find the
     existing rule for that selector and change the properties in it - and
     values it can read as values are easier to put into whatever the project
     writes its CSS in, which may not be CSS. The text goes in too when it has
     been edited on the page: a block whose copy was rewritten here should not
     have to have it retyped at the other end. */
  function paramsFor(e) {
    const f = lib.byName(e.font);
    const sel = selectorFor(e.el);
    const params = {
      selector: sel,
      fontFamily: e.font,
      fallback: lib.FB[f.c] || 'sans-serif',
      fontWeight: e.weight,
      fontStyle: e.italic ? 'italic' : 'normal',
      fontSize: round(e.size) + 'px',
      lineHeight: e.lh,
      letterSpacing: e.ls ? e.ls + 'em' : 'normal',
      textTransform: e.transform,
      textAlign: e.align,
      color: e.color,
      webfont: webfontFor(e),
      // Only when the block was actually moved or resized - see the note in
      // cssFor. `offset` rather than `translate` because an agent reading this
      // should decide how to express it in the project's own layout, and a CSS
      // property name would read as an instruction to use that property.
      ...(e.w != null ? { width: Math.round(e.w) + 'px' } : {}),
      ...(e.h != null ? { height: Math.round(e.h) + 'px' } : {}),
      ...((e.dx || e.dy) ? { offset: `${Math.round(e.dx)}px ${Math.round(e.dy)}px` } : {}),
    };
    if (e.text !== undefined && e.el.textContent.trim() !== e.text.trim()) {
      params.text = e.el.textContent.replace(/\s+/g, ' ').trim();
    }
    return `Apply this typography to \`${sel}\` in this project.

${JSON.stringify(params, null, 2)}

Set these on the rule that already styles that selector rather than adding a new
one, and add the webfont once - a <link> in the head or an @import at the top of
the stylesheet, whichever the project already uses. Keep the fallback after the
family in the font stack.${params.text ? '\n\n"text" is the copy as it now reads on the page; update the markup to match.' : ''}`;
  }

  function cssFor() {
    const live = [...entries.values()].filter(e => e.el.isConnected);
    if (!live.length) return '/* nothing edited yet */';
    // One @import for every family in use, in the weights actually set, so the
    // pasted CSS brings its own fonts rather than relying on whatever the page
    // happened to be loading already.
    const families = new Map();
    for (const e of live) {
      const set = families.get(e.font) || new Set();
      set.add(e.weight + (e.italic ? 'i' : ''));
      families.set(e.font, set);
    }
    const imports = [...families].map(([name, set]) => {
      const f = lib.byName(name);
      const weights = [...new Set([...set].map(s => parseInt(s, 10)))].sort((a, b) => a - b);
      const anyItalic = f.i && [...set].some(s => s.endsWith('i'));
      const axis = anyItalic
        ? 'ital,wght@' + weights.map(w => '0,' + w).concat(weights.map(w => '1,' + w)).join(';')
        : 'wght@' + weights.join(';');
      return `@import url("https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:${axis}&display=swap");`;
    });

    const decl = (o) => Object.entries(o).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    const rules = live.map(e => `${selectorFor(e.el)} {\n${decl({
      'font-family': stackFor(e.font),
      'font-weight': e.weight,
      ...(e.italic ? { 'font-style': 'italic' } : {}),
      'font-size': round(e.size) + 'px',
      'line-height': e.lh,
      ...(e.ls ? { 'letter-spacing': e.ls + 'em' } : {}),
      ...(e.transform !== 'none' ? { 'text-transform': e.transform } : {}),
      'text-align': e.align,
      color: e.color,
      // Only what was actually set. A width nobody dragged is not a width, and
      // writing one out would bake in the measure of whatever window this
      // happened to be open in.
      ...(e.w != null ? { width: Math.round(e.w) + 'px' } : {}),
      ...(e.h != null ? { height: Math.round(e.h) + 'px' } : {}),
      ...((e.dx || e.dy) ? { translate: `${Math.round(e.dx)}px ${Math.round(e.dy)}px` } : {}),
    })}\n}`);

    // The imports first, because @import is only valid at the top of a sheet -
    // a browser drops one that follows a rule, silently, and the paste comes
    // out in the fallback face with no sign of why.
    return ['/* type kit */', ...imports, '', ...rules].join('\n');
  }

  /* ============================ the panel ============================ */

  // A group's header: the name, a dice for the properties it owns, and a lock
  // that holds them through everyone else's roll. No eye - a block always has
  // a face and a size, so there is nothing here to switch off.
  const head = (label, key) => `<h4>
        <span class="chev"></span>
        <span class="head-label">${label}</span>
        <button class="iconbtn dice" data-rand="${key}" title="Randomize ${label}"></button>
        <button class="lockbtn lock" data-lock="${key}" aria-pressed="false" title="Lock during randomize"></button></h4>`;

  const PANEL = `
<div class="kit">
  <button id="panelShow" data-mark="plus">Maximize type panel</button>
  <button id="kitExit" title="Close edit mode" aria-label="Close edit mode">&times;</button>
  <div class="hover"></div>
  <div class="toast" role="status" aria-live="polite"></div>
  <!-- The selection frame, and the handles that move and resize what it is
       round. The frame itself stays pointer-transparent - it covers the block,
       and swallowing clicks over the words would take away the caret. Only
       these are live: four strips in the 20px ring the frame stands off by,
       and eight squares on the corners and edges. -->
  <div class="outline">
    <i class="grip move n" data-grip="move"></i><i class="grip move s" data-grip="move"></i>
    <i class="grip move w" data-grip="move"></i><i class="grip move e" data-grip="move"></i>
    <i class="grip nw" data-grip="nw"></i><i class="grip ne" data-grip="ne"></i>
    <i class="grip sw" data-grip="sw"></i><i class="grip se" data-grip="se"></i>
    <i class="grip n" data-grip="n"></i><i class="grip s" data-grip="s"></i>
    <i class="grip w" data-grip="w"></i><i class="grip e" data-grip="e"></i>
  </div>
  <aside class="panel" id="panel">
    <div class="phead">
      <b>Type</b>
      <span class="spacer"></span>
      <button id="randomize" class="primary" title="Pair two faces and roll every block in the list">Randomize</button>
      <button id="panelToggle" class="iconbtn" data-mark="minus" title="Minimize"></button>
      <button id="kitClose" class="iconbtn" title="Close and put the page back (Shift+T)">&times;</button>
    </div>
    <div class="pbody">

    <div class="grp" data-section="element">
      <h3><span class="chev"></span><span class="head-label">Element</span><button class="infobtn" data-mark="info" title="Every block in the list answers the pointer while this panel is open. Click one to edit it, double-click to rewrite its copy. Alt-click takes a block's type, Ctrl+Alt-click (Cmd+Option on a Mac) puts it on another — the size travels as a ratio of each block's own, so a heading's look lands on a paragraph without turning it into a heading. Up and down walk the family list. Esc backs out a step at a time: out of the copy, out of the selection, then the panel minimizes." aria-label="What you can do here"></button></h3>
      <div class="grp-body">
      <div class="row"><label>target</label><select id="kit-target"></select><button id="kit-pick" title="Click an element on the page">Select element</button></div>
      <div class="row"><label>actions</label>
        <button class="iconbtn" data-mark="copy" id="kit-copy" title="Copy the CSS for every block edited" aria-label="Copy CSS"></button>
        <button class="iconbtn" data-mark="db-export" id="kit-params" title="Copy this block's type as a brief for a coding agent — the values as JSON, the webfont, and what to do with them" aria-label="Copy params for a coding agent"></button>
        <button class="iconbtn" data-mark="trash" id="kit-clear" title="Put this block back to the page's own type and text" aria-label="Clear element"></button></div>
      <p class="hint" id="kit-note"></p>
      </div>
    </div>

    <div class="grp" data-section="type">
      <h3><span class="chev"></span><span class="head-label">Type</span>
        <button class="iconbtn dice" data-rand="all" title="Randomize this block"></button>
        <button class="lockbtn lock" data-lock="all" aria-pressed="false" title="Lock every group on this block"></button></h3>
      <div class="grp-body">

      <div class="sub" data-section="face">
        ${head('Face', 'face')}
        <div class="sub-body">
          <!-- The families are previewed rather than listed, the way the
               studio previews its pattern tiles and its palettes: each row is
               the family's own name set in that family, so the list shows the
               thing being chosen instead of a word for it. -->
          <div class="row"><label>family</label><span class="chips" id="ty-cats"></span></div>
          <div class="fontlist" id="ty-fontlist" role="listbox" aria-label="Font family"></div>
          <!-- The weights as chips, the studio's way: a family exposes up to
               nine of them and they are a row of choices, not a menu to open.
               Which nine, and whether there is an italic at all, depends on
               the family - so both are redrawn when it changes. -->
          <div class="row"><label>weight</label><div class="chips" id="ty-weight"></div></div>
          <!-- No label in the gutter: the checkbox says "italic" an inch to the
               right of where the label would, and the word twice on one line is
               once too many. The empty gutter is still there, or the box would
               sit out of the column every other control starts in. -->
          <div class="row"><span class="gutter"></span>
            <span class="inline-check"><input type="checkbox" id="ty-italic"><label for="ty-italic">italic</label></span></div>
        </div>
      </div>

      <div class="sub" data-section="measure">
        ${head('Measure', 'measure')}
        <div class="sub-body">
          <div class="row"><label>size</label><input id="ty-size" type="range" min="8" max="160" step="0.5"><output id="ty-sizeV"></output></div>
          <div class="row"><label>line height</label><input id="ty-lh" type="range" min="0.8" max="2.4" step="0.01"><output id="ty-lhV"></output></div>
          <div class="row"><label>tracking</label><input id="ty-ls" type="range" min="-0.06" max="0.4" step="0.005"><output id="ty-lsV"></output></div>
        </div>
      </div>

      <div class="sub" data-section="treatment">
        ${head('Treatment', 'treatment')}
        <div class="sub-body">
          <div class="row"><label>case</label><select id="ty-transform">
            <option value="none">as typed</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
            <option value="capitalize">Capitalize</option></select></div>
          <div class="row"><label>align</label><span class="radios">
            <input type="radio" name="ty-align" id="ty-align-left" value="left"><label for="ty-align-left">left</label>
            <input type="radio" name="ty-align" id="ty-align-center" value="center"><label for="ty-align-center">centre</label>
            <input type="radio" name="ty-align" id="ty-align-right" value="right"><label for="ty-align-right">right</label>
            <input type="radio" name="ty-align" id="ty-align-justify" value="justify"><label for="ty-align-justify">justify</label></span></div>
          <div class="row"><label>colour</label><input type="color" id="ty-color" aria-label="Text colour"></div>
        </div>
      </div>

      </div>
    </div>

    </div>
  </aside>
</div>`;

  /* ============================ the panel, wired ============================ */

  let ui = null;
  const $ = (id) => ui.root.getElementById(id);
  const cur = () => ui.current ? entryFor(ui.current) : null;

  function note(text) {
    const n = $('kit-note');
    n.textContent = text || '';
    n.hidden = !text;
  }

  function toast(text) {
    const t = ui.root.querySelector('.toast');
    t.textContent = text;
    t.classList.add('is-shown');
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => t.classList.remove('is-shown'), 1400);
  }

  /* ---- the list of blocks ----
     Read off the page each time rather than written down here: a block added
     to the HTML with a data-type-kit name appears in the panel without this
     file knowing anything about it. */
  function buildTargets() {
    ui.targets = [['page', document.body]];
    document.querySelectorAll('[data-type-kit]').forEach((el, i) => {
      // Non-breaking spaces for the indent: an <option> collapses plain ones.
      ui.targets.push([`  ${i + 1}. ${el.dataset.typeKit || el.tagName.toLowerCase()}`, el]);
    });
    const sel = $('kit-target');
    sel.innerHTML = ui.targets.map(([label], i) => `<option value="${i}">${label}</option>`).join('');
    markTarget();
  }

  function markTarget() {
    const i = ui.targets.findIndex(([, el]) => el === ui.current);
    $('kit-target').value = i < 0 ? '' : String(i);
    ui.root.querySelector('.kit').classList.toggle('is-unselected', !ui.current);
  }

  function select(el) {
    ui.current = el;
    if (el && el !== document.body) entryFor(el);
    markTarget();
    placeOutline();
    watchBox();
    sync();
    revealFont();
  }

  /* ---- the controls, from the block ---- */

  /* ---- the family list, previewed ----
     41 rows, each the family's name set in that family. A name in the panel's
     own face tells you what a font is called; it does not tell you whether you
     want it, which is the only question being asked here.

     The catalogue is filtered by category rather than grouped by it: five
     groups in a box this tall means scrolling past four of them to reach the
     fifth, and the chips do the same job in one line. */
  function buildCats() {
    $('ty-cats').innerHTML = [['all', 'all'], ...lib.CATS].map(([key]) =>
      `<label><input type="radio" name="ty-cat" value="${key}"${key === ui.fontFilter ? ' checked' : ''}>${key}</label>`).join('');
  }

  function buildFontList() {
    const list = $('ty-fontlist');
    const shown = ui.fontFilter === 'all' ? lib.FONTS : lib.FONTS.filter(f => f.c === ui.fontFilter);
    list.innerHTML = shown.map(f => {
      const weights = f.w.length + (f.w.length === 1 ? ' weight' : ' weights');
      return `<button type="button" role="option" data-font="${f.n}" aria-selected="false" aria-pressed="false" title="${f.n} — ${weights}${f.i ? ', italic' : ''}">${f.n}<i>${f.c}</i></button>`;
    }).join('');
    dressRows();
    markFont();
  }

  /* ---- the faces the list is set in ----
     One stylesheet for the whole catalogue, asked for once when the panel
     opens: every family at 400, which is all a preview row needs. css2 takes
     as many family= parameters as you give it, so 41 families cost one
     request and Google sends each as its own small latin woff2.

     This was an IntersectionObserver first, dressing each row as it came into
     view - the frugal version, and the one that matches how the studio fills
     its pattern grid. It never fired: these rows are in a shadow root under a
     host that is a 0x0 fixed box, and no root setting - the list, the
     viewport - produced a single intersection. A preview that silently leaves
     every row in the fallback face is worse than the bytes, so the list asks
     for all of them and is certain.

     The weights a block actually uses still come from loadFont(), which asks
     for that family in full. Two @font-face rules for the same family at 400
     is a duplicate, not a conflict - both are the whole face. */
  function loadPreviewFaces() {
    if (ui.facesAsked) return;
    ui.facesAsked = true;
    const families = lib.FONTS.map(f => `family=${f.n.replace(/ /g, '+')}:wght@${nearestWeight(f.n, 400)}`).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.typeKitStyle = '';   // goes with everything else on close
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.append(link);
  }

  // Every row in its own face. No waiting and nothing to observe: the rule is
  // set as the row is built, and the glyphs swap in when the sheet above
  // arrives, which is the swap any webfont makes.
  function dressRows() {
    loadPreviewFaces();
    for (const b of $("ty-fontlist").children) b.style.fontFamily = stackFor(b.dataset.font);
  }

  // Which row is the block's, and the name spelled out under the list - a row
  // set in Pacifico is not always a row you can read the name of.
  function markFont() {
    const e = cur(), list = $('ty-fontlist');
    for (const b of list.children) {
      const on = !!e && b.dataset.font === e.font;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-selected', String(on));
    }
  }

  /* ---- one family up, one down ----
     Choosing a typeface is comparing typefaces, and a list you have to aim at
     with a pointer makes you do it one deliberate click at a time. The arrow
     keys walk it: hold Down and the page reads its way through the catalogue.

     Within the filter, so the chips narrow what the arrows walk, and stopping
     at each end rather than wrapping - a list that silently starts again is a
     list you can no longer tell you are at the end of. */
  function stepFont(by) {
    const e = cur(); if (!e) return;
    const rows = [...$('ty-fontlist').children];
    const at = rows.findIndex(b => b.dataset.font === e.font);
    // Not in the list at all (the filter is on another category): the first
    // press takes the row the filter starts with rather than doing nothing.
    const next = rows[at < 0 ? (by > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, at + by))];
    if (!next || next.dataset.font === e.font) return;
    edit(x => {
      x.font = next.dataset.font;
      x.weight = nearestWeight(x.font, x.weight);
      if (!lib.byName(x.font).i) x.italic = false;
    });
    revealFont();
  }

  // The chosen row brought into view, and only if it is not already - and only
  // the list is scrolled. scrollIntoView would take every scrollable ancestor
  // with it, which here means the panel body and then the page behind it.
  function revealFont() {
    const e = cur(); if (!e) return;
    const list = $('ty-fontlist');
    const row = [...list.children].find(b => b.dataset.font === e.font);
    if (!row) return;
    const top = row.offsetTop, bottom = top + row.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = top - (list.clientHeight - row.offsetHeight) / 2;
  }

  // The weights this family actually ships. Rebuilt whenever the family
  // changes, because a weight that is not in the list is a font that will not
  // arrive.
  function buildWeights(e) {
    const w = lib.byName(e.font).w;
    // Snapped here as well as where the family is chosen, because a rolled or
    // pasted weight can be one this family does not have either - and a chip
    // row with nothing checked is a control with no answer in it.
    if (!w.includes(e.weight)) e.weight = nearestWeight(e.font, e.weight);
    $('ty-weight').innerHTML = w.map(x =>
      `<label><input type="radio" name="ty-wt" value="${x}"${x === e.weight ? ' checked' : ''}>${x}</label>`).join('');
  }

  function sync() {
    const e = cur();
    const kit = ui.root.querySelector('.kit');
    kit.classList.toggle('is-unselected', !e);
    for (const key of [...GROUPS, 'all']) {
      const held = e ? (key === 'all' ? GROUPS.every(g => e.locks[g]) : e.locks[key]) : false;
      ui.root.querySelector(`[data-lock="${key}"]`).setAttribute('aria-pressed', String(held));
    }
    if (!e) { note('Nothing selected — pick a block from the list, or click one on the page.'); return; }
    note('');
    markFont();
    buildWeights(e);
    $('ty-italic').checked = e.italic;
    $('ty-italic').disabled = !lib.byName(e.font).i;
    $('ty-size').max = sizeCap(e);
    $('ty-size').value = e.size; $('ty-sizeV').value = round(e.size) + 'px';
    $('ty-lh').value = e.lh; $('ty-lhV').value = (+e.lh).toFixed(2);
    $('ty-ls').value = e.ls; $('ty-lsV').value = (e.ls > 0 ? '+' : '') + (+e.ls).toFixed(3) + 'em';
    $('ty-transform').value = e.transform;
    const align = ui.root.querySelector(`input[name="ty-align"][value="${e.align}"]`);
    if (align) align.checked = true;
    $('ty-color').value = e.color;
  }

  // Everything that edits one property does the same three things, so they all
  // go through here: put it in the entry, put it on the page, put it back in
  // the panel where a second control shows the same value.
  const edit = (fn) => {
    const e = cur(); if (!e) return;
    fn(e);
    paint(e);
    sync();
    // The observer will say the same thing a frame later; this is so the
    // frame moves with the slider rather than behind it.
    reframe();
  };

  function wire() {
    buildCats();
    buildFontList();

    // --- the element section ---
    $('kit-target').addEventListener('change', (ev) => {
      const pick = ui.targets[+ev.target.value];
      select(pick && pick[1] !== document.body ? pick[1] : null);
    });
    $('kit-pick').addEventListener('click', () => togglePick());
    $('kit-copy').addEventListener('click', async () => {
      const css = cssFor();
      try { await navigator.clipboard.writeText(css); toast('css copied'); }
      catch { console.log(css); toast('css in console'); }
    });
    $('kit-params').addEventListener('click', async () => {
      const e = cur(); if (!e) return;
      const brief = paramsFor(e);
      try { await navigator.clipboard.writeText(brief); toast('params copied'); }
      catch { console.log(brief); toast('params in console'); }
    });
    $('kit-clear').addEventListener('click', () => {
      const e = cur(); if (!e) return;
      // Clear puts the copy back too, which means replacing the contents of the
      // element the caret is sitting in.
      if (ui.editing === e.el) stopEditing();
      reset(e);
      sync();
      toast('block reset');
    });

    // --- the face ---
    // One listener on the list rather than one per row: the list is rebuilt
    // whenever the category chips change, and per-row listeners would have to
    // be hung again every time.
    $('ty-fontlist').addEventListener('click', (ev) => {
      const row = ev.target.closest('[data-font]');
      if (!row) return;
      edit(e => {
        e.font = row.dataset.font;
        // The nearest weight the new family has: a family switched from one
        // with a 200 to one without leaves the panel showing a weight that
        // does not exist and the page showing the fallback.
        e.weight = nearestWeight(e.font, e.weight);
        if (!lib.byName(e.font).i) e.italic = false;
      });
    });
    $('ty-cats').addEventListener('change', (ev) => {
      ui.fontFilter = ev.target.value;
      buildFontList();
      revealFont();
    });
    // Delegated: the chips are rebuilt whenever the family changes, so a
    // listener per chip would have to be hung again every time.
    $('ty-weight').addEventListener('change', (ev) => {
      if (ev.target.name === 'ty-wt') edit(e => { e.weight = +ev.target.value; });
    });
    $('ty-italic').addEventListener('change', (ev) => edit(e => { e.italic = ev.target.checked; }));

    // --- the measure ---
    $('ty-size').addEventListener('input', (ev) => edit(e => { e.size = +ev.target.value; }));
    $('ty-lh').addEventListener('input', (ev) => edit(e => { e.lh = +ev.target.value; }));
    $('ty-ls').addEventListener('input', (ev) => edit(e => { e.ls = +ev.target.value; }));

    // --- the treatment ---
    $('ty-transform').addEventListener('change', (ev) => edit(e => { e.transform = ev.target.value; }));
    ui.root.querySelectorAll('input[name="ty-align"]').forEach(r =>
      r.addEventListener('change', (ev) => edit(e => { e.align = ev.target.value; })));
    $('ty-color').addEventListener('input', (ev) => edit(e => { e.color = ev.target.value; }));

    // --- the dice and the locks ---
    // One listener on the root rather than one per button: events inside a
    // shadow root do not retarget within it, so delegation has to live here,
    // and there is nothing to unbind on close - the root goes with the panel.
    ui.root.addEventListener('click', (ev) => {
      const die = ev.target.closest?.('[data-rand]');
      if (die) {
        const e = cur(); if (!e) return;
        const key = die.dataset.rand;
        if (key === 'all') rollEntry(e);
        else if (!e.locks[key]) { ROLL[key](e); paint(e); }
        sync();
        reframe();
        return;
      }
      const lock = ev.target.closest?.('[data-lock]');
      if (lock) {
        const e = cur(); if (!e) return;
        const key = lock.dataset.lock;
        if (key === 'all') { const on = !GROUPS.every(g => e.locks[g]); GROUPS.forEach(g => { e.locks[g] = on; }); }
        else e.locks[key] = !e.locks[key];
        sync();
      }
    });

    // --- the sections open and shut ---
    ui.root.addEventListener('click', (ev) => {
      const h = ev.target.closest?.('.grp > h3, .sub > h4');
      if (!h || ev.target.closest('button')) return;
      h.parentElement.classList.toggle('collapsed');
    });

    wireGrips();
    $('randomize').addEventListener('click', rollAll);
    $('kitClose').addEventListener('click', close);
    wireWindow();
  }

  /* ---- the floating window: dragged, minimized, and sized by its contents ----
     The studio's, and lifted from texture-kit.js with it. --dock-x/y are what
     panel.css animates the minimize along, measured at the moment of the press
     from wherever the window has been dragged to. */
  function wireWindow() {
    const panel = $('panel'), show = $('panelShow'), bar = panel.querySelector('.phead'), kit = ui.root.querySelector('.kit');

    $('panelToggle').addEventListener('click', () => {
      const wasStyle = show.getAttribute('style') || '';
      show.style.display = 'block'; show.style.visibility = 'hidden';
      const b = show.getBoundingClientRect();
      show.setAttribute('style', wasStyle);
      const cx = panel.offsetLeft + panel.offsetWidth / 2, cy = panel.offsetTop + panel.offsetHeight / 2;
      panel.style.setProperty('--dock-x', Math.round((b.left + b.right) / 2 - cx) + 'px');
      panel.style.setProperty('--dock-y', Math.round((b.top + b.bottom) / 2 - cy) + 'px');
      kit.classList.add('panel-hidden');
    });
    show.addEventListener('click', () => kit.classList.remove('panel-hidden'));
    $('kitExit').addEventListener('click', close);

    let dx = 0, dy = 0, dragging = false;
    const place = (x, y) => {
      const gap = 8, w = panel.offsetWidth, h = panel.offsetHeight;
      panel.style.left = Math.round(Math.max(gap, Math.min(x, innerWidth - w - gap))) + 'px';
      panel.style.top = Math.round(Math.max(gap, Math.min(y, innerHeight - h - gap))) + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.translate = 'none';
      // Held to the room below where it was dropped: a window put down low can
      // still grow past the bottom of the screen when a group is opened, long
      // after the drag that clamped it is over.
      panel.style.maxHeight = Math.max(160, innerHeight - parseFloat(panel.style.top) - gap) + 'px';
    };
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      place(r.left, r.top);
      dragging = true;
      panel.classList.add('is-dragging');
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    bar.addEventListener('pointermove', e => { if (dragging) place(e.clientX - dx, e.clientY - dy); });
    const endDrag = e => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) panel.style.left = panel.style.top = panel.style.right = panel.style.bottom = panel.style.translate = panel.style.maxHeight = ''; });
    ui.onResize = () => { if (panel.style.left) place(parseFloat(panel.style.left), parseFloat(panel.style.top)); placeOutline(); };

    // The window follows its own contents: a group opening changes the height
    // between one frame and the next, and the observer animates from where it
    // was to where it now is. The guard is what stops the animation's own
    // resize firing the observer again.
    if (typeof ResizeObserver === 'function') {
      const body = panel.querySelector('.pbody');
      const still = matchMedia('(prefers-reduced-motion: reduce)');
      let last = panel.getBoundingClientRect().height, flight = null;
      const ro = new ResizeObserver(() => {
        const now = panel.getBoundingClientRect().height;
        if (flight || ui.settling) { last = now; return; }
        const from = last;
        last = now;
        if (still.matches || Math.abs(now - from) < 3) return;
        flight = panel.animate([{ height: from + 'px' }, { height: now + 'px' }],
                               { duration: 170, easing: 'cubic-bezier(.2, .7, .3, 1)' });
        flight.finished.catch(() => {}).finally(() => { flight = null; });
        ui.onResize?.();
      });
      if (body) ro.observe(body);
      ui.panelRO = ro;
    }
  }

  /* ---- the frames: the block being edited, and the one under the pointer ---- */
  /* How far the two frames stand off the block they are round.
     The texture kit draws its frame just inside the element's edge, which is
     right there: it is framing a band of colour, and a rule sitting on the
     colour is the clearest way to say which band. Here the element IS the
     words, and a rule drawn on top of them - a dashed one, with a paper band
     under it - lands on the ascenders of the first line and the descenders of
     the last. Which is the one thing you are trying to look at while you go
     through faces.

     So both frames step back out of the way - the hovered one by the same
     amount as the chosen one, or a block would jump a frame's width the moment
     it was clicked. Far enough to clear the type they are round, near enough
     to still read as belonging to it. */
  const FRAME_PAD = 20;

  function placeBox(box, el, pad = 0) {
    const r = el?.getBoundingClientRect();
    if (!r || el === document.body) { box.style.display = 'none'; return; }
    Object.assign(box.style, {
      display: 'block',
      left: (r.left - pad) + 'px',
      top: (r.top - pad) + 'px',
      width: (r.width + pad * 2) + 'px',
      height: (r.height + pad * 2) + 'px',
    });
  }
  function placeOutline(el = ui?.current) {
    if (ui?.outline) placeBox(ui.outline, el, FRAME_PAD);
  }

  /* ---- the frames follow what they are drawn round ----
     Almost every control here changes the size of the thing it is framing: a
     bigger size, a heavier weight, looser leading, a wider face all change how
     much room the block takes, and a block that grows pushes whatever is under
     it down. Frames placed once at selection and left there drift off the
     block within two drags of a slider.

     An observer rather than a call after each edit, because the box changes
     twice for one edit and only the first is ours. Picking a family sets the
     style now and reflows again a moment later when the font file arrives from
     Google - and that second reflow belongs to nobody, so nothing would be
     there to answer it.

     The body is watched as well as the block: a heading that grows moves every
     block below it without changing their size, so the frame on one of THOSE
     has to move for a change that did not happen to it. */
  function reframe() {
    if (!ui) return;
    placeOutline();
    placeBox(ui.hoverBox, ui.hover === ui.current && ui.hoverMode === 'select' ? null : ui.hover, FRAME_PAD);
  }

  /* ---- dragging the block itself ----
     One handler on the frame for all twelve handles: they differ only in which
     of the four edges the pointer is allowed to move.

     A resize from the top or the left moves the block as it shrinks it, so the
     opposite edge stays where it is - drag the west handle and the east edge
     does not wander, which is the only behaviour that lets you set a measure
     by eye.

     Everything is measured from where the press landed rather than from where
     the pointer is now, so a drag that goes out of the window and comes back
     picks up exactly where it left off. */
  function wireGrips() {
    const frame = ui.outline, kit = ui.root.querySelector('.kit');

    frame.addEventListener('pointerdown', (ev) => {
      const grip = ev.target.closest('.grip');
      const e = cur();
      if (!grip || !e || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();

      const how = grip.dataset.grip;
      const r = e.el.getBoundingClientRect();
      const from = { x: ev.clientX, y: ev.clientY, dx: e.dx || 0, dy: e.dy || 0, w: e.w ?? r.width, h: e.h ?? r.height };
      grip.setPointerCapture(ev.pointerId);

      /* Nothing happens until the pointer has actually travelled. The move
         strips fill a 20px ring around the block, and on a page set at all
         tightly that ring lies over whatever is above and below it - so a
         press there is far more often someone reaching for the next paragraph
         than someone beginning a drag. Under the threshold the press is handed
         back to the page as a selection; over it, it is a drag. */
      let dragging = false;
      const began = (m) => dragging || (dragging = Math.abs(m.clientX - from.x) > 3 || Math.abs(m.clientY - from.y) > 3);

      const onMove = (m) => {
        if (!began(m)) return;
        kit.classList.add('is-dragging-block');
        const mx = m.clientX - from.x, my = m.clientY - from.y;
        if (how === 'move') {
          e.dx = from.dx + mx;
          e.dy = from.dy + my;
        } else {
          // A block can be dragged to nothing and then never found again, so
          // both dimensions stop while there is still something to grab.
          if (how.includes('e')) e.w = Math.max(32, from.w + mx);
          if (how.includes('w')) { e.w = Math.max(32, from.w - mx); e.dx = from.dx + (from.w - e.w); }
          if (how.includes('s')) e.h = Math.max(20, from.h + my);
          if (how.includes('n')) { e.h = Math.max(20, from.h - my); e.dy = from.dy + (from.h - e.h); }
        }
        paint(e);
        reframe();
      };
      const done = (m) => {
        frame.removeEventListener('pointermove', onMove);
        frame.removeEventListener('pointerup', done);
        frame.removeEventListener('pointercancel', done);
        kit.classList.remove('is-dragging-block');
        if (grip.hasPointerCapture(m.pointerId)) grip.releasePointerCapture(m.pointerId);
        // A press that never became a drag is a click on whatever is under the
        // ring. The frame is taken out of the way to ask - elementFromPoint
        // returns the topmost thing that takes pointer events, and right now
        // that is the strip we are standing on.
        if (!dragging && m.type === 'pointerup') {
          frame.style.display = 'none';
          const under = document.elementFromPoint(m.clientX, m.clientY);
          frame.style.display = '';
          const t = under && targetAt(under);
          if (t && t !== e.el) { listIfNew(t); select(t); return; }
        }
        reframe();
      };
      frame.addEventListener('pointermove', onMove);
      frame.addEventListener('pointerup', done);
      frame.addEventListener('pointercancel', done);
    });

    // A double-click on a handle puts the box back where the page had it,
    // which is the way out of a drag that went wrong without clearing the type
    // with it.
    frame.addEventListener('dblclick', (ev) => {
      if (!ev.target.closest('.grip')) return;
      const e = cur(); if (!e) return;
      ev.preventDefault(); ev.stopPropagation();
      Object.assign(e, { dx: 0, dy: 0, w: null, h: null });
      paint(e);
      reframe();
      toast('box reset');
    });
  }

  function watchBox() {
    if (typeof ResizeObserver !== 'function') return;
    ui.boxRO?.disconnect();
    // The frames are fixed-position and live in the shadow root, so moving
    // them cannot change the page's layout and cannot feed this back.
    ui.boxRO = new ResizeObserver(() => reframe());
    if (ui.current && ui.current !== document.body) ui.boxRO.observe(ui.current);
    ui.boxRO.observe(document.body);
  }

  function setHover(el, mode = 'select') {
    if (ui.hover === el && ui.hoverMode === mode) return;
    ui.hover?.removeAttribute('data-type-kit-hover');
    ui.hover = el; ui.hoverMode = mode;
    // The value is the page sheet's cursor hook: which of the three this click
    // would be, said before it is pressed.
    if (el && el !== document.body) el.setAttribute('data-type-kit-hover', mode);
    placeBox(ui.hoverBox, el === ui.current && mode === 'select' ? null : el, FRAME_PAD);
  }

  /* ---- Select element: click anything on the page ---- */
  const pickable = (t) => (t instanceof Element && t !== ui.host && !t.closest('[data-type-kit-panel]'))
    ? (t === document.documentElement ? document.body : t) : null;
  const onPickMove = (ev) => { const t = pickable(ev.target); if (t) placeOutline(t); };
  function onPickClick(ev) {
    const t = pickable(ev.target);
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    togglePick(false);
    listIfNew(t);
    select(t);
  }
  function togglePick(force) {
    const on = typeof force === 'boolean' ? force : !ui.picking;
    ui.picking = on;
    $('kit-pick').classList.toggle('primary', on);
    const opt = { capture: true };
    if (on) { document.addEventListener('pointermove', onPickMove, opt); document.addEventListener('click', onPickClick, opt); note('Click a block on the page — Esc cancels.'); }
    else { document.removeEventListener('pointermove', onPickMove, opt); document.removeEventListener('click', onPickClick, opt); note(''); placeOutline(); }
  }

  /* ---- click to edit: every block in the list is live ----
     Hovering one frames it, clicking one selects it. The innermost wins, so a
     paragraph beats the column it sits in. The click is taken rather than
     passed on - a click meant to choose a block should not follow a link out
     of the page. Ctrl / Cmd or Shift lets the page have it back. */
  /* ---- what a click on the page lands on ----
     Any run of words, not only the blocks the page named. The named ones are a
     convenience - they give the list its order and its names - but a tool for
     setting type that can only set the type of six pre-agreed elements is not
     much of a tool, and on somebody else's page there may be none at all.

     "A run of words" means an element with a text node of its own. That is the
     whole rule, and it lands exactly where a person would point: a heading, a
     paragraph, a list item, a link, a caption. It also means a wrapper is
     never chosen over what is inside it - a column of paragraphs holds no text
     itself, so clicking one gets the paragraph. The wrapper is still reachable
     from the list, which is where "the whole column at once" belongs.

     Interactive elements are not skipped. A button's label and a link are type
     like anything else, and this kit already hands the page back its own click
     on Shift or Ctrl/Cmd - which is the documented way to follow a link while
     the panel is open, and how the texture kit behaves too. */
  const ownWords = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());

  /* A list is one piece of type, not one per bullet. Nobody sets the third
     item of a list in a different face from the second, and a tool that makes
     you click four items to change four items is a tool that will be used to
     produce a list set four ways. So a click on an item takes the list.

     The nearest list, not the outermost: the steps on the intro page hold a
     list of kits inside one of their items, and those are a different piece of
     type from the steps around them.

     A list that is itself clicked - in its own padding, or because the page
     named it - is already the answer. Without that check a nested list would
     be promoted to the one it sits in, since it is inside an item too. */
  const listOf = (el) => {
    if (el.matches('ul, ol')) return el;
    const item = el.closest('li');
    return item ? (item.parentElement?.closest('ul, ol') || el) : el;
  };

  function targetAt(t) {
    if (!(t instanceof Element) || t.closest('[data-type-kit-panel]')) return null;
    for (let n = t; n && n !== document.body; n = n.parentElement) {
      // A named block with nothing of its own to say is still worth offering
      // once the walk reaches it - the column of paragraphs, clicked in the
      // gap between two of them.
      if (ownWords(n) || n.hasAttribute('data-type-kit')) return listOf(n);
    }
    return null;
  }

  // Anything chosen that the page did not name joins the list, so it can be
  // come back to after something else has been selected.
  function listIfNew(el) {
    if (!el || el === document.body || ui.targets.some(([, x]) => x === el)) return;
    const words = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    ui.targets.push([`  · ${el.tagName.toLowerCase()}${words ? ' ' + words.toLowerCase() : ''}`, el]);
    $('kit-target').innerHTML = ui.targets.map(([label], i) => `<option value="${i}">${label}</option>`).join('');
    // Rebuilding the options drops the selected one; put it back, for the
    // copy and paste paths that list an element without selecting it.
    markTarget();
  }
  /* ---- double-click to rewrite the copy ----
     Type is judged on the words it is setting, and the words on a demo page
     are never the words you are shipping. A double-click turns the block into
     what it already looks like - a box of text with a caret in it - and Esc,
     or a click anywhere else, puts the caret away again.

     plaintext-only where it is supported: a paste out of a browser carries its
     source's markup with it, and a heading that arrives wearing someone else's
     <span style> is not a heading you can judge a typeface by. Browsers that
     do not know the value fall back to plain `true`, which is the old
     behaviour rather than no behaviour.

     The block keeps the type the panel gave it while it is edited, because the
     type is inline on the element and the caret does not disturb it. */
  function startEditing(el) {
    if (!el || el === document.body || ui.editing === el) return;
    stopEditing();
    entryFor(el);                       // its copy snapshotted before it is changed
    ui.editing = el;
    el.contentEditable = 'plaintext-only';
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.spellcheck = false;
    el.setAttribute('data-type-kit-editing', '');
    el.focus({ preventScroll: true });
    note('Editing the copy — Esc when you are done.');
  }
  function stopEditing() {
    const el = ui?.editing;
    if (!el) return;
    ui.editing = null;
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.removeAttribute('data-type-kit-editing');
    note('');
    // The frame is drawn from the element's box, and rewriting the copy is the
    // one edit here that can change how many lines it takes.
    placeOutline();
  }
  const onEditDbl = (ev) => {
    if (!ui || ui.picking) return;
    const t = targetAt(ev.target);
    if (!t) return;
    ev.preventDefault();
    listIfNew(t);
    select(t);
    startEditing(t);
  };

  /* ---- copy one block's type onto another ----
     Alt-click takes a block's look; Ctrl+Alt-click (Cmd+Option on a Mac) puts
     it on another. The same pair the texture kit uses, and for the same
     reason: the fastest way to make two things match is to say "like that
     one", and the slowest is to read nine values off one panel and type them
     into another.

     Size travels as a RATIO, not as a number. Everything else is the look
     itself - a face is a face wherever it lands - but 64px is not a look, it
     is a decision about one block. What is worth carrying is how far the block
     was moved from the size its own stylesheet gives it, so a title set to
     1.35x its page size lands on a paragraph as 1.35x THAT paragraph's page
     size. Two blocks the page sets at the same size still come out identical,
     which is the case where copying the number would also have been right.

     This is how the dice already works in this kit, so the two agree. */
  const lookOf = (e) => ({
    font: e.font, weight: e.weight, italic: e.italic,
    sizeFactor: e.baseSize ? e.size / e.baseSize : 1,
    lh: e.lh, ls: e.ls, transform: e.transform, align: e.align, color: e.color,
  });

  const nameOf = (el) => (ui.targets.find(([, x]) => x === el)?.[0] || selectorFor(el)).replace(/^[\s ]+/, '');

  function copyLook(el) {
    const e = entryFor(el);
    ui.copied = lookOf(e);
    toast('copied ' + e.font);
  }
  function pasteLook(el) {
    if (!ui.copied) return toast('nothing copied yet');
    const e = entryFor(el), look = ui.copied;
    Object.assign(e, {
      font: look.font, weight: look.weight, italic: look.italic,
      lh: look.lh, ls: look.ls, transform: look.transform, align: look.align, color: look.color,
    });
    e.size = capSize(e, round(e.baseSize * look.sizeFactor));
    // The weight may not exist in this family - it does, since the family came
    // with it, but a family whose weights the catalogue lists differently is
    // one browser update away and this costs nothing.
    e.weight = nearestWeight(e.font, e.weight);
    paint(e);
    if (el === ui.current) sync();
    reframe();
    toast('pasted onto ' + nameOf(el));
  }

  // Alt copies; Ctrl+Alt (Cmd+Option) pastes; Ctrl / Cmd or Shift alone is the
  // page's own click - a link opened in a new tab, and so on; nothing held
  // selects.
  const modeOf = (ev) => {
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ev.shiftKey) return null;
    if (ev.altKey) return ctrl ? 'paste' : 'copy';
    return ctrl ? null : 'select';
  };

  function onEditMove(ev) {
    if (!ui || ui.picking) return;
    ui.lastTarget = ev.target;          // so a modifier pressed without moving can re-read it
    const mode = modeOf(ev);
    setHover(mode ? targetAt(ev.target) : null, mode || 'select');
  }
  const onEditOut = (ev) => { if (ui && !ui.picking && !ev.relatedTarget) { ui.lastTarget = null; setHover(null); } };
  // Pressing or letting go of a modifier changes the cursor on the spot,
  // rather than on the next move of the mouse.
  function onModifier(ev) {
    if (!ui || ui.picking || !['Alt', 'Control', 'Meta', 'Shift'].includes(ev.key)) return;
    // Firefox, and Alt alone on some Windows browsers, hands the keyboard to
    // the menu bar when Alt comes back up; not after an Alt-click that copied.
    if (ev.type === 'keyup' && ev.key === 'Alt' && ui.altUsed) { ev.preventDefault(); ui.altUsed = false; }
    const mode = modeOf(ev);
    setHover(mode && ui.lastTarget ? targetAt(ui.lastTarget) : null, mode || 'select');
  }

  function onEditClick(ev) {
    if (!ui || ui.picking) return;
    const mode = modeOf(ev);
    if (!mode) return;                  // Shift or Ctrl alone: the page's own click
    // A click inside the block being rewritten is a caret, not a selection:
    // taking it would make the text uneditable by the thing that made it
    // editable. A modifier still gets through - copying the look of the block
    // you are typing in is a reasonable thing to want.
    if (ui.editing && mode === 'select') {
      if (ui.editing.contains(ev.target)) return;
      stopEditing();
    }
    const t = targetAt(ev.target);
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    if (mode === 'copy') { ui.altUsed = true; listIfNew(t); return copyLook(t); }
    if (mode === 'paste') { ui.altUsed = true; listIfNew(t); return pasteLook(t); }
    listIfNew(t);
    select(t);
    placeBox(ui.hoverBox, null);   // the selection frame takes over from the hover one
  }

  // Ctrl+Option-click on a Mac is a right-click, which opens a menu instead of
  // clicking - so there it pastes from the menu event.
  function onEditMenu(ev) {
    if (!ui || ui.picking || !ev.ctrlKey || !ev.altKey || ev.shiftKey) return;
    const el = targetAt(ev.target);
    if (!el) return;
    ev.preventDefault();
    pasteLook(el);
  }

  const onScroll = () => {
    if (!ui || ui.picking) return;
    placeOutline();
    placeBox(ui.hoverBox, ui.hover === ui.current ? null : ui.hover, FRAME_PAD);
  };
  const onResize = () => ui?.onResize?.();
  // Esc backs out one step at a time: out of Select element, then out of the
  // selection, then the panel minimizes.
  const onKey = (ev) => {
    if (!ui || ui.loading) return;

    // Up and down walk the family list. Not while the caret is in a block, and
    // not while the pointer is in a field or on a control of the panel's own -
    // a slider answers the same keys, and the one under the pointer should
    // win. A modifier belongs to the browser: Alt+Down is a select, Cmd+Down
    // is the end of the page.
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && !ui.editing
        && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      const on = ev.composedPath()[0];
      if (!on?.closest?.('input, textarea, select, [contenteditable]')) {
        ev.preventDefault();
        stepFont(ev.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    if (ev.key !== 'Escape') return;
    if (ui.editing) stopEditing();
    else if (ui.picking) togglePick(false);
    else if (ui.current) { select(null); setHover(null); }
    else if (!ui.root.querySelector('.kit').classList.contains('panel-hidden')) $('panelToggle').click();
  };

  // The one thing the kit styles on the page itself, so a block on offer says
  // it is one. Removed with everything else on close.
  /* The two cursors that say what a modifier would do, drawn here rather than
     named: no system cursor means "take this one's look" or "put it on that
     one". The studio's, down to the paper edge that keeps them legible over a
     dark block, and the hotspot is the tip that does the work. The keyword
     after each is what a browser that refuses an SVG cursor falls back to. */
  const cursorURL = (svg, x, y, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
  const EYEDROPPER = cursorURL(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M19.6 2.9a2.2 2.2 0 0 0-3.1 0l-2.6 2.6-1-1-1.6 1.6 1 1-8 8c-.3.3-.5.7-.5 1.1l-.4 2.2L2 20l2 2 1.6-1.4 2.2-.4c.4 0 .8-.2 1.1-.5l8-8 1 1 1.6-1.6-1-1 2.6-2.6a2.2 2.2 0 0 0 0-3.1z' fill='#000' stroke='#fff' stroke-width='1.2' stroke-linejoin='round'/></svg>`,
    2, 22, 'copy');
  const BUCKET = cursorURL(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M10 3 3 10l8 8 7-7z' fill='#000' stroke='#fff' stroke-width='1.2' stroke-linejoin='round'/><path d='M20 14s2.2 2.6 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.5 2.2-4.1 2.2-4.1z' fill='#000' stroke='#fff' stroke-width='1.2'/></svg>`,
    20, 21, 'cell');

  const CURSOR_SHEET = [
    '[data-type-kit-hover], [data-type-kit-hover] * { cursor: pointer !important; }',
    `[data-type-kit-hover="copy"], [data-type-kit-hover="copy"] * { cursor: ${EYEDROPPER} !important; }`,
    `[data-type-kit-hover="paste"], [data-type-kit-hover="paste"] * { cursor: ${BUCKET} !important; }`,
    // Being rewritten: a caret, and no focus ring - the dashed frame round the
    // block is already saying which one has the caret in it.
    '[data-type-kit-editing], [data-type-kit-editing] * { cursor: text !important; }',
    '[data-type-kit-editing] { outline: none !important; }',
  ].join('\n');

  /* ============================ open / close ============================ */

  async function open({ select: asked = null } = {}) {
    if (ui) return;
    ui = { loading: true };
    try { await loadLib(); }
    catch (err) { ui = null; console.warn('[type-kit]', err); return; }

    const host = document.createElement('div');
    host.dataset.typeKitPanel = '';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = SHEETS.map(s => `<link rel="stylesheet" href="${s}">`).join('') + PANEL;

    // Off-screen and ready to fly before it is ever on the page, so it cannot
    // flash up in place first.
    const kitEl = root.querySelector('.kit');
    kitEl.classList.add('is-away', 'is-entering');
    document.body.append(host);

    const sheet = document.createElement('style');
    // Its own mark, not the host's: the host is what 'is this the panel'
    // asks about, and a <style> in the head answering yes to that question sends
    // every such test to an element with no shadow root on it.
    sheet.dataset.typeKitStyle = '';
    sheet.textContent = CURSOR_SHEET;
    document.head.append(sheet);

    const start = asked ? document.querySelector(asked) : null;
    ui = { host, root, sheet, picking: false, hover: null, targets: [], current: null };
    ui.fontFilter = 'all';
    ui.outline = root.querySelector('.outline');
    ui.hoverBox = root.querySelector('.hover');
    wire();

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointermove', onEditMove, { capture: true, passive: true });
    document.addEventListener('pointerout', onEditOut, { capture: true, passive: true });
    document.addEventListener('click', onEditClick, { capture: true });
    document.addEventListener('dblclick', onEditDbl, { capture: true });
    document.addEventListener('keydown', onModifier);
    document.addEventListener('keyup', onModifier);
    document.addEventListener('contextmenu', onEditMenu, { capture: true });

    // Said before the panel is seen, so the other kit is already standing
    // down by the time this one lands.
    document.dispatchEvent(new CustomEvent('type-kit:open'));

    buildTargets();
    // The block the opener named, or the first one the page lists.
    select(start || (ui.targets[1] && ui.targets[1][1]) || null);

    // Two frames: the first is the off-screen state being taken up, the second
    // is the one it can be transitioned away from. Release on the same frame
    // and the browser folds the two into one style change, with nothing in
    // between to animate.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!ui || ui.host !== host) return;
      ui.settling = true;
      kitEl.classList.remove('is-away');
      ui.enterTimer = setTimeout(() => { kitEl.classList.remove('is-entering'); ui.settling = false; }, 620);
    }));
  }

  function close() {
    if (!ui || ui.loading) return;
    stopEditing();
    togglePick(false);
    setHover(null);
    // Every block back to the string its style attribute held, which for a
    // block the kit never touched is the string it still holds.
    for (const e of [...entries.values()]) reset(e);
    entries.clear();
    document.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointermove', onEditMove, { capture: true });
    document.removeEventListener('pointerout', onEditOut, { capture: true });
    document.removeEventListener('click', onEditClick, { capture: true });
    document.removeEventListener('dblclick', onEditDbl, { capture: true });
    document.removeEventListener('keydown', onModifier);
    document.removeEventListener('keyup', onModifier);
    document.removeEventListener('contextmenu', onEditMenu, { capture: true });
    clearTimeout(ui.toastTimer);
    clearTimeout(ui.enterTimer);
    ui.panelRO?.disconnect();
    ui.boxRO?.disconnect();
    // The cursor rule and the preview stylesheet both carry the style mark.
    // The font FILES stay in the browser cache, which is the point of a cache;
    // what goes is the sheet that declared them.
    document.querySelectorAll("[data-type-kit-style]").forEach(n => n.remove());
    ui.host.remove();
    ui = null;
    // The other half of type-kit:open, for a page that wants to know the
    // words are its own again - the intro page blurs a screenshot of a panel
    // while a real one is open, and has to be told when to stop. Last, after
    // the teardown, so a listener that reads the page reads the page as it
    // has been put back.
    document.dispatchEvent(new CustomEvent('type-kit:close'));
  }

  /* ============================ the ways in ============================ */

  document.addEventListener('click', (ev) => {
    const opener = ev.target.closest?.('[data-type-kit-open]');
    // The attribute can name the block to open on: data-type-kit-open=".title".
    if (!ui && opener) open({ select: opener.getAttribute('data-type-kit-open') || null });
  });
  /* Shift + a letter, T unless the page says otherwise:

       <script src="type-kit.js" data-key="Y" defer></script>

     A page that carries both kits cannot give them both Shift+T, and the
     texture kit had it first. The letter is the page's choice rather than a
     second hard-coded default, because which tools a page loads is the page's
     business and not either kit's. */
  const KEY = (SELF?.dataset.key || 'T').toUpperCase();
  document.addEventListener('keydown', (ev) => {
    if (ev.key.toUpperCase() !== KEY || !ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.composedPath()[0];
    if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
    ui ? close() : open();
  });

  /* One tool at a time. Both kits take clicks on the page to choose what they
     are editing, so two open at once means two frames, two hover cursors and a
     click that only one of them gets. Each announces itself when it opens and
     stands down when it hears the other. */
  document.addEventListener('texture-kit:open', () => close());
  // And the same for the move-resize kit (move-resize-studio/move-resize-kit.js).
  document.addEventListener('move-resize-kit:open', () => close());

  if (/[?&]type\b/.test(location.search)) open();
})();
