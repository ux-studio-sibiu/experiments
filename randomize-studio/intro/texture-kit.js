/* texture-kit — the studio's Dynamic SVG, Pattern and Static FX layers, laid
   over the intro page's own layout elements instead of over the artboard.

   The panel IS the studio's panel: the same markup for those three layers, and
   the studio's own panel.css / controls.css / svg-background.css, loaded
   untouched. They are loaded inside a shadow root, which is what keeps them
   off the page — they style bare `button`, `select` and `input`, and base.css
   styles `body`, none of which the intro page should ever see. The panel
   floats, drags by its titlebar and minimizes to a maximize button the same
   way the studio's does.

   Opt-in and self-removing. Nothing happens until it is opened, with ?texture
   in the URL or Shift+T. Opening loads the studio's catalogues from ../js/
   (the 44 backgrounds, the 300 palettes, the 87 pattern tiles, the grain);
   closing it takes every trace back out:

   - each textured element gets ONE child, a [data-texture-kit] host holding
     the three layers, and its `style` attribute is restored to exactly what it
     was (the kit sets position/isolation on it so the host has a box to fill);
   - grain canvases are destroyed, which also drops their observers and loops;
   - the panel's shadow host and every listener the kit added go.

   What it cannot take back: overlay-patterns.js declares OVERLAY_PATTERNS with
   `const` and static-background.js declares createStaticBackground as a
   function, and a script's top-level declarations cannot be undeclared. Both
   stay on the page, inert, and a second open reuses them rather than loading
   them twice. BACKGROUNDS and PALETTES are `window.` properties, so those are
   copied in here and deleted.

   Nothing is saved. "Copy CSS" writes what is on screen out as ::before /
   ::after rules to paste into intro.css, which is how a texture you like is
   kept. The grain is a canvas and has no CSS form; the export says so. */

(() => {
  const ROOT = '../';
  const DATA = ['js/svg-backgrounds-data.js', 'js/palettes.js', 'js/overlay-patterns.js', 'js/static-background.js'];
  const SHEETS = ['css/panel.css', 'css/controls.css', 'css/svg-background.css'];

  // The page's main layout elements, by the names the panel shows, in the
  // order they sit on a wide screen: the studio on the left, the copy on the
  // right. Anything else can be reached with Pick.
  const PRESETS = [
    ['page', 'body'],
    ['left column', '.showcase'],
    ['stage', '.stage'],
    ['steps', '.steps'],
    ['right column', '.copy'],
  ];
  // Every section of the copy column gets an entry of its own, listed under
  // the column. Read off the page each time, so a section added to index.html
  // shows up without being named here.
  const SECTIONS = '.copy > section';
  // What a section is called in the list: its title if it has one, else its
  // class, else the start of its first line.
  function sectionName(s, i) {
    const text = (s.querySelector('h1, h2')?.textContent || [...s.classList][0] || s.textContent).trim().replace(/\s+/g, ' ');
    // Non-breaking spaces for the indent: an <option> collapses plain ones.
    return `  ${i + 1}. ${(text || 'empty').toLowerCase().slice(0, 32)}`;
  }

  // The layers, keyed the way the studio keys them.
  const LAYERS = ['svgbg', 'pattern', 'fx'];
  const FX_DEF = { opacity: 0.12, fps: 24, cell: 2 };

  /* ============================ loading the catalogues ============================ */

  let lib = null;   // { BACKGROUNDS, PALETTES, PATTERNS, grain } once loaded
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ROOT + src;
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error('could not load ' + src)); };
      document.head.append(s);
    });
  }
  async function loadLib() {
    if (lib) return lib;
    const have = {
      'js/svg-backgrounds-data.js': !!window.BACKGROUNDS,
      'js/palettes.js': !!window.PALETTES,
      'js/overlay-patterns.js': typeof OVERLAY_PATTERNS !== 'undefined',
      'js/static-background.js': typeof createStaticBackground === 'function',
    };
    for (const src of DATA) if (!have[src]) await loadScript(src);
    lib = {
      BACKGROUNDS: window.BACKGROUNDS || [],
      PALETTES: window.PALETTES || [],
      // eslint-disable-next-line no-undef
      PATTERNS: typeof OVERLAY_PATTERNS !== 'undefined' ? OVERLAY_PATTERNS : [],
      // eslint-disable-next-line no-undef
      grain: typeof createStaticBackground === 'function' ? createStaticBackground : null,
    };
    delete window.BACKGROUNDS;
    delete window.PALETTES;
    return lib;
  }

  /* ============================ colour (ported from svg-background.js) ============================ */

  const HEX_RE = /(%23|#)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-f])/gi;
  const MAX_SWATCHES = 16;
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
  const lightness = (hex) => hexToHsl(hex)[2];
  function mix(a, b, t) {
    const ch = (h, i) => parseInt(h.slice(i, i+2), 16);
    return [0,2,4].map(i => Math.round(ch(a,i) + (ch(b,i)-ch(a,i))*t).toString(16).padStart(2,'0')).join('');
  }

  const bgById = (id) => lib.BACKGROUNDS.find(b => b.id === id) || lib.BACKGROUNDS[0];

  function mapColor(s, key) {
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
  const recolor = (s, text) => text.replace(HEX_RE, (m, pre, hex) => {
    const { key, alpha } = parseHex(hex);
    return pre + mapColor(s, key) + alpha;
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
  function editedCss(s) {
    const bg = bgById(s.id), css = { ...bg.css };
    if (css['background-color']) css['background-color'] = recolor(s, css['background-color']);
    if (css['background-image']) css['background-image'] = recolor(s, css['background-image']);
    const sizes = tileSizes(bg);
    if (sizes && s.scale !== 1)
      css['background-size'] = sizes.map(([w,h]) => `${+(w*s.scale).toFixed(1)}px ${+(h*s.scale).toFixed(1)}px`).join(', ');
    // 27 of the 44 come with `background-attachment: fixed`, which on a page
    // that scrolls pins the drawing to the window while the element moves past
    // it. Here it moves with the element unless "fixed to the window" is on -
    // and that box then pins any of them, not only the ones drawn that way.
    css['background-attachment'] = s.fixed ? 'fixed' : 'scroll';
    return css;
  }
  function applyCss(el, css) {
    el.removeAttribute('style');
    for (const [prop, value] of Object.entries(css)) el.style.setProperty(prop, value);
  }
  function applyPalette(s) {
    s.overrides = {};
    const pal = lib.PALETTES[s.palette]; if (!pal) return;
    const { baseKey, keys } = paletteOf(bgById(s.id));
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

  const patternURL = (name) => `${ROOT}overlay-patterns/${encodeURIComponent(name)}.svg`;
  const patternTile = (name) => lib.PATTERNS.find(t => t.n === name) || { w: 20, h: 20 };
  const patternSize = (p) => { const t = patternTile(p.name); return `${Math.max(1, Math.round(t.w * p.scale))}px ${Math.max(1, Math.round(t.h * p.scale))}px`; };

  /* ============================ the textured elements ============================ */

  const rand = (list) => list[Math.floor(Math.random() * list.length)];
  const rnd = (lo, hi, step) => Math.round((lo + Math.random() * (hi - lo)) / step) * step;
  const fmt = (v) => String(+(+v).toFixed(2));

  const entries = new Map();   // element -> entry

  function entryFor(el) {
    if (entries.has(el)) return entries.get(el);
    const entry = {
      el,
      style: el.getAttribute('style'),       // restored verbatim on the way out
      movedPosition: false, onTop: false,
      host: null, grain: null,
      locks: { background: false, svgbg: false, pattern: false, fx: false },
      svgbg:   { enabled: false, id: lib.BACKGROUNDS[0]?.id, overrides: {}, hue: 0, sat: 0, light: 0, scale: 1, palette: null, palRot: 0, fixed: false },
      pattern: { enabled: false, name: 'polka-dots', scale: 1, opacity: 0.35, color: '#000000', blend: 'normal', rotate: 0 },
      fx:      { enabled: false, ...FX_DEF },
      color: null,   // a flat colour under the layers, set from the Background header; null for none
    };
    entries.set(el, entry);
    return entry;
  }

  // The host goes in only once there is something to show, so looking at an
  // element in the panel does not touch it.
  function mount(entry) {
    if (entry.host) return;
    const el = entry.el;
    if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; entry.movedPosition = true; }
    // Its own stacking context, so a z-index of -1 lands above the element's
    // own background and below its content, rather than behind the page.
    el.style.isolation = 'isolate';
    const host = document.createElement('div');
    host.dataset.textureKit = '';
    host.setAttribute('aria-hidden', 'true');
    // Inline styles only, so the kit puts no stylesheet on the page.
    const fill = 'position:absolute;inset:0;pointer-events:none;';
    host.style.cssText = fill + 'overflow:hidden;border-radius:inherit;';
    // The pattern's tile box is a square centred on the element, 142% of its
    // longer side - past its diagonal, so no rotation can turn an edge into
    // view. The studio's 200% x 200% box is enough for a 16:9 artboard, but
    // turned 90 degrees on a short wide band it covers only a strip twice the
    // band's height. The layer is a size container so cqmax can say "longer
    // side".
    host.innerHTML = `<div style="${fill}"></div>` +
      `<div style="${fill}overflow:hidden;container-type:size"><i style="position:absolute;left:50%;top:50%;width:142cqmax;height:142cqmax;display:block"></i></div>` +
      `<div style="${fill}"></div>`;
    el.prepend(host);
    entry.host = host;
  }

  // The element back exactly as it was. The entry's settings survive, so a
  // layer turned back on picks up where it left off.
  function demount(entry) {
    entry.grain?.destroy();
    entry.host?.remove();
    entry.grain = entry.host = null;
    entry.movedPosition = false;
    const el = entry.el;
    if (!entry.style) {
      el.removeAttribute('style');
      // A late write of an empty inline style (seen in testing, not pinned
      // down) would leave style="" behind; an element that had none gets none.
      // A timer rather than a frame: frames do not run in a hidden tab.
      setTimeout(() => { if (!entries.get(el)?.host && el.getAttribute('style') === '') el.removeAttribute('style'); }, 50);
    }
    else el.setAttribute('style', entry.style);
  }

  const FILL = 'position:absolute;inset:0;pointer-events:none;';
  // A textured element: any layer showing, or a flat colour under them.
  const isTextured = (e) => !!e.color || LAYERS.some(l => e[l].enabled);

  function paint(entry) {
    const { svgbg: sv, pattern: pat, fx } = entry;
    if (!sv.enabled && !pat.enabled && !fx.enabled) { demount(entry); paintColor(entry); return; }
    mount(entry);
    paintColor(entry);
    const [sl, pl, fl] = entry.host.children, tile = pl.firstElementChild;
    entry.host.style.zIndex = entry.onTop ? '2' : '-1';

    // Recolouring a 100KB data URI per slider tick is real work, so only when
    // something this layer cares about has changed — as the studio does.
    const key = sv.enabled ? JSON.stringify(sv) : 'off';
    if (sl.dataset.key !== key) {
      sl.dataset.key = key;
      if (sv.enabled) { applyCss(sl, editedCss(sv)); sl.style.cssText = FILL + sl.style.cssText; }
      else sl.style.cssText = FILL + 'display:none';
    }

    pl.style.display = pat.enabled ? '' : 'none';
    if (pat.enabled) {
      const url = `url("${patternURL(pat.name)}")`, size = patternSize(pat);
      tile.style.webkitMaskImage = tile.style.maskImage = url;
      tile.style.webkitMaskSize = tile.style.maskSize = size;
      tile.style.webkitMaskRepeat = tile.style.maskRepeat = 'repeat';
      tile.style.backgroundColor = pat.color;
      tile.style.transform = `translate(-50%, -50%) rotate(${pat.rotate}deg)`;   // centred, then turned
      pl.style.opacity = pat.opacity;
      // No blend control in this panel: the pattern always draws normally.
      pl.style.mixBlendMode = 'normal';
    }

    fl.style.display = fx.enabled ? '' : 'none';
    if (fx.enabled && lib.grain) {
      entry.grain ||= lib.grain({ container: fl, opacity: fx.opacity, fps: fx.fps, cellSize: fx.cell, zIndex: 0, autostart: false });
      entry.grain.set('opacity', fx.opacity).set('fps', fx.fps).set('cellSize', fx.cell).show();
    } else entry.grain?.hide();
  }

  // The flat colour is the element's own background, not a layer in the host:
  // the host sits at z-index -1, over the element's background and under its
  // content, so the colour is always under the three layers - and stays under
  // the content even when they are set over it. The element's style attribute
  // is snapshotted, so closing the kit takes this back out with the rest.
  function paintColor(entry) {
    if (entry.color) entry.el.style.backgroundColor = entry.color;
    else entry.el.style.removeProperty('background-color');
  }

  /* ---- the dice, per layer (ported from randomize.js / svg-background.js) ---- */
  const ROLL = {
    // `palette` given: that palette, with its colours dealt out in a random
    // order (a random rotation, what the rotate button steps through) - the
    // titlebar Randomize hands every element the same one.
    svgbg(e, palette) {
      const s = e.svgbg, list = visibleBgs();
      Object.assign(s, { id: rand(list).id, hue: 0, sat: 0, light: 0, scale: 1, palRot: 0 });
      if (palette != null && lib.PALETTES[palette]) {
        s.palette = palette;
        s.palRot = Math.floor(Math.random() * lib.PALETTES[palette].colors.length);
      } else {
        const pals = visiblePalettes();
        s.palette = pals.length && Math.random() < 0.5 ? rand(pals) : null;
      }
      applyPalette(s);
    },
    pattern(e) {
      Object.assign(e.pattern, {
        // Black at one of four set strengths, so a rolled pattern always
        // reads and never rolls to nothing.
        name: rand(lib.PATTERNS).n, scale: rnd(0.5, 3, 0.1), opacity: rand([0.25, 0.5, 0.75, 1]),
        rotate: rnd(0, 3, 1) * 90, blend: 'normal',
        color: '#000000',
      });
    },
    fx(e) { Object.assign(e.fx, FX_DEF); },
  };

  /* ============================ css export ============================ */

  // A selector that finds the element on the page WITHOUT the kit in it: the
  // host is left out of the sibling count, since it will not be there.
  function selectorFor(el) {
    for (const [, sel] of PRESETS) if (document.querySelector(sel) === el) return sel;
    const parts = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cls = [...n.classList];
      // A class that is unique on the page is the whole anchor: `.copy`, not
      // `div.copy:nth-of-type(1)`.
      const own = cls.length ? '.' + cls.join('.') : '';
      if (own && document.querySelectorAll(own).length === 1) { parts.unshift(own); break; }
      let s = n.tagName.toLowerCase() + own;
      const same = [...n.parentElement.children].filter(c => c.tagName === n.tagName && !c.hasAttribute('data-texture-kit'));
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(n) + 1})`;
      parts.unshift(s);
      if (cls.length && document.querySelectorAll(parts.join(' > ')).length === 1) break;
    }
    return parts.join(' > ') || 'body';
  }

  function cssFor(entry) {
    const { svgbg: sv, pattern: pat, fx } = entry, sel = selectorFor(entry.el), z = entry.onTop ? 2 : -1;
    const decl = (o) => Object.entries(o).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    const layer = { content: '""', position: 'absolute', inset: '0', 'z-index': z, 'pointer-events': 'none' };
    const out = [`${sel} {\n${decl({
      ...(entry.movedPosition ? { position: 'relative' } : {}),
      ...(entry.host ? { isolation: 'isolate' } : {}),
      ...(entry.color ? { 'background-color': entry.color } : {}),
    })}\n}`];
    // Only the pseudo-elements the page is not already using - a section's
    // ::before is the rule above it.
    const free = ['::before', '::after'].filter(p => getComputedStyle(entry.el, p).content === 'none');
    const slot = (what) => free.shift() || (out.push(`/* ${sel}: no free ::before / ::after left for the ${what} - it needs a child element of its own */`), null);
    const svSlot = sv.enabled ? slot('dynamic svg') : null;
    const patSlot = pat.enabled ? slot('pattern') : null;
    if (svSlot) out.push(`${sel}${svSlot} {\n${decl({ ...layer, ...editedCss(sv) })}\n}`);
    if (patSlot) {
      const url = `url("../overlay-patterns/${pat.name}.svg")`, size = patternSize(pat);
      out.push((pat.rotate % 360 ? `/* rotated ${pat.rotate}deg in the kit: a mask cannot turn, so this is unrotated */\n` : '') +
        `${sel}${patSlot} {\n${decl({ ...layer, 'background-color': pat.color,
          '-webkit-mask': `${url} 0 0 / ${size} repeat`, mask: `${url} 0 0 / ${size} repeat`,
          opacity: pat.opacity })}\n}`);
    }
    if (fx.enabled) out.push(`/* ${sel}: static fx is a canvas, not css. createStaticBackground({ container, opacity: ${fx.opacity}, fps: ${fx.fps}, cellSize: ${fx.cell} }) from ../js/static-background.js */`);
    return out.join('\n');
  }

  /* ============================ the panel ============================ */

  // What base.css puts on :root, which a stylesheet inside a shadow root cannot
  // reach — so the tokens the three sheets read are set on the host instead.
  // Values copied from base.css; the icon marks are its Dashicons tokens and
  // the die.
  const TOKENS = `
:host {
  all: initial;
  position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;
  --panel: 356px; --panel-max: 90vh; --panel-gap: 20px;
  --bg: #ffffff; --ink: #000000; --muted: #6b6b6b; --faint: #d4d4d4; --wash: #f4f4f2;
  --ui-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --ui-sans: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --lbl: 76px; --ctl: 22px;
  --icon-randomize: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 118.91 122.88'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M6.41,23.43l49.53,20.15c1.57,0.64,4.17,1.04,5.74,0.4l52.42-21.41c1.57-0.64-0.02-3.49-1.62-4.05L59.62,0 c-0.4-0.14-10.33,3.48-11.72,3.97L4.79,19.38C3.12,19.97,4.26,22.55,6.41,23.43L6.41,23.43z M116.87,94.34l-51.73,28.06 c-1.49,0.81-3.56,0.69-3.56-1.01l-0.01-66.03c0-1.7,0.14-3.36,1.7-4.03l51.92-22.12c1.56-0.66,3.73-0.07,3.72,1.62l-0.34,59.48 C118.56,92,118.36,93.53,116.87,94.34L116.87,94.34z M104.99,71.09c3.52,1.5,4.55,6.77,2.28,11.78c-2.26,5-6.96,7.84-10.48,6.34 c-3.52-1.5-4.55-6.77-2.28-11.78C96.78,72.43,101.47,69.59,104.99,71.09L104.99,71.09z M86.22,57.28c3.65,1.55,4.7,7.01,2.36,12.19 c-2.34,5.18-7.2,8.12-10.85,6.57c-3.65-1.55-4.7-7.01-2.36-12.19C77.71,58.66,82.57,55.72,86.22,57.28L86.22,57.28z M1.81,93.89 l51.26,27.75c1.49,0.81,3.56,0.69,3.56-1.01l0.01-65.42c0-1.7-0.14-3.36-1.7-4.03L3.72,29.22C2.16,28.55,0,29.15,0,30.85 l0.11,59.02C0.11,91.56,0.32,93.08,1.81,93.89L1.81,93.89z M6.91,75.74c3.21-2.04,7.99,0.29,10.66,5.2s2.24,10.56-0.97,12.6 c-3.21,2.04-7.99-0.29-10.66-5.2C3.27,83.42,3.7,77.78,6.91,75.74L6.91,75.74z M22.06,64.37c3.4-2.06,8.45,0.29,11.28,5.26 c2.83,4.97,2.38,10.67-1.02,12.73c-3.4,2.06-8.45-0.29-11.28-5.26C18.2,72.14,18.66,66.44,22.06,64.37L22.06,64.37z M38.12,52.37 c3.42-2.07,8.51,0.29,11.36,5.26c2.85,4.97,2.39,10.68-1.03,12.74c-3.42,2.07-8.51-0.29-11.36-5.26 C34.24,60.14,34.7,54.44,38.12,52.37L38.12,52.37z M59.16,15.48c6.04,0,10.93,2.34,10.93,5.22c0,2.88-4.89,5.22-10.93,5.22 c-6.03,0-10.93-2.34-10.93-5.22C48.23,17.82,53.13,15.48,59.16,15.48L59.16,15.48z'/%3E%3C/svg%3E");
  --icon-eye: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M18.3 9.5C15 4.9 8.5 3.8 3.9 7.2c-1.2.9-2.2 2.1-3 3.4.2.4.5.8.8 1.2 3.3 4.6 9.6 5.6 14.2 2.4.9-.7 1.7-1.4 2.4-2.4.3-.4.5-.8.8-1.2-.3-.4-.5-.8-.8-1.1zm-8.2-2.3c.5-.5 1.3-.5 1.8 0s.5 1.3 0 1.8-1.3.5-1.8 0-.5-1.3 0-1.8zm-.1 7.7c-3.1 0-6-1.6-7.7-4.2C3.5 9 5.1 7.8 7 7.2c-.7.8-1 1.7-1 2.7 0 2.2 1.7 4.1 4 4.1 2.2 0 4.1-1.7 4.1-4v-.1c0-1-.4-2-1.1-2.7 1.9.6 3.5 1.8 4.7 3.5-1.7 2.6-4.6 4.2-7.7 4.2z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-eye-off: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M17.3 3.3c-.4-.4-1.1-.4-1.6 0l-2.4 2.4c-1.1-.4-2.2-.6-3.3-.6-3.8.1-7.2 2.1-9 5.4.2.4.5.8.8 1.2.8 1.1 1.8 2 2.9 2.7L3 16.1c-.4.4-.5 1.1 0 1.6.4.4 1.1.5 1.6 0L17.3 4.9c.4-.5.4-1.2 0-1.6zm-10.6 9l-1.3 1.3c-1.2-.7-2.3-1.7-3.1-2.9C3.5 9 5.1 7.8 7 7.2c-1.3 1.4-1.4 3.6-.3 5.1zM10.1 9c-.5-.5-.4-1.3.1-1.8.5-.4 1.2-.4 1.7 0L10.1 9zm8.2.5c-.5-.7-1.1-1.4-1.8-1.9l-1 1c.8.6 1.5 1.3 2.1 2.2C15.9 13.4 13 15 9.9 15h-.8l-1 1c.7-.1 1.3 0 1.9 0 3.3 0 6.4-1.6 8.3-4.3.3-.4.5-.8.8-1.2-.3-.3-.5-.7-.8-1zM14 10l-4 4c2.2 0 4-1.8 4-4z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-lock: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M15 9h-1V6c0-2.2-1.8-4-4-4S6 3.8 6 6v3H5c-.5 0-1 .5-1 1v7c0 .5.5 1 1 1h10c.5 0 1-.5 1-1v-7c0-.5-.5-1-1-1zm-4 7H9l.4-2.2c-.5-.2-.9-.8-.9-1.3 0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5c0 .6-.3 1.1-.9 1.3L11 16zm1-7H8V6c0-1.1.9-2 2-2s2 .9 2 2v3z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-unlock: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M12 9V6c0-1.1-.9-2-2-2s-2 .9-2 2H6c0-2.21 1.79-4 4-4s4 1.79 4 4v3h1c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H5c-.55 0-1-.45-1-1v-7c0-.55.45-1 1-1h7zm-1 7l-.36-2.15c.51-.24.86-.75.86-1.35 0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5c0 .6.35 1.11.86 1.35L9 16h2z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-undo: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M12 5H7V2L1 6l6 4V7h5c2.2 0 4 1.8 4 4s-1.8 4-4 4H7v2h5c3.3 0 6-2.7 6-6s-2.7-6-6-6z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-redo: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M8 5h5V2l6 4-6 4V7H8c-2.2 0-4 1.8-4 4s1.8 4 4 4h5v2H8c-3.3 0-6-2.7-6-6s2.7-6 6-6z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-minus: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M4 9h12v2H4V9z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-plus: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M17 9v2h-6v6H9v-6H3V9h6V3h2v6h6z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-star: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M10 1l3 6 6 .75-4.12 4.62L16 19l-6-3-6 3 1.13-6.63L1 7.75 7 7z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-download: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M14.01 4v6h2V2H4v8h2.01V4h8zm-2 2v6h3l-5 6-5-6h3V6h4z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-upload: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M8 14V8H5l5-6 5 6h-3v6H8zm-2 2v-6H4v8h12.01v-8H14v6H6z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-db-export: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M9 6c0-1.6.8-3 2-4h-1c-3.9 0-7 .9-7 2 0 1 2.6 1.8 6 2zm1 9c-3.9 0-7-.9-7-2v3c0 1.1 3.1 2 7 2s7-.9 7-2v-3c0 1.1-3.1 2-7 2zm2.8-4.2c-.9.1-1.9.2-2.8.2-3.9 0-7-.9-7-2v3c0 1.1 3.1 2 7 2s7-.9 7-2v-2c-.9.7-1.9 1-3 1-.4 0-.8-.1-1.2-.2zM10 10h1c-1-.7-1.7-1.8-1.9-3C5.7 6.9 3 6 3 5v3c0 1.1 3.1 2 7 2zm4 0c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0-7l3 3h-2v3h-2V6h-2l3-3z'/%3E%3C/g%3E%3C/svg%3E");
  --icon-trash: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg%3E%3Cpath d='M12 4h3c.6 0 1 .4 1 1v1H3V5c0-.6.5-1 1-1h3c.2-1.1 1.3-2 2.5-2s2.3.9 2.5 2zM8 4h3c-.2-.6-.9-1-1.5-1S8.2 3.4 8 4zM4 7h11l-.9 10.1c0 .5-.5.9-1 .9H5.9c-.5 0-.9-.4-1-.9L4 7z'/%3E%3C/g%3E%3C/svg%3E");
}
* { box-sizing: border-box; }

/* panel.css keys minimizing off body.panel-hidden, and there is no body in
   here: the same rules, keyed off the wrapper instead. */
.kit.panel-hidden .panel::before, .kit.panel-hidden .panel::after { display: none; }
.kit.panel-hidden .panel {
  opacity: 0;
  transform: translate(var(--dock-x), var(--dock-y)) scale(.12);
  pointer-events: none; visibility: hidden;
  transition: opacity .2s ease, transform .24s cubic-bezier(.33, 0, .2, 1), visibility 0s linear .24s;
}
.kit.panel-hidden #panelShow { display: block; }

/* The one part of this panel the studio's does not have: which element it is
   editing, and the way out. */
.phead #kitClose { font-size: 15px; line-height: 1; }
.row > button { flex: 0 0 auto; }
textarea {
  display: block; width: 100%; height: 120px; margin-top: 8px; padding: 6px;
  font: 10px/1.45 var(--ui-mono); color: var(--ink); background: var(--bg);
  border: 1px solid var(--ink); border-radius: 0; resize: vertical;
}
textarea[hidden] { display: none; }

/* Tabs, the way an Adobe panel draws them: a hairline under the row, and the
   open tab framed on three sides and joined to the content below it by
   standing over that line in the panel's own paper. The closed ones are
   words in grey. Undoes the shared button look, which would make each tab
   read as a command rather than as a place. */
.tabs { display: flex; gap: 2px; margin: 6px 0 8px; border-bottom: 1px solid var(--ink); }
/* A closed tab sits clear of the hairline, and its hover wash is inset by a
   ring of paper, so it never paints over the rule under the row or the frame
   of the open tab beside it. Only the open tab steps down over the line. */
.tabs button {
  height: 22px; padding: 0 12px;
  background: transparent; color: var(--muted);
  border: 1px solid transparent; border-bottom: 0;
  font-size: 10px; font-weight: 700; letter-spacing: .12em;
}
.tabs button:hover,
.tabs button:active { background: var(--wash); color: var(--ink); border-color: transparent; box-shadow: inset 0 0 0 3px var(--bg); }
.tabs button[aria-selected="true"] {
  margin-bottom: -1px;
  background: var(--bg); color: var(--ink);
  border-color: var(--ink); border-bottom: 1px solid var(--bg);
  box-shadow: none;
}
.tabpane[hidden] { display: none; }

/* What a copy or a paste did: one line in the black band the titlebar is,
   top centre of the window, over everything, gone after a moment. */
.toast {
  position: fixed; top: 16px; left: 50%; transform: translate(-50%, -8px);
  padding: 7px 14px; background: var(--ink); color: var(--bg);
  font: 700 10px/1.4 var(--ui-mono); letter-spacing: .14em; text-transform: uppercase; white-space: nowrap;
  box-shadow: 3px 5px #00000033;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease, transform .18s ease;
}
.toast.is-shown { opacity: 1; transform: translate(-50%, 0); }
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }

/* The flat colour in the Background header: a swatch the size of the dice
   beside it, the colour input laid invisibly over it the way the studio's
   Dynamic SVG swatches are built. No colour is hatched, like the "none"
   palette. It takes the header's push to the right, so the dice after it
   must not take it too. */
.grp h3 .colorbtn {
  position: relative; flex: none; width: 20px; height: 18px; margin-left: auto;
  border: 1px solid var(--ink); cursor: pointer;
  background: repeating-linear-gradient(45deg, var(--bg) 0 3px, var(--faint) 3px 4px);
}
.grp h3 .colorbtn.is-set { background: var(--swatch); }
.grp h3 .colorbtn input { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; opacity: 0; cursor: pointer; }
.grp h3 .colorbtn ~ button { margin-left: 0; }
/* The element being edited: a dashed double rule, ink over paper, so it
   reads over a white column and over a dark texture alike, and a faint wash
   so it is picked out even where the rule runs along the window's edge. */
.outline {
  position: fixed; pointer-events: none; display: none;
  outline: 2px dashed var(--ink); outline-offset: -1px; box-shadow: 0 0 0 1px var(--bg) inset;
  background: #0000000a;
}
/* The one under the pointer, offered rather than chosen: a single solid
   hairline, lighter than the selection so the two are never confused. */
.hover {
  position: fixed; pointer-events: none; display: none;
  outline: 1px solid var(--ink); outline-offset: -1px; box-shadow: 0 0 0 1px var(--bg) inset;
}
`;

  /* The cursors over an element on offer, the one stylesheet the kit puts on
     the page. The eyedropper and the paint bucket are drawn here in the
     studio's ink, with a paper edge so they read over a dark texture too; the
     hotspot is the tip that does the work. Keywords after each are what a
     browser that refuses an SVG cursor shows instead. */
  const cursorURL = (svg, x, y, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
  const EYEDROPPER = cursorURL(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M19.6 2.9a2.2 2.2 0 0 0-3.1 0l-2.6 2.6-1-1-1.6 1.6 1 1-8 8c-.3.3-.5.7-.5 1.1l-.4 2.2L2 20l2 2 1.6-1.4 2.2-.4c.4 0 .8-.2 1.1-.5l8-8 1 1 1.6-1.6-1-1 2.6-2.6a2.2 2.2 0 0 0 0-3.1z' fill='#000' stroke='#fff' stroke-width='1.2' stroke-linejoin='round'/></svg>`,
    2, 22, 'copy');
  const BUCKET = cursorURL(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M10 3 3 10l8 8 7-7z' fill='#000' stroke='#fff' stroke-width='1.2' stroke-linejoin='round'/><path d='M20 14s2.2 2.6 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.5 2.2-4.1 2.2-4.1z' fill='#000' stroke='#fff' stroke-width='1.2'/></svg>`,
    20, 21, 'cell');
  const CURSOR_SHEET = `
[data-texture-kit-hover], [data-texture-kit-hover] * { cursor: pointer !important; }
[data-texture-kit-hover="copy"], [data-texture-kit-hover="copy"] * { cursor: ${EYEDROPPER} !important; }
[data-texture-kit-hover="paste"], [data-texture-kit-hover="paste"] * { cursor: ${BUCKET} !important; }`;

  const head = (label, key, title) => `<h4>${label}
          <button class="eyebtn" data-vis="${key}" aria-pressed="false" title="Show this on the element"></button>
          <button class="iconbtn dice" data-rand="${key}" title="Randomize this layer"></button>
          <button class="lockbtn lock" data-lock="${key}" aria-pressed="false" title="Lock during randomize"></button></h4>`;

  const PANEL = `
<div class="kit">
  <button id="panelShow" data-mark="plus">Maximize texture panel</button>
  <div class="hover"></div>
  <div class="toast" role="status" aria-live="polite"></div>
  <div class="outline"></div>
  <aside class="panel" id="panel">
    <div class="phead">
      <b>Texture</b>
      <span class="spacer"></span>
      <button id="randomize" class="primary" title="Randomize every element in the list">Randomize</button>
      <button id="panelToggle" class="iconbtn" data-mark="minus" title="Minimize"></button>
      <button id="kitClose" class="iconbtn" title="Close and put the page back (Shift+T)">&times;</button>
    </div>
    <div class="pbody">

    <div class="grp" data-section="element">
      <h3>Element</h3>
      <div class="row"><label>target</label><select id="kit-target"></select><button id="kit-pick" title="Click an element on the page">Pick</button></div>
      <div class="row"><label>layers</label><span class="inline-check"><input type="checkbox" id="kit-onTop"><label for="kit-onTop">over the content</label></span></div>
      <div class="btnrow spaced"><button id="kit-copy">Copy CSS</button><button id="kit-clear">Clear element</button></div>
      <textarea id="kit-css" readonly hidden aria-label="Exported CSS"></textarea>
      <p class="hint" id="kit-note"></p>
      <p class="hint"><b>Alt</b>-click an element to copy its look, <b>Ctrl</b>-click (<b>Cmd</b> on a Mac) to paste it onto another, <b>Shift</b>-click to click the page itself.</p>
    </div>

    <div class="grp" data-section="background">
      <h3>Background
        <label class="colorbtn" id="bg-colorbtn" title="Flat colour under the layers — right-click to clear"><input type="color" id="bg-color" aria-label="Flat background colour"></label>
        <button class="iconbtn dice" data-rand="background" title="Randomize every layer"></button>
        <button class="lockbtn lock" data-lock="background" aria-pressed="false" title="Lock during randomize"></button></h3>

      <div class="sub" data-section="svgbg">
        ${head('Dynamic SVG', 'svgbg')}
        <div class="sub-body">
          <!-- Three tabs rather than one long run of controls, the way an
               Adobe panel groups a layer's properties: what it is, what
               colours it is in, and how those are shifted. -->
          <div class="tabs" role="tablist" aria-label="Dynamic SVG">
            <button type="button" role="tab" id="sv-tab-svg" aria-controls="sv-pane-svg" aria-selected="true">svg</button>
            <button type="button" role="tab" id="sv-tab-color" aria-controls="sv-pane-color" aria-selected="false" tabindex="-1">color</button>
            <button type="button" role="tab" id="sv-tab-adjust" aria-controls="sv-pane-adjust" aria-selected="false" tabindex="-1">adjust</button>
          </div>

          <div class="tabpane" role="tabpanel" id="sv-pane-svg" aria-labelledby="sv-tab-svg">
          <div class="row"><label>library</label><span></span><output id="sv-count"></output></div>
          <div class="chips tags" id="sv-tags"></div>
          <div class="tiles" id="sv-tiles"></div>
          </div>

          <div class="tabpane" role="tabpanel" id="sv-pane-color" aria-labelledby="sv-tab-color" hidden>
          <div class="row"><label>colours</label><span></span>
            <button class="iconbtn" id="sv-resetColors" data-mark="undo" title="Back to the original colours"></button></div>
          <div class="swatches" id="sv-swatches"></div>
          <p class="hint" id="sv-swatchNote" hidden></p>

          <div class="row"><label>from set</label>
            <span></span>
            <button class="iconbtn" id="sv-palRandom" title="Random palette"></button>
            <button class="iconbtn" id="sv-palRotate" data-mark="redo" title="Rotate which colour goes where"></button></div>
          <div class="chips tags" id="sv-palTags"></div>
          <div class="pallist" id="sv-palList"></div>
          <p class="hint" id="sv-palNote" hidden></p>
          </div>

          <div class="tabpane" role="tabpanel" id="sv-pane-adjust" aria-labelledby="sv-tab-adjust" hidden>
          <div class="row"><label>adjust</label><span></span>
            <button class="iconbtn" id="sv-resetAdjust" data-mark="undo" title="Reset hue, saturation, lightness and scale"></button></div>
          <div class="row"><label>hue</label><input id="sv-hue" type="range" min="-180" max="180" step="1"><output id="sv-hueV"></output></div>
          <div class="row"><label>saturation</label><input id="sv-sat" type="range" min="-100" max="100" step="1"><output id="sv-satV"></output></div>
          <div class="row"><label>lightness</label><input id="sv-light" type="range" min="-50" max="50" step="1"><output id="sv-lightV"></output></div>
          <div class="row"><label>scale</label><input id="sv-scale" type="range" min="0.1" max="4" step="0.05"><output id="sv-scaleV"></output></div>
          <p class="hint" id="sv-scaleNote" hidden>This one is sized to <b>cover</b> the element, so it has no tile to scale.</p>
          <div class="row"><label>attach</label><span class="inline-check"><input type="checkbox" id="sv-fixed"><label for="sv-fixed">fixed to the window</label></span></div>
          </div>
        </div>
      </div>

      <div class="sub" data-section="pattern">
        ${head('Pattern', 'pattern')}
        <div class="sub-body">
          <div class="pat-grid" id="pat-grid"></div>
          <div class="pat-current" id="pat-name"></div>
          <div class="row"><label>scale</label><input id="pat-scale" type="range" min="0.1" max="8" step="0.1"><output id="pat-scaleV"></output></div>
          <div class="row"><label>opacity</label><input id="pat-opacity" type="range" min="0" max="1" step="0.05"><output id="pat-opacityV"></output></div>
          <div class="row"><label>colour</label><input id="pat-color" type="color"><span></span></div>
          <div class="row"><label>rotation</label><input id="pat-rotate" type="range" min="0" max="360" step="15"><output id="pat-rotateV"></output></div>
        </div>
      </div>

      <div class="sub" data-section="fx">
        ${head('Static fx', 'fx')}
        <div class="sub-body">
          <div class="row"><label>amount</label><input id="fx-opacity" type="range" min="0" max="0.5" step="0.01"><output id="fx-opacityV"></output></div>
          <div class="row"><label>fps</label><input id="fx-fps" type="range" min="6" max="60" step="1"><output id="fx-fpsV"></output></div>
          <div class="row"><label>cell</label><input id="fx-cell" type="range" min="1" max="6" step="0.5"><output id="fx-cellV"></output></div>
        </div>
      </div>
    </div>

    <!-- The studio's Scene section, for the page instead of the artboard: the
         textures on every element, kept in this browser or written out as a
         file and read back in. -->
    <div class="grp" data-section="scene">
      <h3>Scene</h3>
      <div class="row"><label>saved</label>
        <span></span>
        <button id="scn-dumpAll" class="iconbtn" data-mark="db-export" title="Download every scene stored in this browser, one file each"></button>
        <button id="scn-delete" class="iconbtn" data-mark="trash" title="Delete the selected browser scene"></button>
      </div>
      <div class="scenelist" id="scn-list"></div>
      <div class="row"><label>save</label>
        <input id="scn-name" type="text" placeholder="name" spellcheck="false">
        <button id="scn-store" class="iconbtn" data-mark="star" title="Save in this browser"></button>
        <button id="scn-save" class="iconbtn" data-mark="download" title="Export a .json file"></button>
        <label class="uploadbtn iconbtn" data-mark="upload" title="Import a scene file"><input id="scn-load" type="file" accept=".json,application/json" hidden></label>
      </div>
      <p class="hint" id="scn-note"></p>
    </div>

    </div>
  </aside>
</div>`;

  let ui = null;   // everything the open panel owns; null when closed
  let tag = 'All', palTag = 'All';   // browsing filters, not part of any element

  const $ = (id) => ui.root.getElementById(id);
  const cur = () => entryFor(ui.current);
  const note = (text) => { $('kit-note').textContent = text; };

  const tagsOf = (bg) => bg.tags.replace('Line Art', 'Line_Art').split(' ').filter(Boolean).map(t => t.replace('_',' '));
  const visibleBgs = () => lib.BACKGROUNDS.filter(bg => tag === 'All' || tagsOf(bg).includes(tag));
  const visiblePalettes = () => lib.PALETTES.map((p, i) => i).filter(i => palTag === 'All' || lib.PALETTES[i].topics.includes(palTag));
  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  // Repaint the element, and keep the ● in the target list honest.
  function render() {
    paint(cur());
    markTargets();
  }

  /* ---- the target ---- */
  function targetsList() {
    const list = PRESETS.map(([name, sel]) => [name, document.querySelector(sel)]).filter(([, el]) => el);
    const col = list.findIndex(([, el]) => el?.matches('.copy'));
    list.splice(col + 1, 0, ...[...document.querySelectorAll(SECTIONS)].map((s, i) => [sectionName(s, i), s]));
    for (const el of entries.keys()) if (!list.some(([, e]) => e === el)) list.push([selectorFor(el), el]);
    if (ui.current && !list.some(([, e]) => e === ui.current)) list.push([selectorFor(ui.current), ui.current]);
    return list;
  }
  function buildTargets() {
    ui.targets = targetsList();
    $('kit-target').innerHTML = ui.targets.map(([name], i) => `<option value="${i}">${esc(name)}</option>`).join('');
    $('kit-target').value = String(Math.max(0, ui.targets.findIndex(([, el]) => el === ui.current)));
    markTargets();
  }
  function markTargets() {
    [...$('kit-target').options].forEach((o, i) => {
      const [name, el] = ui.targets[i];
      const e = entries.get(el);
      o.textContent = (e && isTextured(e) ? '● ' : '') + name;
    });
  }
  function select(el) {
    ui.current = el;
    buildTargets();
    syncAll();
  }

  /* ---- Dynamic SVG (ported from svg-background.js) ---- */
  const TAGS = () => ['All', ...[...new Set(lib.BACKGROUNDS.flatMap(tagsOf))].sort()];
  const PAL_TOPICS = () => ['All', ...[...new Set(lib.PALETTES.flatMap(p => p.topics))].sort()];

  function buildTags() {
    $('sv-tags').innerHTML = TAGS().map(t =>
      `<label><input type="radio" name="sv-tag" value="${t}"${t === tag ? ' checked' : ''}>${t.toLowerCase()}</label>`).join('');
  }
  function buildTiles() {
    const list = visibleBgs();
    $('sv-count').value = `${list.length}/${lib.BACKGROUNDS.length}`;
    $('sv-tiles').replaceChildren(...list.map(bg => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.title = bg.name; btn.dataset.id = bg.id;
      btn.setAttribute('aria-label', bg.name);
      const css = { ...bg.css };
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
    for (const t of $('sv-tiles').children) t.setAttribute('aria-pressed', String(t.dataset.id === cur().svgbg.id));
  }
  function revealTile() {
    const grid = $('sv-tiles'), tile = grid.querySelector('[aria-pressed="true"]');
    if (!tile) return;
    const top = tile.offsetTop, bottom = top + tile.offsetHeight;
    if (top < grid.scrollTop) grid.scrollTop = top - 4;
    else if (bottom > grid.scrollTop + grid.clientHeight) grid.scrollTop = bottom - grid.clientHeight + 4;
  }
  function buildSwatches() {
    const s = cur().svgbg;
    const { baseKey, keys } = paletteOf(bgById(s.id));
    const shown = [...(baseKey ? [baseKey] : []), ...keys].slice(0, MAX_SWATCHES);
    $('sv-swatches').replaceChildren(...shown.map(key => {
      const label = document.createElement('label');
      label.className = 'swatch' + (key === baseKey ? ' is-base' : '');
      label.title = '#' + key;
      const input = document.createElement('input');
      input.type = 'color'; input.value = '#' + (s.overrides[key] || key);
      input.addEventListener('input', () => { cur().svgbg.overrides[key] = input.value.slice(1); paintSvg(); });
      label.append(input);
      return label;
    }));
    const hidden = keys.length + (baseKey ? 1 : 0) - shown.length;
    $('sv-swatchNote').hidden = hidden <= 0;
    $('sv-swatchNote').innerHTML = `<b>+${hidden}</b> more shades in this gradient &mdash; shift them all with <b>hue / saturation / lightness</b>.`;
    paintSwatches();
  }
  function paintSwatches() {
    const s = cur().svgbg;
    for (const label of $('sv-swatches').children) {
      const key = label.title.slice(1);
      label.style.background = '#' + mapColor(s, key);
      label.classList.toggle('is-edited', key in s.overrides);
    }
  }
  const palTitle = (p) => `${p.name} by ${p.by} · ${p.topics.join(', ')}`;
  function buildPaletteTags() {
    $('sv-palTags').innerHTML = PAL_TOPICS().map(t =>
      `<label><input type="radio" name="sv-palTag" value="${esc(t)}"${t === palTag ? ' checked' : ''}>${esc(t.toLowerCase())}</label>`).join('');
  }
  function buildPaletteList() {
    const cell = (i) => {
      const p = lib.PALETTES[i];
      return `<button type="button" data-pal="${i}" aria-pressed="false" title="${esc(palTitle(p))}">` +
             p.colors.map(x => `<i style="background:#${x}"></i>`).join('') + `</button>`;
    };
    $('sv-palList').innerHTML =
      `<button type="button" class="is-none" data-pal="" aria-pressed="true" title="None — the colours the background was drawn in"></button>` +
      visiblePalettes().map(cell).join('');
    markPalette();
  }
  function markPalette() {
    const i = cur().svgbg.palette, pal = lib.PALETTES[i], list = $('sv-palList');
    let picked = null;
    list.querySelectorAll('[data-pal]').forEach(b => {
      const on = b.dataset.pal === (pal ? String(i) : '');
      b.setAttribute('aria-pressed', String(on));
      if (on) picked = b;
    });
    if (picked && (picked.offsetTop < list.scrollTop || picked.offsetTop + picked.offsetHeight > list.scrollTop + list.clientHeight))
      list.scrollTop = picked.offsetTop - (list.clientHeight - picked.offsetHeight) / 2;
    $('sv-palNote').hidden = !pal;
    $('sv-palRotate').disabled = !pal;
    if (pal) $('sv-palNote').innerHTML = `<b>${esc(pal.name)}</b> by ${esc(pal.by)} &middot; ${esc(pal.topics.join(', '))}`;
  }
  function setPalette(index) {
    const s = cur().svgbg;
    Object.assign(s, { palette: index, palRot: 0 });
    applyPalette(s); markPalette(); buildSwatches(); paintSvg();
  }
  function pickBg(id) {
    const s = cur().svgbg;
    Object.assign(s, { id, overrides: {}, hue: 0, sat: 0, light: 0, scale: 1 });
    applyPalette(s);
    syncSvg();
    revealTile();
  }
  function paintSvg() { paintSwatches(); render(); }
  function syncSvg() {
    const s = cur().svgbg;
    if (!lib.BACKGROUNDS.some(b => b.id === s.id)) s.id = lib.BACKGROUNDS[0].id;
    for (const [id, v] of [['hue', s.hue], ['sat', s.sat], ['light', s.light], ['scale', s.scale]]) $('sv-' + id).value = v;
    for (const id of ['hue', 'sat', 'light']) $(`sv-${id}V`).value = (s[id] > 0 ? '+' : '') + s[id];
    $('sv-scaleV').value = (+s.scale).toFixed(2) + '×';
    $('sv-fixed').checked = !!s.fixed;
    const scalable = !!tileSizes(bgById(s.id));
    $('sv-scale').closest('.row').classList.toggle('is-disabled', !scalable);
    $('sv-scaleNote').hidden = scalable;
    markTile();
    buildSwatches();
    markPalette();
  }

  /* ---- Pattern (ported from panel.js) ---- */
  const swatchStyle = (p, box) => {
    const k = box / Math.max(p.w, p.h);
    return `background-image:url('${patternURL(p.n)}');` +
           `background-size:${Math.max(2, Math.round(p.w * k))}px ${Math.max(2, Math.round(p.h * k))}px`;
  };
  function syncPattern() {
    const p = cur().pattern;
    $('pat-name').textContent = p.name;
    let picked = null;
    $('pat-grid').querySelectorAll('[data-pat]').forEach(b => {
      const on = b.dataset.pat === p.name;
      b.setAttribute('aria-pressed', String(on));
      if (on) picked = b;
    });
    const g = $('pat-grid');
    if (picked && (picked.offsetTop < g.scrollTop || picked.offsetTop + picked.offsetHeight > g.scrollTop + g.clientHeight))
      g.scrollTop = picked.offsetTop - (g.clientHeight - picked.offsetHeight) / 2;
    $('pat-scale').value = p.scale;     $('pat-scaleV').value = fmt(p.scale) + '×';
    $('pat-opacity').value = p.opacity; $('pat-opacityV').value = Math.round(p.opacity * 100) + '%';
    $('pat-color').value = p.color;
    $('pat-rotate').value = p.rotate;   $('pat-rotateV').value = p.rotate + '°';
  }

  /* ---- Static fx ---- */
  function syncFx() {
    const f = cur().fx;
    for (const k of ['opacity', 'fps', 'cell']) { $('fx-' + k).value = f[k]; $(`fx-${k}V`).value = f[k]; }
  }

  /* ---- eyes, locks, and the whole panel from the element ---- */
  const HIDDEN_TIP = 'Hidden — turn its eye back on to open it';
  function syncEyes() {
    const e = cur();
    ui.root.querySelectorAll('[data-vis]').forEach(b => {
      const on = !!e[b.dataset.vis].enabled;
      b.setAttribute('aria-pressed', String(on));
      const sec = b.closest('.sub');
      sec.classList.toggle('is-hidden', !on);
      if (!on) sec.classList.add('collapsed');
      const h = sec.querySelector(':scope > h4');
      h.title = on ? '' : HIDDEN_TIP;
      const dice = h.querySelector('[data-rand]');
      dice.dataset.tip ??= dice.title;
      dice.disabled = !on;
      dice.title = on ? dice.dataset.tip : HIDDEN_TIP;
    });
  }
  function syncLocks() {
    const e = cur();
    ui.root.querySelectorAll('[data-lock]').forEach(b => b.setAttribute('aria-pressed', String(e.locks[b.dataset.lock])));
  }
  function syncColor() {
    const c = cur().color, btn = $('bg-colorbtn');
    btn.classList.toggle('is-set', !!c);
    btn.style.setProperty('--swatch', c || 'transparent');
    $('bg-color').value = c || '#ffffff';
  }
  function syncAll() {
    $('kit-onTop').checked = cur().onTop;
    syncColor();
    syncEyes(); syncLocks(); syncSvg(); syncPattern(); syncFx();
    placeOutline();
  }

  /* ---- wiring ---- */
  function wire() {
    const r = ui.root;
    r.getElementById('kit-target').addEventListener('change', e => select(ui.targets[+e.target.value][1]));
    $('kit-pick').addEventListener('click', () => togglePick());
    $('kit-onTop').addEventListener('change', e => { cur().onTop = e.target.checked; render(); });
    $('kit-clear').addEventListener('click', () => {
      const e = cur();
      demount(e);
      entries.delete(e.el);
      buildTargets(); syncAll();
      note('Element restored.');
    });
    $('kit-copy').addEventListener('click', () => {
      const textured = [...entries.values()].filter(isTextured);
      const css = textured.length ? '/* texture kit */\n' + textured.map(cssFor).join('\n\n') + '\n' : '';
      const area = $('kit-css');
      area.value = css; area.hidden = !css;
      if (!css) return note('Nothing textured yet.');
      area.select();
      navigator.clipboard?.writeText(css).then(() => note('Copied — paste it into intro.css.'), () => note('Select the text above and copy it.'));
    });
    $('kitClose').addEventListener('click', close);

    // The flat colour: picking one sets it, right-click takes it off again.
    // Randomize leaves it alone - it is a choice, not a texture.
    $('bg-color').addEventListener('input', e => { cur().color = e.target.value; syncColor(); render(); });
    $('bg-colorbtn').addEventListener('contextmenu', ev => {
      ev.preventDefault();
      cur().color = null; syncColor(); render();
    });

    // Eyes: the layer's `enabled`, and a hidden layer shuts.
    r.querySelectorAll('[data-vis]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const s = cur()[btn.dataset.vis];
      s.enabled = !s.enabled;
      syncEyes(); render();
    }));
    r.querySelectorAll('[data-lock]').forEach(btn => btn.addEventListener('click', () => {
      const e = cur(), k = btn.dataset.lock;
      e.locks[k] = !e.locks[k];
      btn.setAttribute('aria-pressed', String(e.locks[k]));
    }));
    // Randomizing a whole element - what both the titlebar's Randomize (on
    // every element) and the Background dice (on this one) do. It picks the
    // look as well as the settings, whatever is showing now: one base texture
    // - Dynamic SVG or Pattern, never both - so an element that had every
    // layer hidden comes out with one of the two on. The grain comes off: it
    // is handed out afterwards by grainOnOne(), to one element at most. A
    // locked layer keeps what it is and whether it shows; an element whose
    // Background is locked is left alone (returns false).
    function randomizeElement(e, palette) {
      if (e.locks.background) return false;
      const bases = ['svgbg', 'pattern'].filter(l => !e.locks[l]);
      // A locked base that is showing IS the base: the other goes off.
      if (['svgbg', 'pattern'].some(l => e.locks[l] && e[l].enabled)) bases.forEach(l => { e[l].enabled = false; });
      else if (bases.length) {
        const pick = rand(bases);
        for (const l of bases) e[l].enabled = l === pick;
        ROLL[pick](e, palette);
      }
      if (!e.locks.fx) e.fx.enabled = false;
      return true;
    }
    // The grain, on one of these elements at most: a coin toss for whether
    // any gets it, then one of them at random. Moving grain everywhere at
    // once is noise rather than texture. Only an element that was randomized
    // and whose grain is not locked can be picked.
    function grainOnOne(list) {
      const open = list.filter(e => !e.locks.background && !e.locks.fx);
      if (!open.length || Math.random() < 0.5) return;
      const e = rand(open);
      e.fx.enabled = true;
      ROLL.fx(e);
    }

    // The dice: one layer, or the whole element for the Background one.
    r.querySelectorAll('[data-rand]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const e = cur(), k = btn.dataset.rand;
      if (k === 'background') {
        if (!randomizeElement(e)) return note('Background is locked.');
        grainOnOne([e]);
      }
      else ROLL[k](e);
      syncAll(); render();
    }));

    // The titlebar's Randomize, over every element in the target list at once
    // - except the containers. The page and the two columns only show in the
    // gaps between the bands inside them, so they are cleared instead of
    // rolled: every layer that is not locked goes off, and they are never the
    // one that gets the grain. A container whose Background is locked is left
    // exactly as it is.
    //
    // One palette for the whole page: every Dynamic SVG it rolls is recoloured
    // from the same one, each with the colours in a different order, so the
    // bands read as one set rather than as a dozen unrelated covers. Chosen
    // from what the palette pills allow, like the palette dice.
    const CONTAINERS = ['body', '.showcase', '.copy'];
    $('randomize').addEventListener('click', () => {
      let held = 0;
      const rolled = [], cleared = [];
      const pals = visiblePalettes();
      const palette = pals.length ? rand(pals) : null;
      for (const [, el] of ui.targets) {
        const e = entryFor(el);
        if (CONTAINERS.some(sel => el.matches(sel))) {
          if (e.locks.background) { held++; continue; }
          LAYERS.filter(l => !e.locks[l]).forEach(l => { e[l].enabled = false; });
          cleared.push(e);
        }
        else if (randomizeElement(e, palette)) rolled.push(e); else held++;
      }
      grainOnOne(rolled);
      [...cleared, ...rolled].forEach(e => paint(e));
      markTargets(); syncAll();
      note(held ? `${held} locked element${held > 1 ? 's' : ''} kept as they were.` : '');
    });

    // Collapsible sections and layers, as in panel.js — except that the
    // sections here start open, since there are only two of them.
    r.querySelectorAll('.panel .grp').forEach(grp => {
      const h = grp.querySelector('h3');
      const body = document.createElement('div');
      body.className = 'grp-body';
      for (let n = h.nextSibling; n; ) { const nx = n.nextSibling; body.appendChild(n); n = nx; }
      grp.appendChild(body);
      h.insertBefore(Object.assign(document.createElement('span'), { className: 'chev' }), h.firstChild);
      h.addEventListener('click', ev => { if (!ev.target.closest('button, .colorbtn')) grp.classList.toggle('collapsed'); });
    });
    r.querySelectorAll('.panel .sub').forEach(sub => {
      const h = sub.querySelector('h4');
      h.insertBefore(Object.assign(document.createElement('span'), { className: 'chev' }), h.firstChild);
      sub.classList.add('collapsed');
      h.addEventListener('click', ev => {
        if (ev.target.closest('button') || sub.classList.contains('is-hidden')) return;
        sub.classList.toggle('collapsed');
      });
    });

    // Dynamic SVG: the three tabs. Which one is open is the panel's, not the
    // element's, so it stays put while you move between elements. The grids
    // scroll their current item into view on the way in - a hidden grid has
    // no layout to scroll against.
    const tabs = [...r.querySelectorAll('[role="tab"]')];
    const openTab = (tab) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = !on;
      }
      if (tab.id === 'sv-tab-svg') revealTile();
      if (tab.id === 'sv-tab-color') markPalette();
    };
    for (const t of tabs) {
      t.addEventListener('click', () => openTab(t));
      // Arrow keys move along the row, as a tab list does.
      t.addEventListener('keydown', ev => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
        if (!step) return;
        const next = tabs[(tabs.indexOf(t) + step + tabs.length) % tabs.length];
        openTab(next); next.focus(); ev.preventDefault();
      });
    }

    $('sv-tags').addEventListener('change', e => { tag = e.target.value; buildTiles(); });
    $('sv-tiles').addEventListener('click', e => { const t = e.target.closest('[data-id]'); if (t) pickBg(t.dataset.id); render(); });
    $('sv-resetColors').addEventListener('click', () => setPalette(null));
    $('sv-palList').addEventListener('click', e => { const row = e.target.closest('[data-pal]'); if (row) setPalette(row.dataset.pal === '' ? null : +row.dataset.pal); });
    $('sv-palTags').addEventListener('change', e => { palTag = e.target.value; buildPaletteList(); });
    $('sv-palRandom').addEventListener('click', () => { const list = visiblePalettes(); if (list.length) setPalette(rand(list)); });
    $('sv-palRotate').addEventListener('click', () => { const s = cur().svgbg; s.palRot++; applyPalette(s); buildSwatches(); paintSvg(); });
    for (const id of ['hue', 'sat', 'light', 'scale']) {
      $('sv-' + id).addEventListener('input', e => {
        cur().svgbg[id] = +e.target.value;
        $(`sv-${id}V`).value = id === 'scale' ? (+e.target.value).toFixed(2) + '×' : (e.target.value > 0 ? '+' : '') + e.target.value;
        paintSvg();
      });
    }
    $('sv-resetAdjust').addEventListener('click', () => { Object.assign(cur().svgbg, { hue: 0, sat: 0, light: 0, scale: 1 }); syncSvg(); render(); });
    $('sv-fixed').addEventListener('change', e => { cur().svgbg.fixed = e.target.checked; render(); });

    // Pattern
    $('pat-grid').innerHTML = lib.PATTERNS.map(p =>
      `<button type="button" data-pat="${p.n}" title="${p.n}" aria-pressed="false" style="${swatchStyle(p, 18)}"></button>`).join('');
    $('pat-grid').addEventListener('click', e => { const sw = e.target.closest('[data-pat]'); if (!sw) return; cur().pattern.name = sw.dataset.pat; syncPattern(); render(); });
    $('pat-scale').addEventListener('input', e => { cur().pattern.scale = +e.target.value; $('pat-scaleV').value = fmt(e.target.value) + '×'; render(); });
    $('pat-opacity').addEventListener('input', e => { cur().pattern.opacity = +e.target.value; $('pat-opacityV').value = Math.round(e.target.value*100) + '%'; render(); });
    $('pat-color').addEventListener('input', e => { cur().pattern.color = e.target.value; render(); });
    $('pat-rotate').addEventListener('input', e => { cur().pattern.rotate = +e.target.value; $('pat-rotateV').value = e.target.value + '°'; render(); });

    // Static fx
    for (const k of ['opacity', 'fps', 'cell']) {
      $('fx-' + k).addEventListener('input', e => { cur().fx[k] = +e.target.value; $(`fx-${k}V`).value = e.target.value; render(); });
    }

    buildTags(); buildTiles(); buildPaletteTags(); buildPaletteList();
    wireWindow();
    wireScenes();
  }

  /* ---- scenes (after scenes.js) ----
     What is textured, element by element: each one is found again by the same
     selector Copy CSS writes, and carries its three layers and whether they sit
     over the content. Nothing else - the page's own layout is the page's.

     Kept two ways, as the studio keeps its covers: in this browser under a
     name, for "let me try this again in a minute", and as a .json file for a
     keeper. The browser store is localStorage, so it survives reloads and is
     the one thing the kit does leave behind on purpose - it is what you asked
     it to keep. Every access is guarded: storage throws in a private window,
     and setItem throws on quota. */
  const SCENE_KEY = 'randomizeStudio.textureScenes';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function readStore() { try { return JSON.parse(localStorage.getItem(SCENE_KEY)) || {}; } catch { return {}; } }
  function writeStore(map) {
    try { localStorage.setItem(SCENE_KEY, JSON.stringify(map)); return true; }
    catch (err) { sceneNote(`This browser refused to store it (${err.name}) — use Export instead.`); return false; }
  }
  let sceneTimer = 0;
  function sceneNote(msg) {
    $('scn-note').textContent = msg;
    clearTimeout(sceneTimer);
    sceneTimer = setTimeout(() => { if (ui) $('scn-note').textContent = ''; }, 6000);
  }
  const sceneStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
  const nameField = () => $('scn-name').value.trim();

  function serializeScene() {
    const elements = {};
    for (const e of entries.values()) {
      if (!isTextured(e)) continue;          // nothing showing, nothing to keep
      elements[selectorFor(e.el)] = { onTop: e.onTop, color: e.color, svgbg: clone(e.svgbg), pattern: clone(e.pattern), fx: clone(e.fx) };
    }
    return { kind: 'randomize-studio/texture-scene', version: 1, elements };
  }
  // Replaces what is on the page: every element is cleared first, so a scene
  // is the whole look rather than a layer on top of the last one. Locks are
  // the panel's, not the scene's, and survive.
  function applyScene(data) {
    if (!data || typeof data.elements !== 'object') throw new Error('not a texture scene');
    for (const e of entries.values()) {
      demount(e);
      for (const l of LAYERS) e[l].enabled = false;
      e.onTop = false;
      e.color = null;
    }
    const missing = [];
    for (const [sel, s] of Object.entries(data.elements)) {
      let el = null;
      try { el = document.querySelector(sel); } catch { /* a selector this page cannot parse */ }
      if (!el) { missing.push(sel); continue; }
      const e = entryFor(el);
      e.onTop = !!s.onTop;
      e.color = typeof s.color === 'string' ? s.color : null;
      for (const l of LAYERS) if (s[l]) Object.assign(e[l], clone(s[l]));
      paint(e);
    }
    buildTargets(); syncAll();
    return missing;
  }

  /* ---- the list: this browser's scenes, open rather than in a dropdown ---- */
  let picked = '';   // the name of the scene last saved or loaded here
  function refreshScenes(select) {
    if (select !== undefined) picked = select;
    const list = $('scn-list'), names = Object.keys(readStore()).sort((a, b) => a.localeCompare(b));
    list.replaceChildren();
    const h = document.createElement('div');
    h.className = 'scenegroup';
    h.textContent = 'this browser · local storage';
    list.append(h);
    for (const n of names) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'scenerow'; b.dataset.scene = n; b.title = n;
      b.textContent = n;                       // a name cannot bring markup with it
      b.setAttribute('aria-pressed', String(n === picked));
      list.append(b);
    }
    if (!names.length) {
      const empty = document.createElement('p');
      empty.className = 'scene-empty';
      empty.textContent = 'Nothing saved yet — ★ keeps one in this browser.';
      list.append(empty);
    }
    $('scn-delete').disabled = !names.includes(picked);
  }
  function loadStored(name) {
    const data = readStore()[name];
    if (!data) return;
    const missing = applyScene(data);
    $('scn-name').value = name;
    refreshScenes(name);
    sceneNote(`Loaded "${name}".` + (missing.length ? ` ${missing.length} element${missing.length > 1 ? 's are' : ' is'} not on this page any more.` : ''));
  }
  function download(data, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const slug = name.replace(/[^a-z0-9._ -]+/gi, '').trim().replace(/\s+/g, '-');
    a.download = `texture-scene-${slug || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function wireScenes() {
    $('scn-list').addEventListener('click', e => { const row = e.target.closest('[data-scene]'); if (row) loadStored(row.dataset.scene); });
    // Up and down walk the list and load as they go, as in the studio.
    $('scn-list').addEventListener('keydown', e => {
      const STEP = { ArrowDown: 1, ArrowUp: -1 };
      if (!(e.key in STEP)) return;
      const rows = [...$('scn-list').querySelectorAll('[data-scene]')];
      if (!rows.length) return;
      e.preventDefault();
      const at = rows.findIndex(r => r.dataset.scene === picked);
      const next = at < 0 ? rows[STEP[e.key] > 0 ? 0 : rows.length - 1] : rows[(at + STEP[e.key] + rows.length) % rows.length];
      loadStored(next.dataset.scene);
      ui.root.querySelector(`[data-scene="${CSS.escape(next.dataset.scene)}"]`)?.focus();
    });
    $('scn-store').addEventListener('click', () => {
      const name = nameField() || sceneStamp(), map = readStore(), replacing = name in map;
      map[name] = serializeScene();
      if (!writeStore(map)) return;
      $('scn-name').value = name;
      refreshScenes(name);
      sceneNote(`${replacing ? 'Replaced' : 'Saved'} "${name}" in this browser.`);
    });
    $('scn-delete').addEventListener('click', () => {
      if (!picked) return;
      const map = readStore(), name = picked;
      delete map[name];
      if (!writeStore(map)) return;
      refreshScenes('');
      sceneNote(`Deleted "${name}" from this browser.`);
    });
    $('scn-save').addEventListener('click', () => { download(serializeScene(), nameField()); sceneNote('Exported the scene as a .json file.'); });
    // One file each, spaced out: a browser handed a dozen downloads at once
    // takes the first and quietly drops the rest.
    $('scn-dumpAll').addEventListener('click', () => {
      const store = readStore(), names = Object.keys(store);
      if (!names.length) return sceneNote('Nothing is stored in this browser yet.');
      names.forEach((n, i) => setTimeout(() => download(store[n], n), i * 180));
      sceneNote(`Downloading ${names.length} scene${names.length > 1 ? 's' : ''}.`);
    });
    $('scn-load').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';                    // so re-picking the same file fires again
      if (!f) return;
      try {
        const missing = applyScene(JSON.parse(await f.text()));
        refreshScenes('');
        sceneNote(`Loaded ${f.name}.` + (missing.length ? ` ${missing.length} element${missing.length > 1 ? 's are' : ' is'} not on this page.` : ''));
      } catch (err) { sceneNote(`Could not load: ${err.message}`); }
    });
    // Shut on open, as the studio's sections are: it is for when you want it.
    ui.root.querySelector('.grp[data-section="scene"]').classList.add('collapsed');
    refreshScenes();
  }

  /* ---- the floating window: drag, minimize, maximize (from panel-window.js) ---- */
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

    let dx = 0, dy = 0, dragging = false;
    const place = (x, y) => {
      const gap = 8, w = panel.offsetWidth, h = panel.offsetHeight;
      panel.style.left = Math.round(Math.max(gap, Math.min(x, innerWidth - w - gap))) + 'px';
      panel.style.top = Math.round(Math.max(gap, Math.min(y, innerHeight - h - gap))) + 'px';
      panel.style.right = 'auto';
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
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) panel.style.left = panel.style.top = panel.style.right = ''; });
    ui.onResize = () => { if (panel.style.left) place(parseFloat(panel.style.left), parseFloat(panel.style.top)); placeOutline(); };
  }

  /* ---- Pick: click any element on the page ---- */
  function pickable(t) {
    if (!(t instanceof Element) || t === ui.host || t.closest('[data-texture-kit]')) return null;
    // The frame is not a target: a click on it (or on anything in it) picks
    // what it sits in instead.
    const frame = t.closest('.frame');
    if (frame) t = frame.parentElement;
    return t === document.documentElement ? document.body : t;
  }
  function onPickMove(ev) { const t = pickable(ev.target); if (t) placeOutline(t); }
  function onPickClick(ev) {
    const t = pickable(ev.target);
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    togglePick(false);
    select(t);
  }
  function togglePick(force) {
    const on = typeof force === 'boolean' ? force : !ui.picking;
    ui.picking = on;
    $('kit-pick').classList.toggle('primary', on);
    const opt = { capture: true };
    if (on) { document.addEventListener('pointermove', onPickMove, opt); document.addEventListener('click', onPickClick, opt); note('Click an element on the page — Esc cancels.'); }
    else { document.removeEventListener('pointermove', onPickMove, opt); document.removeEventListener('click', onPickClick, opt); note(''); placeOutline(); }
  }

  /* ---- click to edit: every element in the target list is live ----
     While the kit is open, the list's elements answer the pointer: hovering
     one frames it and turns the cursor into a pointer, clicking it selects it
     for editing. The innermost one under the pointer wins, so a section beats
     the column it sits in. The page itself is left out - framing the whole
     page on every move would say nothing - and stays reachable from the list.

     The click is taken, not passed on: a click meant to select the frame
     should not follow the Open studio link out of the page and lose the
     edits. The modifier keys change what a click does, and the cursor says
     which before you press:

       click            select the element for editing       pointer
       Alt / Option     copy its look (the eyedropper)        eyedropper
       Ctrl / Cmd       paste the copied look onto it         paint bucket
       Shift            go through to the page as usual       the page's own

     The copied look stays until the next copy, so one Alt-click can be pasted
     onto element after element. */
  function targetAt(t) {
    if (!(t instanceof Element) || t.closest('[data-texture-kit]')) return null;
    let best = null;
    for (const [, el] of ui.targets) if (el !== document.body && el.contains(t) && (!best || best.contains(el))) best = el;
    return best;
  }
  const modeOf = (ev) => ev.shiftKey ? null : ev.altKey ? 'copy' : (ev.ctrlKey || ev.metaKey) ? 'paste' : 'select';
  function setHover(el, mode = 'select') {
    if (ui.hover === el && ui.hoverMode === mode) return;
    ui.hover?.removeAttribute('data-texture-kit-hover');
    ui.hover = el; ui.hoverMode = mode;
    el?.setAttribute('data-texture-kit-hover', mode);   // the page sheet's cursor hook
    placeBox(ui.hoverBox, el === ui.current && mode === 'select' ? null : el);
  }
  function onEditMove(ev) {
    if (ui.picking) return;
    ui.lastTarget = ev.target;         // so a modifier pressed without moving can re-read it
    const mode = modeOf(ev);
    setHover(mode ? targetAt(ev.target) : null, mode || 'select');
  }
  function onEditOut(ev) { if (!ev.relatedTarget && !ui.picking) { ui.lastTarget = null; setHover(null); } }
  // Pressing or letting go of a modifier changes the cursor on the spot,
  // rather than on the next move of the mouse.
  function onModifier(ev) {
    if (!ui || ui.picking || !['Alt', 'Control', 'Meta', 'Shift'].includes(ev.key)) return;
    // Firefox (and Alt alone in some Windows browsers) hands the keyboard to the
    // menu bar when Alt comes back up; not after an Alt-click that copied.
    if (ev.type === 'keyup' && ev.key === 'Alt' && ui.altUsed) { ev.preventDefault(); ui.altUsed = false; }
    const mode = modeOf(ev);
    setHover(mode && ui.lastTarget ? targetAt(ui.lastTarget) : null, mode || 'select');
  }
  function onEditClick(ev) {
    if (ui.picking) return;
    const mode = modeOf(ev);
    if (!mode) return;                  // Shift: the page's own click
    const el = targetAt(ev.target);
    if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    if (mode === 'copy') { ui.altUsed = true; return copyLook(el); }
    if (mode === 'paste') return pasteLook(el);
    select(el);
    placeBox(ui.hoverBox, null);   // the selection frame takes over from the hover one
  }
  // Ctrl-click on a Mac is a right-click, which opens a menu instead of
  // clicking - so there it pastes from the menu event.
  function onEditMenu(ev) {
    if (ui.picking || !ev.ctrlKey || ev.shiftKey) return;
    const el = targetAt(ev.target);
    if (!el) return;
    ev.preventDefault();
    pasteLook(el);
  }

  /* ---- copy and paste a look ---- */
  const nameOf = (el) => (ui.targets.find(([, x]) => x === el)?.[0] || selectorFor(el)).replace(/^[\s ]+/, '');
  function copyLook(el) {
    const e = entryFor(el);
    ui.clip = clone({ color: e.color, onTop: e.onTop, svgbg: e.svgbg, pattern: e.pattern, fx: e.fx });
    toast(isTextured(e) ? 'Copied' : 'Copied — nothing on it, so pasting clears');
  }
  function pasteLook(el) {
    if (!ui.clip) return toast('Nothing copied yet — Alt-click an element first');
    const e = entryFor(el);
    if (e.locks.background) return toast(`${nameOf(el)} is locked`);
    // A layer the target has locked keeps what it has.
    const held = LAYERS.filter(l => e.locks[l]);
    for (const l of LAYERS) if (!e.locks[l]) Object.assign(e[l], clone(ui.clip[l]));
    e.color = ui.clip.color;
    e.onTop = ui.clip.onTop;
    paint(e);
    markTargets();
    if (el === ui.current) syncAll();
    toast(`Pasted onto ${nameOf(el)}` + (held.length ? `, except ${held.length} locked layer${held.length > 1 ? 's' : ''}` : ''));
  }

  // One line at the top of the window, centred, then gone.
  function toast(msg) {
    const t = ui.root.querySelector('.toast');
    t.textContent = msg;
    t.classList.add('is-shown');
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => t.classList.remove('is-shown'), 1400);
  }

  /* ---- the frames round the element being edited, and the one hovered ---- */
  function placeBox(box, el) {
    const r = el?.getBoundingClientRect();
    if (!r || el === document.body) { box.style.display = 'none'; return; }
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  function placeOutline(el = ui?.current) {
    if (!ui?.outline) return;
    placeBox(ui.outline, el);
  }
  const onScroll = () => {
    if (!ui || ui.picking) return;
    placeOutline();
    placeBox(ui.hoverBox, ui.hover === ui.current ? null : ui.hover);
  };
  const onResize = () => ui?.onResize?.();
  const onKey = (ev) => { if (ev.key === 'Escape' && ui?.picking) togglePick(false); };

  /* ============================ open / close ============================ */

  async function open() {
    if (ui) return;
    ui = { loading: true };
    try { await loadLib(); }
    catch (err) { ui = null; console.warn('[texture-kit]', err); return; }

    const host = document.createElement('div');
    host.dataset.textureKit = '';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = SHEETS.map(s => `<link rel="stylesheet" href="${ROOT}${s}">`).join('') +
                     `<style>${TOKENS}</style>` + PANEL;
    document.body.append(host);

    // The one thing the kit has to style on the page itself: the cursor over
    // the element it is offering. Removed with everything else on close.
    const sheet = document.createElement('style');
    sheet.dataset.textureKit = '';
    sheet.textContent = CURSOR_SHEET;
    document.head.append(sheet);

    ui = { host, root, sheet, picking: false, hover: null, targets: [], current: document.querySelector('.copy') || document.body };
    ui.outline = root.querySelector('.outline');
    ui.hoverBox = root.querySelector('.hover');
    wire();

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onModifier);
    document.addEventListener('keyup', onModifier);
    document.addEventListener('pointermove', onEditMove, { capture: true, passive: true });
    document.addEventListener('pointerout', onEditOut, { capture: true, passive: true });
    document.addEventListener('click', onEditClick, { capture: true });
    document.addEventListener('contextmenu', onEditMenu, { capture: true });

    buildTargets();
    syncAll();
    // Tells the page it is being edited, so intro.js holds the cover rotation
    // still - a cover changing under you is a moving target.
    document.dispatchEvent(new CustomEvent('texture-kit:open'));
  }

  function close() {
    if (!ui || ui.loading) return;
    togglePick(false);
    setHover(null);
    for (const entry of entries.values()) demount(entry);
    entries.clear();
    document.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keydown', onModifier);
    document.removeEventListener('keyup', onModifier);
    document.removeEventListener('pointermove', onEditMove, { capture: true });
    document.removeEventListener('pointerout', onEditOut, { capture: true });
    document.removeEventListener('click', onEditClick, { capture: true });
    document.removeEventListener('contextmenu', onEditMenu, { capture: true });
    clearTimeout(ui.toastTimer);
    ui.sheet.remove();
    ui.host.remove();
    ui = null;
    document.dispatchEvent(new CustomEvent('texture-kit:close'));
  }

  // What the kit leaves standing while closed: a way in. Any element marked
  // data-texture-kit-open opens it - the button under the page title - and
  // Shift+T toggles it.
  document.addEventListener('click', (ev) => {
    if (!ui && ev.target.closest?.('[data-texture-kit-open]')) open();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'T' || !ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.composedPath()[0];
    if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
    ui ? close() : open();
  });
  if (/[?&]texture\b/.test(location.search)) open();
})();
