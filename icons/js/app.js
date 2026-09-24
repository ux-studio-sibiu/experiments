/* Icon Studio — try an icon out before you commit to it.

   The catalogue (js/icons-data.js, generated from sets/) holds each icon's
   markup, so everything here is drawing: one tile at the size you are choosing,
   the same icon down the sizes a UI actually uses, and the whole filtered set
   together. Nothing is fetched and nothing is built.

   The panel is the same chrome as the other playgrounds in this workspace. */

const $ = (id) => document.getElementById(id);
const ICONS = window.ICONS || [];
const SETS = window.ICON_SETS || [];
const byKey = (k) => ICONS.find(i => key(i) === k) || ICONS[0];
const key = (i) => `${i.s}/${i.n}`;

const state = {
  // what the library is showing
  set: 'All', tag: 'All', q: '',
  icon: key(ICONS.find(i => i.n === 'heart') || ICONS[0] || { s: '', n: '' }),
  // the icon itself
  size: 128, color: '#000000', opacity: 1, rotate: 0, flipH: false, flipV: false,
  // the tile around it
  tileBg: '#ffffff', tileBgA: 1, tilePad: 28, tileRadius: 0, tileBorder: 0, tileBorderColor: '#000000', tileShadow: false,
  // the stage under both
  stageBg: '#f4f4f2', checker: false, ladder: true, sheet: false, sheetSize: 28,
};

const hexRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* ---------------------------------------------------------------- drawing */

// One icon, at one size. The markup is the file's own, so what is drawn here is
// what the file draws — only the colour and the box are this studio's doing.
const svgOf = (icon, px, extra = '') =>
  `<svg viewBox="${icon.vb}" width="${px}" height="${px}" xmlns="http://www.w3.org/2000/svg"${extra}>${icon.d}</svg>`;

const TAGS = ['All', ...[...new Set(ICONS.flatMap(i => i.t))].sort()];
const SET_IDS = ['All', ...SETS.map(s => s.id)];

// What the three filters agree on. A search beats the pills when both are set:
// typing a name is a more specific thing to have asked for.
function visible() {
  const q = state.q.trim().toLowerCase();
  return ICONS.filter(i =>
    (state.set === 'All' || i.s === state.set) &&
    (state.tag === 'All' || i.t.includes(state.tag)) &&
    (!q || i.n.includes(q)));
}

/* ---------------------------------------------------------------- the stage */

function paintStage() {
  const s = state, icon = byKey(s.icon);
  $('stage').style.backgroundColor = s.stageBg;
  $('stage').classList.toggle('is-checker', s.checker);

  $('bench').hidden = s.sheet;
  $('sheet').hidden = !s.sheet;
  if (s.sheet) {
    // One size, one colour, every icon the filter is showing: the view that
    // answers whether these belong to the same family.
    $('sheet').innerHTML = visible()
      .map(i => `<div title="${i.n}">${svgOf(i, s.sheetSize)}</div>`).join('');
    $('sheet').style.color = s.color;
    $('sheet').style.opacity = s.opacity;
    return;
  }

  const tile = $('tile');
  tile.style.color = s.color;
  tile.style.opacity = s.opacity;
  tile.style.padding = s.tilePad + 'px';
  tile.style.background = hexRgba(s.tileBg, s.tileBgA);
  tile.style.borderRadius = s.tileRadius + 'px';
  tile.style.border = s.tileBorder ? `${s.tileBorder}px solid ${s.tileBorderColor}` : '0';
  tile.style.boxShadow = s.tileShadow ? '0 18px 40px rgba(0,0,0,.28)' : 'none';
  // The transform is the icon's, not the tile's: rotating the box as well would
  // turn the padding and the corners with it, which is not what a flip means.
  const t = [s.rotate ? `rotate(${s.rotate}deg)` : '', s.flipH ? 'scaleX(-1)' : '', s.flipV ? 'scaleY(-1)' : ''].filter(Boolean).join(' ');
  tile.innerHTML = svgOf(icon, s.size, t ? ` style="transform:${t}"` : '');

  // The sizes interfaces are built from. An icon that holds at 48 and falls
  // apart at 16 is a drawing rather than an icon, and this is where that shows.
  $('ladder').hidden = !s.ladder;
  $('ladder').style.color = s.color;
  $('ladder').style.opacity = s.opacity;
  $('ladder').innerHTML = [16, 20, 24, 32, 48]
    .map(px => `<span class="step">${svgOf(icon, px)}<span class="px">${px}</span></span>`).join('');
}

/* ---------------------------------------------------------------- the panel */

function buildChips(el, values, nameAttr, current) {
  el.innerHTML = values.map(v =>
    `<label><input type="radio" name="${nameAttr}" value="${v}"${v === current ? ' checked' : ''}>${String(v).toLowerCase()}</label>`).join('');
}

function buildGrid() {
  const list = visible();
  $('count').textContent = `${list.length}/${ICONS.length}`;
  $('grid').innerHTML = list.map(i =>
    `<button type="button" data-key="${key(i)}" title="${i.n}" aria-pressed="false">${svgOf(i, 20)}</button>`).join('');
  markIcon();
}

function markIcon() {
  const grid = $('grid');
  let picked = null;
  grid.querySelectorAll('[data-key]').forEach(b => {
    const on = b.dataset.key === state.icon;
    b.setAttribute('aria-pressed', String(on));
    if (on) picked = b;
  });
  // A mark nobody can see is not a mark: the grid scrolls itself rather than
  // scrollIntoView, which would drag the panel along with it.
  if (picked && (picked.offsetTop < grid.scrollTop ||
      picked.offsetTop + picked.offsetHeight > grid.scrollTop + grid.clientHeight))
    grid.scrollTop = picked.offsetTop - (grid.clientHeight - picked.offsetHeight) / 2;

  const icon = byKey(state.icon), set = SETS.find(s => s.id === icon.s);
  $('picked').innerHTML = `<b>${icon.n}</b> &middot; ${icon.t.join(', ')}`;
  $('credit').innerHTML = set
    ? `<b>${set.name}</b> by ${set.by} &middot; ${set.licence} &mdash; <a href="${set.source}" target="_blank" rel="noopener">source</a>. Keep the licence with the files you use.`
    : '';
}

function syncInputs() {
  const s = state;
  $('q').value = s.q;
  $('size').value = s.size;                 $('sizeV').value = s.size + 'px';
  $('color').value = s.color;
  $('opacity').value = s.opacity;           $('opacityV').value = Math.round(s.opacity * 100) + '%';
  $('rotate').value = s.rotate;             $('rotateV').value = s.rotate + '°';
  $('flipH').checked = s.flipH;             $('flipV').checked = s.flipV;
  $('tileBg').value = s.tileBg;
  $('tileBgA').value = s.tileBgA;           $('tileBgAV').value = Math.round(s.tileBgA * 100) + '%';
  $('tilePad').value = s.tilePad;           $('tilePadV').value = s.tilePad + 'px';
  $('tileRadius').value = s.tileRadius;     $('tileRadiusV').value = s.tileRadius + 'px';
  $('tileBorder').value = s.tileBorder;     $('tileBorderV').value = s.tileBorder + 'px';
  $('tileBorderColor').value = s.tileBorderColor;
  $('tileShadow').checked = s.tileShadow;
  $('stageBg').value = s.stageBg;
  $('checker').checked = s.checker;
  $('showLadder').checked = s.ladder;
  $('sheetToggle').checked = s.sheet;
  $('sheetSize').value = s.sheetSize;       $('sheetSizeV').value = s.sheetSize + 'px';
}

function render() { paintStage(); $('code').textContent = exportSvg(); }

/* ---------------------------------------------------------------- export */

// A standalone file: the size and colour you set, baked in, since an icon
// pasted into a project should look like the one you were just looking at.
function exportSvg() {
  const s = state, icon = byKey(s.icon);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.vb}" width="${s.size}" height="${s.size}" fill="${s.color}">\n  ${icon.d}\n</svg>`;
}

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('is-shown'), 1600);
}

/* ---------------------------------------------------------------- picking */

function select(k) {
  state.icon = k;
  markIcon();
  render();
  history.replaceState(null, '', '#' + k);
}
// Step through what the filter is showing, so the arrows and the dice agree
// with the grid in front of you.
function step(dir) {
  const list = visible(); if (!list.length) return;
  const at = list.findIndex(i => key(i) === state.icon);
  select(key(list[(at + dir + list.length) % list.length]));
}
function randomize() {
  const list = visible().filter(i => key(i) !== state.icon);
  if (list.length) select(key(list[Math.floor(Math.random() * list.length)]));
}

/* ---------------------------------------------------------------- wiring */

buildChips($('sets'), SET_IDS, 'set', state.set);
buildChips($('tags'), TAGS, 'tag', state.tag);
buildGrid();

$('sets').addEventListener('change', e => { state.set = e.target.value; buildGrid(); });
$('tags').addEventListener('change', e => { state.tag = e.target.value; buildGrid(); });
$('q').addEventListener('input', e => { state.q = e.target.value; buildGrid(); });
$('grid').addEventListener('click', e => {
  const btn = e.target.closest('[data-key]');
  if (btn) select(btn.dataset.key);
});

// Every control writes to state and repaints: one direction, one place that
// knows how a value becomes a pixel.
const bind = (id, prop, read, out) => $(id).addEventListener('input', e => {
  state[prop] = read(e.target);
  if (out) $(out.id).value = out.fmt(state[prop]);
  render();
});
bind('size', 'size', t => +t.value, { id: 'sizeV', fmt: v => v + 'px' });
bind('color', 'color', t => t.value);
bind('opacity', 'opacity', t => +t.value, { id: 'opacityV', fmt: v => Math.round(v * 100) + '%' });
bind('rotate', 'rotate', t => +t.value, { id: 'rotateV', fmt: v => v + '°' });
bind('flipH', 'flipH', t => t.checked);
bind('flipV', 'flipV', t => t.checked);
bind('tileBg', 'tileBg', t => t.value);
bind('tileBgA', 'tileBgA', t => +t.value, { id: 'tileBgAV', fmt: v => Math.round(v * 100) + '%' });
bind('tilePad', 'tilePad', t => +t.value, { id: 'tilePadV', fmt: v => v + 'px' });
bind('tileRadius', 'tileRadius', t => +t.value, { id: 'tileRadiusV', fmt: v => v + 'px' });
bind('tileBorder', 'tileBorder', t => +t.value, { id: 'tileBorderV', fmt: v => v + 'px' });
bind('tileBorderColor', 'tileBorderColor', t => t.value);
bind('tileShadow', 'tileShadow', t => t.checked);
bind('stageBg', 'stageBg', t => t.value);
bind('checker', 'checker', t => t.checked);
bind('showLadder', 'ladder', t => t.checked);
bind('sheetToggle', 'sheet', t => t.checked);
bind('sheetSize', 'sheetSize', t => +t.value, { id: 'sheetSizeV', fmt: v => v + 'px' });

$('randomize').addEventListener('click', randomize);
$('copySvg').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(exportSvg()); toast('SVG copied'); }
  catch { toast('Copy failed — select the code below'); }
});
$('downloadSvg').addEventListener('click', () => {
  const icon = byKey(state.icon);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([exportSvg()], { type: 'image/svg+xml' }));
  a.download = `${icon.n}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('SVG saved');
});

const setPanel = (shown) => document.body.classList.toggle('panel-hidden', !shown);
$('panelToggle').addEventListener('click', () => setPanel(false));
$('panelShow').addEventListener('click', () => setPanel(true));
$('helpToggle').addEventListener('click', e => {
  const open = $('help').hidden;
  $('help').hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches('input, textarea, select')) return;   // typing in the search field is not a shortcut
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'r' || e.key === 'R') randomize();
  else if (e.key === 'h' || e.key === 'H') setPanel(document.body.classList.contains('panel-hidden'));
  else return;
  e.preventDefault();
});

// The panel is a floating window: drag it by its titlebar, like the others.
(() => {
  const panel = $('panel'), head = $('phead');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || matchMedia('(max-width: 600px)').matches) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    panel.classList.add('is-dragging'); head.setPointerCapture(e.pointerId);
    const move = ev => {
      panel.style.left = clamp(ev.clientX - dx, 0, innerWidth - r.width) + 'px';
      panel.style.top = clamp(ev.clientY - dy, 0, innerHeight - 38) + 'px';
      panel.style.right = 'auto';
    };
    const up = () => { panel.classList.remove('is-dragging'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  });
})();

/* ---------------------------------------------------------------- init */

const fromHash = decodeURIComponent(location.hash.slice(1));
if (fromHash && ICONS.some(i => key(i) === fromHash)) state.icon = fromHash;
syncInputs();
markIcon();
render();
window.iconLab = { state, ICONS, SETS, render, select, visible, exportSvg };
