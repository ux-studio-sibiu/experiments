/**
 * static-background — animated film-grain / TV-static overlay.
 *
 * Reproduces the grainy static texture that fades in behind menus on sites
 * like newformcap.com: a fast-flickering monochrome noise layer. It can sit
 * over transparent (page shows through), over a flat colour, or — for a filmic
 * look — over a background **image** that the grain mixes into via a blend mode.
 * Zero dependencies, pure Canvas 2D.
 *
 * Compositing model (per frame, all inside the one canvas):
 *   1. clear
 *   2. fill `background` colour            (if not 'transparent')
 *   3. draw `image` with `imageFit`        (if one is set)
 *   4. draw the noise on top at `opacity`, blended with `grainBlend`
 * The canvas's own CSS opacity is used only for the show()/hide() fade.
 *
 * Usage (ES module):
 *   import { createStaticBackground } from './static-background.js';
 *   const fx = createStaticBackground({ container: menuEl, image: 'bg.jpg' });
 *   fx.show();  fx.hide();  fx.setImage('other.jpg');  fx.destroy();
 *
 * Usage (script tag): window.createStaticBackground is exposed.
 */

const DEFAULTS = {
  /** Element the canvas is appended to (fills it). Default: document.body. */
  container: null,
  /** Grain strength (0..1). With an image, this is how strongly snow mixes in. */
  opacity: 0.10,
  /** Grain refresh rate in frames/sec. Lower = chunkier, more "film". 12–30. */
  fps: 24,
  /** Size of one noise cell in CSS px. >1 = coarser/blockier static. */
  cellSize: 1.5,
  /** Fraction of cells that receive grain each frame (0..1). 1 = dense TV snow. */
  density: 1,
  /** RGB tint as [r,g,b] 0..255, or null for neutral grayscale snow. */
  color: null,
  /** Background IMAGE: a URL string, or an HTMLImageElement/Canvas, or null. */
  image: null,
  /** How the image fills the canvas: 'cover' | 'contain' | 'fill'. */
  imageFit: 'cover',
  /** Draw the image in black and white (the grain keeps its own tint). */
  mono: false,
  /** Blur the image, in CSS px (0 = sharp). A soft, out-of-focus backdrop behind crisp grain. */
  blur: 0,
  /** Blur the grain, in CSS px (0 = crisp cells). Softens TV snow towards film grain. */
  grainBlur: 0,
  /** How the grain mixes over the image/colour (canvas globalCompositeOperation):
   *  'overlay' (filmic), 'soft-light', 'screen' (additive snow), 'source-over'… */
  grainBlend: 'overlay',
  /** Flat backdrop painted behind the grain (and behind the image). */
  background: 'transparent',
  /** CSS mix-blend-mode for the whole canvas vs. the page behind it. */
  blendMode: 'normal',
  /** Fade duration in ms for show()/hide(). */
  fade: 320,
  /** Stacking order of the overlay canvas. */
  zIndex: 9999,
  /** Forward pointer events to content underneath (true) or capture them (false). */
  passthrough: true,
  /** Start visible immediately. */
  autostart: false,
  /** Honour `prefers-reduced-motion`: render a single still grain frame. */
  respectReducedMotion: true,
};

function createStaticBackground(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const container = cfg.container || document.body;

  const reducedMotion =
    cfg.respectReducedMotion &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- canvas setup --------------------------------------------------------
  const canvas = document.createElement('canvas');
  const s = canvas.style;
  s.position = 'absolute';
  s.inset = '0';
  s.width = '100%';
  s.height = '100%';
  s.display = 'block';
  s.zIndex = String(cfg.zIndex);
  s.pointerEvents = cfg.passthrough ? 'none' : 'auto';
  s.mixBlendMode = cfg.blendMode;
  s.opacity = '0'; // CSS opacity drives only the show/hide fade
  s.transition = `opacity ${cfg.fade}ms ease`;

  const ctx = canvas.getContext('2d');
  container.appendChild(canvas);

  // Noise is generated into this smaller offscreen buffer (1 px per cell) then
  // stretched up with smoothing off — both the look (crisp blocks) and the
  // speed (far fewer writes).
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');
  let imageData = null;

  // The base (backdrop colour + image, with its mono/blur filter) is drawn once into this offscreen canvas
  // and reused every frame - only the grain changes per frame, and a blur is too costly to redo 24 times a second.
  const base = document.createElement('canvas');
  const basectx = base.getContext('2d');
  let baseDirty = true;

  let cssW = 0, cssH = 0, bufW = 0, bufH = 0;

  // --- background image ----------------------------------------------------
  let imgEl = null;       // the image being drawn
  let imgReady = false;
  let pending = null;     // the image loading to replace it - the current one stays up until it arrives

  function useLoaded(el) {
    if (pending !== el) return;   // superseded by a later setImage
    pending = null; imgEl = el; imgReady = true; baseDirty = true;
    if (!running) renderFrame();
  }

  function setImage(src) {
    pending = null;
    if (!src) { imgEl = null; imgReady = false; baseDirty = true; if (!running) renderFrame(); return; }
    // an element is used as given; a URL string gets an image to load into
    const el = (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) ? src : new Image();
    pending = el;
    if (el instanceof HTMLCanvasElement || (el.complete && el.naturalWidth > 0)) { useLoaded(el); return; }
    el.addEventListener('load', () => useLoaded(el), { once: true });
    el.addEventListener('error', () => { if (pending === el) pending = null; }, { once: true });   // a failed load leaves the current image up
    if (el !== src) { el.decoding = 'async'; el.src = src; }
  }

  // `pad` grows the drawn image past the edges on every side, so a blur doesn't fade the borders to transparent.
  function drawImageFit(c, img, pad = 0) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const W = cssW + pad * 2, H = cssH + pad * 2;
    if (cfg.imageFit === 'fill') { c.drawImage(img, -pad, -pad, W, H); return; }
    const cr = W / H, ir = iw / ih;
    let dw, dh;
    if (cfg.imageFit === 'contain' ? ir > cr : ir < cr) { dw = W; dh = W / ir; }
    else { dh = H; dw = H * ir; }
    c.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
  }

  function renderBase() {
    baseDirty = false;
    basectx.clearRect(0, 0, cssW, cssH);
    if (cfg.background && cfg.background !== 'transparent') { basectx.fillStyle = cfg.background; basectx.fillRect(0, 0, cssW, cssH); }
    if (!(imgEl && imgReady)) return;
    const blur = Math.max(0, +cfg.blur || 0);
    const filter = [cfg.mono ? 'grayscale(1)' : '', blur ? `blur(${blur}px)` : ''].join(' ').trim();
    basectx.imageSmoothingEnabled = true;
    basectx.filter = filter || 'none';
    drawImageFit(basectx, imgEl, blur * 2);
    basectx.filter = 'none';
  }

  // --- sizing --------------------------------------------------------------
  function resize() {
    cssW = container.clientWidth || window.innerWidth;
    cssH = container.clientHeight || window.innerHeight;
    canvas.width = cssW;
    canvas.height = cssH;
    base.width = cssW;
    base.height = cssH;
    baseDirty = true;

    bufW = Math.max(1, Math.ceil(cssW / cfg.cellSize));
    bufH = Math.max(1, Math.ceil(cssH / cfg.cellSize));
    buffer.width = bufW;
    buffer.height = bufH;
    imageData = bctx.createImageData(bufW, bufH);

    if (reducedMotion || !running) renderFrame();
  }

  // --- noise + compositing -------------------------------------------------
  function fillNoiseBuffer() {
    const data = imageData.data;
    const n = bufW * bufH;
    const tint = cfg.color;
    const density = cfg.density;
    for (let i = 0; i < n; i++) {
      const o = i << 2;
      if (density < 1 && Math.random() > density) { data[o + 3] = 0; continue; }
      const v = (Math.random() * 256) | 0;
      if (tint) {
        data[o]     = (tint[0] * v) >> 8;
        data[o + 1] = (tint[1] * v) >> 8;
        data[o + 2] = (tint[2] * v) >> 8;
      } else {
        data[o] = data[o + 1] = data[o + 2] = v;
      }
      data[o + 3] = 255;
    }
    bctx.putImageData(imageData, 0, 0);
  }

  function renderFrame() {
    // base layers
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cssW, cssH);

    const hasBase = (cfg.background && cfg.background !== 'transparent') || (imgEl && imgReady);
    if (hasBase) {
      if (baseDirty) renderBase();
      ctx.drawImage(base, 0, 0);
    }

    // grain on top, mixed into the base
    fillNoiseBuffer();
    const grainBlur = Math.max(0, +cfg.grainBlur || 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = cfg.opacity;
    ctx.globalCompositeOperation = hasBase ? cfg.grainBlend : 'source-over';
    ctx.filter = grainBlur ? `blur(${grainBlur}px)` : 'none';
    ctx.drawImage(buffer, 0, 0, bufW, bufH, 0, 0, cssW, cssH);

    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // --- animation loop ------------------------------------------------------
  let rafId = 0;
  let running = false;
  let visible = false;
  let lastFrame = -Infinity;

  function frame(ts) {
    if (!running) return;
    const interval = 1000 / cfg.fps;
    if (ts - lastFrame >= interval) { lastFrame = ts; renderFrame(); }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reducedMotion) { if (reducedMotion) renderFrame(); return api; }
    running = true;
    lastFrame = -Infinity;
    rafId = requestAnimationFrame(frame);
    return api;
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    return api;
  }

  // --- visibility / lifecycle ---------------------------------------------
  function show() {
    visible = true;
    s.opacity = '1';
    start();
    return api;
  }

  function hide() {
    visible = false;
    s.opacity = '0';
    clearTimeout(hide._t);
    hide._t = setTimeout(() => { if (!visible) stop(); }, cfg.fade + 50);
    return api;
  }

  function toggle(force) {
    const next = typeof force === 'boolean' ? force : !visible;
    return next ? show() : hide();
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else if (visible) start();
  }

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null;
  if (ro) ro.observe(container);
  else window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // --- public API ----------------------------------------------------------
  const api = {
    canvas,
    show,
    hide,
    toggle,
    start,
    stop,
    resize,
    setImage,
    get visible() { return visible; },

    /** Update a knob at runtime. Geometry changes (cellSize) trigger a resize. */
    set(name, value) {
      if (name === 'image') { setImage(value); return api; }
      if (!(name in cfg)) return api;
      cfg[name] = value;
      if (['background', 'imageFit', 'mono', 'blur'].includes(name)) baseDirty = true;   // redraw the cached base
      switch (name) {
        case 'blendMode':  s.mixBlendMode = value; break;
        case 'zIndex':     s.zIndex = String(value); break;
        case 'cellSize':   resize(); break;
        case 'passthrough': s.pointerEvents = value ? 'none' : 'auto'; break;
        default: break; // opacity/density/color/background/imageFit/grainBlend
      }
      if (!running) renderFrame(); // reflect change immediately when idle
      return api;
    },

    destroy() {
      stop();
      clearTimeout(hide._t);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (canvas.parentNode === container) container.removeChild(canvas);
    },
  };

  // Init runs AFTER `api` exists — show()/start() reference `api`, so calling
  // them earlier (e.g. via autostart) would hit a temporal-dead-zone error.
  if (cfg.image) setImage(cfg.image);
  resize();
  if (cfg.autostart) show();

  return api;
}

// ES module export …
export { createStaticBackground };
export default createStaticBackground;

// … and a global for plain <script> includes.
if (typeof window !== 'undefined') {
  window.createStaticBackground = createStaticBackground;
}
