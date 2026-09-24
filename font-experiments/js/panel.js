/* panel — building the inspector and wiring it to state.
   The other direction: the controls are built from the role list, synced from
   `state` by syncInputs(), and each one writes back on input. Also the eyes,
   the locks and the collapsible sections, all generic over data attributes. */

/* ============================ build role panels ============================ */
function fontOptionsHTML() {
  return CATS.map(([c,label]) =>
    `<optgroup label="${label}">` +
    FONTS.filter(f=>f.c===c).map(f=>`<option value="${f.n}">${f.n}</option>`).join('') +
    `</optgroup>`).join('');
}
function rolePanelHTML(role, label) {
  const isBody = role === 'body';
  return `
  <div class="sub" data-section="${role}">
    <h4>${label}
      <button class="eyebtn" data-vis="${role}" aria-pressed="true" title="Hide this on the cover"></button>
      <button class="iconbtn dice" data-rand="${role}" title="Randomize this layer"></button>
      <button class="lockbtn lock" data-lock="${role}" aria-pressed="false" title="Lock during randomize"></button></h4>
    <div class="sub-body">
    <div class="row"><label>font-size</label><input id="${role}-size" type="range"><output id="${role}-sizeV"></output></div>
    <div class="row"><label>font/color</label><select id="${role}-font">${fontOptionsHTML()}</select><input id="${role}-color" type="color"></div>
    <div class="row"><label>weight</label><div class="chips" id="${role}-weight"></div></div>
    <div class="row"><label>length</label><input id="${role}-amount" type="range"><output id="${role}-amountV"></output></div>
    <div class="row"><label>line-h</label><input id="${role}-lh" type="range" min="0.85" max="2.2" step="0.01"><output id="${role}-lhV"></output></div>
    <div class="row"><label>tracking</label><input id="${role}-ls" type="range" min="-0.06" max="0.4" step="0.005"><output id="${role}-lsV"></output></div>
    ${isBody ? `<div class="row"><label>columns</label>
      <div class="chips" id="body-columns">
        <label><input type="radio" name="body-cols" value="1">1</label>
        <label><input type="radio" name="body-cols" value="2">2</label>
        <label><input type="radio" name="body-cols" value="3">3</label>
        <label><input type="radio" name="body-cols" value="4">4</label>
      </div></div>` : ``}
    <div class="row"><label>case</label>
      <div class="radios" id="${role}-transform">
        <label title="None"><input type="radio" name="${role}-tf" value="none">Aa</label>
        <label title="UPPERCASE"><input type="radio" name="${role}-tf" value="uppercase">AA</label>
        <label title="lowercase"><input type="radio" name="${role}-tf" value="lowercase">aa</label>
      </div></div>
    <div class="row"><label>align</label>
      <div class="radios" id="${role}-align">
        <label title="Left"><input type="radio" name="${role}-al" value="left">L</label>
        <label title="Center"><input type="radio" name="${role}-al" value="center">C</label>
        <label title="Right"><input type="radio" name="${role}-al" value="right">R</label>
        ${isBody ? `<label title="Justify"><input type="radio" name="${role}-al" value="justify">J</label>` : ``}
      </div>
      <span class="inline-check"><input id="${role}-italic" type="checkbox"> <label for="${role}-italic">italic</label></span></div>
    <div class="row"><label>shadow</label><span></span><input id="${role}-shadow" type="checkbox"></div>
    </div>
  </div>`;
}
$('roles').innerHTML = ROLES.map(([r,l]) => rolePanelHTML(r,l)).join('');

// per-role size ranges + text-length (word count) ranges
const SIZE_RANGE = { heading:[28,200], subheading:[12,72], body:[12,30] };
const AMOUNT = { heading:[1,16], subheading:[3,40], body:[20,600] };
ROLES.forEach(([r]) => {
  const [mn,mx] = SIZE_RANGE[r];
  const s = $(`${r}-size`); s.min = mn; s.max = mx; s.step = 1;
  const [an,ax] = AMOUNT[r];
  const a = $(`${r}-amount`); a.min = an; a.max = ax; a.step = 1;
});

/* ============================ sync DOM ← state ============================ */
// Serves all four blocks. A font exposes its own set of weights, so switching
// face has to redraw the chips and snap the current weight to the nearest one
// the new face actually has.
function setWeightOptions(r) {
  const p = UI[r], c = state[r], f = byName(c.font);
  if (!f.w.includes(c.weight))
    c.weight = f.w.reduce((a, x) => Math.abs(x - c.weight) < Math.abs(a - c.weight) ? x : a, f.w[0]);
  $(`${p}-weight`).innerHTML = f.w.map(x =>
    `<label><input type="radio" name="${p}-wt" value="${x}"${x === c.weight ? ' checked' : ''}>${x}</label>`).join('');
  const it = $(`${p}-italic`);        // the menu has no italic control
  if (it) { it.disabled = !f.i; if (!f.i) c.italic = false; }
}
$('tm-font').innerHTML = fontOptionsHTML();

/* ---- the anchor ----
   Nine squares for the nine points of the window a position can be measured
   from. The bar lives in screen pixels, so "120px from the left" means a
   different place on a different screen — but "8px in from the bottom-right"
   means the same place everywhere, which is what makes a saved scene survive
   the window it is reopened in. */
const ANCHORS = [['t','l','Top left'], ['t','c','Top centre'], ['t','r','Top right'],
                 ['m','l','Middle left'], ['m','c','Centre'], ['m','r','Middle right'],
                 ['b','l','Bottom left'], ['b','c','Bottom centre'], ['b','r','Bottom right']];
$('tm-anchor').innerHTML = ANCHORS.map(([v, h, label]) =>
  `<button type="button" data-anchor="${v}${h}" title="${label}" aria-pressed="false"></button>`).join('');

// Nothing moves. The anchor only decides what gets written into a scene file
// and how it is read back, so picking one is a decision about the future, not
// an edit to the cover in front of you.
function setMenuAnchor(next) {
  state.topmenu.anchor = next;
  syncTopMenu();
}
$('tm-anchor').addEventListener('click', e => {
  const btn = e.target.closest('[data-anchor]');
  if (btn && btn.dataset.anchor !== state.topmenu.anchor) setMenuAnchor(btn.dataset.anchor);
});

function syncTopMenu() {
  const m = state.topmenu;
  $('tm-anchor').querySelectorAll('[data-anchor]')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.anchor === m.anchor)));
  $('tm-links').value = m.links;   $('tm-linksV').value = m.links;
  $('tm-font').value = m.font;     setWeightOptions('topmenu');
  $('tm-size').value = m.size;     $('tm-sizeV').value = m.size + 'px';
  $('tm-ls').value = m.ls;         $('tm-lsV').value = fmt(m.ls) + 'em';
  $('tm-transform').querySelectorAll('input').forEach(i => { i.checked = (i.value === m.transform); });
  $('tm-align').querySelectorAll('input').forEach(i => { i.checked = (i.value === m.align); });
  $('tm-gap').value = m.gap;       $('tm-gapV').value = m.gap + 'px';
  $('tm-pad').value = m.pad;       $('tm-padV').value = m.pad + 'px';
  $('tm-brand').checked = m.brand;
  $("tm-shadow").checked = m.shadow;
  $('tm-color').value = m.color;
  $('tm-bg').value = m.bg;
  $('tm-bgA').value = m.bgA; $('tm-bgAV').value = Math.round(m.bgA*100) + '%';
}
function syncInputs() {
  ROLES.forEach(([r]) => {
    const c = state[r];
    $(`${r}-amount`).value = c.amount; $(`${r}-amountV`).value = c.amount;
    $(`${r}-font`).value = c.font;
    setWeightOptions(r);
    $(`${r}-size`).value = c.size;       $(`${r}-sizeV`).value = c.size + 'px';
    $(`${r}-lh`).value = c.lh;           $(`${r}-lhV`).value = (+c.lh).toFixed(2);
    $(`${r}-ls`).value = c.ls;           $(`${r}-lsV`).value = fmt(c.ls) + 'em';
    $(`${r}-transform`).querySelectorAll('input').forEach(i => { i.checked = (i.value === c.transform); });
    $(`${r}-align`).querySelectorAll('input').forEach(i => { i.checked = (i.value === c.align); });
    $(`${r}-italic`).checked = c.italic;
    $(`${r}-color`).value = c.color;
    $(`${r}-shadow`).checked = c.shadow;
  });
  syncTypeMaster();
  $('body-columns').querySelectorAll('input').forEach(i => { i.checked = (+i.value === state.body.columns); });
  $('scrimAmt').value = state.scrim.amount; $('scrimAmtV').value = Math.round(state.scrim.amount*100)+'%';
  $('scrimColor').value = state.scrim.color;
  const p = state.plate;
  $('plate-color').value = p.color;
  $('plate-alpha').value = p.alpha; $('plate-alphaV').value = Math.round(p.alpha*100) + '%';
  syncBgTreatment();
  syncTopMenu();
  syncPattern();
  CTA.sync();
  SVGBG.sync();
  syncEyes();
}

/* ============================ wire controls ============================ */
ROLES.forEach(([r]) => {
  $(`${r}-amount`).addEventListener('input', e => { state[r].amount = +e.target.value; $(`${r}-amountV`).value = e.target.value; setText(r); });
  $(`${r}-font`).addEventListener('change', e => { state[r].font = e.target.value; setWeightOptions(r); syncTypeMaster(); render(); });
  $(`${r}-weight`).addEventListener('change', e => { state[r].weight = +e.target.value; render(); });
  $(`${r}-size`).addEventListener('input', e => { state[r].size = +e.target.value; $(`${r}-sizeV`).value = e.target.value + 'px'; render(); });
  $(`${r}-lh`).addEventListener('input', e => { state[r].lh = +e.target.value; $(`${r}-lhV`).value = (+e.target.value).toFixed(2); render(); });
  $(`${r}-ls`).addEventListener('input', e => { state[r].ls = +e.target.value; $(`${r}-lsV`).value = fmt(e.target.value) + 'em'; render(); });
  $(`${r}-transform`).addEventListener('change', e => { state[r].transform = e.target.value; render(); });
  $(`${r}-align`).addEventListener('change', e => { state[r].align = e.target.value; render(); });
  $(`${r}-italic`).addEventListener('change', e => { state[r].italic = e.target.checked; render(); });
  $(`${r}-color`).addEventListener('input', e => { state[r].color = e.target.value; syncTypeMaster(); render(); });
  $(`${r}-shadow`).addEventListener('change', e => { state[r].shadow = e.target.checked; render(); });
});

/* ---- the Typography masters ----
   Face and colour for all three layers at once. They write through rather than
   cascade: each layer keeps its own value, and the master only ever means "make
   them all this", so setting one layer afterwards is not fighting an inherited
   value. With the layers out of step the select reads "mixed" and the swatch is
   marked, because there is no single answer to show and guessing one would make
   the panel lie about what is on the cover. */
$('type-font').innerHTML = '<option value="" disabled>mixed</option>' + fontOptionsHTML();
$('type-font').addEventListener('change', e => {
  TEXT_ROLES.forEach(r => { state[r].font = e.target.value; setWeightOptions(r); $(`${r}-font`).value = state[r].font; });
  syncTypeMaster(); render();
});
$('type-color').addEventListener('input', e => {
  TEXT_ROLES.forEach(r => { state[r].color = e.target.value; $(`${r}-color`).value = e.target.value; });
  syncTypeMaster(); render();
});
// The value the three layers share, or undefined when they differ.
function commonRole(key) {
  const v = state[TEXT_ROLES[0]][key];
  return TEXT_ROLES.every(r => state[r][key] === v) ? v : undefined;
}
function syncTypeMaster() {
  const f = commonRole('font'), c = commonRole('color');
  $('type-font').value = f ?? '';
  $('type-color').value = c ?? state.heading.color;
  $('type-color').classList.toggle('is-mixed', c === undefined);
}
$('body-columns').addEventListener('change', e => { state.body.columns = +e.target.value; render(); });
$('scrimAmt').addEventListener('input', e => { state.scrim.amount = +e.target.value; $('scrimAmtV').value = Math.round(e.target.value*100)+'%'; render(); });
$('scrimColor').addEventListener('change', e => { state.scrim.color = e.target.value; render(); });
// A guide, not a property of the cover, so it is not part of a saved scene.
$('safeToggle').addEventListener('change', e => document.body.classList.toggle('show-safe', e.target.checked));
/* ---- the menu overlay ----
   The grid is built once from the catalogue. Each swatch is the tile itself,
   scaled so about two of it fit the box — small enough to fit 87 of them in the
   panel, big enough to tell a texture from a stripe. */
// SINGLE quotes around the url: this string is also interpolated into a
// double-quoted HTML style="" attribute, and a double quote in there closes the
// attribute early — which leaves `background-image: url("")` and a grid of
// blank squares.
const swatchStyle = (p, box) => {
  const k = box / Math.max(p.w, p.h);
  return `background-image:url('${patternURL(p.n)}');` +
         `background-size:${Math.max(2, Math.round(p.w * k))}px ${Math.max(2, Math.round(p.h * k))}px`;
};
$('pat-grid').innerHTML = OVERLAY_PATTERNS.map(p =>
  // The names are the filenames: lowercase, digits and hyphens, so nothing here
  // needs escaping beyond the URL encoding patternURL already does.
  `<button type="button" data-pat="${p.n}" title="${p.n}" aria-pressed="false" style="${swatchStyle(p, 18)}"></button>`
).join('');

function syncPattern() {
  const p = state.pattern;
  $('pat-name').textContent = p.name;
  let picked = null;
  $('pat-grid').querySelectorAll('[data-pat]').forEach(b => {
    const on = b.dataset.pat === p.name;
    b.setAttribute('aria-pressed', String(on));
    if (on) picked = b;
  });
  // 87 tiles in a scrolling box: marking the current one is no use if it is
  // parked out of sight, so bring it into the middle whenever it is not
  // already showing. The grid scrolls itself rather than scrollIntoView, which
  // would drag the whole panel along with it.
  if (picked) {
    const g = $('pat-grid');
    if (picked.offsetTop < g.scrollTop || picked.offsetTop + picked.offsetHeight > g.scrollTop + g.clientHeight)
      g.scrollTop = picked.offsetTop - (g.clientHeight - picked.offsetHeight) / 2;
  }
  $('pat-scale').value = p.scale;     $('pat-scaleV').value = fmt(p.scale) + '×';
  $('pat-opacity').value = p.opacity; $('pat-opacityV').value = Math.round(p.opacity * 100) + '%';
  $('pat-color').value = p.color;
  $('pat-blend').value = p.blend;
  $('pat-rotate').value = p.rotate;   $('pat-rotateV').value = p.rotate + '°';
}

$('pat-grid').addEventListener('click', e => {
  const swatch = e.target.closest('[data-pat]');
  if (!swatch) return;
  state.pattern.name = swatch.dataset.pat;
  syncPattern();
  render();
});
$('pat-scale').addEventListener('input', e => { state.pattern.scale = +e.target.value; $('pat-scaleV').value = fmt(e.target.value) + '×'; render(); });
$('pat-opacity').addEventListener('input', e => { state.pattern.opacity = +e.target.value; $('pat-opacityV').value = Math.round(e.target.value*100) + '%'; render(); });
$('pat-color').addEventListener('input', e => { state.pattern.color = e.target.value; render(); });
$('pat-blend').addEventListener('change', e => { state.pattern.blend = e.target.value; render(); });
$('pat-rotate').addEventListener('input', e => { state.pattern.rotate = +e.target.value; $('pat-rotateV').value = e.target.value + '°'; render(); });

/* the plate */
$('plate-color').addEventListener('input', e => { state.plate.color = e.target.value; render(); });
$('plate-alpha').addEventListener('input', e => { state.plate.alpha = +e.target.value; $('plate-alphaV').value = Math.round(e.target.value*100) + '%'; render(); });

/* top menu controls */
$('tm-links').addEventListener('input', e => { state.topmenu.links = +e.target.value; $('tm-linksV').value = e.target.value; render(); });
$('tm-font').addEventListener('change', e => { state.topmenu.font = e.target.value; setWeightOptions('topmenu'); render(); });
$('tm-weight').addEventListener('change', e => { state.topmenu.weight = +e.target.value; render(); });
$('tm-size').addEventListener('input', e => { state.topmenu.size = +e.target.value; $('tm-sizeV').value = e.target.value + 'px'; render(); });
$('tm-ls').addEventListener('input', e => { state.topmenu.ls = +e.target.value; $('tm-lsV').value = fmt(e.target.value) + 'em'; render(); });
$('tm-transform').addEventListener('change', e => { state.topmenu.transform = e.target.value; render(); });
$('tm-align').addEventListener('change', e => { state.topmenu.align = e.target.value; render(); });
$('tm-gap').addEventListener('input', e => { state.topmenu.gap = +e.target.value; $('tm-gapV').value = e.target.value + 'px'; render(); });
$('tm-pad').addEventListener('input', e => { state.topmenu.pad = +e.target.value; $('tm-padV').value = e.target.value + 'px'; render(); });
$("tm-shadow").addEventListener("change", e => { state.topmenu.shadow = e.target.checked; render(); });
$('tm-brand').addEventListener('change', e => { state.topmenu.brand = e.target.checked; render(); });
$('tm-color').addEventListener('input', e => { state.topmenu.color = e.target.value; render(); });
$('tm-bg').addEventListener('input', e => { state.topmenu.bg = e.target.value; render(); });
$('tm-bgA').addEventListener('input', e => { state.topmenu.bgA = +e.target.value; $('tm-bgAV').value = Math.round(e.target.value*100) + '%'; render(); });
els.topmenu.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); });

/* ---- the visibility eyes ----
   One switch per section, driving that block's `enabled`. It replaced the
   `show` checkbox the plate and the menu each had, so there is one place a
   thing is turned off rather than two. Background is included: hidden, it drops
   the photograph and leaves the flat backdrop, which is a cover in its own
   right.

   It toggles visibility and nothing else — it never moves a block. Blocks are
   placed by hand now, so closing the gap left by a hidden one would throw away
   the placement of everything below it. A hidden block does drop out of the
   next Randomize, which is where closing up belongs. */
document.querySelectorAll('[data-vis]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();                 // not a click on the section header
    const k = btn.dataset.vis;
    state[k].enabled = !state[k].enabled;
    syncEyes();
    render();
  });
});
// A hidden layer goes quiet and shuts: its title dims to the same grey as its
// struck-through eye, its settings fold away, and it stays folded until the eye
// brings it back. Nothing below it is worth reading while it is off the cover,
// and a panel of open sections that draw nothing is a panel that lies about
// what you are looking at.
const HIDDEN_TIP = 'Hidden — turn its eye back on to open it';
const syncEyes = () => document.querySelectorAll('[data-vis]').forEach(b => {
  const on = !!state[b.dataset.vis].enabled;
  b.setAttribute('aria-pressed', String(on));
  const sec = b.closest('.grp, .sub');
  if (!sec) return;
  sec.classList.toggle('is-hidden', !on);
  if (!on) sec.classList.add('collapsed');
  const head = sec.querySelector(':scope > h3, :scope > h4');
  if (head) head.title = on ? '' : HIDDEN_TIP;
  // Nothing to roll on a layer that is off the cover: the dice goes with the
  // settings it would change. The lock stays live — locking a hidden layer is
  // how you keep it that way through a re-roll. Its own tooltip is kept the
  // first time through, since it says which layer it rolls and that is worth
  // having back when the layer returns.
  const dice = head && head.querySelector('[data-rand]');
  if (dice) {
    dice.dataset.tip ??= dice.title;
    dice.disabled = !on;
    dice.title = on ? dice.dataset.tip : HIDDEN_TIP;
  }
});

document.querySelectorAll('[data-lock]').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.lock; locks[k] = !locks[k];
    btn.setAttribute('aria-pressed', String(locks[k]));
  });
});

/* ---- collapsible sections (all shut on load) ---- */
document.querySelectorAll('.panel .grp').forEach(grp => {
  const h = grp.querySelector('h3');
  if (!h) return;                          // groups without a header stay open
  const body = document.createElement('div');
  body.className = 'grp-body';
  for (let n = h.nextSibling; n; ) { const nx = n.nextSibling; body.appendChild(n); n = nx; }
  grp.appendChild(body);
  h.insertBefore(Object.assign(document.createElement('span'), { className: 'chev' }), h.firstChild);
  // data-section is declared in the markup now rather than guessed from the
  // heading text — the titles had started colliding ("subheading" begins with
  // "sub", "body" with "b") and a key is not something to infer from prose.
  // Everything shut on load: the panel opens as a list of what the cover is
  // made of, and you open the one you came for. Clicking a block on the cover
  // opens its section anyway, which is the shorter way in.
  grp.classList.add('collapsed');
  h.addEventListener('click', e => {
    if (e.target.closest('.lock') || grp.classList.contains('is-hidden')) return;
    grp.classList.toggle('collapsed');
  });
});

/* ---- collapsible sub-layers ----
   The same thing one level down, and deliberately so: a layer is a smaller
   section, so it opens and shuts by the same chevron in the same place. No
   wrapping to do — a `.sub` already carries its own `.sub-body`.

   They start shut, because a section that is a stack of four layers should read
   as four layers rather than as everything at once. A click on any of the three
   buttons is that button's business and never folds the layer. */
document.querySelectorAll('.panel .sub').forEach(sub => {
  const h = sub.querySelector('h4');
  if (!h) return;
  h.insertBefore(Object.assign(document.createElement('span'), { className: 'chev' }), h.firstChild);
  sub.classList.add('collapsed');
  h.addEventListener('click', e => {
    // A click on any of the three buttons is that button's business, and a
    // hidden layer does not open: its eye is the way back in.
    if (e.target.closest('button') || sub.classList.contains('is-hidden')) return;
    sub.classList.toggle('collapsed');
  });
});

// Open one section (and collapse the rest) — used when clicking the matching
// element in the preview so its controls are front-and-centre.
// Bring a block's own controls up. The target may be a section or a layer
// nested in one, so rather than matching a key against the sections, this opens
// everything on the PATH to it and folds away everything else — which works at
// any depth and needs no list of what contains what.
function openSection(key) {
  document.body.classList.remove('panel-hidden');   // make sure the panel is visible
  const target = document.querySelector(`.panel [data-section="${key}"]`);
  if (!target) return;
  document.querySelectorAll('.panel .grp[data-section], .panel .sub[data-section]')
    .forEach(el => el.classList.toggle('collapsed', !el.contains(target)));
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
