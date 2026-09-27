/* cta — the call to action, as a block you place.

   Two kinds, where there used to be eleven ready-made shapes:

     solid  a box - fill (colour and opacity), corner radius up to a full pill,
            a border, and a drop shadow (hard or soft). Between them these are
            what the old shapes were: pill, outline, ghost, hard shadow and tag
            are all settings of this one.
     link   no box - the words, with an underline, an arrow, or both.

   Each is a class in css/cta.css, with its options as custom properties and
   plain extra classes; this file sets them and knows nothing about how they
   draw.

   The label is the element's own text, which is what lets the same double-click
   that edits a heading edit this too — everything a style adds (the arrow, the
   underline) is a pseudo-element and therefore not text.

   Depends on: state.js, render.js (applyBox), fonts.js, and rand()/rnd() from
   randomize.js at roll time. */

const CTA = (() => {
  const el = $('cta');
  const c = () => state.cta;

  const STYLES = [
    { n: 'solid', label: 'Solid' },
    { n: 'link',  label: 'Link' },
  ];
  const RADIUS_PILL = 50;   // the top of the radius slider: fully rounded, whatever the height

  /* ---- scenes saved with one of the eleven old shapes ----
     Put into the two kinds when they load (and before anything draws them), so
     a cover saved last week still comes up as the button it had. What has no
     setting any more - split block's ink square, the wipe on hover, full width
     - is left out. The settings each shape drew with carry its colours. Runs
     once per scene: afterwards the style is one of the two. */
  const LEGACY = {
    outline: (s) => ({ style: 'solid', bgA: 0, border: 2, borderColor: s.bg }),
    pill:    ()  => ({ style: 'solid', radius: RADIUS_PILL }),
    ghost:   (s) => ({ style: 'solid', border: 1, borderColor: s.color }),
    brutal:  (s) => ({ style: 'solid', border: 2, borderColor: s.color, drop: 4, dropBlur: 0, dropColor: s.color }),
    wipe:    (s) => ({ style: 'solid', border: 1, borderColor: s.bg }),
    tag:     (s) => ({ style: 'solid', size: Math.max(10, Math.round(s.size * 0.8)), ls: 0.18, transform: 'uppercase' }),
    split:   ()  => ({ style: 'solid' }),
    block:   ()  => ({ style: 'solid' }),
    arrow:   ()  => ({ style: 'link', underline: false, arrow: true }),
  };
  function migrate(s) {
    for (const gone of ['hover', 'full', 'shadow']) delete s[gone];
    // A link with neither mark is just words - the old underline link was
    // saved that way, before the underline was a setting.
    if (s.style === 'link') { if (!s.underline && !s.arrow) s.underline = true; return; }
    if (s.style === 'solid') return;
    for (const [k, v] of Object.entries(DEFAULTS.cta)) if (!(k in s)) s[k] = v;
    Object.assign(s, (LEGACY[s.style] || (() => ({ style: 'solid' })))(s));
  }

  // The room around the label, from the label's own size: a button is padded in
  // proportion to what it says, which is why there is no S/M/L to keep in step
  // with the type — the corner handles are there for a box of your own.
  const padOf = (size) => ({ x: Math.round(size * 1.35), y: Math.round(size * 0.72) });

  // Ten things a button says. The list is the control: a field would only ask
  // you to think of one of these anyway.
  const LABELS = ['Get started', 'See the work', 'Read more', 'Book a call', 'Start free',
                  'View project', 'Say hello', 'Download', 'Join the list', 'Explore'];

  /* ---------------------------------------------------------------- render */

  // The label lives in a span of its own, because every decoration a style
  // draws is a pseudo-element of it: the button is an `.editable`, and its own
  // ::before and ::after are the hover outline and the name tag. Typing can
  // flatten the span away, so it is put back whenever the DOM is ours again.
  function labelEl() {
    let lab = el.firstElementChild;
    if (!lab || !lab.classList.contains('label')) {
      lab = document.createElement('span');
      lab.className = 'label';
      el.replaceChildren(lab);
    }
    return lab;
  }

  function render() {
    const s = c();
    migrate(s);
    const f = byName(s.font);
    el.style.display = s.enabled ? '' : 'none';
    if (!s.enabled) return;
    loadFont(s.font);

    // The text is the DOM's, not state's, while it is being typed into — the
    // caret lives in that text node and rewriting it would throw the caret away.
    if (!el.isContentEditable) {
      const lab = labelEl();
      if (lab.textContent !== s.text) lab.textContent = s.text;
    }

    const link = s.style === 'link';
    el.className = ['editable', 'cta', s.style, link && s.underline && 'underline', link && s.arrow && 'arrow']
      .filter(Boolean).join(' ');
    el.style.fontFamily = `'${s.font}', ${FB[f.c]}`;
    el.style.fontWeight = s.weight;
    el.style.fontSize = s.size + 'px';
    el.style.letterSpacing = s.ls + 'em';
    el.style.textTransform = s.transform;
    // Colours and measures go through custom properties, read by css/cta.css.
    // A link draws none of the box, whatever its settings still hold.
    el.style.setProperty('--cta-fill', link ? 'transparent' : hexRgba(s.bg, s.bgA));
    el.style.setProperty('--cta-ink', s.color);
    el.style.setProperty('--cta-radius', (s.radius >= RADIUS_PILL ? 999 : s.radius) + 'px');
    el.style.setProperty('--cta-border-w', (link ? 0 : s.border) + 'px');
    el.style.setProperty('--cta-border-c', s.borderColor);
    el.style.setProperty('--cta-drop', !link && (s.drop || s.dropBlur) ? `${s.drop}px ${s.drop}px ${s.dropBlur}px ${s.dropColor}` : 'none');
    const pad = padOf(s.size);
    el.style.setProperty('--cta-pad-x', pad.x + 'px');
    el.style.setProperty('--cta-pad-y', pad.y + 'px');
    applyBox('cta');
  }

  /* ---------------------------------------------------------------- panel */

  // Rows for one kind only are hidden for the other: a control that does
  // nothing is a control that lies about what it does. (`hidden` on a .row
  // needs the [hidden] rule in css/controls.css - .row sets display: flex.)
  const onlyRows = (kind) => document.querySelectorAll(`.panel [data-section="cta"] [data-cta-only="${kind}"]`);

  function sync() {
    const s = c();
    migrate(s);
    // Typed on the cover, the label is no longer one of the ten — say so rather
    // than showing whichever one happens to sort first.
    $('cta-text').value = LABELS.includes(s.text) ? s.text : '';
    $('cta-style').value = s.style;
    $('cta-size').value = s.size;       $('cta-sizeV').value = s.size + 'px';
    $('cta-font').value = s.font;       setWeightOptions('cta');
    $('cta-color').value = s.color;
    $('cta-ls').value = s.ls;           $('cta-lsV').value = fmt(s.ls) + 'em';
    $('cta-transform').querySelectorAll('input').forEach(i => { i.checked = i.value === s.transform; });
    // solid
    $('cta-bg').value = s.bg;
    $('cta-bgA').value = s.bgA;         $('cta-bgAV').value = Math.round(s.bgA * 100) + '%';
    $('cta-radius').value = Math.min(s.radius, RADIUS_PILL);
    $('cta-radiusV').value = s.radius >= RADIUS_PILL ? 'pill' : s.radius + 'px';
    $('cta-borderC').value = s.borderColor;
    $('cta-border').value = s.border;   $('cta-borderV').value = s.border + 'px';
    $('cta-dropC').value = s.dropColor;
    $('cta-drop').value = s.drop;       $('cta-dropV').value = s.drop + 'px';
    $('cta-dropBlur').value = s.dropBlur; $('cta-dropBlurV').value = s.dropBlur + 'px';
    // link
    $('cta-underline').checked = !!s.underline;
    $('cta-arrow').checked = !!s.arrow;
    markAnchor();
    onlyRows('solid').forEach(r => { r.hidden = s.style !== 'solid'; });
    onlyRows('link').forEach(r => { r.hidden = s.style !== 'link'; });
    render();
  }

  /* ---------------------------------------------------------------- the anchor
     The menu's anchor, brought to the button (see menuOffsets() in render.js):
     it says which point a saved position is counted from, and nothing moves
     when it is picked. The menu lives in screen pixels and counts from the
     window; the button lives on the artboard, so it counts from the part of the
     artboard this window shows - the safe area. The artboard is cover-scaled,
     so a narrower or wider window crops a different edge off it, and "24px in
     from the bottom right of what you can see" survives that where "x 1480"
     does not: a button saved near a corner reopens near that corner instead of
     off a cropped edge.

     No anchor - the default, and every scene from before this - is the
     artboard itself, x and y exactly as they are. */

  // The visible part of the artboard, in artboard pixels: the same fractions
  // the safe-area guide draws (fitSafeArea in artboard.js).
  function visibleRect() {
    const refA = REF.w / REF.h, a = innerWidth / innerHeight;
    const w = REF.w * Math.min(a, refA) / refA, h = REF.h * refA / Math.max(a, refA);
    return { x: (REF.w - w) / 2, y: (REF.h - h) / 2, w, h };
  }
  // Live left/top -> the distances a scene file stores.
  function offsets() {
    const s = c();
    if (!s.anchor) return { x: s.x, y: s.y };
    const [v, h] = s.anchor, V = visibleRect();
    const w = el.offsetWidth || s.boxW || 0, ht = el.offsetHeight || s.boxH || 0;
    return {
      x: Math.round(h === 'l' ? s.x - V.x : h === 'c' ? s.x + w / 2 - (V.x + V.w / 2) : V.x + V.w - (s.x + w)),
      y: Math.round(v === 't' ? s.y - V.y : v === 'm' ? s.y + ht / 2 - (V.y + V.h / 2) : V.y + V.h - (s.y + ht)),
    };
  }
  // The other way, run once a scene has been applied and the button laid out -
  // its own size is half of the sum.
  function fromOffsets(ax, ay) {
    const s = c();
    if (!s.anchor) return;
    const [v, h] = s.anchor, V = visibleRect();
    const w = el.offsetWidth || s.boxW || 0, ht = el.offsetHeight || s.boxH || 0;
    s.x = Math.round(h === 'l' ? V.x + ax : h === 'c' ? V.x + V.w / 2 + ax - w / 2 : V.x + V.w - ax - w);
    s.y = Math.round(v === 't' ? V.y + ay : v === 'm' ? V.y + V.h / 2 + ay - ht / 2 : V.y + V.h - ay - ht);
    applyBox('cta');
  }
  function markAnchor() {
    $('cta-anchor').querySelectorAll('[data-anchor]')
      .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.anchor === c().anchor)));
  }

  /* ---------------------------------------------------------------- the dice */

  // Visibility is the eye's business, like every other layer. What is rolled is
  // the kind, the words and how loud it is — against a photograph that means
  // black or white, because a button is a thing to press rather than a colour
  // to admire.
  //
  // A solid is rolled as one of the old shapes, now recipes of its settings,
  // so the dice still brings up a pill, an outline or a hard shadow rather
  // than a random mix of borders and blurs nobody would have drawn.
  const RECIPES = {
    plain:   () => ({}),
    pill:    () => ({ radius: RADIUS_PILL }),
    outline: (k) => ({ bgA: 0, border: 2, borderColor: k.ink, color: k.ink }),
    ghost:   (k) => ({ bgA: rnd(0.1, 0.35, 0.05), border: 1, borderColor: k.ink, color: k.ink }),
    brutal:  (k) => ({ border: 2, borderColor: k.ink, drop: 4, dropBlur: 0, dropColor: k.ink, color: k.ink, bg: k.paper }),
    soft:    () => ({ radius: rand([6, 8, 12]), drop: rnd(2, 6), dropBlur: rnd(10, 20), dropColor: '#00000066' }),
    tag:     () => ({ size: rnd(10, 13), ls: 0.18, transform: 'uppercase', radius: rand([0, 2]) }),
  };
  function roll() {
    const s = c();
    const style = Math.random() < 0.72 ? 'solid' : 'link';
    const dark = Math.random() < 0.5;
    const k = { fill: dark ? '#000000' : '#ffffff', ink: dark ? '#ffffff' : '#000000', paper: dark ? '#ffffff' : '#000000' };
    Object.assign(s, {
      text: rand(LABELS),
      style,
      size: rnd(13, 22),
      weight: rand([500, 600, 700]),
      ls: rnd(0, 0.16, 0.01),
      transform: rand(['none', 'none', 'uppercase']),
      radius: rand([0, 0, 2, 4, 8]),
      bg: k.fill, color: k.ink, bgA: 1,
      border: 0, borderColor: k.ink,
      drop: 0, dropBlur: 0, dropColor: k.ink,
      underline: true, arrow: false,
    });
    if (style === 'solid') Object.assign(s, RECIPES[rand(Object.keys(RECIPES))](k));
    else {
      Object.assign(s, rand([{ underline: true, arrow: false }, { underline: false, arrow: true }, { underline: true, arrow: true }]));
      // A link has no fill to read against, so it takes the colour the type has.
      s.color = state.heading.color;
    }
  }

  /* ---------------------------------------------------------------- wiring */

  $('cta-style').innerHTML = STYLES.map(s => `<option value="${s.n}">${s.label}</option>`).join('');
  $('cta-text').innerHTML = '<option value="" disabled>custom</option>' +
    LABELS.map(t => `<option value="${t}">${t}</option>`).join('');
  $('cta-font').innerHTML = fontOptionsHTML();

  $('cta-text').addEventListener('change', e => { c().text = e.target.value; render(); });
  // Typed into on the cover: state follows the DOM here, since the DOM is where
  // the caret is, and the dropdown falls back to "custom".
  el.addEventListener('input', () => {
    c().text = el.textContent;
    $('cta-text').value = LABELS.includes(c().text) ? c().text : '';
  });
  // Typing can leave the label span deleted or split in two. Once the caret has
  // gone, the DOM is ours again: rebuild it from what was typed.
  el.addEventListener('blur', () => render());
  $('cta-style').addEventListener('change', e => { c().style = e.target.value; sync(); });
  $('cta-size').addEventListener('input', e => { c().size = +e.target.value; $('cta-sizeV').value = e.target.value + 'px'; render(); });
  $('cta-font').addEventListener('change', e => { c().font = e.target.value; setWeightOptions('cta'); render(); });
  $('cta-weight').addEventListener('change', e => { c().weight = +e.target.value; render(); });
  $('cta-color').addEventListener('input', e => { c().color = e.target.value; render(); });
  $('cta-ls').addEventListener('input', e => { c().ls = +e.target.value; $('cta-lsV').value = fmt(e.target.value) + 'em'; render(); });
  $('cta-transform').addEventListener('change', e => { c().transform = e.target.value; render(); });
  // solid
  $('cta-bg').addEventListener('input', e => { c().bg = e.target.value; render(); });
  $('cta-bgA').addEventListener('input', e => { c().bgA = +e.target.value; $('cta-bgAV').value = Math.round(e.target.value * 100) + '%'; render(); });
  $('cta-radius').addEventListener('input', e => {
    c().radius = +e.target.value;
    $('cta-radiusV').value = c().radius >= RADIUS_PILL ? 'pill' : e.target.value + 'px';
    render();
  });
  $('cta-borderC').addEventListener('input', e => { c().borderColor = e.target.value; render(); });
  $('cta-border').addEventListener('input', e => { c().border = +e.target.value; $('cta-borderV').value = e.target.value + 'px'; render(); });
  $('cta-dropC').addEventListener('input', e => { c().dropColor = e.target.value; render(); });
  $('cta-drop').addEventListener('input', e => { c().drop = +e.target.value; $('cta-dropV').value = e.target.value + 'px'; render(); });
  $('cta-dropBlur').addEventListener('input', e => { c().dropBlur = +e.target.value; $('cta-dropBlurV').value = e.target.value + 'px'; render(); });
  // link
  $('cta-underline').addEventListener('change', e => { c().underline = e.target.checked; render(); });
  $('cta-arrow').addEventListener('change', e => { c().arrow = e.target.checked; render(); });
  // The anchor: the nine squares the menu has (ANCHORS in panel.js). Pressing
  // the one already chosen lets go of it - back to plain artboard position.
  $('cta-anchor').innerHTML = ANCHORS.map(([v, h, label]) =>
    `<button type="button" data-anchor="${v}${h}" title="${label} of what the window shows" aria-pressed="false"></button>`).join('');
  $('cta-anchor').addEventListener('click', e => {
    const btn = e.target.closest('[data-anchor]');
    if (!btn) return;
    c().anchor = btn.dataset.anchor === c().anchor ? null : btn.dataset.anchor;
    markAnchor();
  });

  return { render, sync, roll, STYLES, offsets, fromOffsets };
})();
