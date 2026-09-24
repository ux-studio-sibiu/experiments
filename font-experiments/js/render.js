/* render — state to DOM.
   The one direction: every control writes to `state` and calls render(), so
   there is a single place that knows how a value becomes a pixel. Holds the
   block renderers, the menu, the pattern overlay and restack(). */

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
  // Treatment, applied to the layer rather than baked into the picture, so a
  // re-roll of the photograph keeps it. A blur on a box that ends exactly at
  // the artboard's edge fades the edge out with it, so the layer is grown by
  // the radius it is blurred with — it is a cover-sized background, and there
  // is always more picture to show.
  const { sat, blur } = state.bg;
  bgLayer.style.filter = (sat === 1 && !blur) ? 'none' : `saturate(${sat}) blur(${blur}px)`;
  bgLayer.style.inset = blur ? `-${Math.round(blur * 2)}px` : '0';
  SVGBG.render();               // a drawn background over the picture, if one is on
  scrimEl.style.background = scrim.enabled
    ? hexRgba(scrim.color === 'dark' ? '#000000' : '#ffffff', scrim.amount)
    : 'transparent';
  renderPattern();
  renderFx();
  renderPlate();
  TEXT_ROLES.forEach(applyRole);
  renderTopMenu();
  CTA.render();
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
/* Where the bar sits: left and top in screen pixels, the way every other block
   is placed. Its own function only because a drag writes the position dozens of
   times a second and must not go the long way round through a whole render.

   The anchor is NOT here. It says how a position is written down and read back
   — see menuOffsets() below — and never how the bar behaves while you are
   moving it. Dragging, nudging and resizing stay exactly what they were. */
function placeMenu() {
  const m = state.topmenu, el = els.topmenu;
  el.style.left = m.x + 'px';
  el.style.top = m.y + 'px';
  el.style.right = el.style.bottom = 'auto';
  el.style.transform = '';
}

/* ---- the anchor: a way of writing a position down ----
   The bar is the one thing measured in screen pixels, so "120 from the left"
   means a different place on a different screen. The anchor names the point a
   saved position is counted from, and these two functions are the whole of it:
   one converts the live left/top into that form on the way into a scene file,
   the other converts it back on the way out, against whatever window is there
   now. In between, x and y are plain left and top like everything else. */
function menuOffsets() {
  const m = state.topmenu, [v, h] = m.anchor || 'tl';
  const r = els.topmenu.getBoundingClientRect();
  const w = r.width || m.boxW || 0, ht = r.height || m.boxH || 0;
  return {
    x: Math.round(h === 'l' ? m.x : h === 'c' ? m.x + w / 2 - innerWidth / 2 : innerWidth - (m.x + w)),
    y: Math.round(v === 't' ? m.y : v === 'm' ? m.y + ht / 2 - innerHeight / 2 : innerHeight - (m.y + ht)),
  };
}
// The other direction, run once after a scene has been applied and the bar has
// been laid out — its size is half of the sum, and only the DOM knows it.
function menuFromOffsets(ax, ay) {
  const m = state.topmenu, [v, h] = m.anchor || 'tl';
  const r = els.topmenu.getBoundingClientRect();
  const w = r.width || m.boxW || 0, ht = r.height || m.boxH || 0;
  m.x = Math.round(h === 'l' ? ax : h === 'c' ? innerWidth / 2 + ax - w / 2 : innerWidth - ax - w);
  m.y = Math.round(v === 't' ? ay : v === 'm' ? innerHeight / 2 + ay - ht / 2 : innerHeight - ay - ht);
  placeMenu();
}

function renderTopMenu() {
  const m = state.topmenu, el = els.topmenu;
  if (!m.enabled) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  // Screen pixels, not artboard ones: the bar is chrome, anchored to the window.
  placeMenu();
  // Its own box if it has been given one, the width of the window otherwise —
  // the same bar whichever corner it is measured from.
  el.style.width = m.boxW ? m.boxW + 'px' : '100%';
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
  // A hidden block takes no room, and a held one keeps where it is — held by
  // its own lock or by the section's, which is what rollable() folds together.
  const stack = TEXT_ROLES.filter(k => rollable(k) && state[k].enabled);
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
  // rollable(), not locks[]: the plate is a layer of Typography now, so a lock
  // on the section has to hold its placement the way it holds the type's.
  if (state.plate.enabled && rollable('plate')) plateToText();
}

// The plate wrapped around the text, which is what the old card's padding did.
// An explicit action rather than a live binding, so a plate you have placed by
// hand is never yanked back.
// How far the plate spreads past the text when it is fitted. A constant now:
// it is a margin, and a margin nobody needs to argue with is not a control.
const PLATE_PAD = 14;
function plateToText() {
  const p = state.plate, pad = PLATE_PAD;
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
