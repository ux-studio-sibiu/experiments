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

  let cssW = 0, cssH = 0, bufW = 0, bufH = 0;

  // --- background image ----------------------------------------------------
  let imgEl = null;       // currently-loaded image element
  let imgReady = false;

  function setImage(src) {
    if (!src) { imgEl = null; imgReady = false; if (!running) renderFrame(); return; }
    if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) {
      imgEl = src;
      imgReady = !!(src.complete ?? true) &&
                 (src.naturalWidth || src.width) > 0;
      if (!imgReady && src.addEventListener) {
        src.addEventListener('load', () => { imgReady = true; if (!running) renderFrame(); }, { once: true });
      } else if (!running) renderFrame();
      return;
    }
    // URL string
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { if (imgEl === im) { imgReady = true; if (!running) renderFrame(); } };
    im.onerror = () => { if (imgEl === im) { imgEl = null; imgReady = false; } };
    imgEl = im;
    imgReady = false;
    im.src = src;
  }

  function drawImageFit(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    if (cfg.imageFit === 'fill') { ctx.drawImage(img, 0, 0, cssW, cssH); return; }
    const cr = cssW / cssH, ir = iw / ih;
    let dw, dh;
    if (cfg.imageFit === 'contain' ? ir > cr : ir < cr) { dw = cssW; dh = cssW / ir; }
    else { dh = cssH; dw = cssH * ir; }
    ctx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
  }

  // --- sizing --------------------------------------------------------------
  function resize() {
    cssW = container.clientWidth || window.innerWidth;
    cssH = container.clientHeight || window.innerHeight;
    canvas.width = cssW;
    canvas.height = cssH;

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

    const hasColour = cfg.background && cfg.background !== 'transparent';
    if (hasColour) { ctx.fillStyle = cfg.background; ctx.fillRect(0, 0, cssW, cssH); }
    if (imgEl && imgReady) { ctx.imageSmoothingEnabled = true; drawImageFit(imgEl); }
    const hasBase = hasColour || (imgEl && imgReady);

    // grain on top, mixed into the base
    fillNoiseBuffer();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = cfg.opacity;
    ctx.globalCompositeOperation = hasBase ? cfg.grainBlend : 'source-over';
    ctx.drawImage(buffer, 0, 0, bufW, bufH, 0, 0, cssW, cssH);

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
