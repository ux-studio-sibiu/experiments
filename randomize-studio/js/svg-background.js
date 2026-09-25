/* svg-background — the Dynamic SVG layer.
   The 48 free svgbackgrounds.com backgrounds as a background layer, ported from
   the svg-backgrounds playground: pick one, recolour it swatch by swatch or
   from a 300-palette set, and shift hue / saturation / lightness or the tile
   size for all of it at once.

   Everything lives behind one `SVGBG` object rather than at the top level like
   the rest of the app: this is a whole editor of its own, and it carries names
   the cover already uses (`state`, `render`, `select`). The cover talks to it
   through four methods and nothing else.

   The edits are made to the background's CSS TEXT — every %23rrggbb in the data
   URI is remapped — which is why a recoloured background is still just CSS and
   needs no canvas, no fetch and no SVG parsing.

   Depends on: svg-backgrounds-data.js (BACKGROUNDS), palettes.js (PALETTES),
   state.js, and rand() from randomize.js at roll time. */

const SVGBG = (() => {
  const ALL = window.BACKGROUNDS || [];
  const PALETTES = window.PALETTES || [];
  const layer = $('svgLayer');
  const sub = document.querySelector('.panel [data-section="svgbg"]');
  // Without the catalogue there is no layer to offer, so the section goes away
  // rather than sitting there empty.
  if (!ALL.length || !layer) { if (sub) sub.hidden = true; return { render(){}, sync(){}, roll(){} }; }

  const HEX_RE = /(%23|#)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-f])/gi;
  const MAX_SWATCHES = 16;
  const c = () => state.svgbg;                       // the layer's slice of state
  const byId = (id) => ALL.find(b => b.id === id) || ALL[0];
  let tag = 'All';                                   // a browsing filter, not part of the cover

  /* ---------------------------------------------------------------- colour */

  // '#ABC' / 'abcd' / 'aabbcc' -> { key: 'aabbcc', alpha: '' | 'dd' }
  function parseHex(h) {
    h = h.toLowerCase();
    if (h.length <= 4) h = [...h].map(x => x + x).join('');
    return { key: h.slice(0, 6), alpha: h.slice(6) };
  }
  function hexToHsl(hex) {
    const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2;
    if (max === min) return [0, 0, l];
    const d = max-min, s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    const h = max === r ? (g-b)/d + (g<b ? 6:0) : max === g ? (b-r)/d + 2 : (r-g)/d + 4;
    return [h*60, s, l];
  }
  function hslToHex(h, s, l) {
    const k = (n) => (n + h/30) % 12, a = s * Math.min(l, 1-l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n)-3, 9-k(n), 1)))).toString(16).padStart(2,'0');
    return f(0) + f(8) + f(4);
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // What a source colour ends up as: its swap, if any, then the global shift.
  function mapColor(key) {
    const s = c();
    let hex = s.overrides[key] || key;
    if (s.hue || s.sat || s.light) {
      let [h, sa, l] = hexToHsl(hex);
      h = (h + s.hue + 360) % 360;
      sa = clamp(sa * (1 + s.sat/100), 0, 1);
      l = clamp(l + s.light/100, 0, 1);
      hex = hslToHex(h, sa, l);
    }
    return hex;
  }
  const recolor = (text) => text.replace(HEX_RE, (m, pre, hex) => {
    const { key, alpha } = parseHex(hex);
    return pre + mapColor(key) + alpha;
  });

  // Every colour in a background: the base colour first, then the image's by
  // how often it appears.
  function paletteOf(bg) {
    const counts = new Map();
    for (const [, , hex] of (bg.css['background-image'] || '').matchAll(HEX_RE)) {
      const { key } = parseHex(hex);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const base = (bg.css['background-color'] || '').match(/^#([0-9a-f]{3,8})$/i);
    const baseKey = base ? parseHex(base[1]).key : null;
    const keys = [...counts.entries()].sort((a,b) => b[1]-a[1]).map(([k]) => k).filter(k => k !== baseKey);
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
  function svgOf(l) {
    const m = l.match(/^url\(\s*(["']?)data:image\/svg\+xml(?:;utf8)?,([\s\S]*)\1\s*\)$/);
    if (!m) return null;
    try { return decodeURIComponent(m[2]); } catch { return m[2]; }
  }
  // The natural tile size of each layer, or null when any layer has none — a %
  // width or a cover/contain fit means there is no tile to scale.
  function tileSizes(bg) {
    const fit = bg.css['background-size'];
    if (fit && /cover|contain/.test(fit)) return null;
    const sizes = splitLayers(bg.css['background-image'] || '').map(l => {
      const svg = svgOf(l); if (!svg) return null;
      const root = svg.match(/<svg[^>]*>/); if (!root) return null;
      const w = root[0].match(/\swidth=['"]([\d.]+)(px)?['"]/), h = root[0].match(/\sheight=['"]([\d.]+)(px)?['"]/);
      return w && h ? [+w[1], +h[1]] : null;
    });
    return sizes.length && sizes.every(Boolean) ? sizes : null;
  }

  // The background's declarations with every edit applied.
  function editedCss(bg) {
    const css = { ...bg.css };
    if (css['background-color']) css['background-color'] = recolor(css['background-color']);
    if (css['background-image']) css['background-image'] = recolor(css['background-image']);
    const sizes = tileSizes(bg);
    if (sizes && c().scale !== 1)
      css['background-size'] = sizes.map(([w,h]) => `${+(w*c().scale).toFixed(1)}px ${+(h*c().scale).toFixed(1)}px`).join(', ');
    return css;
  }
  function applyCss(el, css) {
    el.removeAttribute('style');
    for (const [prop, value] of Object.entries(css)) el.style.setProperty(prop, value);
  }

  /* ---------------------------------------------------------------- library */

  const tagsOf = (bg) => bg.tags.replace('Line Art', 'Line_Art').split(' ').filter(Boolean).map(t => t.replace('_',' '));
  const TAGS = ['All', ...[...new Set(ALL.flatMap(tagsOf))].sort()];
  const visible = () => ALL.filter(bg => tag === 'All' || tagsOf(bg).includes(tag));

  function buildTags() {
    $('sv-tags').innerHTML = TAGS.map(t =>
      `<label><input type="radio" name="sv-tag" value="${t}"${t === tag ? ' checked' : ''}>${t.toLowerCase()}</label>`).join('');
  }
  function buildTiles() {
    const list = visible();
    $('sv-count').value = `${list.length}/${ALL.length}`;
    $('sv-tiles').replaceChildren(...list.map(bg => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.title = bg.name; btn.dataset.id = bg.id;
      btn.setAttribute('aria-label', bg.name);
      const css = { ...bg.css };
      // A big tile would show one corner of itself in a 46px thumbnail.
      const sizes = tileSizes(bg);
      if (sizes) {
        const f = Math.min(0.5, 140 / Math.max(...sizes[0]));
        css['background-size'] = sizes.map(([w,h]) => `${w*f}px ${h*f}px`).join(', ');
      }
      applyCss(btn, css);
      return btn;
    }));
    markTile();
  }
  function markTile() {
    for (const t of $('sv-tiles').children) t.setAttribute('aria-pressed', String(t.dataset.id === c().id));
  }
  // Scroll only the tile grid — scrollIntoView would drag the panel with it.
  function revealTile() {
    const grid = $('sv-tiles'), tile = grid.querySelector('[aria-pressed="true"]');
    if (!tile) return;
    const top = tile.offsetTop, bottom = top + tile.offsetHeight;   // .tiles is the offset parent
    if (top < grid.scrollTop) grid.scrollTop = top - 4;
    else if (bottom > grid.scrollTop + grid.clientHeight) grid.scrollTop = bottom - grid.clientHeight + 4;
  }

  /* ---------------------------------------------------------------- swatches */

  function buildSwatches() {
    const { baseKey, keys } = paletteOf(byId(c().id));
    const shown = [...(baseKey ? [baseKey] : []), ...keys].slice(0, MAX_SWATCHES);
    $('sv-swatches').replaceChildren(...shown.map(key => {
      const label = document.createElement('label');
      label.className = 'swatch' + (key === baseKey ? ' is-base' : '');
      label.title = '#' + key;
      const input = document.createElement('input');
      input.type = 'color'; input.value = '#' + (c().overrides[key] || key);
      input.addEventListener('input', () => { c().overrides[key] = input.value.slice(1); paint(); });
      label.append(input);
      return label;
    }));
    const hidden = keys.length + (baseKey ? 1 : 0) - shown.length;
    $('sv-swatchNote').hidden = hidden <= 0;
    $('sv-swatchNote').innerHTML = `<b>+${hidden}</b> more shades in this gradient &mdash; shift them all with <b>hue / saturation / lightness</b>.`;
    paintSwatches();
  }
  // Swatches show the colour AFTER the global shift, so they match the cover.
  function paintSwatches() {
    for (const label of $('sv-swatches').children) {
      const key = label.title.slice(1);
      label.style.background = '#' + mapColor(key);
      label.classList.toggle('is-edited', key in c().overrides);
    }
  }

  /* ---------------------------------------------------------------- palettes */

  const lightness = (hex) => hexToHsl(hex)[2];
  function mix(a, b, t) {
    const ch = (h, i) => parseInt(h.slice(i, i+2), 16);
    return [0,2,4].map(i => Math.round(ch(a,i) + (ch(b,i)-ch(a,i))*t).toString(16).padStart(2,'0')).join('');
  }
  /* Map the background's colours onto the palette by lightness rank: darkest to
     darkest, lightest to lightest. With more source colours than the palette has
     (a 60-shade gradient) they are spread along it and blended between
     neighbours, so a ramp stays a ramp. Rotate cycles which colour goes where. */
  function applyPalette() {
    const s = c();
    s.overrides = {};
    const pal = PALETTES[s.palette]; if (!pal) return;
    const { baseKey, keys } = paletteOf(byId(s.id));
    const src = [...new Set([...(baseKey ? [baseKey] : []), ...keys])].sort((a,b) => lightness(a) - lightness(b));
    const sorted = [...pal.colors].sort((a,b) => lightness(a) - lightness(b)), k = sorted.length;
    const dst = sorted.map((_, i) => sorted[(i + s.palRot) % k]);
    src.forEach((key, i) => {
      const t = src.length === 1 ? 0 : i / (src.length - 1);
      if (src.length <= k) { s.overrides[key] = dst[Math.round(t * (k-1))]; return; }
      const x = t * (k-1), j = Math.min(k-2, Math.floor(x));
      s.overrides[key] = mix(dst[j], dst[j+1], x - j);
    });
  }
  // A palette is its colours, so a cell IS its colours and nothing else: the
  // name lives in the tooltip, which costs no width and lets several palettes
  // sit on a line. 300 names is a list to read; 300 strips is a thing to scan.
  // Topic pills narrow it, the way the library's tags do — which is also why
  // there are no group headings any more.
  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const palTitle = (p) => `${p.name} by ${p.by} · ${p.topics.join(', ')}`;
  const PAL_TOPICS = ['All', ...[...new Set(PALETTES.flatMap(p => p.topics))].sort()];
  let palTag = 'All';
  // The indices of the palettes the pills currently allow — indices, because
  // that is what state stores and what a row carries.
  const visiblePalettes = () =>
    PALETTES.map((p, i) => i).filter(i => palTag === 'All' || PALETTES[i].topics.includes(palTag));

  function buildPaletteTags() {
    $('sv-palTags').innerHTML = PAL_TOPICS.map(t =>
      `<label><input type="radio" name="sv-palTag" value="${esc(t)}"${t === palTag ? ' checked' : ''}>${esc(t.toLowerCase())}</label>`).join('');
  }
  function buildPaletteList() {
    const list = $('sv-palList');
    if (!PALETTES.length) { $('sv-palTags').hidden = list.hidden = true; return; }
    const cell = (i) => {
      const p = PALETTES[i];
      return `<button type="button" data-pal="${i}" aria-pressed="false" title="${esc(palTitle(p))}">` +
             p.colors.map(x => `<i style="background:#${x}"></i>`).join('') + `</button>`;
    };
    // "none" is not one of the 300 and no filter hides it: it is the way back.
    list.innerHTML =
      `<button type="button" class="is-none" data-pal="" aria-pressed="true" title="None — the colours the background was drawn in"></button>` +
      visiblePalettes().map(cell).join('');
    markPalette();
  }
  function markPalette() {
    const i = c().palette, pal = PALETTES[i];
    const list = $('sv-palList');
    let picked = null;
    list.querySelectorAll('[data-pal]').forEach(b => {
      const on = b.dataset.pal === (pal ? String(i) : '');
      b.setAttribute('aria-pressed', String(on));
      if (on) picked = b;
    });
    // Same as the pattern grid: a mark nobody can see is not a mark. The list
    // scrolls itself rather than scrollIntoView, which would drag the panel.
    if (picked) {
      if (picked.offsetTop < list.scrollTop || picked.offsetTop + picked.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = picked.offsetTop - (list.clientHeight - picked.offsetHeight) / 2;
    }
    $('sv-palNote').hidden = !pal;
    $('sv-palRotate').disabled = !pal;
    if (pal) $('sv-palNote').innerHTML = `<b>${esc(pal.name)}</b> by ${esc(pal.by)} &middot; ${esc(pal.topics.join(', '))}`;
  }
  function setPalette(index) {
    Object.assign(c(), { palette: index, palRot: 0 });
    applyPalette(); markPalette(); buildSwatches(); paint();
  }

  /* ---------------------------------------------------------------- picking */

  // Pick a background. Colour edits belong to the one they were made on, so they
  // are dropped — except a palette from the set, which carries over as you
  // browse, the way it does in the svg-backgrounds playground.
  function pick(id) {
    Object.assign(c(), { id, overrides: {}, hue: 0, sat: 0, light: 0, scale: 1 });
    applyPalette();
    sync();
    revealTile();
  }

  /* ---------------------------------------------------------------- render */

  // render() runs on every slider tick anywhere in the panel, and recolouring a
  // 100KB data URI per tick is real work — so it happens only when something
  // this layer cares about has actually changed.
  let lastKey = '';
  function render() {
    const s = c();
    const key = s.enabled ? JSON.stringify(s) : 'off';
    if (key === lastKey) return;
    lastKey = key;
    layer.style.display = s.enabled ? 'block' : 'none';
    if (!s.enabled) return;
    applyCss(layer, editedCss(byId(s.id)));
    layer.style.display = 'block';
  }
  // The panel's own repaint: everything that reads state, plus the cover.
  function paint() { paintSwatches(); render(); }

  /* ---------------------------------------------------------------- sync */

  // state -> panel, for a scene load, a dice roll or anything else that wrote
  // to the layer behind the controls' back.
  function sync() {
    const s = c();
    if (!ALL.some(b => b.id === s.id)) s.id = ALL[0].id;     // a scene naming a background that is gone
    const bg = byId(s.id);
    for (const [id, v] of [['hue', s.hue], ['sat', s.sat], ['light', s.light], ['scale', s.scale]]) $('sv-' + id).value = v;
    for (const id of ['hue', 'sat', 'light']) $(`sv-${id}V`).value = (s[id] > 0 ? '+' : '') + s[id];
    $('sv-scaleV').value = (+s.scale).toFixed(2) + '×';

    // A full-page background has no tile, so there is nothing for scale to do.
    const scalable = !!tileSizes(bg);
    $('sv-scale').closest('.row').classList.toggle('is-disabled', !scalable);
    $('sv-scaleNote').hidden = scalable;

    markTile();
    buildSwatches();
    markPalette();
    render();
  }

  /* ---------------------------------------------------------------- the dice */

  // Like every other layer, this rolls what the background IS and leaves
  // whether it is shown to the eye. The tag filter is respected — narrowing the
  // library is a statement about what you want.
  function roll() {
    const s = c();
    const list = visible();
    Object.assign(s, { id: rand(list).id, hue: 0, sat: 0, light: 0, scale: 1, palRot: 0 });
    // Original colours as often as a palette: these backgrounds were coloured
    // by someone, and a set palette on top of that is an alternative, not a fix.
    const pals = visiblePalettes();
    s.palette = pals.length && Math.random() < 0.5 ? pals[Math.floor(Math.random() * pals.length)] : null;
    applyPalette();
  }

  /* ---------------------------------------------------------------- wiring */

  $('sv-tags').addEventListener('change', e => { tag = e.target.value; buildTiles(); });
  $('sv-tiles').addEventListener('click', e => {
    const tile = e.target.closest('[data-id]');
    if (tile) pick(tile.dataset.id);
  });
  $('sv-resetColors').addEventListener('click', () => setPalette(null));
  $('sv-palList').addEventListener('click', e => {
    const row = e.target.closest('[data-pal]');
    if (row) setPalette(row.dataset.pal === '' ? null : +row.dataset.pal);
  });
  $('sv-palTags').addEventListener('change', e => { palTag = e.target.value; buildPaletteList(); });
  // From what the pills are showing, like the library's dice.
  $('sv-palRandom').addEventListener('click', () => {
    const list = visiblePalettes();
    if (list.length) setPalette(list[Math.floor(Math.random() * list.length)]);
  });
  $('sv-palRotate').addEventListener('click', () => { c().palRot++; applyPalette(); buildSwatches(); paint(); });
  for (const id of ['hue', 'sat', 'light', 'scale']) {
    $('sv-' + id).addEventListener('input', e => {
      c()[id] = +e.target.value;
      $(`sv-${id}V`).value = id === 'scale' ? (+e.target.value).toFixed(2) + '×'
                                            : (e.target.value > 0 ? '+' : '') + e.target.value;
      paint();
    });
  }
  $('sv-resetAdjust').addEventListener('click', () => { Object.assign(c(), { hue: 0, sat: 0, light: 0, scale: 1 }); sync(); });

  buildTags();
  buildTiles();
  buildPaletteTags();
  buildPaletteList();

  return { render, sync, roll, pick };
})();
