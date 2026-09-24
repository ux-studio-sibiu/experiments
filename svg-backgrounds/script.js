/* SVG Backgrounds — a playground for the free svgbackgrounds.com set.
   Every background is plain CSS (window.BACKGROUNDS, from backgrounds.js). The
   edits here — colour swaps, hue/saturation/lightness shift, tile scale — are
   applied to that CSS text itself, so what you see is exactly what Copy CSS
   hands you. */

const $ = (id) => document.getElementById(id);
const ALL = window.BACKGROUNDS;
const HEX_RE = /(%23|#)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-f])/gi;
const MAX_SWATCHES = 16;

const state = { index: 0, tag: 'All', overrides: {}, hue: 0, sat: 0, light: 0, scale: 1, palette: null, palRot: 0 };

/* ---------------------------------------------------------------- colour */

// '#ABC' / 'abcd' / 'aabbcc' -> { key: 'aabbcc', alpha: '' | 'dd' }
function parseHex(h) {
  h = h.toLowerCase();
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  return { key: h.slice(0, 6), alpha: h.slice(6) };
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0');
  return f(0) + f(8) + f(4);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The colour a source colour ends up as: its swap (if any), then the global shift.
function mapColor(key) {
  let hex = state.overrides[key] || key;
  if (state.hue || state.sat || state.light) {
    let [h, s, l] = hexToHsl(hex);
    h = (h + state.hue + 360) % 360;
    s = clamp(s * (1 + state.sat / 100), 0, 1);
    l = clamp(l + state.light / 100, 0, 1);
    hex = hslToHex(h, s, l);
  }
  return hex;
}

const recolor = (text) => text.replace(HEX_RE, (m, pre, hex) => {
  const { key, alpha } = parseHex(hex);
  return pre + mapColor(key) + alpha;
});

// Every colour in a background, base colour first, then the image's by frequency.
function paletteOf(bg) {
  const counts = new Map();
  for (const [, , hex] of (bg.css['background-image'] || '').matchAll(HEX_RE)) {
    const { key } = parseHex(hex);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const base = (bg.css['background-color'] || '').match(/^#([0-9a-f]{3,8})$/i);
  const baseKey = base ? parseHex(base[1]).key : null;
  const keys = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).filter((k) => k !== baseKey);
  return { baseKey, keys };
}

/* ---------------------------------------------------------------- layers */

// Split a background-image value on its top-level commas.
function splitLayers(value) {
  const out = []; let cur = '', depth = 0, quote = null;
  for (const ch of value) {
    if (quote) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function svgOf(layer) {
  const m = layer.match(/^url\(\s*(["']?)data:image\/svg\+xml(?:;utf8)?,([\s\S]*)\1\s*\)$/);
  if (!m) return null;
  try { return decodeURIComponent(m[2]); } catch { return m[2]; }
}

// The intrinsic tile size of each layer, or null when any layer has none —
// a % width, or a cover/contain fit, means there is no tile to scale.
function tileSizes(bg) {
  const fit = bg.css['background-size'];
  if (fit && /cover|contain/.test(fit)) return null;
  const sizes = splitLayers(bg.css['background-image'] || '').map((layer) => {
    const svg = svgOf(layer); if (!svg) return null;
    const root = svg.match(/<svg[^>]*>/); if (!root) return null;
    const w = root[0].match(/\swidth=['"]([\d.]+)(px)?['"]/), h = root[0].match(/\sheight=['"]([\d.]+)(px)?['"]/);
    return w && h ? [+w[1], +h[1]] : null;
  });
  return sizes.length && sizes.every(Boolean) ? sizes : null;
}

/* ---------------------------------------------------------------- css */

// The background's declarations with every edit applied.
function editedCss(bg) {
  const css = { ...bg.css };
  if (css['background-color']) css['background-color'] = recolor(css['background-color']);
  if (css['background-image']) css['background-image'] = recolor(css['background-image']);
  const sizes = tileSizes(bg);
  if (sizes && state.scale !== 1) css['background-size'] = sizes.map(([w, h]) => `${+(w * state.scale).toFixed(1)}px ${+(h * state.scale).toFixed(1)}px`).join(', ');
  return css;
}

function applyCss(el, css) {
  el.removeAttribute('style');
  for (const [prop, value] of Object.entries(css)) el.style.setProperty(prop, value);
}

const cssText = (bg, css) => `.bg-${bg.id} {\n${Object.entries(css).map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`;

/* ---------------------------------------------------------------- tags */

const tagsOf = (bg) => bg.tags.replace('Line Art', 'Line_Art').split(' ').filter(Boolean).map((t) => t.replace('_', ' '));
const TAGS = ['All', ...[...new Set(ALL.flatMap(tagsOf))].sort()];
const visible = () => ALL.filter((bg) => state.tag === 'All' || tagsOf(bg).includes(state.tag));

/* ---------------------------------------------------------------- ui build */

function buildTags() {
  $('tags').innerHTML = TAGS.map((t) => `<label><input type="radio" name="tag" value="${t}"${t === state.tag ? ' checked' : ''}>${t.toLowerCase()}</label>`).join('');
  $('tags').addEventListener('change', (e) => { state.tag = e.target.value; buildTiles(); });
}

function buildTiles() {
  const list = visible();
  $('count').textContent = `${list.length}/${ALL.length}`;
  $('tiles').replaceChildren(...list.map((bg) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.title = bg.name; btn.dataset.id = bg.id;
    btn.setAttribute('aria-label', bg.name);
    const css = { ...bg.css };
    // Big tiles would show one corner of themselves in a 46px thumbnail.
    const sizes = tileSizes(bg);
    if (sizes) { const f = Math.min(0.5, 140 / Math.max(...sizes[0])); css['background-size'] = sizes.map(([w, h]) => `${w * f}px ${h * f}px`).join(', '); }
    applyCss(btn, css);
    btn.addEventListener('click', () => select(ALL.indexOf(bg)));
    return btn;
  }));
  markTile();
}

function markTile() {
  for (const t of $('tiles').children) t.setAttribute('aria-pressed', t.dataset.id === ALL[state.index].id);
}

function buildSwatches() {
  const bg = ALL[state.index];
  const { baseKey, keys } = paletteOf(bg);
  const shown = [...(baseKey ? [baseKey] : []), ...keys].slice(0, MAX_SWATCHES);
  $('swatches').replaceChildren(...shown.map((key) => {
    const label = document.createElement('label');
    label.className = 'swatch' + (key === baseKey ? ' is-base' : '');
    label.title = '#' + key;
    const input = document.createElement('input');
    input.type = 'color'; input.value = '#' + (state.overrides[key] || key);
    input.addEventListener('input', () => { state.overrides[key] = input.value.slice(1); render(); });
    label.append(input);
    return label;
  }));
  const hidden = keys.length + (baseKey ? 1 : 0) - shown.length;
  $('swatchNote').hidden = hidden <= 0;
  $('swatchNote').innerHTML = `<b>+${hidden}</b> more shades in this gradient &mdash; shift them all with <b>hue / saturation / lightness</b>.`;
  paintSwatches();
}

// Swatches show the colour AFTER the global shift, so they match the stage.
function paintSwatches() {
  for (const label of $('swatches').children) {
    const key = label.title.slice(1);
    label.style.background = '#' + mapColor(key);
    label.classList.toggle('is-edited', key in state.overrides);
  }
}

/* ---------------------------------------------------------------- render */

function render() {
  const bg = ALL[state.index];
  const css = editedCss(bg);
  applyCss($('stage'), css);
  $('code').textContent = cssText(bg, css);
  paintSwatches();
  for (const id of ['hue', 'sat', 'light']) $(id + 'V').textContent = (state[id] > 0 ? '+' : '') + state[id];
  $('scaleV').textContent = state.scale.toFixed(2) + '×';
}

/* ---------------------------------------------------------------- set palette */

// The 300 palettes (palettes.js, a copy of ../color-palletes/palettes.js); the block hides itself without them.
const PALETTES = window.PALETTES || [];

const lightness = (hex) => hexToHsl(hex)[2];
function mix(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('');
}

/* Map the background's colours onto the palette by lightness rank: darkest to
   darkest, lightest to lightest. With more source colours than the palette
   has (a 60-shade gradient), they are spread along it and blended between
   neighbours, so a ramp stays a ramp. Rotate cycles which colour goes where. */
function applyPalette() {
  state.overrides = {};
  const pal = PALETTES[state.palette]; if (!pal) return;
  const { baseKey, keys } = paletteOf(ALL[state.index]);
  const src = [...new Set([...(baseKey ? [baseKey] : []), ...keys])].sort((a, b) => lightness(a) - lightness(b));
  const sorted = [...pal.colors].sort((a, b) => lightness(a) - lightness(b)), k = sorted.length;
  const dst = sorted.map((_, i) => sorted[(i + state.palRot) % k]);
  src.forEach((key, i) => {
    const t = src.length === 1 ? 0 : i / (src.length - 1);
    if (src.length <= k) { state.overrides[key] = dst[Math.round(t * (k - 1))]; return; }
    const x = t * (k - 1), j = Math.min(k - 2, Math.floor(x));
    state.overrides[key] = mix(dst[j], dst[j + 1], x - j);
  });
}

function buildPalettePicker() {
  if (!PALETTES.length) { $('setPalette').hidden = true; return; }
  const groups = {};
  PALETTES.forEach((p, i) => (groups[p.topics[0]] ||= []).push(`<option value="${i}">${p.name.replace(/</g, '&lt;')}</option>`));
  $('palPick').innerHTML = '<option value="">none — original colours</option>' +
    Object.entries(groups).map(([t, opts]) => `<optgroup label="${t}">${opts.join('')}</optgroup>`).join('');
}

function paintPaletteStrip() {
  const pal = PALETTES[state.palette];
  $('palPick').value = pal ? String(state.palette) : '';
  $('palStrip').hidden = $('palNote').hidden = !pal;
  $('palRotate').disabled = !pal;
  if (!pal) return;
  $('palStrip').innerHTML = pal.colors.map((c) => `<i style="background:#${c}" title="#${c}"></i>`).join('');
  $('palNote').innerHTML = `<b>${pal.name.replace(/</g, '&lt;')}</b> by ${pal.by.replace(/</g, '&lt;')} &middot; ${pal.topics.join(', ')}`;
}

function setPalette(index) {
  state.palette = index; state.palRot = 0;
  applyPalette(); paintPaletteStrip(); buildSwatches(); render();
}

const randomPalette = () => PALETTES.length && setPalette(Math.floor(Math.random() * PALETTES.length));

function select(index) {
  state.index = (index + ALL.length) % ALL.length;
  const bg = ALL[state.index];
  Object.assign(state, { overrides: {}, hue: 0, sat: 0, light: 0, scale: 1 });
  applyPalette();   // a picked set palette carries over to the next background
  syncSliders();

  const scalable = !!tileSizes(bg);
  $('scale').closest('.row').classList.toggle('is-disabled', !scalable);
  $('scaleNote').hidden = scalable;

  $('curName').textContent = bg.name;
  $('curFit').textContent = scalable ? `tile ${tileSizes(bg).map(([w, h]) => `${w}×${h}`).join(' + ')}` : (bg.css['background-size'] || 'full page');
  $('capName').textContent = bg.name;
  $('capAlt').textContent = bg.alt;
  $('capTags').textContent = tagsOf(bg).join(' · ');
  history.replaceState(null, '', '#' + bg.id);

  buildSwatches();
  markTile();
  revealTile();
  render();
}

// Scroll only the tile grid — scrollIntoView would drag the panel along too.
function revealTile() {
  const grid = $('tiles'), tile = grid.querySelector('[aria-pressed="true"]'); if (!tile) return;
  const top = tile.offsetTop, bottom = top + tile.offsetHeight;  // .tiles is the offsetParent
  if (top < grid.scrollTop) grid.scrollTop = top - 4;
  else if (bottom > grid.scrollTop + grid.clientHeight) grid.scrollTop = bottom - grid.clientHeight + 4;
}

function syncSliders() { for (const id of ['hue', 'sat', 'light', 'scale']) $(id).value = state[id]; }

// Step through the filtered list, so prev / next / random respect the tag.
function step(dir) {
  const list = visible(); if (!list.length) return;
  const at = list.indexOf(ALL[state.index]);
  select(ALL.indexOf(list[(at + dir + list.length) % list.length]));
}

function randomize() {
  const list = visible().filter((bg) => bg !== ALL[state.index]);
  if (list.length) select(ALL.indexOf(list[Math.floor(Math.random() * list.length)]));
}

/* ---------------------------------------------------------------- export */

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg; $('toast').classList.add('is-shown');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('is-shown'), 1600);
}

async function copyCss() {
  try { await navigator.clipboard.writeText($('code').textContent); toast('CSS copied'); }
  catch { toast('Copy failed — select the code below'); }
}

// Downloads the top layer: the pattern itself, with the edits baked in.
function downloadSvg() {
  const bg = ALL[state.index];
  const layers = splitLayers(editedCss(bg)['background-image'] || '');
  const svg = layers.map(svgOf).find(Boolean);
  if (!svg) return toast('No SVG layer');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  a.download = bg.id + '.svg'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(layers.length > 1 ? `SVG saved (layer 1 of ${layers.length})` : 'SVG saved');
}

/* ---------------------------------------------------------------- panel */

function setPanel(shown) { document.body.classList.toggle('panel-hidden', !shown); }

function dragPanel() {
  const panel = $('panel'), head = $('phead');
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || matchMedia('(max-width: 600px)').matches) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    panel.classList.add('is-dragging'); head.setPointerCapture(e.pointerId);
    const move = (ev) => {
      panel.style.left = clamp(ev.clientX - dx, 0, innerWidth - r.width) + 'px';
      panel.style.top = clamp(ev.clientY - dy, 0, innerHeight - 38) + 'px';
      panel.style.right = 'auto';
    };
    const up = () => { panel.classList.remove('is-dragging'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', up);
  });
}

/* ---------------------------------------------------------------- wire up */

for (const id of ['hue', 'sat', 'light', 'scale']) $(id).addEventListener('input', () => { state[id] = +$(id).value; render(); });
$('resetAdjust').addEventListener('click', () => { Object.assign(state, { hue: 0, sat: 0, light: 0, scale: 1 }); syncSliders(); render(); });
$('resetColors').addEventListener('click', () => setPalette(null));
$('palPick').addEventListener('change', (e) => setPalette(e.target.value === '' ? null : +e.target.value));
$('palRandom').addEventListener('click', randomPalette);
$('palRotate').addEventListener('click', () => { state.palRot++; applyPalette(); buildSwatches(); render(); });
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('randomize').addEventListener('click', randomize);
$('copyCss').addEventListener('click', copyCss);
$('downloadSvg').addEventListener('click', downloadSvg);
$('showCaption').addEventListener('change', (e) => $('caption').classList.toggle('is-hidden', !e.target.checked));
$('ink').addEventListener('change', (e) => $('caption').classList.toggle('is-dark', e.target.value === 'dark'));
$('panelToggle').addEventListener('click', () => setPanel(false));
$('panelShow').addEventListener('click', () => setPanel(true));
$('helpToggle').addEventListener('click', (e) => {
  const open = $('help').hidden; $('help').hidden = !open; e.currentTarget.setAttribute('aria-expanded', open);
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input[type=range], input[type=color]')) return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'r' || e.key === 'R') randomize();
  else if (e.key === 'p' || e.key === 'P') randomPalette();
  else if (e.key === 'h' || e.key === 'H') setPanel(document.body.classList.contains('panel-hidden'));
  else return;
  e.preventDefault();
});

dragPanel();
buildTags();
buildTiles();
buildPalettePicker();
paintPaletteStrip();
const fromHash = ALL.findIndex((bg) => bg.id === location.hash.slice(1));
select(fromHash >= 0 ? fromHash : Math.floor(Math.random() * ALL.length));
