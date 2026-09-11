/* font-experiments app logic.
   Depends on (loaded first, as plain <script>s): fonts.js (FONTS/byName/loadFont…)
   and static-background.js (createStaticBackground). */

/* ============================ state ============================ */
const state = {
  bg: { url: null, fit: 'cover', preset: 0 },
  scrim: { amount: 0.35, color: 'dark' },
  shadow: true,
  layout: { vAlign: 'center', hAlign: 'flex-start', width: 940, offX: 0, offY: 0, cardColor: '#000000', cardA: 0, cardPad: 0 },
  textColor: '#ffffff',
  heading:    { font:'Playfair Display', weight:700, size:96, lh:1.04, ls:-0.01, italic:false, transform:'none', align:'left', amount:5 },
  subheading: { font:'Inter',           weight:500, size:22, lh:1.35, ls:0.18,  italic:false, transform:'uppercase', align:'left', amount:11 },
  body:       { font:'Inter',           weight:400, size:18, lh:1.7,  ls:0,     italic:false, transform:'none', align:'left', columns:2, amount:180 },
  topmenu:    { enabled:true, links:4, font:'Inter', weight:500, size:14, ls:0.08, transform:'uppercase', align:'spread', gap:28, pad:28, color:'#ffffff', brand:true, bg:'#0b0b0d', bgA:0 },
};
const locks = { heading:false, subheading:false, body:false, bg:false, topmenu:false };
const ROLES = [['heading','Heading'],['subheading','Subheading'],['body','Body / columns']];
const els = { heading: document.getElementById('heading'), subheading: document.getElementById('subheading'), body: document.getElementById('body') };
const $ = (id) => document.getElementById(id);
// trim trailing zeros for slider value read-outs (e.g. 0.150 -> "0.15", 0 -> "0")
const fmt = (v) => (+v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');

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
      <button class="iconbtn dice" data-rand="${role}" title="Randomize this section">⤨</button>
      <button class="lockbtn lock" data-lock="${role}" aria-pressed="false" title="Lock during randomize">🔓</button></h3>
    <div class="row"><label>length</label><input id="${role}-amount" type="range"><output id="${role}-amountV"></output></div>
    <div class="row" style="grid-template-columns:64px 1fr"><label>font</label><select id="${role}-font">${fontOptionsHTML()}</select></div>
    <div class="row" style="grid-template-columns:64px 1fr"><label>weight</label><div class="chips" id="${role}-weight"></div></div>
    <div class="row"><label>size</label><input id="${role}-size" type="range"><output id="${role}-sizeV"></output></div>
    <div class="row"><label>line-h</label><input id="${role}-lh" type="range" min="0.85" max="2.2" step="0.01"><output id="${role}-lhV"></output></div>
    <div class="row"><label>tracking</label><input id="${role}-ls" type="range" min="-0.06" max="0.4" step="0.005"><output id="${role}-lsV"></output></div>
    ${isBody ? `<div class="row" style="grid-template-columns:64px 1fr"><label>columns</label>
      <div class="chips" id="body-columns">
        <label><input type="radio" name="body-cols" value="1">1</label>
        <label><input type="radio" name="body-cols" value="2">2</label>
        <label><input type="radio" name="body-cols" value="3">3</label>
        <label><input type="radio" name="body-cols" value="4">4</label>
      </div></div>` : ``}
    <div class="row" style="grid-template-columns:60px 1fr"><label>case</label>
      <div class="radios" id="${role}-transform">
        <label title="None"><input type="radio" name="${role}-tf" value="none">Aa</label>
        <label title="UPPERCASE"><input type="radio" name="${role}-tf" value="uppercase">AA</label>
        <label title="lowercase"><input type="radio" name="${role}-tf" value="lowercase">aa</label>
      </div></div>
    <div class="row" style="grid-template-columns:64px 1fr auto"><label>align</label>
      <div class="radios" id="${role}-align">
        <label title="Left"><input type="radio" name="${role}-al" value="left">L</label>
        <label title="Center"><input type="radio" name="${role}-al" value="center">C</label>
        <label title="Right"><input type="radio" name="${role}-al" value="right">R</label>
        ${isBody ? `<label title="Justify"><input type="radio" name="${role}-al" value="justify">J</label>` : ``}
      </div>
      <span style="display:flex; gap:6px; align-items:center; white-space:nowrap"><input id="${role}-italic" type="checkbox"> <label for="${role}-italic">italic</label></span></div>
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
function applyRole(r) {
  const c = state[r], f = byName(c.font), el = els[r];
  loadFont(c.font);
  el.style.fontFamily = `'${c.font}', ${FB[f.c]}`;
  el.style.fontWeight = c.weight;
  el.style.fontStyle = c.italic ? 'italic' : 'normal';
  el.style.fontSize = c.size + 'px';
  el.style.lineHeight = c.lh;
  el.style.letterSpacing = c.ls + 'em';
  el.style.textTransform = c.transform;
  el.style.textAlign = c.align;
  el.style.color = state.textColor;
  if (r === 'body') { el.style.columnCount = c.columns; el.style.columnGap = '2.4em'; }
}
function render() {
  const b = $('bgLayer');
  b.style.backgroundImage = state.bg.url ? `url("${state.bg.url}")` : 'none';
  b.style.backgroundSize = state.bg.fit === 'auto' ? 'auto' : state.bg.fit;
  b.style.backgroundRepeat = state.bg.fit === 'auto' ? 'repeat' : 'no-repeat';
  $('scrim').style.background = (state.scrim.color === 'dark' ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + state.scrim.amount + ')';
  const si = document.querySelector('.stageInner');
  si.style.alignItems = state.layout.vAlign;
  si.style.justifyContent = state.layout.hAlign;
  $('content').style.maxWidth = state.layout.width + 'px';
  $('content').style.transform = `translate(${state.layout.offX}px, ${state.layout.offY}px)`;
  $('content').style.background = state.layout.cardA > 0 ? hexRgba(state.layout.cardColor, state.layout.cardA) : 'transparent';
  $('content').style.padding = state.layout.cardPad + 'px';
  const shadow = state.shadow ? (state.scrim.color === 'dark' ? '0 2px 24px rgba(0,0,0,.55)' : '0 1px 14px rgba(255,255,255,.5)') : 'none';
  ['heading','subheading','body'].forEach(r => { applyRole(r); els[r].style.textShadow = shadow; });
  renderTopMenu(shadow);
}

/* ============================ top menu ============================ */
const MENU_WORDS = ['Work','Studio','About','Journal','Index','Contact','Shop','News','Archive','Projects'];
const MENU_BRAND = '✶ Studio';
const hexRgba = (hex, a) => {
  const h = hex.replace('#',''); const f = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(f, 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
};
function renderTopMenu(shadow) {
  const m = state.topmenu, el = $('topmenu');
  if (!m.enabled) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.style.background = m.bgA > 0 ? hexRgba(m.bg, m.bgA) : 'transparent';
  el.style.padding = m.pad + 'px';
  el.style.gap = m.gap + 'px';
  el.style.justifyContent = m.align === 'spread' ? 'space-between'
    : m.align === 'center' ? 'center' : m.align === 'right' ? 'flex-end' : 'flex-start';
  loadFont(m.font);
  const mk = (t) => { const a = document.createElement('a'); a.href = '#'; a.textContent = t; a.className = 'tm-link'; return a; };
  el.innerHTML = '';
  if (m.brand) { const br = mk(MENU_BRAND); br.classList.add('tm-brand'); el.appendChild(br); }
  const links = document.createElement('div'); links.className = 'tm-links'; links.style.gap = m.gap + 'px';
  for (let i = 0; i < m.links; i++) links.appendChild(mk(MENU_WORDS[i % MENU_WORDS.length]));
  el.appendChild(links);
  const fam = `'${m.font}', ${FB[byName(m.font).c]}`;
  el.querySelectorAll('.tm-link').forEach(a => {
    a.style.fontFamily = fam; a.style.fontWeight = m.weight; a.style.fontSize = m.size + 'px';
    a.style.letterSpacing = m.ls + 'em'; a.style.textTransform = m.transform; a.style.color = m.color;
    a.style.textShadow = shadow || 'none';
  });
  el.querySelectorAll('.tm-brand').forEach(a => { a.style.fontWeight = Math.min(900, (+m.weight) + 200); });
}

/* ============================ sync DOM ← state ============================ */
function setWeightOptions(r) {
  const box = $(`${r}-weight`), f = byName(state[r].font);
  if (!f.w.includes(state[r].weight)) // snap to closest available
    state[r].weight = f.w.reduce((a,x)=> Math.abs(x-state[r].weight) < Math.abs(a-state[r].weight) ? x : a, f.w[0]);
  box.innerHTML = f.w.map(x => `<label><input type="radio" name="${r}-wt" value="${x}"${x===state[r].weight?' checked':''}>${x}</label>`).join('');
  const it = $(`${r}-italic`); it.disabled = !f.i; if (!f.i) state[r].italic = false;
}
$('tm-font').innerHTML = fontOptionsHTML();
function setTmWeight() {
  const box = $('tm-weight'), f = byName(state.topmenu.font);
  if (!f.w.includes(state.topmenu.weight))
    state.topmenu.weight = f.w.reduce((a,x)=> Math.abs(x-state.topmenu.weight) < Math.abs(a-state.topmenu.weight) ? x : a, f.w[0]);
  box.innerHTML = f.w.map(x => `<label><input type="radio" name="tm-wt" value="${x}"${x===state.topmenu.weight?' checked':''}>${x}</label>`).join('');
}
function syncTopMenu() {
  const m = state.topmenu;
  $('tm-enabled').checked = m.enabled;
  $('tm-links').value = m.links;   $('tm-linksV').value = m.links;
  $('tm-font').value = m.font;     setTmWeight();
  $('tm-size').value = m.size;     $('tm-sizeV').value = m.size + 'px';
  $('tm-ls').value = m.ls;         $('tm-lsV').value = fmt(m.ls) + 'em';
  $('tm-transform').querySelectorAll('input').forEach(i => { i.checked = (i.value === m.transform); });
  $('tm-align').querySelectorAll('input').forEach(i => { i.checked = (i.value === m.align); });
  $('tm-gap').value = m.gap;       $('tm-gapV').value = m.gap + 'px';
  $('tm-pad').value = m.pad;       $('tm-padV').value = m.pad + 'px';
  $('tm-brand').checked = m.brand;
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
  });
  $('body-columns').querySelectorAll('input').forEach(i => { i.checked = (+i.value === state.body.columns); });
  $('scrimAmt').value = state.scrim.amount; $('scrimAmtV').value = Math.round(state.scrim.amount*100)+'%';
  $('scrimColor').value = state.scrim.color;
  $('bgFit').value = state.bg.fit;
  $('textColor').value = state.textColor;
  $('cWidth').value = state.layout.width; $('cWidthV').value = state.layout.width + 'px';
  $('vAlign').querySelectorAll('input').forEach(i => { i.checked = (i.value === state.layout.vAlign); });
  $('hAlign').querySelectorAll('input').forEach(i => { i.checked = (i.value === state.layout.hAlign); });
  $('cardColor').value = state.layout.cardColor;
  $('cardA').value = state.layout.cardA;     $('cardAV').value = Math.round(state.layout.cardA*100) + '%';
  $('cardPad').value = state.layout.cardPad; $('cardPadV').value = state.layout.cardPad + 'px';
  $('offX').value = state.layout.offX; $('offXV').value = state.layout.offX + 'px';
  $('offY').value = state.layout.offY; $('offYV').value = state.layout.offY + 'px';
  $('shadow').checked = state.shadow;
  syncTopMenu();
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
});
$('body-columns').addEventListener('change', e => { state.body.columns = +e.target.value; render(); });
$('scrimAmt').addEventListener('input', e => { state.scrim.amount = +e.target.value; $('scrimAmtV').value = Math.round(e.target.value*100)+'%'; render(); });
$('scrimColor').addEventListener('change', e => { state.scrim.color = e.target.value; render(); });
$('bgFit').addEventListener('change', e => { state.bg.fit = e.target.value; render(); });
$('textColor').addEventListener('input', e => { state.textColor = e.target.value; render(); });
$('cWidth').addEventListener('input', e => { state.layout.width = +e.target.value; $('cWidthV').value = e.target.value + 'px'; render(); });
$('vAlign').addEventListener('change', e => { state.layout.vAlign = e.target.value; render(); });
$('hAlign').addEventListener('change', e => { state.layout.hAlign = e.target.value; render(); });
$('cardColor').addEventListener('input', e => { state.layout.cardColor = e.target.value; render(); });
$('cardA').addEventListener('input', e => { state.layout.cardA = +e.target.value; $('cardAV').value = Math.round(e.target.value*100) + '%'; render(); });
$('cardPad').addEventListener('input', e => { state.layout.cardPad = +e.target.value; $('cardPadV').value = e.target.value + 'px'; render(); });
$('offX').addEventListener('input', e => { state.layout.offX = +e.target.value; $('offXV').value = e.target.value + 'px'; render(); });
$('offY').addEventListener('input', e => { state.layout.offY = +e.target.value; $('offYV').value = e.target.value + 'px'; render(); });
$('shadow').addEventListener('change', e => { state.shadow = e.target.checked; render(); });

/* top menu controls */
$('tm-enabled').addEventListener('change', e => { state.topmenu.enabled = e.target.checked; render(); });
$('tm-links').addEventListener('input', e => { state.topmenu.links = +e.target.value; $('tm-linksV').value = e.target.value; render(); });
$('tm-font').addEventListener('change', e => { state.topmenu.font = e.target.value; setTmWeight(); render(); });
$('tm-weight').addEventListener('change', e => { state.topmenu.weight = +e.target.value; render(); });
$('tm-size').addEventListener('input', e => { state.topmenu.size = +e.target.value; $('tm-sizeV').value = e.target.value + 'px'; render(); });
$('tm-ls').addEventListener('input', e => { state.topmenu.ls = +e.target.value; $('tm-lsV').value = fmt(e.target.value) + 'em'; render(); });
$('tm-transform').addEventListener('change', e => { state.topmenu.transform = e.target.value; render(); });
$('tm-align').addEventListener('change', e => { state.topmenu.align = e.target.value; render(); });
$('tm-gap').addEventListener('input', e => { state.topmenu.gap = +e.target.value; $('tm-gapV').value = e.target.value + 'px'; render(); });
$('tm-pad').addEventListener('input', e => { state.topmenu.pad = +e.target.value; $('tm-padV').value = e.target.value + 'px'; render(); });
$('tm-brand').addEventListener('change', e => { state.topmenu.brand = e.target.checked; render(); });
$('tm-color').addEventListener('input', e => { state.topmenu.color = e.target.value; render(); });
$('tm-bg').addEventListener('input', e => { state.topmenu.bg = e.target.value; render(); });
$('tm-bgA').addEventListener('input', e => { state.topmenu.bgA = +e.target.value; $('tm-bgAV').value = Math.round(e.target.value*100) + '%'; render(); });
$('topmenu').addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); });

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
  const t = h.textContent.trim().toLowerCase();
  grp.dataset.section = t.startsWith('subheading') ? 'subheading'
    : t.startsWith('heading') ? 'heading'
    : t.startsWith('body') ? 'body'
    : t.startsWith('top menu') ? 'topmenu'
    : t.startsWith('background') ? 'bg'
    : t.startsWith('layout') ? 'layout' : '';
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
els.heading.addEventListener('click', () => openSection('heading'));
els.subheading.addEventListener('click', () => openSection('subheading'));
els.body.addEventListener('click', () => openSection('body'));
$('topmenu').addEventListener('click', () => openSection('topmenu'));

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
let bgObjectUrl = null;
function setBg(url) {
  if (bgObjectUrl && url !== bgObjectUrl) { URL.revokeObjectURL(bgObjectUrl); bgObjectUrl = null; }
  state.bg.url = url;
  render();
}
let lastGrad = -1;
$('bgGradient').addEventListener('click', () => randomGradient());
$('bgUpload').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const prev = bgObjectUrl;                 // revoke the PREVIOUS url, never the new one
  bgObjectUrl = URL.createObjectURL(f);
  setBg(bgObjectUrl);
  if (prev) URL.revokeObjectURL(prev);
});
let photoSeed = 1;
function loadRandomPhoto() {
  const url = `https://picsum.photos/1600/1000?random=${photoSeed++}`;
  const im = new Image();
  im.onload  = () => setBg(url);
  im.onerror = () => { const i = Math.floor(Math.random()*BG_PRESETS.length); setBg(BG_PRESETS[i].url); }; // offline fallback
  im.src = url;
}
$('bgPhoto').addEventListener('click', loadRandomPhoto);
function randomGradient() {
  let i; do { i = Math.floor(Math.random()*BG_PRESETS.length); } while (BG_PRESETS.length > 1 && i === lastGrad);
  lastGrad = i; setBg(BG_PRESETS[i].url);
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

// Global randomize — every unlocked section (order matters: body/sub depend on heading).
function randomizeRoles(fontsOnly, skipBg) {
  if (!locks.heading)    rHeading(fontsOnly);
  if (!locks.body)       rBody(fontsOnly);
  if (!locks.subheading) rSub(fontsOnly);
  if (!locks.topmenu)    rTopMenu(fontsOnly);
  if (!fontsOnly) {
    // title & subtitle use the fixed cover copy + length here (their fonts/sizes still vary)
    if (!locks.heading)    { state.heading.amount = COVER.heading.words; state.heading.transform = 'none'; els.heading.textContent = COVER.heading.text; }
    if (!locks.subheading) { state.subheading.amount = COVER.sub.words;  state.subheading.transform = 'none'; els.subheading.textContent = COVER.sub.text; }
    if (!locks.body)       setText('body');
    if (!locks.bg) {
      if (!skipBg) randomBg();   // bg photo — skipped on load (loadRandomPhoto does the first paint)
      randomizeFx();             // static fx — rolled on load too
    }
  }
  syncInputs(); render();
}

// Randomize just one section (explicit action — ignores its lock).
function randomizeSection(key) {
  if (key === 'bg') { randomBg(); randomizeFx(); return; }
  RFN[key](false);
  if (key !== 'topmenu') setText(key);
  syncInputs(); render();
}

$('randomize').addEventListener('click', () => randomizeRoles(false));
$('randFonts').addEventListener('click', () => randomizeRoles(true));
document.querySelectorAll('[data-rand]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); randomizeSection(b.dataset.rand); }));
$('panelToggle').addEventListener('click', () => document.body.classList.add('panel-hidden'));
$('panelShow').addEventListener('click', () => document.body.classList.remove('panel-hidden'));
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !document.activeElement.isContentEditable
      && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
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
const bgByName = (n) => (BG_PRESETS.find(p => p.name === n) || BG_PRESETS[0]).url;

function applyPreset(p) {
  for (const k in p) {
    if (k === 'bg' || k === 'fx' || k === 'name') continue;
    if (state[k] && typeof state[k] === 'object' && typeof p[k] === 'object') Object.assign(state[k], p[k]);
    else state[k] = p[k];
  }
  els.heading.textContent = COVER.heading.text;  state.heading.amount = COVER.heading.words;
  els.subheading.textContent = COVER.sub.text;   state.subheading.amount = COVER.sub.words;
  setText('body');
  if (p.bg) {
    const isImg = /\.(jpe?g|png|webp|avif|gif)$/i.test(p.bg) || p.bg.includes('/');
    setBg(isImg ? encodeURI(p.bg) : bgByName(p.bg));  // image path → URL (spaces encoded); else a gradient preset
  }
  applyFx(p.fx);
  [state.heading.font, state.subheading.font, state.body.font, state.topmenu.font].forEach(loadFont);
  syncInputs(); render();
}

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
window.fontLab = { state, render, randomizeRoles, loadRandomPhoto, setText, applyPreset, CURATED }; // handy for console tinkering

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
