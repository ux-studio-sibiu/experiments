/* move-resize-kit - the studio's move and resize, laid over a page's own elements
   instead of over the artboard.

   The third of the kits, built the same way as the other two and for the same
   reason: randomize-studio/intro/texture-kit.js edits what is BEHIND the
   elements, randomize-studio/type-kit/type-kit.js edits the words in them,
   and this one edits where they sit and how big they are.

   What it borrows from the studio, untouched:

   - css/panel.css and css/controls.css - the floating window, its titlebar,
     its sections and every control in them;
   - type-kit/kit-shell.css - the tokens those sheets read, the frame round
     the element being edited and the eight handles on it.

   Its own: move-resize-kit.css (the few things a layout frame needs that a type
   frame does not) and this file.

   The sheets go inside a shadow root, which keeps them off the page: they
   style bare `button`, `select` and `input`, and no page should have to
   survive that.

   Opt-in and self-removing. Nothing happens until it is opened, with ?move-resize
   in the URL, Shift+L, or a press on anything marked data-move-resize-kit-open.
   Every edit is an inline style on the element; closing puts each element's
   `style` attribute back to the string it had.

   Nothing is saved. "Copy CSS" writes what is on screen out as ordinary rules
   to paste into the page's own stylesheet; "Copy params" hands one element to
   a coding agent as JSON. */

(() => {
  const SELF = document.currentScript;
  // Where the studio is, from this script's own address rather than from the
  // page's. This folder sits beside randomize-studio/, so the default is one
  // level up and across. data-studio overrides it.
  const STUDIO = new URL(SELF?.dataset.studio || '../randomize-studio/', SELF?.src || location.href).href;
  const HERE = new URL('.', SELF?.src || location.href).href;
  const SHEETS = [STUDIO + 'css/panel.css', STUDIO + 'css/controls.css', STUDIO + 'type-kit/kit-shell.css', HERE + 'move-resize-kit.css'];

  /* What may be moved, when the page wants to say. With no data-select every
     element with a box can be chosen; with one, only the elements matching
     it - hover, click, Select element, parent, child, the list and the
     titlebar Randomize all keep to that set:

       <script src="move-resize-kit.js" data-select=".can-move-and-resize" defer></script>

     A page that is mostly furniture and a few movable blocks gets a tool that
     never offers the furniture. */
  const ONLY = SELF?.dataset.select || null;
  const allowed = (el) => !ONLY || el.matches(ONLY);

  // The two groups an element's box is edited in, each with its own dice and
  // its own lock: where it is, and how big it is.
  const GROUPS = ['position', 'size'];

  /* ============================ the elements ============================ */

  const entries = new Map();

  const px = (v) => parseFloat(v) || 0;

  // A translate the page already gave the element is where a move starts
  // from, not something the first drag throws away.
  function translateOf(cs) {
    if (!cs.translate || cs.translate === 'none') return { x: 0, y: 0 };
    const [x = '0', y = '0'] = cs.translate.split(' ');
    return { x: px(x), y: px(y) };
  }

  // The same for a scale. One number: the kit only ever scales evenly, so a
  // page's own uneven scale is read as its horizontal half.
  function scaleOf(cs) {
    if (!cs.scale || cs.scale === 'none') return 1;
    const n = parseFloat(cs.scale.split(' ')[0]);
    return n > 0 ? n : 1;
  }

  function read(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const t = translateOf(cs);
    const sc = scaleOf(cs);
    return {
      el,
      style: el.getAttribute('style'),   // exactly the string to put back, null included
      dx: t.x, dy: t.y,
      // Size is a scale, not a width and a height. A resize here makes the
      // element and everything in it bigger or smaller together - its type,
      // its pictures, its padding - and always in the proportion it started
      // in, which is what resizing a thing on an artboard means.
      s: sc,
      // What the page laid it out at, kept for good: a roll moves the box
      // relative to where it started, and Clear comes back to it.
      baseX: t.x, baseY: t.y, baseS: sc,
      // The box at a scale of one, so any scale can be turned into the size it
      // shows at without measuring again.
      natW: r.width / sc, natH: r.height / sc,
      // An inline box takes no transform at all - neither the translate nor
      // the scale would show. It is promoted to inline-block the moment it is
      // moved or scaled, and only then.
      inline: cs.display === 'inline',
      locks: { position: false, size: false },
    };
  }

  const entryFor = (el) => {
    let e = entries.get(el);
    if (!e) { e = read(el); entries.set(el, e); }
    return e;
  };

  const moved = (e) => Math.round(e.dx) !== Math.round(e.baseX) || Math.round(e.dy) !== Math.round(e.baseY);
  const scaled = (e) => Math.abs(e.s - e.baseS) > 0.0005;
  const edited = (e) => moved(e) || scaled(e);
  const r3 = (n) => +n.toFixed(3);

  /* The box, inline. `translate` and `scale` rather than `transform` or
     `position`: each is a property of its own, so neither clobbers a
     transform the page already has, and the element stays in the flow - the
     page underneath keeps the shape it had, which is what makes this a
     preview rather than a rebuild. Nothing is written for a property that
     was not changed.

     Scaled from the top left corner. Every resize is then the same sum - the
     corner stays put and the box grows away from it - and a handle that has
     to keep a different corner still moves the box by the difference. */
  function paint(e) {
    // From the page's own style attribute every time, so a property the kit
    // stops setting goes back to what the page had inline rather than to
    // nothing.
    putStyleBack(e.el, e.style);
    const s = e.el.style;
    if (moved(e)) s.translate = `${Math.round(e.dx)}px ${Math.round(e.dy)}px`;
    if (scaled(e)) { s.scale = String(r3(e.s)); s.transformOrigin = '0 0'; }
    if (e.inline && edited(e)) s.display = 'inline-block';
  }

  const putStyleBack = (el, was) => {
    if (!was) el.removeAttribute('style');
    else el.setAttribute('style', was);
  };

  function reset(e) {
    putStyleBack(e.el, e.style);
    entries.delete(e.el);
  }

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  // The smallest an element may be scaled to: still big enough to grab.
  const minScale = (e) => Math.max(16 / Math.max(1, e.natW), 8 / Math.max(1, e.natH), 0.05);

  /* ============================ the dice ============================ */

  // A nudge, not a scatter. The point of rolling a layout is to see the same
  // page a little off its grid - a title pushed right, a picture a size up -
  // and a roll that throws a block across the window has not suggested
  // anything.
  const ROLL = {
    position(e) {
      const reach = Math.min(80, Math.max(16, e.natW * e.baseS * 0.12));
      e.dx = e.baseX + Math.round(rand(-reach, reach));
      e.dy = e.baseY + Math.round(rand(-reach / 2, reach / 2));
    },
    size(e) {
      e.s = r3(Math.max(minScale(e), e.baseS * rand(0.85, 1.15)));
    },
  };

  function rollEntry(e) {
    if (!e.locks.position) ROLL.position(e);
    if (!e.locks.size) ROLL.size(e);
    paint(e);
  }

  // Every element in the list, the page's named ones and the ones picked since.
  function rollAll() {
    let n = 0;
    for (const [, el] of ui.targets) {
      if (!el || !el.isConnected) continue;
      rollEntry(entryFor(el));
      n++;
    }
    if (!n) return toast('nothing listed to roll');
    sync();
    reframe();
    toast('rolled ' + n + (n === 1 ? ' element' : ' elements'));
  }

  /* ============================ the exported CSS ============================ */

  // A selector that finds this element again in the page's own stylesheet.
  // Its id if it has one, else its classes, else its tag - narrowed by walking
  // up the tree until the selector matches one element and no more. The same
  // walk the type kit does, so the two kits name an element the same way.
  function selectorFor(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const cls = [...node.classList].filter(c => !c.startsWith('is-')).map(c => '.' + CSS.escape(c));
      let part = cls.length ? cls.join('') : node.tagName.toLowerCase();
      // A tag alone among same-tag siblings needs its place, or the walk
      // never narrows to one.
      if (!cls.length && node.parentElement) {
        const same = [...node.parentElement.children].filter(c => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
    }
    return parts.join(' > ') || 'body';
  }

  const declsFor = (e) => ({
    ...(e.inline && edited(e) ? { display: 'inline-block' } : {}),
    ...(moved(e) ? { translate: `${Math.round(e.dx)}px ${Math.round(e.dy)}px` } : {}),
    ...(scaled(e) ? { scale: String(r3(e.s)), 'transform-origin': 'top left' } : {}),
  });

  function cssFor() {
    const live = [...entries.values()].filter(e => e.el.isConnected && edited(e));
    if (!live.length) return '/* nothing moved or resized yet */';
    const decl = (o) => Object.entries(o).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    return ['/* move-resize kit */', ...live.map(e => `${selectorFor(e.el)} {\n${decl(declsFor(e))}\n}`)].join('\n\n');
  }

  /* One element, as a brief for a coding agent. `offset` rather than
     `translate`, because an agent should decide how to express a move in the
     project's own layout - a margin, a grid placement, a position - and a CSS
     property name would read as an instruction to use that property. */
  function paramsFor(e) {
    const sel = selectorFor(e.el);
    const params = {
      selector: sel,
      ...(moved(e) ? { offset: `${Math.round(e.dx - e.baseX)}px ${Math.round(e.dy - e.baseY)}px` } : {}),
      ...(scaled(e) ? { scale: r3(e.s / e.baseS) } : {}),
      size: {
        before: `${Math.round(e.natW * e.baseS)}px x ${Math.round(e.natH * e.baseS)}px`,
        after: `${Math.round(e.natW * e.s)}px x ${Math.round(e.natH * e.s)}px`,
      },
    };
    return `Apply this layout change to \`${sel}\` in this project.

${JSON.stringify(params, null, 2)}

"offset" is how far the element was moved from where the page lays it out
(x then y). Express it in the project's own layout system - margins, grid or
flex placement, or a translate if that is what the project already uses -
rather than bolting a translate on top.

"scale" is a uniform scale of the element AND everything inside it - its type,
images and spacing all grow or shrink together, proportions kept. Prefer
expressing it as real sizes in the project (font sizes, widths, spacing scaled
by that factor) so the layout reflows around it; if the element should simply
be drawn bigger without reflowing, keep it as \`scale\` with
\`transform-origin: top left\`. "size" is the rendered size before and after.`;
  }

  /* ============================ the panel ============================ */

  const head = (label, key) => `<h4>
        <span class="chev"></span>
        <span class="head-label">${label}</span>
        <button class="iconbtn dice" data-rand="${key}" title="Randomize ${label}"></button>
        <button class="lockbtn lock" data-lock="${key}" aria-pressed="false" title="Lock during randomize"></button></h4>`;

  const PANEL = `
<div class="kit">
  <button id="panelShow" data-mark="plus">Maximize move &amp; resize panel</button>
  <button id="kitExit" title="Close edit mode" aria-label="Close edit mode">&times;</button>
  <div class="hover"></div>
  <div class="toast" role="status" aria-live="polite"></div>
  <!-- The selection frame: drawn on the element's edge, with the whole of it
       a handle to move by and eight squares to resize by. -->
  <div class="outline is-move-resize">
    <i class="grip move fill" data-grip="move"></i>
    <i class="grip nw" data-grip="nw"></i><i class="grip ne" data-grip="ne"></i>
    <i class="grip sw" data-grip="sw"></i><i class="grip se" data-grip="se"></i>
    <i class="grip n" data-grip="n"></i><i class="grip s" data-grip="s"></i>
    <i class="grip w" data-grip="w"></i><i class="grip e" data-grip="e"></i>
    <span class="size-tag"></span>
  </div>
  <aside class="panel" id="panel">
    <div class="phead">
      <b>Edit</b>
      <span class="spacer"></span>
      <button id="randomize" class="primary" title="Nudge and resize every element in the list">Randomize</button>
      <button id="panelToggle" class="iconbtn" data-mark="minus" title="Minimize"></button>
      <button id="kitClose" class="iconbtn" title="Close and put the page back (Shift+L)">&times;</button>
    </div>
    <div class="pbody">

    <div class="grp" data-section="element">
      <h3><span class="chev"></span><span class="head-label">Element</span><button class="infobtn" data-mark="info" title="Hover to frame an element, click to select it. Drag the selected element to move it. Drag a square to resize it - the element and its contents scale together, in the proportion they started in, and the opposite edge stays put. Double-click a square to put its box back. Click inside the selection to go one level in; Parent goes one level out. Ctrl/Cmd-click adds an element to the selection, or takes it out; every edit then goes to all of them. Arrow keys nudge by 1px, with Shift by 10. Shift or Alt gives the click back to the page. Esc backs out: out of Select element, out of the selection, then the panel minimizes." aria-label="What you can do here"></button></h3>
      <div class="grp-body">
      <div class="row"><label>target</label><select id="kit-target"></select><button id="kit-pick" title="Click an element on the page">Select element</button></div>
      <div class="row"><label>walk</label>
        <button id="kit-parent" title="Select the element this one is inside">parent</button>
        <button id="kit-child" title="Select the first element inside this one">child</button></div>
      <div class="row"><label>actions</label>
        <button class="iconbtn" data-mark="copy" id="kit-copy" title="Copy the CSS for every element moved or resized" aria-label="Copy CSS"></button>
        <button class="iconbtn" data-mark="db-export" id="kit-params" title="Copy this element's box as a brief for a coding agent" aria-label="Copy params for a coding agent"></button>
        <button class="iconbtn" data-mark="trash" id="kit-clear" title="Put this element back where the page has it" aria-label="Clear element"></button></div>
      <p class="hint" id="kit-note"></p>
      </div>
    </div>

    <div class="grp" data-section="box">
      <h3><span class="chev"></span><span class="head-label">Box</span>
        <button class="iconbtn dice" data-rand="all" title="Randomize this element"></button>
        <button class="lockbtn lock" data-lock="all" aria-pressed="false" title="Lock every group on this element"></button></h3>
      <div class="grp-body">

      <div class="sub" data-section="position">
        ${head('Position', 'position')}
        <div class="sub-body">
          <div class="row"><label>x</label><input id="ly-x" type="range" step="1"><output id="ly-xV"></output></div>
          <div class="row"><label>y</label><input id="ly-y" type="range" step="1"><output id="ly-yV"></output></div>
          <!-- Where a drag and an arrow land. Off is the pixel; the others
               round every move to a step, which is how a page built on an
               8px rhythm stays on it while things are pushed around. -->
          <div class="row"><label>snap</label><span class="chips" id="ly-snap">
            <label><input type="radio" name="ly-snap" value="1" checked>off</label>
            <label><input type="radio" name="ly-snap" value="4">4</label>
            <label><input type="radio" name="ly-snap" value="8">8</label>
            <label><input type="radio" name="ly-snap" value="16">16</label></span></div>
        </div>
      </div>

      <div class="sub" data-section="size">
        ${head('Size', 'size')}
        <div class="sub-body">
          <!-- One slider, not a width and a height: the element and its
               contents scale together, in the proportion they started in. -->
          <div class="row"><label>scale</label><input id="ly-s" type="range" min="10" max="300" step="1"><output id="ly-sV"></output></div>
          <div class="row"><label>size</label><span class="readout" id="ly-size"></span>
            <button id="ly-sReset" title="Back to the size the page gives it">reset</button></div>
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

  /* ---- more than one ----
     Ctrl/Cmd-click adds an element to the selection, or takes it out again.
     ui.current is the one clicked last - the one with the handles, the one
     the panel's readouts show - and ui.also the rest. Every edit, from a drag
     to a slider to the dice, goes to all of them: moved by the same distance,
     scaled by the same factor. */
  const chosen = () => ui.current ? [ui.current, ...ui.also].filter(el => el.isConnected) : [];
  const all = () => chosen().map(entryFor);

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

  /* ---- the list of elements ----
     Read off the page each time: an element given a data-move-resize-kit name
     appears in the panel without this file knowing anything about it. */
  const labelFor = (el) => {
    const words = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24).toLowerCase();
    const cls = el.classList[0] ? '.' + el.classList[0] : '';
    return `${el.tagName.toLowerCase()}${cls}${words ? ' ' + words : ''}`;
  };

  function renderTargets() {
    $('kit-target').innerHTML = '<option value="">—</option>' +
      ui.targets.map(([label], i) => `<option value="${i}">${label}</option>`).join('');
    markTarget();
  }

  function buildTargets() {
    ui.targets = [];
    // Everything the page allows when it has said, the named blocks when not.
    document.querySelectorAll(ONLY || '[data-move-resize-kit]').forEach((el, i) => {
      ui.targets.push([`  ${i + 1}. ${el.dataset.moveResizeKit || labelFor(el)}`, el]);
    });
    renderTargets();
  }

  function listIfNew(el) {
    if (!el || ui.targets.some(([, x]) => x === el)) return;
    ui.targets.push([`  · ${labelFor(el)}`, el]);
    renderTargets();
  }

  function markTarget() {
    const i = ui.targets.findIndex(([, el]) => el === ui.current);
    $('kit-target').value = i < 0 ? '' : String(i);
    ui.root.querySelector('.kit').classList.toggle('is-unselected', !ui.current);
  }

  function select(el) {
    ui.current = el || null;
    ui.also.clear();
    if (el) { entryFor(el); listIfNew(el); }
    markTarget();
    watchBox();
    sync();
    reframe();
  }

  // In or out of the selection. One added becomes the one with the handles;
  // taking that one out hands them to the one added before it.
  function toggleSelect(el) {
    if (!el) return;
    if (!ui.current) return select(el);
    if (el === ui.current) {
      const rest = [...ui.also];
      ui.current = rest.pop() || null;
      ui.also = new Set(rest);
    } else if (ui.also.has(el)) {
      ui.also.delete(el);
    } else {
      ui.also.add(ui.current);
      ui.current = el;
      entryFor(el);
      listIfNew(el);
    }
    markTarget();
    watchBox();
    sync();
    reframe();
  }

  const snapStep = () => ui.snap || 1;
  const snap = (n) => Math.round(n / snapStep()) * snapStep();

  // The position sliders follow the element: half the window either way of
  // where the page put it.
  function ranges(e) {
    const reachX = Math.round(Math.max(200, innerWidth * 0.5));
    const reachY = Math.round(Math.max(200, innerHeight * 0.5));
    const set = (id, lo, hi) => { const i = $(id); i.min = lo; i.max = hi; };
    set('ly-x', Math.round(e.baseX - reachX), Math.round(e.baseX + reachX));
    set('ly-y', Math.round(e.baseY - reachY), Math.round(e.baseY + reachY));
  }

  // The scale relative to where the page had it, as the slider and the
  // readouts show it: 100% is the page's own size whatever scale that is.
  const pct = (e) => Math.round(e.s / e.baseS * 100);

  function sync() {
    const e = cur();
    for (const key of [...GROUPS, 'all']) {
      const held = e ? (key === 'all' ? GROUPS.every(g => e.locks[g]) : e.locks[key]) : false;
      ui.root.querySelector(`[data-lock="${key}"]`).setAttribute('aria-pressed', String(held));
    }
    if (!e) { note('Nothing selected — click an element on the page, or pick one from the list.'); return; }
    if (!ui.picking) note(ui.also.size ? `${ui.also.size + 1} selected — every edit goes to all of them; the readouts are the framed one's.` : '');
    ranges(e);
    $('ly-x').value = e.dx; $('ly-xV').value = Math.round(e.dx - e.baseX) + 'px';
    $('ly-y').value = e.dy; $('ly-yV').value = Math.round(e.dy - e.baseY) + 'px';
    $('ly-s').value = pct(e); $('ly-sV').value = pct(e) + '%';
    $('ly-size').textContent = `${Math.round(e.natW * e.s)} × ${Math.round(e.natH * e.s)}`;
    $('kit-parent').disabled = !parentOf(ui.current);
    $('kit-child').disabled = !childOf(ui.current);
  }

  // The same change to every selected element.
  const edit = (fn) => {
    if (!ui.current) return;
    for (const e of all()) { fn(e); paint(e); }
    sync();
    reframe();
  };

  // The tree, one level at a time. Up stops below the body: the body is the
  // page, and moving the page is not a layout edit.
  // With data-select, the nearest allowed element out, and the first allowed
  // one in - whatever plain elements lie between.
  const parentOf = (el) => {
    for (let p = el?.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (allowed(p)) return p;
    }
    return null;
  };
  const childOf = (el) => {
    if (!el) return null;
    const shown = (c) => !SKIP.has(c.tagName) && c.getBoundingClientRect().width > 0;
    if (ONLY) return [...el.querySelectorAll(ONLY)].find(shown) || null;
    return [...el.children].find(shown) || null;
  };

  function wire() {
    $('kit-target').addEventListener('change', (ev) => {
      const pick = ui.targets[+ev.target.value];
      select(ev.target.value === '' ? null : pick?.[1]);
    });
    $('kit-pick').addEventListener('click', () => togglePick());
    $('kit-parent').addEventListener('click', () => { const p = parentOf(ui.current); if (p) select(p); });
    $('kit-child').addEventListener('click', () => { const c = childOf(ui.current); if (c) select(c); });
    $('kit-copy').addEventListener('click', async () => {
      const css = cssFor();
      try { await navigator.clipboard.writeText(css); toast('css copied'); }
      catch { console.log(css); toast('css in console'); }
    });
    $('kit-params').addEventListener('click', async () => {
      if (!ui.current) return;
      const brief = all().map(paramsFor).join('\n\n---\n\n');
      try { await navigator.clipboard.writeText(brief); toast('params copied'); }
      catch { console.log(brief); toast('params in console'); }
    });
    $('kit-clear').addEventListener('click', () => {
      if (!ui.current) return;
      const [first, ...rest] = chosen();
      all().forEach(reset);
      // Read afresh, from the page as it now is, and still all selected.
      select(first);
      rest.forEach(el => { ui.also.add(el); entryFor(el); });
      watchBox(); sync(); reframe();
      toast(rest.length ? `${rest.length + 1} elements reset` : 'element reset');
    });

    // The sliders show the framed element; the others move by the same
    // distance it does, and scale by the same factor.
    const by = (fn) => { const e = cur(); return e ? fn(e) : 0; };
    $('ly-x').addEventListener('input', (ev) => { const d = by(e => snap(+ev.target.value - e.baseX) + e.baseX - e.dx); edit(e => { e.dx += d; }); });
    $('ly-y').addEventListener('input', (ev) => { const d = by(e => snap(+ev.target.value - e.baseY) + e.baseY - e.dy); edit(e => { e.dy += d; }); });
    // The slider scales from each one's top left corner, which stays put.
    $('ly-s').addEventListener('input', (ev) => { const k = by(e => e.baseS * +ev.target.value / 100 / e.s); edit(e => { e.s = r3(Math.max(minScale(e), e.s * k)); }); });
    $('ly-sReset').addEventListener('click', () => edit(e => { e.s = e.baseS; }));
    $('ly-snap').addEventListener('change', (ev) => { ui.snap = +ev.target.value; });

    // The dice and the locks, delegated on the root: events inside a shadow
    // root do not retarget within it, and the root goes with the panel.
    ui.root.addEventListener('click', (ev) => {
      const die = ev.target.closest?.('[data-rand]');
      if (die) {
        if (!ui.current) return;
        const key = die.dataset.rand;
        for (const e of all()) {
          if (key === 'all') rollEntry(e);
          else if (!e.locks[key]) { ROLL[key](e); paint(e); }
        }
        sync();
        reframe();
        return;
      }
      // A lock follows the framed element: pressed, every selected one takes
      // the state it is switching to.
      const lock = ev.target.closest?.('[data-lock]');
      if (lock) {
        const e = cur(); if (!e) return;
        const key = lock.dataset.lock;
        const keys = key === 'all' ? GROUPS : [key];
        const on = !keys.every(g => e.locks[g]);
        for (const x of all()) keys.forEach(g => { x.locks[g] = on; });
        sync();
      }
    });

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

  /* ---- the floating window: dragged, minimized, sized by its contents ----
     The studio's, as the other two kits carry it. */
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
    ui.onResize = () => { if (panel.style.left) place(parseFloat(panel.style.left), parseFloat(panel.style.top)); reframe(); };

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

  /* ---- the frames ----
     On the element's edge, not stood off it as the type kit's are: there the
     element is the words and a rule on it lands on the letters, here the
     element is a box and its edge is exactly the thing being moved. */
  /* A block of text is framed round its words, not round its box. A heading
     is a block the width of its column, and a frame drawn on that edge is a
     long thin bar with a short title somewhere at its left end - nothing in
     it says which part is the thing being moved. So a block that holds only
     text and inline elements is framed round the lines it actually sets, the
     union of their boxes, with TEXT_PAD clear of the letters on every side.

     Only for a block or a list item. An inline-block - a button, a tag - is a
     box whose edge is part of how it looks, and that edge is what it is
     framed by. */
  const TEXT_PAD = 10;

  function isTextBlock(el) {
    const cs = getComputedStyle(el);
    if (cs.display !== 'block' && cs.display !== 'list-item') return false;
    if (!el.textContent.trim()) return false;
    for (const c of el.children) {
      const d = getComputedStyle(c).display;
      if (d !== 'none' && d !== 'contents' && !d.startsWith('inline')) return false;
    }
    return true;
  }

  // The box a frame is drawn on, in viewport pixels.
  function frameRect(el) {
    const r = el.getBoundingClientRect();
    if (!isTextBlock(el)) return r;
    const range = document.createRange();
    range.selectNodeContents(el);
    let l = Infinity, t = Infinity, rt = -Infinity, b = -Infinity;
    // getClientRects rather than the range's own box: a collapsed space at the
    // start of a block reports a zero-width rect at the block's left edge, and
    // taking it would stretch the frame back out to the edge it is avoiding.
    for (const q of range.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
    }
    range.detach?.();
    if (l === Infinity) return r;
    const framed = new DOMRect(l - TEXT_PAD, t - TEXT_PAD, rt - l + TEXT_PAD * 2, b - t + TEXT_PAD * 2);
    framed.pad = TEXT_PAD;   // so a drag can take it back off - see wireGrips
    return framed;
  }

  function placeBox(box, el) {
    const r = el && frameRect(el);
    if (!r) { box.style.display = 'none'; return; }
    Object.assign(box.style, {
      display: 'block',
      left: r.left + 'px',
      top: r.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
    });
  }

  function reframe() {
    if (!ui) return;
    placeBox(ui.outline, ui.picking ? ui.pickHover : ui.current);
    placeBox(ui.hoverBox, ui.hover && !chosen().includes(ui.hover) ? ui.hover : null);
    // The rest of the selection: the same dashes, no handles - the framed one
    // is where a drag starts, and it takes these along.
    const also = ui.picking ? [] : [...ui.also].filter(el => el.isConnected);
    while (ui.alsoBoxes.length < also.length) {
      const b = document.createElement('div');
      b.className = 'outline is-also';
      ui.root.querySelector('.kit').append(b);
      ui.alsoBoxes.push(b);
    }
    ui.alsoBoxes.forEach((b, i) => placeBox(b, also[i] || null));
    const e = ui.current && !ui.picking ? cur() : null;
    const tag = ui.root.querySelector('.size-tag');
    if (e) {
      const r = frameRect(e.el);
      tag.textContent = (also.length ? `${also.length + 1} selected  ·  ` : '')
        + `${Math.round(r.width)} × ${Math.round(r.height)}`
        + (scaled(e) ? `  ·  ${pct(e)}%` : '')
        + (moved(e) ? `  ·  ${Math.round(e.dx - e.baseX)}, ${Math.round(e.dy - e.baseY)}` : '');
    } else tag.textContent = '';
  }

  /* ---- dragging the element ----
     One handler for all nine handles: they differ only in which edges the
     pointer moves. A resize from the top or the left moves the box as it
     shrinks it, so the opposite edge stays put - drag the west handle and the
     east edge does not wander.

     Measured from where the press landed, so a drag that leaves the window
     and comes back picks up where it left off. Nothing happens under 3px of
     travel: a press on the selection that never moves is a click, and a click
     inside the selection goes one level in - to whatever is under it. */
  function wireGrips() {
    const frame = ui.outline, kit = ui.root.querySelector('.kit');

    frame.addEventListener('pointerdown', (ev) => {
      const grip = ev.target.closest('.grip');
      const e = cur();
      if (!grip || !e || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();

      const how = grip.dataset.grip;
      // What the frame is drawn round, not the element: a text block's frame
      // is narrower than its box, and a handle should stay under the pointer
      // that is dragging it. The padding is taken off first - it is a fixed
      // 10px that a scale does not touch - so w/h are the words themselves
      // and ox/oy where they start inside the element, both of which a scale
      // carries along with everything else.
      const box = e.el.getBoundingClientRect(), fr = frameRect(e.el);
      const pad = fr.pad || 0;
      const from = { x: ev.clientX, y: ev.clientY, dx: e.dx, dy: e.dy, s: e.s,
                     w: fr.width - pad * 2, h: fr.height - pad * 2,
                     ox: fr.left + pad - box.left, oy: fr.top + pad - box.top };
      // The rest of the selection, as it stood at the press: each one's own
      // offset and scale, and its top left corner on screen.
      const rest = all().filter(x => x !== e).map(x => {
        const r = x.el.getBoundingClientRect();
        return { x, dx: x.dx, dy: x.dy, s: x.s, left: r.left, top: r.top };
      });
      grip.setPointerCapture(ev.pointerId);

      let dragging = false;
      const began = (m) => dragging || (dragging = Math.abs(m.clientX - from.x) > 3 || Math.abs(m.clientY - from.y) > 3);

      const onMove = (m) => {
        if (!began(m)) return;
        kit.classList.add('is-dragging-block');
        const mx = snap(m.clientX - from.x), my = snap(m.clientY - from.y);
        if (how === 'move') {
          e.dx = from.dx + mx;
          e.dy = from.dy + my;
          for (const g of rest) { g.x.dx = g.dx + mx; g.x.dy = g.dy + my; paint(g.x); }
        } else {
          /* A resize is a scale: the element and its contents together, in
             the proportion they started in. Each handle says how much bigger
             along its own axis; a corner, which says it twice, goes with
             whichever axis the pointer has pulled further.

             The frame's edge opposite the handle stays where it is. The scale
             grows from the element's top left, so whatever point is to stay
             put - the frame's right edge for a west handle, its left edge
             otherwise, and the same for top and bottom - would be carried by
             the scale, and the box is moved back by exactly that. */
          const kx = how.includes('e') ? (from.w + mx) / from.w : how.includes('w') ? (from.w - mx) / from.w : null;
          const ky = how.includes('s') ? (from.h + my) / from.h : how.includes('n') ? (from.h - my) / from.h : null;
          const k = kx == null ? ky : ky == null ? kx : (Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky);
          // Stops while there is still something to grab: a box scaled to
          // nothing can never be found again.
          e.s = r3(Math.max(minScale(e), from.s * k));
          const kk = e.s / from.s;
          const ax = how.includes('w') ? from.ox + from.w : from.ox;
          const ay = how.includes('n') ? from.oy + from.h : from.oy;
          e.dx = from.dx + ax * (1 - kk);
          e.dy = from.dy + ay * (1 - kk);
          // The others scale by the same factor about the same fixed point,
          // so the group grows as one: each corner moves away from that point
          // in proportion, and the spacing between them scales too.
          const fx = box.left + ax, fy = box.top + ay;
          for (const g of rest) {
            g.x.s = r3(Math.max(minScale(g.x), g.s * kk));
            const k2 = g.x.s / g.s;
            g.x.dx = g.dx + (fx - g.left) * (1 - k2);
            g.x.dy = g.dy + (fy - g.top) * (1 - k2);
            paint(g.x);
          }
        }
        paint(e);
        sync();
        reframe();
      };
      const done = (m) => {
        frame.removeEventListener('pointermove', onMove);
        frame.removeEventListener('pointerup', done);
        frame.removeEventListener('pointercancel', done);
        kit.classList.remove('is-dragging-block');
        if (grip.hasPointerCapture(m.pointerId)) grip.releasePointerCapture(m.pointerId);
        // Ctrl/Cmd-click on the framed one takes it out of the selection.
        if (!dragging && m.type === 'pointerup' && how === 'move' && (m.ctrlKey || m.metaKey)) { toggleSelect(e.el); return; }
        if (!dragging && m.type === 'pointerup' && how === 'move') {
          // A press that never became a drag: whatever is under it, found with
          // the frame out of the way - elementFromPoint returns the topmost
          // thing that takes pointer events, and that is the frame.
          const next = oneLevelIn(e.el, elementUnder(m.clientX, m.clientY));
          if (next && next !== e.el) { select(next); return; }
        }
        reframe();
      };
      frame.addEventListener('pointermove', onMove);
      frame.addEventListener('pointerup', done);
      frame.addEventListener('pointercancel', done);
    });

    // A double-click on a square puts the box back where the page had it.
    frame.addEventListener('dblclick', (ev) => {
      const grip = ev.target.closest('.grip');
      if (!grip || grip.dataset.grip === 'move') return;
      if (!ui.current) return;
      ev.preventDefault(); ev.stopPropagation();
      edit(e => Object.assign(e, { dx: e.baseX, dy: e.baseY, s: e.baseS }));
      toast('box reset');
    });
  }

  // The child of the selection that holds what was clicked, so a click inside
  // a column takes the paragraph's box and not the word's - one level at a
  // time, the way Parent goes the other way. Something that is not inside the
  // selection at all (it overlaps it) is taken as it is.
  //
  // With data-select, the outermost allowed element between the two, so a
  // click goes one allowed level in; nothing allowed in between keeps the
  // selection where it is.
  function oneLevelIn(sel, under) {
    if (!under) return null;
    if (!sel.contains(under)) return targetAt(under);
    let pick = null;
    for (let n = under; n && n !== sel; n = n.parentElement) {
      if (ONLY ? allowed(n) : n.parentElement === sel) pick = n;
    }
    return pick;
  }

  // The raw element under a point, with the kit out of the way.
  function elementUnder(x, y) {
    ui.host.style.display = 'none';
    const under = document.elementFromPoint(x, y);
    ui.host.style.display = '';
    return under instanceof Element && !under.closest('[data-move-resize-kit-panel]') ? under : null;
  }

  function watchBox() {
    if (typeof ResizeObserver !== 'function') return;
    ui.boxRO?.disconnect();
    ui.boxRO = new ResizeObserver(() => reframe());
    chosen().forEach(el => ui.boxRO.observe(el));
    ui.boxRO.observe(document.body);
  }

  /* ---- what a click on the page lands on ----
     Any element with a box, innermost first - a layout tool that could only
     move six pre-agreed blocks would not be much of one. Not the body or the
     root (moving the page is not a layout edit), not the kit, and not the
     things that have no box of their own to move. */
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'BR', 'WBR', 'TEMPLATE', 'SOURCE', 'TRACK']);

  function targetAt(t) {
    if (!(t instanceof Element) || !ui) return null;
    if (t === ui.host || t.closest('[data-move-resize-kit-panel]')) return null;
    for (let n = t; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (!SKIP.has(n.tagName) && allowed(n)) return n;
    }
    return null;
  }

  function setHover(el) {
    if (ui.hover === el) return;
    ui.hover?.removeAttribute('data-move-resize-kit-hover');
    ui.hover = el;
    if (el) el.setAttribute('data-move-resize-kit-hover', '');
    reframe();
  }

  /* ---- Select element: click anything on the page ---- */
  const onPickMove = (ev) => { ui.pickHover = targetAt(ev.target); reframe(); };
  function onPickClick(ev) {
    const t = targetAt(ev.target);
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    // Ctrl/Cmd keeps picking, adding each one clicked.
    if (adds(ev)) { toggleSelect(t); return; }
    togglePick(false);
    select(t);
  }
  function togglePick(force) {
    const on = typeof force === 'boolean' ? force : !ui.picking;
    ui.picking = on;
    ui.pickHover = null;
    $('kit-pick').classList.toggle('primary', on);
    ui.root.querySelector('.kit').classList.toggle('is-picking', on);
    const opt = { capture: true };
    if (on) { document.addEventListener('pointermove', onPickMove, opt); document.addEventListener('click', onPickClick, opt); note('Click an element on the page — Esc cancels.'); }
    else { document.removeEventListener('pointermove', onPickMove, opt); document.removeEventListener('click', onPickClick, opt); note(''); }
    reframe();
  }

  /* ---- hover to frame, click to select ----
     The click is taken rather than passed on - a click meant to choose an
     element should not follow a link out of the page. Ctrl / Cmd adds to the
     selection (or takes out); Shift or Alt lets the page have the click back. */
  const passes = (ev) => ev.shiftKey || ev.altKey;
  const adds = (ev) => ev.ctrlKey || ev.metaKey;

  function onEditMove(ev) {
    if (!ui || ui.picking) return;
    setHover(passes(ev) ? null : targetAt(ev.target));
  }
  const onEditOut = (ev) => { if (ui && !ui.picking && !ev.relatedTarget) setHover(null); };

  // The other kits' buttons keep working while this one is open, so the way
  // from one tool to the next is the button for it rather than closing first.
  const OPENERS = '[data-type-kit-open], [data-texture-kit-open]';

  function onEditClick(ev) {
    if (!ui || ui.picking || passes(ev)) return;
    if (ev.target.closest?.(OPENERS)) return;
    const t = targetAt(ev.target);
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    adds(ev) ? toggleSelect(t) : select(t);
    setHover(null);
  }

  // Arrow keys nudge, Shift by ten - or by the snap step, and ten of them.
  // Not while the pointer is in a field or on one of the panel's sliders,
  // which answer the same keys.
  const onKey = (ev) => {
    if (!ui || ui.loading) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[ev.key] && ui.current && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
      const on = ev.composedPath()[0];
      if (on?.closest?.('input, textarea, select, [contenteditable]')) return;
      ev.preventDefault();
      const by = (ev.shiftKey ? 10 : 1) * snapStep();
      const [x, y] = arrows[ev.key];
      edit(e => { e.dx += x * by; e.dy += y * by; });
      return;
    }
    if (ev.key !== 'Escape') return;
    if (ui.picking) togglePick(false);
    else if (ui.current) { select(null); setHover(null); }
    else if (!ui.root.querySelector('.kit').classList.contains('panel-hidden')) $('panelToggle').click();
  };

  const onScroll = () => reframe();
  const onResize = () => ui?.onResize?.();

  // The one thing the kit styles on the page itself: the cursor says the
  // element under it can be chosen, and nothing selects text mid-drag.
  const CURSOR_SHEET = '[data-move-resize-kit-hover], [data-move-resize-kit-hover] * { cursor: pointer !important; }';

  /* ============================ open / close ============================ */

  function open({ select: asked = null } = {}) {
    if (ui) return;

    const host = document.createElement('div');
    host.dataset.moveResizeKitPanel = '';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = SHEETS.map(s => `<link rel="stylesheet" href="${s}">`).join('') + PANEL;

    const kitEl = root.querySelector('.kit');
    kitEl.classList.add('is-away', 'is-entering');
    document.body.append(host);

    const sheet = document.createElement('style');
    sheet.dataset.moveResizeKitStyle = '';
    sheet.textContent = CURSOR_SHEET;
    document.head.append(sheet);

    ui = { host, root, sheet, picking: false, hover: null, pickHover: null, targets: [], current: null, also: new Set(), alsoBoxes: [], snap: 1 };
    ui.outline = root.querySelector('.outline');
    ui.hoverBox = root.querySelector('.hover');
    wire();

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointermove', onEditMove, { capture: true, passive: true });
    document.addEventListener('pointerout', onEditOut, { capture: true, passive: true });
    document.addEventListener('click', onEditClick, { capture: true });

    // Said before the panel is seen, so the other kits are already standing
    // down by the time this one lands.
    document.dispatchEvent(new CustomEvent('move-resize-kit:open'));

    buildTargets();
    const start = asked ? document.querySelector(asked) : null;
    select((start && allowed(start) ? start : null) || ui.targets[0]?.[1] || null);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!ui || ui.host !== host) return;
      ui.settling = true;
      kitEl.classList.remove('is-away');
      ui.enterTimer = setTimeout(() => { kitEl.classList.remove('is-entering'); ui.settling = false; }, 620);
    }));
  }

  function close() {
    if (!ui) return;
    togglePick(false);
    setHover(null);
    for (const e of [...entries.values()]) reset(e);
    entries.clear();
    document.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointermove', onEditMove, { capture: true });
    document.removeEventListener('pointerout', onEditOut, { capture: true });
    document.removeEventListener('click', onEditClick, { capture: true });
    clearTimeout(ui.toastTimer);
    clearTimeout(ui.enterTimer);
    ui.panelRO?.disconnect();
    ui.boxRO?.disconnect();
    document.querySelectorAll('[data-move-resize-kit-style]').forEach(n => n.remove());
    ui.host.remove();
    ui = null;
    document.dispatchEvent(new CustomEvent('move-resize-kit:close'));
  }

  /* ============================ the ways in ============================ */

  // In the capture phase, and registered at load: a kit that is open takes
  // page clicks in the capture phase too, and this one has to hear the press
  // first - it opens, the open kit hears move-resize-kit:open and stands down, and
  // its own click handler then finds nothing to do.
  document.addEventListener('click', (ev) => {
    const opener = ev.target.closest?.('[data-move-resize-kit-open]');
    // The attribute can name the element to open on: data-move-resize-kit-open=".hero".
    if (!ui && opener) {
      ev.preventDefault();
      open({ select: opener.getAttribute('data-move-resize-kit-open') || null });
    }
  }, { capture: true });

  // Shift + a letter, L unless the page says otherwise with data-key.
  const KEY = (SELF?.dataset.key || 'L').toUpperCase();
  document.addEventListener('keydown', (ev) => {
    if (ev.key.toUpperCase() !== KEY || !ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.composedPath()[0];
    if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
    ui ? close() : open();
  });

  // One tool at a time: every kit takes clicks on the page to choose what it
  // is editing, so two open at once means a click that only one of them gets.
  document.addEventListener('texture-kit:open', () => close());
  document.addEventListener('type-kit:open', () => close());

  if (/[?&]move-resize\b/.test(location.search)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => open(), { once: true });
    else open();
  }
})();
