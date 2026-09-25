/* cta — the call to action, as a block you place.

   A button is a look you recognise, not a set of borders you assemble, so the
   choice here is one of ten ready-made shapes and the knobs left over are the
   ones that change what it says and how loud it is. Each style is a class in
   css/cta.css; this file knows their names and nothing about how they draw.

   The label is the element's own text, which is what lets the same double-click
   that edits a heading edit this too — everything a style adds (an arrow, a
   trailing block, an underline) is a pseudo-element and therefore not text.

   Depends on: state.js, render.js (applyBox), fonts.js, and rand()/rnd() from
   randomize.js at roll time. */

const CTA = (() => {
  const el = $('cta');
  const c = () => state.cta;

  // name, label, and whether the style paints a fill — the ones that do not are
  // the link-ish shapes, where a fill colour would do nothing and the control
  // says so by going quiet.
  const STYLES = [
    { n: 'solid',    label: 'Solid',        fill: true  },
    { n: 'wipe',     label: 'Studio wipe',  fill: true  },
    { n: 'outline',  label: 'Outline',      fill: false },
    { n: 'pill',     label: 'Pill',         fill: true  },
    { n: 'ghost',    label: 'Ghost',        fill: true  },
    { n: 'brutal',   label: 'Hard shadow',  fill: true  },
    { n: 'split',    label: 'Split block',  fill: true  },
    { n: 'tag',      label: 'Tag',          fill: true  },
    { n: 'block',    label: 'Full bar',     fill: true  },
    { n: 'link',     label: 'Underline',    fill: false },
    { n: 'arrow',    label: 'Arrow link',   fill: false },
  ];
  const byStyle = (n) => STYLES.find(s => s.n === n) || STYLES[0];

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
    const s = c(), f = byName(s.font);
    el.style.display = s.enabled ? '' : 'none';
    if (!s.enabled) return;
    loadFont(s.font);

    // The text is the DOM's, not state's, while it is being typed into — the
    // caret lives in that text node and rewriting it would throw the caret away.
    if (!el.isContentEditable) {
      const lab = labelEl();
      if (lab.textContent !== s.text) lab.textContent = s.text;
    }

    el.className = 'editable cta ' + s.style;
    el.style.fontFamily = `'${s.font}', ${FB[f.c]}`;
    el.style.fontWeight = s.weight;
    el.style.fontSize = s.size + 'px';
    el.style.letterSpacing = s.ls + 'em';
    el.style.textTransform = s.transform;
    el.style.textShadow = s.shadow ? shadowCSS() : 'none';
    // The label colour goes through --cta-ink rather than being set here: an
    // inline colour cannot be overridden by a :hover rule, and one style wants
    // exactly that.
    // Read by the stylesheet, so a style can use the fill for a border, a block
    // or nothing at all without this file knowing which.
    el.style.setProperty('--cta-fill', hexRgba(s.bg, s.bgA));
    el.style.setProperty('--cta-ink', s.color);
    el.style.setProperty('--cta-radius', s.radius + 'px');
    const pad = padOf(s.size);
    el.style.setProperty('--cta-pad-x', pad.x + 'px');
    el.style.setProperty('--cta-pad-y', pad.y + 'px');
    applyBox('cta');
  }

  /* ---------------------------------------------------------------- panel */

  function sync() {
    const s = c();
    // Typed on the cover, the label is no longer one of the ten — say so rather
    // than showing whichever one happens to sort first.
    $('cta-text').value = LABELS.includes(s.text) ? s.text : '';
    $('cta-style').value = s.style;
    $('cta-size').value = s.size;       $('cta-sizeV').value = s.size + 'px';
    $('cta-font').value = s.font;       setWeightOptions('cta');
    $('cta-color').value = s.color;
    $('cta-bg').value = s.bg;
    $('cta-bgA').value = s.bgA;         $('cta-bgAV').value = Math.round(s.bgA * 100) + '%';
    $('cta-radius').value = s.radius;   $('cta-radiusV').value = s.radius + 'px';
    $('cta-ls').value = s.ls;           $('cta-lsV').value = fmt(s.ls) + 'em';
    $('cta-transform').querySelectorAll('input').forEach(i => { i.checked = i.value === s.transform; });
    $('cta-shadow').checked = s.shadow;
    // A fill nothing paints is a control that lies about what it does.
    const fills = byStyle(s.style).fill;
    $('cta-bg').closest('.row').classList.toggle('is-disabled', !fills);
    $('cta-radius').closest('.row').classList.toggle('is-disabled', !fills || s.style === 'pill');
    render();
  }

  /* ---------------------------------------------------------------- the dice */

  // Visibility is the eye's business, like every other layer. What is rolled is
  // the shape, the words and how loud it is — against a photograph that means
  // black or white, because a button is a thing to press rather than a colour
  // to admire.
  function roll() {
    const s = c();
    const style = rand(STYLES).n;
    const dark = Math.random() < 0.5;
    Object.assign(s, {
      text: rand(LABELS),
      style,
      size: rnd(13, 22),
      weight: rand([500, 600, 700]),
      ls: rnd(0, 0.16, 0.01),
      transform: rand(['none', 'none', 'uppercase']),
      radius: style === 'pill' ? 999 : rand([0, 0, 2, 4, 8]),
      bg: dark ? '#000000' : '#ffffff',
      color: dark ? '#ffffff' : '#000000',
      bgA: style === 'ghost' ? rnd(0.1, 0.35, 0.05) : 1,
      shadow: false,
    });
    // A link has no fill to read against, so it takes the colour the type has.
    if (!byStyle(style).fill) s.color = state.heading.color;
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
  $('cta-style').addEventListener('change', e => {
    c().style = e.target.value;
    // The full bar is as wide as its box, and its box is the artboard until
    // someone says otherwise — which is a bar across the whole cover. Give it a
    // measure to start from; the handles do the rest.
    if (e.target.value === 'block' && !c().boxW) c().boxW = 360;
    sync();
  });
  $('cta-size').addEventListener('input', e => { c().size = +e.target.value; $('cta-sizeV').value = e.target.value + 'px'; render(); });
  $('cta-font').addEventListener('change', e => { c().font = e.target.value; setWeightOptions('cta'); render(); });
  $('cta-weight').addEventListener('change', e => { c().weight = +e.target.value; render(); });
  $('cta-color').addEventListener('input', e => { c().color = e.target.value; render(); });
  $('cta-bg').addEventListener('input', e => { c().bg = e.target.value; render(); });
  $('cta-bgA').addEventListener('input', e => { c().bgA = +e.target.value; $('cta-bgAV').value = Math.round(e.target.value * 100) + '%'; render(); });
  $('cta-radius').addEventListener('input', e => { c().radius = +e.target.value; $('cta-radiusV').value = e.target.value + 'px'; render(); });
  $('cta-ls').addEventListener('input', e => { c().ls = +e.target.value; $('cta-lsV').value = fmt(e.target.value) + 'em'; render(); });
  $('cta-transform').addEventListener('change', e => { c().transform = e.target.value; render(); });
  $('cta-shadow').addEventListener('change', e => { c().shadow = e.target.checked; render(); });

  return { render, sync, roll, STYLES };
})();
