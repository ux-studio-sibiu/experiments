/* font-experiments app logic.
   Depends on (loaded first, as plain <script>s): fonts.js (FONTS/byName/loadFont…)
   and static-background.js (createStaticBackground). */

/* ============================ state ============================ */
const state = {
  // A background DESCRIPTOR, never a URL: a picsum seed, a gradient preset name
  // or a bundled image path, resolved to a URL at paint time. A URL would not
  // survive a save — picsum's ?random= is a cache-buster that hands back a
  // different photo each call, and a gradient's data: URI is ~100KB of base64.
  // How it is fitted is not a choice: centred cover, stated once in the CSS.
  bg: { enabled: true, kind: "photo", seed: 'studio', preset: null, src: null },
  scrim: { amount: 0.35, color: 'dark' },
  // Not a container, and no longer a panel section either: these are the
  // parameters the stack was last laid out with. Randomize rolls them and
  // restack() reads them; from then on each block owns its own position, which
  // is why there is nothing here to adjust by hand.
  layout: { align: 'left', vAlign: 'center', colW: 940, margin: 54 },
  // A texture laid over the menu bar: an SVG tile from ./overlay-patterns/ used
  // as a mask, tinted and blended. Top-level rather than nested inside
  // `topmenu`, so every block's state stays flat and a shallow copy of one is
  // still a whole copy of it — this object is cloned explicitly on save.
  pattern: { enabled: false, name: 'polka-dots', scale: 1, opacity: 0.35, color: '#ffffff', blend: 'normal', rotate: 0 },
  // The plate: a flat rectangle behind the type, which is what the old card
  // was, except it is now a block of its own and can be placed anywhere.
  plate: { enabled: false, x: 54, y: 240, boxW: 940, boxH: 380, color: '#000000', alpha: 0.36, pad: 14 },
  //                                         x, y and the box are artboard px; every block carries its own
  heading:    { enabled:true, font:'Playfair Display', weight:700, size:96, lh:1.04, ls:-0.01, italic:false, transform:'none', align:'left', amount:5,   color:'#ffffff', shadow:true, x:54, y:250, boxW:940, boxH:40 },
  subheading: { enabled:true, font:'Inter',           weight:500, size:22, lh:1.35, ls:0.18,  italic:false, transform:'uppercase', align:'left', amount:11, color:'#ffffff', shadow:true, x:54, y:400, boxW:940, boxH:30 },
  body:       { enabled:true, font:'Inter',           weight:400, size:18, lh:1.7,  ls:0,     italic:false, transform:'none', align:'left', columns:2, amount:180, color:'#ffffff', shadow:true, x:54, y:470, boxW:940, boxH:40 },
  topmenu:    { enabled:true, links:4, font:'Inter', weight:500, size:14, ls:0.08, transform:'uppercase', align:'spread', gap:28, pad:28, color:'#ffffff', shadow:true, brand:true, bg:'#0b0b0d', bgA:0, x:0, y:0, boxW:null, boxH:null },
};
const locks = { heading:false, subheading:false, body:false, bg:false, topmenu:false, plate:false };
const $ = (id) => document.getElementById(id);

// One source of truth for what the cover is made of. ROLES drives the panel
// (it carries the section headings); the rest are derived, so adding a block
// means touching this and nothing else.
//
// Three lists because there are three genuinely different capabilities: copy you
// can type into, anything with a font, and anything you can place on the cover.
// The plate has no text and no font but is placed and resized like the rest.
const ROLES = [['heading','Heading'],['subheading','Subheading'],['body','Body / columns']];
const TEXT_ROLES = ROLES.map(([r]) => r);
const TYPE_BLOCKS = [...TEXT_ROLES, 'topmenu'];
const BLOCKS = [...TYPE_BLOCKS, 'plate'];

// The panel ids the three copy roles use are their own names; the menu's are
// prefixed `tm`. One map, so the two do not need two copies of every function.
const UI = { heading:'heading', subheading:'subheading', body:'body', topmenu:'tm', plate:'plate' };

const els = Object.fromEntries(BLOCKS.map(k => [k, $(k)]));

// Fixed parts of the stage, looked up once: render() runs on every slider tick.
const bgLayer = $('bgLayer'), scrimEl = $('scrim');

const hexRgba = (hex, a) => {
  const h = hex.replace('#',''); const f = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(f, 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
};
// trim trailing zeros for slider value read-outs (e.g. 0.150 -> "0.15", 0 -> "0")
const fmt = (v) => (+v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');

/* ============================ the artboard ============================
   Everything on the cover is laid out in a fixed REF.w x REF.h space and the
   whole box is scaled to the viewport by max(vw/w, vh/h) — the same number
   `background-size: cover` computes, which is why a box scaled by it covers the
   window exactly. One transform for the scene means the type can never drift
   against the photograph, and every stored number is resolution-independent.
   ===================================================================== */
const REF = { w: 1600, h: 900 };
let sceneScale = 1;

/* ---- the safe area: the part of the artboard this window actually shows ----
   Cover-scaling shows the middle of the artboard in whichever direction the
   window is proportionally shorter:

     a viewport WIDER than the artboard  -> crops top and bottom, keeps refA/a of the height
     a viewport NARROWER than it         -> crops the sides,       keeps a/refA of the width

   Measured against the window you are sitting at, that is exactly the region
   visible right now — the same fraction a `contain` fit would have shown,
   min(vw/w,vh/h) / max(vw/w,vh/h) — and it is the roomiest bound there is.

   Worth knowing what it does NOT claim: it says what YOU can see, not what a
   viewer with a differently shaped window will. Design to its edges at 1.85:1
   and an ultrawide visitor still loses about 12% off the top and bottom. */
function fitSafeArea() {
  const el = $('safeArea'); if (!el) return;
  const refA = REF.w / REF.h, a = innerWidth / innerHeight;
  const wFrac = Math.min(a, refA) / refA;
  const hFrac = refA / Math.max(a, refA);
  el.style.setProperty('--safe-x', (1 - wFrac) / 2 * 100 + '%');
  el.style.setProperty('--safe-y', (1 - hFrac) / 2 * 100 + '%');
  const label = el.querySelector('span');
  if (label) label.textContent = `visible now · ${Math.round(wFrac*100)}% × ${Math.round(hFrac*100)}%`;
}

function fitScene() {
  sceneScale = Math.max(innerWidth / REF.w, innerHeight / REF.h);
  document.documentElement.style.setProperty('--scene-scale', sceneScale);
  const out = $('sceneFit');
  if (out) out.value = `${REF.w}×${REF.h} · ${sceneScale.toFixed(2)}×`;
  fitSafeArea();
  queueFrame();               // the scale changed, so every block's box moved
}
// The reference box is read from the scene file, not hardcoded at load, so a
// later change of default cannot invalidate scenes saved against the old one.
function setRef(w, h) {
  if (!(w > 0 && h > 0)) return;
  REF.w = w; REF.h = h;
  document.documentElement.style.setProperty('--ref-w', w + 'px');
  document.documentElement.style.setProperty('--ref-h', h + 'px');
  fitScene();
}
addEventListener('resize', fitScene);
fitScene();

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
  <div class="grp">
    <h3>${label}
      <button class="eyebtn" data-vis="${role}" aria-pressed="true" title="Hide this on the cover">eye</button>
      <button class="iconbtn dice" data-rand="${role}" title="Randomize this section">⤨</button>
      <button class="lockbtn lock" data-lock="${role}" aria-pressed="false" title="Lock during randomize">🔓</button></h3>
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
      <span style="display:flex; gap:6px; align-items:center; white-space:nowrap"><input id="${role}-italic" type="checkbox"> <label for="${role}-italic">italic</label></span></div>
    <div class="row"><label>shadow</label><span></span><input id="${role}-shadow" type="checkbox"></div>
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

/* ============================ sample text generation ============================ */
// Fixed, themed word banks. Text is sliced deterministically (no randomness) so
// dragging the length slider extends/trims the SAME copy instead of reshuffling.
const TITLE = ('randomize studio your portfolio cover before anyone else gets the chance to '
  + 'judge it by its typeface').split(' ');
const SUB = ('a playground for pairing google fonts over a cover image roll the dice nudge the '
  + 'type drop in a photo and copy the css when it clicks').split(' ');
const PROSE = [
  'this is the green room where type tries on outfits before the big show',
  'you pick a face for the title a quieter one for the body and the dice handle the awkward first dates',
  'it was built for portfolio covers case study headers album sleeves and the hero section you will secretly redesign at midnight',
  'every font streams straight from google fonts so you can flirt with playfair commit to inter and never install a thing',
  'push the scale loosen the tracking and dim the photo behind the words',
  'and when a pairing finally clicks and trust me it will you copy the css and walk away as though you planned the whole performance',
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const take = (arr, n) => { const o = []; for (let i = 0; i < n; i++) o.push(arr[i % arr.length]); return o; };
const phrase = (arr, n) => cap(take(arr, n).join(' '));               // heading / subheading (no period)
function paragraph(n) {                       // body — whole sentences up to ~n words (cycles if needed)
  const parts = []; let words = 0, i = 0;
  while (words < n && i < 240) {
    const s = PROSE[i % PROSE.length];
    parts.push(cap(s) + '.');
    words += s.split(' ').length;
    i++;
  }
  return parts.join(' ');
}
function genText(r) {
  if (r === 'heading') return phrase(TITLE, state.heading.amount);
  if (r === 'subheading') return phrase(SUB, state.subheading.amount);
  return paragraph(state.body.amount);
}
const setText = (r) => { els[r].textContent = genText(r); };

// Fixed cover copy used by the global Randomize button and on page load only.
// (Per-section dice still pulls varied copy from the word banks above.)
const COVER = {
  heading: { text: 'Randomize Studio',                      words: 2 },
  sub:     { text: 'A playground for exploring typography', words: 5 },
};

/* ============================ apply state → DOM ============================ */

// A drop shadow reads against the scrim, not against the block, so its colour
// is the one thing here that is still decided scene-wide.
const shadowCSS = () => state.scrim.color === 'dark'
  ? '0 2px 24px rgba(0,0,0,.55)' : '0 1px 14px rgba(255,255,255,.5)';

// Where a block sits and how big its box is. Shared by every block, including
// the plate, which has geometry and nothing else.
function applyBox(k) {
  const c = state[k], el = els[k];
  el.style.left = c.x + 'px';
  el.style.top = c.y + 'px';
  el.style.width = c.boxW ? c.boxW + 'px' : '';
  // min-height rather than height, so a box can be given room without ever
  // clipping the copy inside it.
  el.style.minHeight = c.boxH ? c.boxH + 'px' : '';
}

function applyRole(r) {
  const c = state[r], f = byName(c.font), el = els[r];
  // '' rather than 'block', so the stylesheet keeps saying what these are.
  el.style.display = c.enabled ? '' : 'none';
  if (!c.enabled) return;
  loadFont(c.font);
  el.style.fontFamily = `'${c.font}', ${FB[f.c]}`;
  el.style.fontWeight = c.weight;
  el.style.fontStyle = c.italic ? 'italic' : 'normal';
  el.style.fontSize = c.size + 'px';
  el.style.lineHeight = c.lh;
  el.style.letterSpacing = c.ls + 'em';
  el.style.textTransform = c.transform;
  el.style.textAlign = c.align;
  el.style.color = c.color;
  el.style.textShadow = c.shadow ? shadowCSS() : 'none';
  applyBox(r);
  if (r === 'body') { el.style.columnCount = c.columns; el.style.columnGap = '2.4em'; }
}

function renderPlate() {
  const p = state.plate, el = els.plate;
  el.style.display = p.enabled ? 'block' : 'none';
  if (!p.enabled) return;
  el.style.background = hexRgba(p.color, p.alpha);
  applyBox('plate');
}
function render() {
  const { scrim } = state;
  // Everything else about the layer — cover, centred, no repeat — is fixed, so
  // it lives in the stylesheet and only the picture itself changes here.
  bgLayer.style.backgroundImage = (state.bg.enabled && bgUrl) ? `url("${bgUrl}")` : 'none';
  scrimEl.style.background = hexRgba(scrim.color === 'dark' ? '#000000' : '#ffffff', scrim.amount);
  renderPattern();
  renderPlate();
  TEXT_ROLES.forEach(applyRole);
  renderTopMenu();
  queueFrame();               // any of the above can have moved or resized a block
}

/* ============================ top menu ============================ */
const MENU_WORDS = ['Work','Studio','About','Journal','Index','Contact','Shop','News','Archive','Projects'];
const MENU_BRAND = '✶ Studio';
const JUSTIFY = { spread:'space-between', center:'center', right:'flex-end', left:'flex-start' };

// The anchors only need rebuilding when the menu's STRUCTURE changes — how many
// links, and whether the brand is there. render() runs on every slider tick, so
// tearing a dozen nodes down and recreating them per mousemove was the one
// genuinely wasteful thing in here.
let menuShape = null;
function buildMenuLinks(m, el) {
  const mk = (t, cls) => { const a = document.createElement('a'); a.href = '#'; a.textContent = t; a.className = cls; return a; };
  el.innerHTML = '';
  if (m.brand) el.appendChild(mk(MENU_BRAND, 'tm-link tm-brand'));
  const links = document.createElement('div');
  links.className = 'tm-links';
  for (let i = 0; i < m.links; i++) links.appendChild(mk(MENU_WORDS[i % MENU_WORDS.length], 'tm-link'));
  el.appendChild(links);
}

/* ---- the pattern overlay over the background ---- */
const patternLayer = $('patternLayer'), patternTile = patternLayer.querySelector('i');
const PATTERN_BY_NAME = Object.fromEntries(OVERLAY_PATTERNS.map(p => [p.n, p]));
const patternURL = (name) => `overlay-patterns/${encodeURIComponent(name)}.svg`;

function renderPattern() {
  const p = state.pattern;
  const on = p.enabled;
  patternLayer.style.display = on ? '' : 'none';
  if (!on) return;
  const tile = PATTERN_BY_NAME[p.name] || { w: 20, h: 20 };
  const size = `${Math.max(1, Math.round(tile.w * p.scale))}px ${Math.max(1, Math.round(tile.h * p.scale))}px`;
  const url = `url("${patternURL(p.name)}")`;
  // Both spellings: Safari still wants the prefix for masks.
  patternTile.style.webkitMaskImage = patternTile.style.maskImage = url;
  patternTile.style.webkitMaskSize = patternTile.style.maskSize = size;
  patternTile.style.webkitMaskRepeat = patternTile.style.maskRepeat = 'repeat';
  patternTile.style.backgroundColor = p.color;
  patternTile.style.transform = `rotate(${p.rotate}deg)`;
  patternLayer.style.opacity = p.opacity;
  patternLayer.style.mixBlendMode = p.blend;
}
function renderTopMenu() {
  const m = state.topmenu, el = els.topmenu;
  if (!m.enabled) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  // Screen pixels, not artboard ones: the bar is chrome, anchored to the window.
  el.style.left = m.x + 'px';
  el.style.top = m.y + 'px';
  // Given a width the bar stops spanning the window, so the right anchor has to
  // let go — otherwise the two fight and the width is ignored.
  el.style.width = m.boxW ? m.boxW + 'px' : '';
  el.style.right = m.boxW ? 'auto' : '';
  el.style.minHeight = m.boxH ? m.boxH + 'px' : '';
  el.style.background = m.bgA > 0 ? hexRgba(m.bg, m.bgA) : 'transparent';
  el.style.padding = m.pad + 'px';
  el.style.gap = m.gap + 'px';
  el.style.justifyContent = JUSTIFY[m.align] || 'flex-start';
  loadFont(m.font);

  const shape = `${m.links}|${m.brand}`;
  if (shape !== menuShape) { menuShape = shape; buildMenuLinks(m, el); }

  el.querySelector('.tm-links').style.gap = m.gap + 'px';
  const fam = `'${m.font}', ${FB[byName(m.font).c]}`;
  el.querySelectorAll('.tm-link').forEach(a => {
    a.style.fontFamily = fam;
    a.style.fontWeight = a.classList.contains('tm-brand') ? Math.min(900, +m.weight + 200) : m.weight;
    a.style.fontSize = m.size + 'px';
    a.style.letterSpacing = m.ls + 'em'; a.style.textTransform = m.transform; a.style.color = m.color;
    a.style.textShadow = m.shadow ? shadowCSS() : 'none';
  });
}

/* ============================ the default composition ============================
   With no shared container, nothing arranges the text for you — so this is the
   one thing that does. It stacks heading, subheading and body into a column at
   one of nine positions, and it is what Randomize lays the cover out with.
   From then on every block is yours to place.

   Two passes, because a block's height is only known once its copy has been
   laid out at the new width: assign x and width, let the browser reflow, then
   measure and set y. Cheap, because this only runs on a deliberate action.
   ============================================================================ */
function restack() {
  const L = state.layout;
  const colW = Math.min(L.colW, REF.w - L.margin * 2);
  const x = L.align === 'center' ? Math.round((REF.w - colW) / 2)
          : L.align === 'right' ? REF.w - L.margin - colW
          : L.margin;
  const stack = TEXT_ROLES.filter(k => !locks[k] && state[k].enabled);   // a hidden block takes no room
  if (!stack.length) return;

  // Pass one: width and x, with the height floor dropped so the copy alone
  // decides how tall each block is.
  stack.forEach(k => { const c = state[k]; c.x = x; c.boxW = colW; c.boxH = 0; applyRole(k); });

  // Gaps scale with the type they follow, so the rhythm holds at any size.
  const gapAfter = { heading: Math.round(state.subheading.size * 1.1), subheading: Math.round(state.body.size * 1.6), body: 0 };
  // Measured, so it has to be treated as untrusted: a zero scale or an element
  // the browser has not laid out yet yields NaN, and a NaN here would reach
  // `top` as "NaNpx" — which is silently dropped, leaving the block stuck at its
  // last good position with nothing logged. Fall back to no height instead.
  const h = Object.fromEntries(stack.map(k => {
    const px = els[k].getBoundingClientRect().height / sceneScale;
    return [k, Number.isFinite(px) ? px : 0];
  }));
  const total = stack.reduce((sum, k, i) => sum + h[k] + (i < stack.length - 1 ? gapAfter[k] : 0), 0);

  let y = L.vAlign === 'flex-start' ? L.margin
        : L.vAlign === 'flex-end' ? REF.h - L.margin - total
        : (REF.h - total) / 2;
  // Centring a stack taller than the artboard starts it off the top, which
  // hides the heading — the one thing that must be on the cover. Pin it instead
  // and let the overflow fall off the bottom, where it reads as a crop.
  if (!Number.isFinite(y) || total > REF.h - L.margin * 2) y = L.margin;
  stack.forEach((k, i) => {
    state[k].y = Math.round(y);
    y += h[k] + (i < stack.length - 1 ? gapAfter[k] : 0);
    applyRole(k);
  });
  if (state.plate.enabled && !locks.plate) plateToText();
}

// The plate wrapped around the text, which is what the old card's padding did.
// An explicit action rather than a live binding, so a plate you have placed by
// hand is never yanked back.
function plateToText() {
  const p = state.plate, pad = p.pad;
  const boxes = TEXT_ROLES.map(k => els[k].getBoundingClientRect()).filter(r => r.width || r.height);
  if (!boxes.length) return;
  const scene = els.heading.offsetParent.getBoundingClientRect();
  const l = Math.min(...boxes.map(r => r.left)), t = Math.min(...boxes.map(r => r.top));
  const rt = Math.max(...boxes.map(r => r.right)), b = Math.max(...boxes.map(r => r.bottom));
  p.x = Math.round((l - scene.left) / sceneScale) - pad;
  p.y = Math.round((t - scene.top) / sceneScale) - pad;
  p.boxW = Math.round((rt - l) / sceneScale) + pad * 2;
  p.boxH = Math.round((b - t) / sceneScale) + pad * 2;
  renderPlate();
}

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
function syncTopMenu() {
  const m = state.topmenu;
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
  $('body-columns').querySelectorAll('input').forEach(i => { i.checked = (+i.value === state.body.columns); });
  $('scrimAmt').value = state.scrim.amount; $('scrimAmtV').value = Math.round(state.scrim.amount*100)+'%';
  $('scrimColor').value = state.scrim.color;
  const p = state.plate;
  $('plate-color').value = p.color;
  $('plate-alpha').value = p.alpha; $('plate-alphaV').value = Math.round(p.alpha*100) + '%';
  $('plate-pad').value = p.pad;     $('plate-padV').value = p.pad + 'px';
  syncTopMenu();
  syncPattern();
  syncEyes();
}

/* ============================ wire controls ============================ */
ROLES.forEach(([r]) => {
  $(`${r}-amount`).addEventListener('input', e => { state[r].amount = +e.target.value; $(`${r}-amountV`).value = e.target.value; setText(r); });
  $(`${r}-font`).addEventListener('change', e => { state[r].font = e.target.value; setWeightOptions(r); render(); });
  $(`${r}-weight`).addEventListener('change', e => { state[r].weight = +e.target.value; render(); });
  $(`${r}-size`).addEventListener('input', e => { state[r].size = +e.target.value; $(`${r}-sizeV`).value = e.target.value + 'px'; render(); });
  $(`${r}-lh`).addEventListener('input', e => { state[r].lh = +e.target.value; $(`${r}-lhV`).value = (+e.target.value).toFixed(2); render(); });
  $(`${r}-ls`).addEventListener('input', e => { state[r].ls = +e.target.value; $(`${r}-lsV`).value = fmt(e.target.value) + 'em'; render(); });
  $(`${r}-transform`).addEventListener('change', e => { state[r].transform = e.target.value; render(); });
  $(`${r}-align`).addEventListener('change', e => { state[r].align = e.target.value; render(); });
  $(`${r}-italic`).addEventListener('change', e => { state[r].italic = e.target.checked; render(); });
  $(`${r}-color`).addEventListener('input', e => { state[r].color = e.target.value; render(); });
  $(`${r}-shadow`).addEventListener('change', e => { state[r].shadow = e.target.checked; render(); });
});
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
  $('pat-enabled').checked = p.enabled;
  $('pat-config').style.display = p.enabled ? '' : 'none';
  $('pat-name').textContent = p.name;
  $('pat-swatch').style.cssText = swatchStyle(PATTERN_BY_NAME[p.name] || { n: p.name, w: 20, h: 20 }, 12);
  $('pat-grid').querySelectorAll('[data-pat]')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pat === p.name)));
  $('pat-scale').value = p.scale;     $('pat-scaleV').value = fmt(p.scale) + '×';
  $('pat-opacity').value = p.opacity; $('pat-opacityV').value = Math.round(p.opacity * 100) + '%';
  $('pat-color').value = p.color;
  $('pat-blend').value = p.blend;
  $('pat-rotate').value = p.rotate;   $('pat-rotateV').value = p.rotate + '°';
}

const closePatterns = () => {
  $('pat-grid').hidden = true;
  $('pat-trigger').setAttribute('aria-expanded', 'false');
};
$('pat-trigger').addEventListener('click', () => {
  const opening = $('pat-grid').hidden;
  $('pat-grid').hidden = !opening;
  $('pat-trigger').setAttribute('aria-expanded', String(opening));
});
$('pat-grid').addEventListener('click', e => {
  const swatch = e.target.closest('[data-pat]');
  if (!swatch) return;
  state.pattern.name = swatch.dataset.pat;
  syncPattern();
  closePatterns();
  render();
});
$('pat-enabled').addEventListener('change', e => {
  state.pattern.enabled = e.target.checked;
  $('pat-config').style.display = e.target.checked ? '' : 'none';
  if (!e.target.checked) closePatterns();
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
$('plate-pad').addEventListener('input', e => { state.plate.pad = +e.target.value; $('plate-padV').value = e.target.value + 'px'; });
$('plateFit').addEventListener('click', () => { state.plate.enabled = true; syncInputs(); render(); plateToText(); });

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
    btn.setAttribute('aria-pressed', String(state[k].enabled));
    render();
  });
});
const syncEyes = () => document.querySelectorAll('[data-vis]')
  .forEach(b => b.setAttribute('aria-pressed', String(!!state[b.dataset.vis].enabled)));

document.querySelectorAll('[data-lock]').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.lock; locks[k] = !locks[k];
    btn.setAttribute('aria-pressed', String(locks[k]));
    btn.textContent = locks[k] ? '🔒' : '🔓';
  });
});

/* ---- collapsible sections (only Heading open by default) ---- */
document.querySelectorAll('.panel .grp').forEach(grp => {
  const h = grp.querySelector('h3');
  if (!h) return;                          // groups without a header stay open
  const body = document.createElement('div');
  body.className = 'grp-body';
  for (let n = h.nextSibling; n; ) { const nx = n.nextSibling; body.appendChild(n); n = nx; }
  grp.appendChild(body);
  h.insertBefore(Object.assign(document.createElement('span'), { className: 'chev' }), h.firstChild);
  // The key a block's title maps to, so clicking a block on the cover can bring
  // its own section up. Longest-first, because "subheading" starts with "sub"
  // but "heading" is a prefix of nothing else here.
  const t = h.textContent.trim().toLowerCase();
  grp.dataset.section = ['subheading', 'heading', 'body', 'plate']
      .find(s => t.startsWith(s))
    || (t.startsWith('top menu') ? 'topmenu' : t.startsWith('background') ? 'bg' : '');
  if (grp.dataset.section !== 'heading') grp.classList.add('collapsed');
  h.addEventListener('click', e => { if (!e.target.closest('.lock')) grp.classList.toggle('collapsed'); });
});

// Open one section (and collapse the rest) — used when clicking the matching
// element in the preview so its controls are front-and-centre.
function openSection(key) {
  document.body.classList.remove('panel-hidden');   // make sure the panel is visible
  document.querySelectorAll('.panel .grp[data-section]').forEach(g => {
    const match = g.dataset.section === key;
    g.classList.toggle('collapsed', !match);
    if (match) g.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
/* ============================ select / move / edit ============================
   The stage behaves like a canvas. One click selects a block and brings its
   controls up in the panel; dragging a selected block places it anywhere,
   including past the edge of the content column or half off the screen, which
   is a legitimate cover layout and so is deliberately not clamped. Typing is a
   separate mode you enter with a double-click — with contenteditable off the
   rest of the time, a drag can never turn into a text selection, and the R key
   still randomizes while a block is merely selected.
   ========================================================================== */
/* A selection is a set plus a primary — the one clicked last. Everything in the
   set moves together; the primary is the one the panel is showing controls for
   and the only one that wears a name tag, because four tags at once is clutter
   and the question a tag answers is "which block are these controls editing?" */
const selected = new Set();
let primary = null, editing = null;

// Position only, no other styles — cheap enough to run on every pointermove.
const applyMove = (key) => {
  const c = state[key], el = els[key];
  el.style.left = c.x + 'px';
  el.style.top = c.y + 'px';
};
function paintSelection() {
  Object.entries(els).forEach(([k, el]) => {
    el.classList.toggle('is-selected', selected.has(k));
    el.classList.toggle('is-primary', k === primary);
  });
  // Straight away, not on the next frame: selecting is a discrete click, one
  // layout read costs nothing there, and the mark should not trail the pointer.
  // queueFrame() is for the high-frequency path — a slider being dragged.
  placeFrame();
}

/* ---- the resize frame ----
   Four handles over the bounding box of the selection. Reading a rect forces
   layout, and this has to be refreshed after anything that could move a block —
   which is every slider tick — so the work is coalesced onto one frame rather
   than run inline. */
const selFrame = $('selFrame');
// The pending flag lives on the function rather than in a `let` beside it:
// fitScene() calls this while the module is still evaluating, and a `let` up
// here would still be in its temporal dead zone. Reading a missing property is
// merely falsy, and by the time the frame callback runs everything exists.
function queueFrame() {
  if (queueFrame.pending) return;
  queueFrame.pending = true;
  requestAnimationFrame(() => { queueFrame.pending = false; placeFrame(); });
}
// The frame sits on the PRIMARY, not on the union of the selection: its only
// job is to carry the resize handles, and resizing sets one block's box. The
// other selected blocks still show their own outlines and move with the drag.
function placeFrame() {
  const r = (!editing && primary) ? els[primary].getBoundingClientRect() : null;
  const box = r && (r.width || r.height) ? r : null;     // a hidden menu has no box
  document.body.classList.toggle('has-selection', !!box);
  if (!box) return;
  selFrame.style.left = box.left + 'px';
  selFrame.style.top = box.top + 'px';
  selFrame.style.width = box.width + 'px';
  selFrame.style.height = box.height + 'px';
}
// Text reflows when a webfont finally arrives, which changes the box after the
// render that asked for it. An observer catches that; nothing else would.
const frameWatch = new ResizeObserver(queueFrame);
BLOCKS.forEach(k => frameWatch.observe(els[k]));

/* ---- resizing: the corners size the box the text flows in ----
   Not the type — the frame. Width sets where the copy wraps, height gives the
   box room, and the text reflows inside whatever that leaves. Type size stays
   where it belongs, on its slider.

   The opposite corner stays put, which is the whole reason this is not just
   "add the delta to the width": pulling the left edge leftward widens the box
   AND shifts the block by the same amount, so the right edge does not travel.

   Everything is measured against the geometry captured on pointerdown, so the
   text rewrapping at the new width cannot feed back into the number. A block
   with no box yet is measured as it currently renders, which is what makes the
   first grab continue from where the text already is rather than jumping. */
const CORNERS = { nw: [-1,-1], ne: [1,-1], se: [1,1], sw: [-1,1] };
const MIN_BOX = 40;             // small enough to be useful, big enough to grab back
let resizing = null;

selFrame.querySelectorAll('.handle').forEach(handle => {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !primary) return;
    e.stopPropagation();        // neither a click on a block nor one on the backdrop
    const key = primary;
    const [sx, sy] = CORNERS[handle.dataset.corner];
    const scale = key === 'topmenu' ? 1 : sceneScale;   // the menu is in screen px
    // Seed from the box it has been GIVEN, falling back to how it currently
    // renders. Re-seeding from the rendered size every grab would make a block
    // whose text is taller than its box creep a little each time, because
    // min-height cannot make a box shorter than its copy.
    const c = state[key], r = els[key].getBoundingClientRect();
    resizing = {
      key, sx, sy, scale,
      px: e.clientX, py: e.clientY,
      w: c.boxW ?? Math.round(r.width / scale),
      h: c.boxH ?? Math.round(r.height / scale),
      x: c.x, y: c.y,
    };
    handle.setPointerCapture(e.pointerId);
  });
  // Back to auto — as wide as the column, as tall as the copy needs.
  handle.addEventListener('dblclick', () => {
    if (!primary) return;
    state[primary].boxW = state[primary].boxH = null;
    render();
  });
});

document.addEventListener('pointermove', e => {
  if (!resizing) return;
  const { key, sx, sy, scale } = resizing;
  const c = state[key];
  const dx = (e.clientX - resizing.px) / scale;
  const dy = (e.clientY - resizing.py) / scale;
  c.boxW = Math.max(MIN_BOX, Math.round(resizing.w + dx * sx));
  c.boxH = Math.max(MIN_BOX, Math.round(resizing.h + dy * sy));
  // The opposite corner stays put: an edge that moves takes the block's own
  // position with it by however much the box actually grew. Plain arithmetic
  // now that blocks are positioned absolutely — there is no flow left to shift
  // them, so nothing has to be measured after the fact.
  c.x = sx < 0 ? resizing.x + (resizing.w - c.boxW) : resizing.x;
  c.y = sy < 0 ? resizing.y + (resizing.h - c.boxH) : resizing.y;
  els[key].dataset.move = `   ${c.boxW} × ${c.boxH}`;
  render();
});
const endResize = () => {
  if (!resizing) return;
  const { key } = resizing;
  resizing = null;
  els[key].removeAttribute('data-move');
  queueFrame();
};
document.addEventListener('pointerup', endResize);
document.addEventListener('pointercancel', endResize);

// `additive` is a ctrl/cmd/shift-click: it toggles one block in or out and
// leaves the rest alone. A plain click replaces the selection outright.
function select(key, additive) {
  stopEditing();
  const was = primary;
  if (additive) {
    if (selected.has(key)) {
      selected.delete(key);
      // Dropping the primary hands the title to whatever is still selected, so
      // the panel always shows something that is actually selected.
      if (primary === key) primary = [...selected].pop() || null;
    } else {
      selected.add(key);
      primary = key;
    }
  } else {
    selected.clear();
    selected.add(key);
    primary = key;
  }
  paintSelection();
  // Only on a change: openSection collapses the other sections and scrolls, and
  // doing that again for a block already showing is a jolt for nothing.
  if (primary && primary !== was) openSection(primary);
}
function deselect() {
  stopEditing();
  selected.clear();
  primary = null;
  paintSelection();
}

// Drop the caret where the pointer went down rather than at the start of the
// block. Chromium and Firefox spell this differently and neither has both.
function placeCaret(el, x, y) {
  let range = null;
  if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
  else if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); }
  }
  // Blocks can be dragged over one another, so the point may well resolve into
  // a different one. The caret belongs in the block being edited or nowhere;
  // fall back to the end of it.
  if (!range || !el.contains(range.startContainer)) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
function startEditing(key, x, y) {
  if (key === 'topmenu') return;            // the menu is generated, not typed
  const el = els[key];
  editing = key;
  el.contentEditable = 'true';
  el.classList.add('is-editing');
  el.focus();
  placeCaret(el, x, y);
}
function stopEditing() {
  if (!editing) return;
  const el = els[editing];
  el.contentEditable = 'false';
  el.classList.remove('is-editing');
  el.blur();
  editing = null;
}

// { keys, sx, sy, start, collapseTo, moving } while the pointer is down on a block
let drag = null;
const signed = (n) => (n >= 0 ? '+' : '') + n;

Object.entries(els).forEach(([key, el]) => {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || editing === key) return;   // inside a block being typed in, the caret wins
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    const wasSelected = selected.has(key);

    if (additive || !wasSelected) {
      select(key, additive);
    } else if (primary !== key) {
      // Already selected, plain click: make it the primary without disturbing
      // the rest of the selection.
      primary = key;
      paintSelection();
      openSection(key);
    }

    if (!selected.has(key)) { drag = null; return; }   // a ctrl-click that deselected it
    drag = {
      keys: [...selected],
      sx: e.clientX, sy: e.clientY,
      start: Object.fromEntries([...selected].map(k => [k, { x: state[k].x, y: state[k].y }])),
      // A plain click on a block that is already part of a multi-selection must
      // NOT collapse the selection on the way down, or a selection could never
      // be dragged at all. Collapse on the way back up instead, and only if
      // nothing moved — which is the difference between a click and a drag.
      collapseTo: (!additive && wasSelected && selected.size > 1) ? key : null,
      moving: false,
    };
  });
  // Typing happens in one block, so entering edit mode collapses the selection.
  el.addEventListener('dblclick', e => { select(key, false); startEditing(key, e.clientX, e.clientY); });
  el.addEventListener('dragstart', e => e.preventDefault());   // no native drag of the menu's links
  el.addEventListener('click', e => e.preventDefault());       // ...and they go nowhere
});

// On the document rather than on the block, and without pointer capture. A
// block is a line of text, so a drag of any speed leaves it within the first
// event and a listener bound to it would never hear the rest; capture would fix
// that, but taking it on pointerdown suppresses the compatibility mouse events,
// and with them the double-click that opens text editing.
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  // A click is not a drag: nothing moves until the pointer has travelled far
  // enough that it cannot have been meant as one.
  if (!drag.moving && Math.hypot(dx, dy) < 3) return;
  if (!drag.moving) {
    drag.moving = true;
    drag.collapseTo = null;              // it became a drag, so nothing collapses
    document.body.classList.add('is-moving');
    drag.keys.forEach(k => els[k].classList.add('is-moving'));
  }
  // One pointer delta applied to every block in the selection, each from where
  // it started, so the group keeps its internal spacing.
  //
  // The pointer moves in device pixels; a block on the cover lives in artboard
  // ones. The menu is the exception — it is anchored to the screen, so its
  // offset is already in the pointer's units, and in a mixed selection the two
  // still travel the same distance on screen. The threshold above stays in
  // device pixels either way: it is about how far a hand travelled.
  drag.keys.forEach(k => {
    const scale = k === 'topmenu' ? 1 : sceneScale;
    const s = drag.start[k];
    const c = state[k];
    c.x = Math.round(s.x + dx / scale);
    c.y = Math.round(s.y + dy / scale);
    if (k === primary) els[k].dataset.move = `   ${signed(c.x)}, ${signed(c.y)}`;
    applyMove(k);
  });
  // Straight away rather than on the next frame: the handles belong to the
  // block, so they have to travel with it — and queueFrame() would leave them
  // a frame behind the pointer.
  placeFrame();
});
const endDrag = () => {
  if (!drag) return;
  const { keys, collapseTo } = drag;
  drag = null;
  keys.forEach(k => { els[k].classList.remove('is-moving'); els[k].removeAttribute('data-move'); });
  document.body.classList.remove('is-moving');
  if (collapseTo) select(collapseTo, false);   // it was a click after all
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// Clicking the backdrop drops the selection, the way it does on any canvas.
document.querySelector('.stage').addEventListener('pointerdown', e => {
  if (!e.target.closest('.editable')) deselect();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (editing) stopEditing(); else deselect();
});

// A keystroke belongs to whatever has focus. In a panel control the arrows are
// the slider's, and in a block being typed in they are the caret's — so every
// shortcut on the stage has to stand down for both.
const typingInto = () => {
  const el = document.activeElement;
  return !!el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
};

/* ---- nudging with the arrow keys ----
   The pointer places a block, the arrows place it exactly. One unit per press
   in the block's OWN space — artboard pixels on the cover, screen pixels for
   the menu — because that is what every number in the panel already means.
   Shift takes ten, the step this kind of tool always uses.

   The whole selection moves, as it does under a drag. Key repeat does the rest,
   so holding an arrow walks the block along. */
const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
let nudgeTimer = 0;
document.addEventListener('keydown', e => {
  const step = NUDGE[e.key];
  if (!step || !selected.size || editing || typingInto()) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;    // those belong to the browser
  e.preventDefault();
  const by = e.shiftKey ? 10 : 1;
  selected.forEach(k => {
    state[k].x += step[0] * by;
    state[k].y += step[1] * by;
    applyMove(k);
  });
  placeFrame();
  // The panel has no x/y field, so the block's own tag is the read-out. Held
  // rather than flashed, and cleared a beat after the last press — on the
  // element captured now, because the primary may have moved on by then.
  const tagged = els[primary], c = state[primary];
  tagged.dataset.move = `   ${signed(c.x)}, ${signed(c.y)}`;
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => tagged.removeAttribute('data-move'), 900);
});

/* ============================ backgrounds ============================ */
function gradURL(draw) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
  draw(c.getContext('2d'), c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}
function linear(angle, stops) {
  return gradURL((g,w,h) => {
    const a = angle*Math.PI/180, x = Math.cos(a), y = Math.sin(a);
    const grd = g.createLinearGradient(w/2-x*w/2, h/2-y*h/2, w/2+x*w/2, h/2+y*h/2);
    stops.forEach(([o,col]) => grd.addColorStop(o, col));
    g.fillStyle = grd; g.fillRect(0,0,w,h);
  });
}
function mesh(base, blobs) {
  return gradURL((g,w,h) => {
    g.fillStyle = base; g.fillRect(0,0,w,h);
    g.globalCompositeOperation = 'lighter';
    blobs.forEach(([cx,cy,rad,col]) => {
      const rg = g.createRadialGradient(cx*w,cy*h,0, cx*w,cy*h,rad*w);
      rg.addColorStop(0,col); rg.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0,0,w,h);
    });
  });
}
const BG_PRESETS = [
  { name:'indigo',  url: linear(135, [[0,'#1e1b4b'],[0.5,'#4338ca'],[1,'#0f172a']]) },
  { name:'sunset',  url: linear(120, [[0,'#fde68a'],[0.45,'#f97316'],[1,'#7c2d12']]) },
  { name:'teal',    url: linear(160, [[0,'#0d9488'],[0.6,'#0f3d4a'],[1,'#020617']]) },
  { name:'charcoal',url: mesh('#0b0b0d', [[0.25,0.3,0.6,'rgba(80,80,95,.5)'],[0.8,0.8,0.5,'rgba(40,40,55,.6)']]) },
  { name:'cream',   url: linear(160, [[0,'#fdfcf8'],[0.6,'#efe7d8'],[1,'#d8c7a8']]) },
  { name:'plum',    url: mesh('#180a1f', [[0.2,0.2,0.55,'rgba(168,85,247,.55)'],[0.8,0.7,0.55,'rgba(236,72,153,.45)']]) },
  { name:'forest',  url: linear(150, [[0,'#14532d'],[0.6,'#052e16'],[1,'#000']]) },
  { name:'slate',   url: linear(135, [[0,'#64748b'],[0.5,'#334155'],[1,'#0f172a']]) },
];
const bgByName = (n) => (BG_PRESETS.find(p => p.name === n) || BG_PRESETS[0]).url;

/* ---- resolving a background descriptor to a URL ----
   state.bg says WHAT the background is; bgUrl is the URL that says so today.
   Only the descriptor is ever saved. */
let bgUrl = null;
let bgObjectUrl = null;            // an upload's blob: url — deliberately not persisted

// /seed/ rather than ?random=: picsum treats the query as a cache-buster and
// hands back a different photograph every call, so a saved scene would come
// back with the wrong picture. /seed/<s>/ is stable.
const photoURL = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${REF.w}/${REF.h}`;
const newSeed = () => Math.random().toString(36).slice(2, 9);

function resolveBg() {
  const bg = state.bg;
  if (bg.kind === 'gradient') return bgByName(bg.preset);
  if (bg.kind === 'image')    return encodeURI(bg.src || '');
  if (bg.kind === 'upload')   return bgObjectUrl || bgByName(null);
  return photoURL(bg.seed);
}
// Takes the descriptor change and the repaint together, because every caller
// wants both and forgetting the second leaves the old picture on screen.
function applyBg(patch) {
  if (patch) Object.assign(state.bg, patch);
  const url = resolveBg();
  if (state.bg.kind !== 'photo') { bgUrl = url; render(); return; }
  // Preload so a dead network shows a gradient rather than the bare backdrop
  // colour. The DESCRIPTOR is left alone: the scene still says which photo it
  // wants, and saving it offline records that rather than the stand-in.
  const im = new Image();
  im.onload  = () => { bgUrl = url; render(); };
  im.onerror = () => { bgUrl = bgByName(null); render(); };
  im.src = url;
}

let lastGrad = -1;
$('bgGradient').addEventListener('click', () => randomGradient());
$('bgUpload').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const prev = bgObjectUrl;                 // revoke the PREVIOUS url, never the new one
  bgObjectUrl = URL.createObjectURL(f);
  applyBg({ kind: 'upload' });
  if (prev) URL.revokeObjectURL(prev);
});
function loadRandomPhoto() { applyBg({ kind: 'photo', seed: newSeed() }); }
$('bgPhoto').addEventListener('click', loadRandomPhoto);
function randomGradient() {
  let i; do { i = Math.floor(Math.random()*BG_PRESETS.length); } while (BG_PRESETS.length > 1 && i === lastGrad);
  lastGrad = i;
  applyBg({ kind: 'gradient', preset: BG_PRESETS[i].name });
}
// Randomize the background = a fresh photo. Gradients are a manual-only choice
// (the "Random gradient" button); they're never picked by Randomize.
function randomBg() { loadRandomPhoto(); }

/* ---- static-background effect (toggled from the Background section) ---- */
const FX_DEF = { opacity: 0.12, fps: 24, cell: 2 };
const fxStatic = createStaticBackground({ container: $('fxLayer'), opacity: FX_DEF.opacity, fps: FX_DEF.fps, cellSize: FX_DEF.cell, autostart: false });
$('fx-opacity').value = FX_DEF.opacity; $('fx-opacityV').value = FX_DEF.opacity;
$('fx-fps').value = FX_DEF.fps;         $('fx-fpsV').value = FX_DEF.fps;
$('fx-cell').value = FX_DEF.cell;       $('fx-cellV').value = FX_DEF.cell;
$('fx-enabled').addEventListener('change', e => { $('fx-config').style.display = e.target.checked ? '' : 'none'; fxStatic.toggle(e.target.checked); });
$('fx-opacity').addEventListener('input', e => { fxStatic.set('opacity', +e.target.value); $('fx-opacityV').value = e.target.value; });
$('fx-fps').addEventListener('input',     e => { fxStatic.set('fps', +e.target.value); $('fx-fpsV').value = e.target.value; });
$('fx-cell').addEventListener('input',    e => { fxStatic.set('cellSize', +e.target.value); $('fx-cellV').value = e.target.value; });

// Apply a static-fx config { enabled, opacity?, fps?, cell? } to the instance + UI.
function applyFx(fx) {
  const on = !!(fx && fx.enabled);
  $('fx-enabled').checked = on;
  $('fx-config').style.display = on ? '' : 'none';
  fxStatic.toggle(on);
  if (on) {
    const op = fx.opacity ?? FX_DEF.opacity, fps = fx.fps ?? FX_DEF.fps, cell = fx.cell ?? FX_DEF.cell;
    fxStatic.set('opacity', op); fxStatic.set('fps', fps); fxStatic.set('cellSize', cell);
    $('fx-opacity').value = op;  $('fx-opacityV').value = op;
    $('fx-fps').value = fps;     $('fx-fpsV').value = fps;
    $('fx-cell').value = cell;   $('fx-cellV').value = cell;
  }
}

/* ============================ randomize ============================ */
const rand = (a) => a[Math.floor(Math.random()*a.length)];
const rnd  = (lo,hi,step=1) => { const n = Math.round((lo + Math.random()*(hi-lo))/step)*step; return +n.toFixed(4); };
const HEADING_POOL = FONTS.filter(f => ['display','serif','sans'].includes(f.c));
const BODY_POOL    = FONTS.filter(f => ['sans','serif'].includes(f.c));
const heavy = (f) => { const big = f.w.filter(x=>x>=600); return big.length ? rand(big) : Math.max(...f.w); };

// per-role randomizers (mutate state[role]; honour fontsOnly for the style bits)
function rHeading(fontsOnly) {
  const hf = rand(HEADING_POOL);
  state.heading.font = hf.n; state.heading.weight = heavy(hf);
  state.heading.italic = hf.i && Math.random() < 0.15;
  if (!fontsOnly) {
    state.heading.transform = rand(['none','none','uppercase']);
    state.heading.size = state.heading.transform === 'uppercase' ? rnd(48,110) : rnd(60,150);
    state.heading.ls = state.heading.transform === 'uppercase' ? rnd(0.02,0.12,0.005) : rnd(-0.03,0.01,0.005);
    state.heading.lh = rnd(0.95,1.15,0.01);
    state.heading.align = rand(['left','left','center']);
    state.heading.amount = rnd(2,9);
  }
  loadFont(state.heading.font);
}
function rBody(fontsOnly) {
  const pool = BODY_POOL.filter(f => f.n !== state.heading.font);
  const diff = pool.filter(f => f.c !== byName(state.heading.font).c);
  const bf = rand(diff.length ? diff : pool);
  state.body.font = bf.n; state.body.weight = bf.w.includes(400) ? 400 : rand(bf.w); state.body.italic = false;
  if (!fontsOnly) {
    state.body.size = rnd(15,21); state.body.lh = rnd(1.5,1.85,0.01); state.body.ls = rnd(-0.01,0.01,0.005);
    state.body.columns = rand([1,1,2,2,3]); state.body.transform = 'none'; state.body.align = 'left';
    state.body.amount = rnd(90,340);
  }
  loadFont(state.body.font);
}
function rSub(fontsOnly) {
  const sf = byName(Math.random() < 0.4 ? state.heading.font : state.body.font);
  state.subheading.font = sf.n;
  const mid = sf.w.filter(x => x>=400 && x<=600);
  state.subheading.weight = mid.length ? rand(mid) : rand(sf.w);
  state.subheading.italic = sf.i && Math.random() < 0.2;
  if (!fontsOnly) {
    state.subheading.transform = rand(['none','uppercase','uppercase']);
    state.subheading.ls = state.subheading.transform === 'uppercase' ? rnd(0.08,0.24,0.005) : rnd(-0.01,0.02,0.005);
    state.subheading.size = state.subheading.transform === 'uppercase' ? rnd(13,20) : rnd(18,30);
    state.subheading.lh = rnd(1.2,1.45,0.01);
    state.subheading.align = state.heading.align;
    state.subheading.amount = rnd(6,22);
  }
  loadFont(state.subheading.font);
}
function rTopMenu(fontsOnly) {
  const f = rand(BODY_POOL);            // menus read best in clean text faces
  state.topmenu.font = f.n;
  const mid = f.w.filter(x => x>=400 && x<=700);
  state.topmenu.weight = mid.length ? rand(mid) : rand(f.w);
  if (!fontsOnly) {
    state.topmenu.transform = rand(['none','uppercase','uppercase']);
    state.topmenu.size = rnd(12,18);
    state.topmenu.ls = state.topmenu.transform === 'uppercase' ? rnd(0.04,0.18,0.005) : rnd(0,0.03,0.005);
    state.topmenu.align = rand(['spread','spread','left','center']);
    state.topmenu.links = rnd(3,6);
    state.topmenu.gap = rnd(16,44);
  }
  loadFont(state.topmenu.font);
}
const RFN = { heading: rHeading, body: rBody, subheading: rSub, topmenu: rTopMenu };

// Randomize the static-fx layer: only the on/off is random (1-in-3 chance on);
// when on it uses the standard FX_DEF params, not random ones.
function randomizeFx() { applyFx({ enabled: Math.random() < 1/3 }); }

// The pattern overlay, rolled with the rest of the backdrop. Off most of the
// time: 87 textures make a striking cover now and then and a busy one if they
// turn up on every roll. Rotation in right angles only, because a tile turned
// 37 degrees rarely reads as anything.
function randomPattern() {
  const p = state.pattern;
  p.enabled = Math.random() < 1/4;
  if (!p.enabled) return;
  p.name = rand(OVERLAY_PATTERNS).n;
  p.scale = rnd(0.5, 3, 0.1);
  p.opacity = rnd(0.1, 0.4, 0.05);
  p.rotate = rnd(0, 3) * 90;
  p.blend = rand(['normal', 'normal', 'multiply', 'screen', 'overlay']);
  // Against a photograph the tint that reads is a flat one, so black or white
  // rather than a colour that fights whatever is underneath.
  p.color = rand(['#ffffff', '#000000']);
}

// Global randomize — every unlocked section (order matters: body/sub depend on heading).
function randomizeRoles(fontsOnly, skipBg) {
  if (!locks.heading)    rHeading(fontsOnly);
  if (!locks.body)       rBody(fontsOnly);
  if (!locks.subheading) rSub(fontsOnly);
  if (!locks.topmenu)    rTopMenu(fontsOnly);
  if (!fontsOnly) {
    // Back to the grid. This is the start-over button, so it also undoes where
    // blocks have been dragged to — and it is the way back for one dragged
    // clean off the screen, which is otherwise unreachable. Lock a section to
    // keep its placement.
    // Placement is part of the roll now. The container used to arrange the text
    // whatever happened, so randomize never had to think about where it went;
    // with free-standing blocks, a composition nobody places is a composition
    // that always looks the same.
    state.layout.align = rand(['left', 'left', 'center', 'right']);
    state.layout.vAlign = rand(['center', 'center', 'flex-end', 'flex-start']);
    state.layout.colW = rnd(560, 1120, 10);
    restack();
    // title & subtitle use the fixed cover copy + length here (their fonts/sizes still vary)
    if (!locks.heading)    { state.heading.amount = COVER.heading.words; state.heading.transform = 'none'; els.heading.textContent = COVER.heading.text; }
    if (!locks.subheading) { state.subheading.amount = COVER.sub.words;  state.subheading.transform = 'none'; els.subheading.textContent = COVER.sub.text; }
    if (!locks.body)       setText('body');
    if (!locks.bg) {
      if (!skipBg) randomBg();   // bg photo — skipped on load (loadRandomPhoto does the first paint)
      randomizeFx(); randomPattern();   // grain and texture — rolled on load too
    }
  }
  syncInputs(); render();
}

// Randomize just one section (explicit action — ignores its lock).
function randomizeSection(key) {
  if (key === 'bg') { randomBg(); randomizeFx(); randomPattern(); syncPattern(); render(); return; }
  // The plate has nothing to roll — the useful action in its place is refitting
  // it around the text, which is what its section button says it does.
  if (key === 'plate') { state.plate.enabled = true; syncInputs(); render(); plateToText(); return; }
  RFN[key](false);
  if (key !== 'topmenu') setText(key);
  syncInputs(); render();
}

$('randomize').addEventListener('click', () => randomizeRoles(false));
$('randFonts').addEventListener('click', () => randomizeRoles(true));
document.querySelectorAll('[data-rand]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); randomizeSection(b.dataset.rand); }));
$('helpToggle').addEventListener('click', e => {
  const open = $('help').hidden;
  $('help').hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

/* ---- where the window goes when it is minimized ----
   The vector from the window's centre to the maximize button's, written as two
   custom properties the stylesheet animates along. Measured each time, because
   the window can have been dragged anywhere by then.

   offsetLeft/Top rather than getBoundingClientRect: those are LAYOUT boxes and
   ignore transforms, so this measures where the window RESTS rather than where
   the shrink has currently got it to. */
function dockPanel() {
  const panel = $('panel'), show = $('panelShow');
  // The button is display:none while the window is up, so lend it a frame of
  // layout to find out where it is going to be.
  const wasStyle = show.getAttribute('style') || '';
  show.style.display = 'block';
  show.style.visibility = 'hidden';
  const b = show.getBoundingClientRect();
  show.setAttribute('style', wasStyle);

  const cx = panel.offsetLeft + panel.offsetWidth / 2;
  const cy = panel.offsetTop + panel.offsetHeight / 2;
  panel.style.setProperty('--dock-x', Math.round((b.left + b.right) / 2 - cx) + 'px');
  panel.style.setProperty('--dock-y', Math.round((b.top + b.bottom) / 2 - cy) + 'px');
}

$('panelToggle').addEventListener('click', () => {
  dockPanel();
  document.body.classList.add('panel-hidden');
});
// Nothing to recompute here: the window is already sitting on the docked
// transform, so dropping the class plays that same journey backwards. Setting
// the vars again would not help — both happen in one style recalc, so the
// transition would still start from the transform already in effect.
$('panelShow').addEventListener('click', () => document.body.classList.remove('panel-hidden'));

/* ---- the panel is a floating window: drag it by its titlebar ----
   Pointer events rather than mouse ones, so a pen or a touch drags it too, and
   pointer capture so the window keeps following even when the cursor outruns
   the handle. Position is written as left/top the moment a drag starts — the
   panel is anchored to the right edge until then, and the two cannot both be
   set. */
(() => {
  const panel = $('panel'), head = panel.querySelector('.phead');
  let dx = 0, dy = 0, dragging = false;

  // Always leaves the whole window on screen, which is also what keeps the
  // titlebar reachable: drag it off the top and there is no way to get it back.
  const place = (x, y) => {
    const gap = 8, w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.round(Math.max(gap, Math.min(x, innerWidth - w - gap))) + 'px';
    panel.style.top = Math.round(Math.max(gap, Math.min(y, innerHeight - h - gap))) + 'px';
    panel.style.right = 'auto';
  };

  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    place(r.left, r.top);                       // pin to left/top before the first move
    dragging = true;
    panel.classList.add('is-dragging');
    head.setPointerCapture(e.pointerId);
    e.preventDefault();                         // no text selection while dragging
  });
  head.addEventListener('pointermove', e => { if (dragging) place(e.clientX - dx, e.clientY - dy); });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    if (head.hasPointerCapture(e.pointerId)) head.releasePointerCapture(e.pointerId);
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  // Double-click the handle to send it back to its corner.
  head.addEventListener('dblclick', e => {
    if (e.target.closest('button')) return;
    panel.style.left = panel.style.top = panel.style.right = '';
  });

  // A window dropped against the right edge of a wide viewport must not end up
  // outside a narrow one. Only for a panel that has been moved: an untouched
  // one is still anchored by CSS and looks after itself.
  addEventListener('resize', () => {
    if (panel.style.left) place(parseFloat(panel.style.left), parseFloat(panel.style.top));
  });
})();
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !typingInto()) {
    e.preventDefault(); randomizeRoles(false);
  }
});

/* ============================ copy CSS ============================ */
function familyAxis(name){ const f=byName(name); const w=[...f.w].sort((a,b)=>a-b);
  return name.replace(/ /g,'+') + ':' + (f.i ? 'ital,wght@'+w.map(x=>`0,${x}`).concat(w.map(x=>`1,${x}`)).join(';') : 'wght@'+w.join(';')); }
$('copyCss')?.addEventListener('click', async () => {
  const fams = [...new Set([state.heading.font, state.subheading.font, state.body.font])];
  const url = `https://fonts.googleapis.com/css2?${fams.map(f=>'family='+familyAxis(f)).join('&')}&display=swap`;
  const rule = (sel,c) => `${sel} {\n  font-family: '${c.font}', ${FB[byName(c.font).c]};\n  font-weight: ${c.weight};\n  font-style: ${c.italic?'italic':'normal'};\n  font-size: ${c.size}px;\n  line-height: ${c.lh};\n  letter-spacing: ${c.ls}em;\n  text-transform: ${c.transform};${c.columns?`\n  column-count: ${c.columns};`:''}\n}`;
  const css = `/* Google Fonts */\n@import url('${url}');\n\n` +
    rule('h1', state.heading) + '\n\n' + rule('.subheading', state.subheading) + '\n\n' + rule('.body', state.body) + '\n';
  try { await navigator.clipboard.writeText(css); flash('Copied CSS ✓'); }
  catch { flash('Copy blocked — see console'); console.log(css); }
});
function flash(msg){ const b=$('copyCss'); if (!b) return; const t=b.textContent; b.textContent=msg; setTimeout(()=>b.textContent=t,1200); }

/* ============================ curated presets ============================ */
// Hand-picked, deterministic covers. Loaded instead of a random combo when the
// URL carries ?curated  (?curated=N selects preset N; bare ?curated picks one at
// random). Backgrounds use the offline gradient presets by name so a curated
// link looks identical with or without a network connection.
// Each preset is a partial of `state`; unspecified fields keep their defaults.
const CURATED = [
  { name:'Editorial', bg:'curated bk/a4.jpg', scrim:{amount:0.4,color:'dark'}, textColor:'#ffffff',
    heading:{font:'Playfair Display', weight:700, size:104, lh:1.02, ls:-0.02, transform:'none', align:'left'},
    subheading:{font:'Inter', weight:500, size:21, ls:0.16, transform:'uppercase', align:'left'},
    body:{font:'Source Serif 4', weight:400, size:18, lh:1.7, ls:0, columns:2, transform:'none', align:'left', amount:120},
    topmenu:{enabled:true, font:'Inter', weight:500, size:14, ls:0.1, transform:'uppercase', align:'spread', brand:true, links:4},
    fx:{enabled:false} },
  { name:'Brutalist', bg:'curated bk/bk15.jpg', scrim:{amount:0.5,color:'dark'}, textColor:'#ffffff', shadow:true,
    layout:{vAlign:'flex-end', hAlign:'flex-start', width:1070, offX:0, offY:0, cardColor:'#000000', cardA:0.36, cardPad:14},
    heading:{font:'Archivo', weight:900, size:97, lh:0.95, ls:-0.03, italic:false, transform:'uppercase', align:'left'},
    subheading:{font:'Space Grotesk', weight:500, size:36, lh:1.57, ls:0.04, italic:false, transform:'none', align:'left'},
    body:{font:'Inter', weight:300, size:15, lh:1.48, ls:0.005, italic:false, transform:'none', align:'justify', columns:3, amount:160},
    topmenu:{enabled:false, links:5, font:'Space Grotesk', weight:500, size:13, ls:0.12, transform:'uppercase', align:'spread', gap:28, pad:28, color:'#ffffff', brand:false, bg:'#0b0b0d', bgA:0},
    fx:{enabled:true, opacity:0.1, fps:11, cell:2} },
  { name:'Gilded', bg:'curated bk/1000.jpg', scrim:{amount:0.14,color:'dark'}, textColor:'#ffdd00', shadow:true,
    layout:{vAlign:'flex-end', hAlign:'flex-start', width:540, offX:0, offY:0, cardColor:'#000000', cardA:0.44, cardPad:24},
    heading:{font:'Playfair Display', weight:600, size:60, lh:1, ls:-0.005, italic:true, transform:'none', align:'left'},
    subheading:{font:'Playfair Display', weight:600, size:18, lh:1.3, ls:0.16, italic:false, transform:'none', align:'left'},
    body:{font:'Work Sans', weight:400, size:12, lh:1.11, ls:-0.045, italic:false, transform:'none', align:'justify', columns:2, amount:211},
    topmenu:{enabled:true, links:4, font:'Archivo', weight:600, size:12, ls:0.17, transform:'uppercase', align:'center', gap:72, pad:38, color:'#d8ff6b', brand:false, bg:'#0b0b0d', bgA:0},
    pattern:{name:'polka', mode:'overlay', color:'#ffffff', opacity:0, scale:60},
    fx:{enabled:true, opacity:0.07, fps:17, cell:1.5} },
  { name:'Warm display', bg:'curated bk/bk28.jpg', scrim:{amount:0.4,color:'dark'}, textColor:'#ffffff',
    heading:{font:'Fraunces', weight:600, size:96, lh:1.05, ls:-0.01, transform:'none', align:'left'},
    subheading:{font:'Fraunces', weight:400, size:23, ls:0, transform:'none', align:'left'},
    body:{font:'Lora', weight:400, size:18, lh:1.75, ls:0, columns:2, transform:'none', align:'left', amount:120},
    topmenu:{enabled:true, font:'Lora', weight:500, size:15, ls:0.02, transform:'none', align:'left', brand:true, links:4},
    fx:{enabled:false} },
];
function applyPreset(p) {
  for (const k in p) {
    if (k === 'bg' || k === 'fx' || k === 'name' || k === 'layout' || k === 'textColor' || k === 'shadow') continue;
    if (state[k] && typeof state[k] === 'object' && typeof p[k] === 'object') Object.assign(state[k], p[k]);
    else state[k] = p[k];
  }
  /* The presets were written against the shared container: one text colour, one
     shadow switch and one card for the lot. Fan those out to the per-block
     fields they became, rather than rewriting eight presets by hand. */
  if (p.textColor) TYPE_BLOCKS.forEach(k => { state[k].color = p.textColor; });
  if (typeof p.shadow === 'boolean') TYPE_BLOCKS.forEach(k => { state[k].shadow = p.shadow; });
  if (p.topmenu && p.topmenu.color) state.topmenu.color = p.topmenu.color;
  if (p.layout) {
    const L = p.layout;
    if (L.hAlign) state.layout.align = { 'flex-start':'left', center:'center', 'flex-end':'right' }[L.hAlign] || 'left';
    if (L.vAlign) state.layout.vAlign = L.vAlign;
    if (L.width) state.layout.colW = L.width;
    // A card with any opacity becomes a plate; no card means no plate.
    state.plate.enabled = L.cardA > 0;
    if (L.cardA > 0) Object.assign(state.plate, { color: L.cardColor || '#000000', alpha: L.cardA, pad: L.cardPad ?? 14 });
  }
  els.heading.textContent = COVER.heading.text;  state.heading.amount = COVER.heading.words;
  els.subheading.textContent = COVER.sub.text;   state.subheading.amount = COVER.sub.words;
  setText('body');
  restack();
  if (p.bg) {
    // image path → a bundled file; anything else names a gradient preset
    const isImg = /\.(jpe?g|png|webp|avif|gif)$/i.test(p.bg) || p.bg.includes('/');
    applyBg(isImg ? { kind: 'image', src: p.bg, preset: null }
                  : { kind: 'gradient', preset: p.bg, src: null });
  }
  applyFx(p.fx);
  [state.heading.font, state.subheading.font, state.body.font, state.topmenu.font].forEach(loadFont);
  syncInputs(); render();
}

/* ============================ save / load a scene ============================
   The whole point of the artboard: every number below is in artboard units, so
   a scene file describes a composition rather than a window, and reloads the
   same at any size. The reference box travels with the file so changing the
   default later cannot invalidate an old scene.
   ========================================================================== */
// 2: blocks are free-standing. Each owns its x, y, box, colour and shadow,
//    where v1 had a shared container with one text colour, one shadow switch
//    and a card. Nothing maps cleanly, so v1 files are refused rather than
//    half-applied — re-save them from this build.
const SCENE_V = 2;
const SCENES_DIR = 'scenes/';        // where a saved scene is picked up from again
const nameField = () => $('sceneName').value.trim();
const sceneStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

// `kind` decides which of seed/preset/src means anything; the others are stale
// leftovers from whatever the background was before. Write only the live one,
// so a scene file says exactly what it is.
const BG_KEY = { photo: 'seed', gradient: 'preset', image: 'src' };
function bgOut() {
  const b = state.bg, key = BG_KEY[b.kind];
  return { enabled: b.enabled, kind: b.kind, ...(key ? { [key]: b[key] } : {}) };
}

// Static fx has no mirror in `state` — it lives in the instance and its inputs.
const fxOut = () => ({
  enabled: $('fx-enabled').checked,
  opacity: +$('fx-opacity').value,
  fps: +$('fx-fps').value,
  cell: +$('fx-cell').value,
});

function serializeScene() {
  const out = {
    v: SCENE_V,
    name: nameField(),
    ref: { w: REF.w, h: REF.h },
    bg: bgOut(),
    scrim: { ...state.scrim },
    fx: fxOut(),
    shadow: state.shadow,
    textColor: state.textColor,
    layout: { ...state.layout },
    pattern: { ...state.pattern },
    // The copy is edited by hand on the stage, so it is part of the scene, not
    // something `amount` can regenerate.
    text: {
      heading: els.heading.textContent,
      subheading: els.subheading.textContent,
      body: els.body.textContent,
    },
  };
  BLOCKS.forEach(k => { out[k] = { ...state[k] }; });   // all scalars now, so a shallow copy is a whole one
  return out;
}

function applyScene(data) {
  if (!data || typeof data !== 'object') throw new Error('not a scene file');
  if (data.v !== SCENE_V) throw new Error(`scene version ${data.v} is not supported`);
  if (typeof data.name === 'string') $('sceneName').value = data.name;
  if (data.ref) setRef(+data.ref.w, +data.ref.h);
  if (data.bg) Object.assign(state.bg, data.bg);
  if (data.scrim) Object.assign(state.scrim, data.scrim);
  if (data.layout) Object.assign(state.layout, data.layout);
  if (data.plate) Object.assign(state.plate, data.plate);
  if (data.pattern) Object.assign(state.pattern, data.pattern);
  BLOCKS.forEach(k => { if (data[k]) Object.assign(state[k], data[k]); });
  if (data.text) {
    if (typeof data.text.heading === 'string') els.heading.textContent = data.text.heading;
    if (typeof data.text.subheading === 'string') els.subheading.textContent = data.text.subheading;
    if (typeof data.text.body === 'string') els.body.textContent = data.text.body;
  }
  applyFx(data.fx);
  TYPE_BLOCKS.forEach(k => loadFont(state[k].font));
  deselect();
  syncInputs();
  applyBg();                      // resolves the descriptor, then renders
}

const NOTE_DEFAULT = $('sceneNote').textContent;
let noteTimer = 0;
function sceneNote(msg) {
  $('sceneNote').textContent = msg;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { $('sceneNote').textContent = NOTE_DEFAULT; }, 6000);
}

let savedTimer = 0;
function saveScene(btn) {
  const blob = new Blob([JSON.stringify(serializeScene(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = nameField().replace(/[^a-z0-9._ -]+/gi, '').trim().replace(/\s+/g, '-');
  a.download = `scene-${slug || new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  sceneNote(state.bg.kind === 'upload'
    ? 'Saved — but an uploaded background is not stored in the file; it will fall back to a gradient.'
    : `Saved at ${REF.w}×${REF.h} — move it into ${SCENES_DIR} to list it above.`);
  // The note above sits at the bottom of a section that is collapsed by
  // default, so a save from the titlebar has to answer for itself.
  if (btn && btn.id === 'sceneSaveTop') {
    btn.textContent = '✓';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { btn.textContent = '⤓'; }, 1200);
  }
}
// Two ways in: the titlebar, which is always on screen, and the Scene section,
// which is where Load lives and so is where you go looking for the pair.
$('sceneSave').addEventListener('click', e => saveScene(e.currentTarget));
$('sceneSaveTop').addEventListener('click', e => saveScene(e.currentTarget));

/* ---- the scenes folder ----
   A page cannot read a directory, so the list is asked for two ways, in order:

   1. the dev server's own directory listing, parsed for .json links. Zero
      upkeep, which is what makes the folder just work while you are building,
      and it is tried FIRST so the usual path makes no failing request — a
      manifest probe that 404s on every load is console noise you would then
      have to learn to ignore.
   2. scenes/index.json, a manifest — either ["a.json", …] or
      { scenes: [{ file, name }, …] }. Reached whenever no listing is served,
      which is the static-host case: a plain file host, or GitHub Pages, or
      wherever the portfolio ends up embedding this. It is also the only way to
      give a scene a real name rather than its timestamp.

   Neither can watch the folder, hence the refresh button beside the dropdown. */
const getJSON = (url) => fetch(url, { cache: 'no-store' }).then(r => {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
});

// scene-2026-09-21-06-30-11.json -> "2026-09-21 06:30"
function sceneName(file) {
  const base = file.replace(/\.json$/i, '');
  const m = base.match(/^scene-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-\d{2}$/);
  return m ? `${m[1]} ${m[2]}:${m[3]}` : base;
}

async function listScenes() {
  try {
    const res = await fetch(SCENES_DIR, { cache: 'no-store' });
    if (res.ok) {
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const hrefs = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
      const files = hrefs
        .map(h => decodeURIComponent(h.split('/').filter(Boolean).pop() || ''))
        .filter(f => /\.json$/i.test(f) && f !== 'index.json')
        // Names are timestamps, so reverse-alphabetical puts the newest on top.
        .sort((a, b) => b.localeCompare(a));
      // A generated index always links to its parent, and an app's own index
      // page does not — which is how an EMPTY folder is told apart from a host
      // that answers every path with the same page. Without that distinction an
      // empty scenes/ would probe for the manifest and log a 404 on every load.
      const isListing = hrefs.some(h => /(^|\/)\.\.\/?$/.test(h));
      if (files.length || isListing) return files.map(f => ({ file: f, name: sceneName(f) }));
    }
  } catch {}
  try {
    const j = await getJSON(SCENES_DIR + 'index.json');
    const arr = Array.isArray(j) ? j : (j.scenes || []);
    return arr.map(e => typeof e === 'string'
      ? { file: e, name: sceneName(e) }
      : { file: e.file, name: e.name || sceneName(e.file) });
  } catch {}
  return [];
}

/* ---- scenes kept in the browser ----
   A page cannot write into the project, so exporting a file means a trip
   through the downloads folder. That is fine for a keeper and far too much
   ceremony for "let me try this again in a minute", which is what this is for:
   localStorage, one JSON object keyed by name, surviving reloads and restarts.
   Perhaps 3KB a scene against a ~5MB budget, so the count is not worth
   policing. Every access is guarded — storage throws outright in a private
   window, and setItem throws on quota. */
const LS_KEY = 'randomizeStudio.scenes';
function readStore() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function writeStore(map) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); return true; }
  catch (err) { sceneNote(`This browser refused to store it (${err.name}) — use Export instead.`); return false; }
}

/* ---- the dropdown: both sources in one list ----
   Values are prefixed by where they live, because a browser scene and a file
   can carry the same name and they are fetched differently. */
async function refreshScenes(selectValue) {
  const sel = $('sceneList');
  const local = Object.keys(readStore()).sort((a, b) => a.localeCompare(b));
  const files = await listScenes();
  const total = local.length + files.length;

  sel.replaceChildren(new Option(total ? '— pick a scene —' : '— none saved —', ''));
  const group = (label, entries) => {
    if (!entries.length) return;
    const g = document.createElement('optgroup');
    g.label = label;
    // new Option() sets text, not HTML: a name cannot inject markup here.
    entries.forEach(([text, value]) => g.append(new Option(text, value)));
    sel.append(g);
  };
  group('this browser', local.map(n => [n, 'local:' + n]));
  group(SCENES_DIR, files.map(s => [s.name, 'file:' + s.file]));

  sel.disabled = !total;
  if (selectValue) sel.value = selectValue;
  syncSceneButtons();
  return { local: local.length, files: files.length, total };
}

// Only a browser scene can be deleted from here; a file in scenes/ is not ours
// to remove, and nothing in a web page should pretend otherwise.
function syncSceneButtons() {
  $('sceneDelete').disabled = !$('sceneList').value.startsWith('local:');
}

$('sceneList').addEventListener('change', async e => {
  const v = e.target.value;
  syncSceneButtons();
  if (!v) return;
  const id = v.slice(v.indexOf(':') + 1);
  try {
    if (v.startsWith('local:')) {
      const scene = readStore()[id];
      if (!scene) throw new Error('it is no longer in this browser');
      applyScene(scene);
      sceneNote(`Loaded "${id}" from this browser.`);
    } else {
      applyScene(await getJSON(SCENES_DIR + encodeURIComponent(id)));
      sceneNote(`Loaded ${id}.`);
    }
  } catch (err) {
    sceneNote(`Could not load: ${err.message}`);
  }
});

$('sceneStore').addEventListener('click', () => {
  const name = nameField() || sceneStamp();
  const map = readStore();
  const replacing = name in map;
  map[name] = serializeScene();
  if (!writeStore(map)) return;
  $('sceneName').value = name;
  refreshScenes('local:' + name);
  sceneNote(`${replacing ? 'Replaced' : 'Saved'} "${name}" in this browser.`);
});

$('sceneDelete').addEventListener('click', () => {
  const v = $('sceneList').value;
  if (!v.startsWith('local:')) return;
  const name = v.slice(6);
  const map = readStore();
  delete map[name];
  if (!writeStore(map)) return;
  refreshScenes();
  sceneNote(`Deleted "${name}" from this browser.`);
});

$('sceneRefresh').addEventListener('click', async () => {
  const { local, files, total } = await refreshScenes();
  sceneNote(total ? `${local} in this browser, ${files} in ${SCENES_DIR}`
                  : `Nothing saved yet — Save here keeps one in this browser.`);
});
refreshScenes();

$('sceneLoad').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';                    // so re-picking the same file fires again
  if (!f) return;
  try {
    applyScene(JSON.parse(await f.text()));
    sceneNote(`Loaded ${f.name}.`);
  } catch (err) {
    sceneNote(`Could not load: ${err.message}`);
  }
});

/* ============================ init ============================ */
const params = new URLSearchParams(location.search);
if (params.has('curated')) {
  // ?curated → a hand-picked cover (deterministic, offline-safe)
  const n = parseInt(params.get('curated'), 10);
  const preset = Number.isInteger(n)
    ? CURATED[((n % CURATED.length) + CURATED.length) % CURATED.length]
    : CURATED[Math.floor(Math.random() * CURATED.length)];
  applyPreset(preset);
} else {
  // default: a fresh random pairing + a random photo backdrop
  randomizeRoles(false, true);  // randomize fonts & lengths (skip bg — avoids a double random)
  loadRandomPhoto();             // single source for the first-load backdrop (a photo)
}
window.fontLab = { state, REF, render, randomizeRoles, loadRandomPhoto, setText, applyPreset, CURATED,
                   serializeScene, applyScene, fitScene, placeFrame, restack, plateToText }; // handy for console tinkering

/* ============================ scroll bridge ============================ */
// When embedded in an iframe (e.g. the portfolio), wheel events are swallowed
// by this document and never reach the parent's scroll-hijacking navigation.
// Mirror game-dev.ro's ScrollBridge: forward the wheel up via postMessage so
// scrolling over the cover advances the portfolio section. The parent listens
// for { type: 'scroll', deltaY } and calls prev/next section.
// Extra guard vs. the original: let the editor panel scroll natively.
if (window.parent && window.parent !== window) {
  window.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('#panel')) return; // keep the panel scrollable
    e.preventDefault();
    window.parent.postMessage({ type: 'scroll', deltaY: e.deltaY }, '*');
  }, { passive: false });
}
