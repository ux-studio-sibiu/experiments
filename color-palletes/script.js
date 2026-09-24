/* Color Palettes — a playground for 300 community palettes from Adobe Color.
   The working palette is a plain list of hex strings. The hue / saturation /
   lightness sliders shift it on the way to the screen; any direct edit in the
   Colours editor first bakes that shift in, so what the editor shows is always
   what the stage shows. */

const $ = (id) => document.getElementById(id);
const ALL = window.PALETTES;
const TOPICS = ['all', ...new Set(ALL.flatMap((p) => p.topics))];
const MIN_COLORS = 2, MAX_COLORS = 10;

const state = {
  index: 0, topic: 'all', query: '',
  colors: [], hue: 0, sat: 0, light: 0,
  layout: 'stripes', direction: 'columns', labels: true, format: 'css',
};

/* ---------------------------------------------------------------- colour */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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

function shift(hex) {
  if (!state.hue && !state.sat && !state.light) return hex;
  let [h, s, l] = hexToHsl(hex);
  h = (h + state.hue + 360) % 360;
  s = clamp(s * (1 + state.sat / 100), 0, 1);
  l = clamp(l + state.light / 100, 0, 1);
  return hslToHex(h, s, l);
}

// Relative luminance, for picking black or white type on a colour.
function luminance(hex) {
  const c = [0, 2, 4].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const inkOn = (hex) => (luminance(hex) > 0.36 ? '#000' : '#fff');

function normHex(value) {
  const m = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(m)) return m;
  if (/^[0-9a-f]{3}$/.test(m)) return [...m].map((c) => c + c).join('');
  return null;
}

const output = () => state.colors.map(shift);

/* Roles for the sample layout: the lightest colour is the page, the darkest
   the ink, and the two most saturated of the rest are the accents. */
function rolesOf(colors) {
  const idx = colors.map((c, i) => i);
  const byLight = [...idx].sort((a, b) => hexToHsl(colors[b])[2] - hexToHsl(colors[a])[2]);
  const bg = byLight[0], ink = byLight[byLight.length - 1];
  const rest = idx.filter((i) => i !== bg && i !== ink);
  const bySat = [...rest].sort((a, b) => hexToHsl(colors[b])[1] - hexToHsl(colors[a])[1]);
  const accent = bySat[0] ?? ink, accent2 = bySat[1] ?? accent;
  const surface = rest.length > 2 ? byLight.find((i) => rest.includes(i) && i !== accent && i !== accent2) ?? bg : bg;
  return { bg, surface, ink, accent, accent2 };
}

/* ---------------------------------------------------------------- library */

function matches(p) {
  if (state.topic !== 'all' && !p.topics.includes(state.topic)) return false;
  const q = state.query.trim().toLowerCase();
  return !q || [p.name, p.by, ...p.topics, ...p.tags].join(' ').toLowerCase().includes(q);
}
const visible = () => ALL.filter(matches);

function buildTopics() {
  $('topics').innerHTML = TOPICS.map((t) => `<label><input type="radio" name="topic" value="${t}"${t === state.topic ? ' checked' : ''}>${t}</label>`).join('');
  $('topics').addEventListener('change', (e) => { state.topic = e.target.value; buildTiles(); });
}

function buildTiles() {
  const list = visible();
  $('count').textContent = `${list.length}/${ALL.length}`;
  if (!list.length) { $('tiles').innerHTML = '<p class="empty">No palettes match.</p>'; return; }
  $('tiles').replaceChildren(...list.map((p) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.title = `${p.name} — ${p.by}`; btn.dataset.id = p.id;
    btn.setAttribute('aria-label', p.name);
    btn.innerHTML = p.colors.map((c) => `<i style="background:#${c}"></i>`).join('');
    btn.addEventListener('click', () => select(ALL.indexOf(p)));
    return btn;
  }));
  markTile();
}

// Scroll only the tile grid — scrollIntoView would drag the panel along too.
function revealTile() {
  const grid = $('tiles'), tile = grid.querySelector('[aria-pressed="true"]'); if (!tile) return;
  const top = tile.offsetTop, bottom = top + tile.offsetHeight;  // .tiles is the offsetParent
  if (top < grid.scrollTop) grid.scrollTop = top - 4;
  else if (bottom > grid.scrollTop + grid.clientHeight) grid.scrollTop = bottom - grid.clientHeight + 4;
}

function markTile() {
  for (const t of $('tiles').querySelectorAll('button')) t.setAttribute('aria-pressed', +t.dataset.id === ALL[state.index].id);
}

/* ---------------------------------------------------------------- editor */

// Fold the slider shift into the colours themselves, then zero the sliders.
function bake() {
  if (!state.hue && !state.sat && !state.light) return;
  state.colors = output();
  Object.assign(state, { hue: 0, sat: 0, light: 0 });
  syncSliders();
}

function buildEditor() {
  const colors = output(), roles = rolesOf(colors);
  const roleOf = (i) => Object.entries(roles).filter(([, v]) => v === i).map(([k]) => k)[0] || '';
  $('editor').replaceChildren(...colors.map((hex, i) => {
    const row = document.createElement('div');
    row.className = 'crow';
    row.innerHTML = `
      <label class="swatch" style="background:#${hex}" title="Pick a colour"><input type="color" value="#${hex}"></label>
      <input type="text" value="#${hex}" spellcheck="false" aria-label="Colour ${i + 1} hex">
      <span class="role">${roleOf(i)}</span>
      <button class="iconbtn" data-act="up" title="Move earlier"${i === 0 ? ' disabled' : ''}>&uarr;</button>
      <button class="iconbtn" data-act="down" title="Move later"${i === colors.length - 1 ? ' disabled' : ''}>&darr;</button>
      <button class="iconbtn" data-act="remove" title="Remove"${colors.length <= MIN_COLORS ? ' disabled' : ''}>&times;</button>`;
    const picker = row.querySelector('input[type=color]'), text = row.querySelector('input[type=text]');
    const setColor = (hex) => {
      bake(); state.colors[i] = hex;
      row.querySelector('.swatch').style.background = '#' + hex;
      render();
    };
    picker.addEventListener('input', () => { text.value = picker.value; text.classList.remove('is-invalid'); setColor(picker.value.slice(1)); });
    text.addEventListener('input', () => {
      const hex = normHex(text.value);
      text.classList.toggle('is-invalid', !hex);
      if (hex) { picker.value = '#' + hex; setColor(hex); }
    });
    text.addEventListener('change', () => { if (normHex(text.value)) buildEditor(); });
    row.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act; if (!act) return;
      bake();
      const c = state.colors;
      if (act === 'up') [c[i - 1], c[i]] = [c[i], c[i - 1]];
      if (act === 'down') [c[i + 1], c[i]] = [c[i], c[i + 1]];
      if (act === 'remove') c.splice(i, 1);
      buildEditor(); render();
    });
    return row;
  }));
  $('addColor').disabled = colors.length >= MAX_COLORS;
}

// Structural edits: bake, change the list, rebuild.
function restructure(fn) { bake(); fn(state.colors); buildEditor(); render(); }

/* ---------------------------------------------------------------- render */

function render() {
  const p = ALL[state.index], colors = output(), stage = $('stage');

  stage.className = `is-${state.layout}${state.direction === 'rows' ? ' is-rows' : ''}${state.labels ? '' : ' no-labels'}`;

  // Bands are rebuilt only when their count changes, so hovering stays smooth.
  const bands = $('bands');
  if (bands.children.length !== colors.length) {
    bands.replaceChildren(...colors.map((_, i) => {
      const b = document.createElement('div');
      b.className = 'band'; b.dataset.i = i;
      b.innerHTML = '<span class="label"><small></small><b></b></span>';
      return b;
    }));
  }
  colors.forEach((hex, i) => {
    const b = bands.children[i];
    b.style.background = '#' + hex; b.style.setProperty('--fg', inkOn(hex));
    b.querySelector('small').textContent = String(i + 1).padStart(2, '0');
    b.querySelector('b').textContent = '#' + hex;
    b.title = `Copy #${hex}`;
  });

  stage.style.background = state.layout === 'gradient' ? gradient(colors, state.direction === 'rows' ? 180 : 90) : '';

  const r = rolesOf(colors);
  for (const [role, i] of Object.entries(r)) stage.style.setProperty(`--c-${role}`, '#' + colors[i]);
  stage.style.setProperty('--c-on-accent', inkOn(colors[r.accent]));
  $('sampleName').textContent = p.name;
  $('sampleTopic').textContent = p.topics.join(' / ');

  // Row roles follow the colours, so refresh them without rebuilding the rows.
  const rows = $('editor').children;
  if (rows.length === colors.length) {
    const names = Object.entries(r);
    [...rows].forEach((row, i) => {
      row.querySelector('.role').textContent = (names.find(([, v]) => v === i) || [''])[0];
      if (state.hue || state.sat || state.light) {
        row.querySelector('.swatch').style.background = '#' + colors[i];
        row.querySelector('input[type=text]').value = '#' + colors[i];
        row.querySelector('input[type=color]').value = '#' + colors[i];
      }
    });
  }

  $('code').textContent = exportText(colors, p);
  for (const id of ['hue', 'sat', 'light']) $(id + 'V').textContent = (state[id] > 0 ? '+' : '') + state[id];
}

function gradient(colors, angle) {
  const last = colors.length - 1;
  return `linear-gradient(${angle}deg, ${colors.map((c, i) => `#${c} ${Math.round((i / last) * 100)}%`).join(', ')})`;
}

function exportText(colors, p) {
  const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'palette';
  if (state.format === 'hex') return colors.map((c) => '#' + c).join(', ');
  if (state.format === 'json') return JSON.stringify({ name: p.name, by: p.by, colors: colors.map((c) => '#' + c) }, null, 2);
  if (state.format === 'gradient') return `background: ${gradient(colors, 90)};`;
  return `/* ${p.name} — ${p.by} (Adobe Color) */\n:root {\n${colors.map((c, i) => `  --${slug}-${i + 1}: #${c};`).join('\n')}\n}`;
}

/* ---------------------------------------------------------------- select */

function syncSliders() { for (const id of ['hue', 'sat', 'light']) $(id).value = state[id]; }

function select(index) {
  state.index = (index + ALL.length) % ALL.length;
  const p = ALL[state.index];
  Object.assign(state, { colors: [...p.colors], hue: 0, sat: 0, light: 0 });
  syncSliders();
  $('curName').textContent = p.name; $('curName').title = p.name;
  $('curBy').textContent = p.by;
  $('curTags').textContent = [...p.topics, ...p.tags].join(', ');
  history.replaceState(null, '', '#' + p.id);
  markTile();
  revealTile();
  buildEditor();
  render();
}

// Step through the filtered list, so prev / next / random respect the filter.
function step(dir) {
  const list = visible(); if (!list.length) return;
  const at = list.indexOf(ALL[state.index]);
  select(ALL.indexOf(list[(at + dir + list.length) % list.length]));
}

function randomize() {
  const list = visible().filter((p) => p !== ALL[state.index]);
  if (list.length) select(ALL.indexOf(list[Math.floor(Math.random() * list.length)]));
}

/* ---------------------------------------------------------------- misc */

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg; $('toast').classList.add('is-shown');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('is-shown'), 1600);
}

async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); toast(label + ' copied'); }
  catch { toast('Copy failed'); }
}

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

function setRadio(name, value) { const el = document.querySelector(`input[name=${name}][value=${value}]`); if (el) el.checked = true; }

/* ---------------------------------------------------------------- wire up */

for (const id of ['hue', 'sat', 'light']) $(id).addEventListener('input', () => { state[id] = +$(id).value; render(); });
$('resetAdjust').addEventListener('click', () => { Object.assign(state, { hue: 0, sat: 0, light: 0 }); syncSliders(); buildEditor(); render(); });
$('resetColors').addEventListener('click', () => select(state.index));
$('addColor').addEventListener('click', () => restructure((c) => {
  const [h, s, l] = hexToHsl(c[c.length - 1]);
  c.push(hslToHex(h, s, l > 0.5 ? l - 0.18 : l + 0.18));
}));
$('reverse').addEventListener('click', () => restructure((c) => c.reverse()));
$('shuffle').addEventListener('click', () => restructure((c) => { for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } }));
$('sortLight').addEventListener('click', () => restructure((c) => c.sort((a, b) => hexToHsl(b)[2] - hexToHsl(a)[2])));

$('search').addEventListener('input', (e) => { state.query = e.target.value; buildTiles(); });
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('randomize').addEventListener('click', randomize);

$('layout').addEventListener('change', (e) => { state.layout = e.target.value; render(); });
$('direction').addEventListener('change', (e) => { state.direction = e.target.value; render(); });
$('showLabels').addEventListener('change', (e) => { state.labels = e.target.checked; render(); });
$('format').addEventListener('change', (e) => { state.format = e.target.value; render(); });
$('copyCode').addEventListener('click', () => copy($('code').textContent, state.format === 'css' ? 'CSS' : state.format.toUpperCase()));
$('bands').addEventListener('click', (e) => { const b = e.target.closest('.band'); if (b) copy('#' + output()[+b.dataset.i], '#' + output()[+b.dataset.i]); });

$('panelToggle').addEventListener('click', () => setPanel(false));
$('panelShow').addEventListener('click', () => setPanel(true));
$('helpToggle').addEventListener('click', (e) => {
  const open = $('help').hidden; $('help').hidden = !open; e.currentTarget.setAttribute('aria-expanded', open);
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input[type=text], input[type=range], input[type=color]')) return;
  const layouts = { 1: 'stripes', 2: 'gradient', 3: 'sample' };
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'r' || e.key === 'R') randomize();
  else if (e.key === 'h' || e.key === 'H') setPanel(document.body.classList.contains('panel-hidden'));
  else if (layouts[e.key]) { state.layout = layouts[e.key]; setRadio('layout', state.layout); render(); }
  else return;
  e.preventDefault();
});

dragPanel();
buildTopics();
buildTiles();
const fromHash = ALL.findIndex((p) => String(p.id) === location.hash.slice(1));
select(fromHash >= 0 ? fromHash : Math.floor(Math.random() * ALL.length));
