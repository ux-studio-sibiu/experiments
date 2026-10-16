/**
 * swipe-effect - a scroll-driven diagonal wipe from one full-screen image to the next, chained into a story.
 *
 * After the before/after section on kota.co.uk/work/dka: there, one pinned frame is scrubbed by the scroll,
 * the top image clipped away behind a slanted edge (clip-path polygon), a thin divider in the brand colour
 * riding the edge, and a dark cover deepening on the image as it leaves. Here the same wipe runs once per
 * chapter over any number of slides, with optional captions crossfading in step and a slow zoom-out on the
 * image being revealed.
 *
 * Isolated, zero-dependency reproduction. Pure CSS clip-path + one scroll listener; no GSAP, no pinning
 * library - the stage is position: sticky inside a section made tall enough for the chapters.
 *
 * Markup it drives (class names are the defaults; content stays in the page):
 *   <section class="nsc-swipe-story">            <- container: gets its height from the slide count
 *     <div class="stage">                         <- sticky, one screen tall
 *       <figure class="slide"><img src="..."></figure>   <- first slide on top, wiped away first
 *       <figure class="slide"><img src="..."></figure>
 *       <div class="chapter">...</div>            <- optional, one per slide, same order
 *     </div>
 *   </section>
 *
 * Usage (ES module):
 *   import { createSwipeEffect } from './swipe-effect.js';
 *   const fx = createSwipeEffect({ container: document.querySelector('.nsc-swipe-story') });
 *   fx.set('slant', 30);   // tweak at runtime (this is what sliders call)
 *   fx.destroy();
 *
 * Usage (script tag): window.createSwipeEffect is exposed.
 */

// Every tunable param lives here, each one settable live through set().
const DEFAULTS = {
  container: null,          // the section; required
  stageSelector: '.stage',
  slideSelector: '.slide',
  chapterSelector: '.chapter',
  step: 120,                // scroll per wipe, in % of the screen height
  hold: 0.3,                // share of each step spent still before and after the wipe (0 - 0.9)
  slant: 20,                // how far the top of the edge leads the bottom, in % of the width (Kota: 20)
  direction: 'ltr',         // 'ltr': the edge travels left to right; 'rtl': right to left
  divider: 0.5,             // width of the edge line, in % of the width (Kota: 0.5); 0 hides it
  dividerColor: '#7f7d69',  // Kota's DK&A brand colour
  shade: 0.8,               // darkness on the leaving image at the end of its wipe (Kota: 0.8)
  zoom: 1.08,               // the revealed image settles from this scale to 1 as it is uncovered
  smooth: 0.15,             // 0 follows the scroll exactly; higher eases toward it (0 - 0.95)
  onUpdate: null,           // (progress 0-1, index, t) => {} on every rendered frame
  respectReducedMotion: true,
};

function createSwipeEffect(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const container = cfg.container;
  if (!container) throw new Error('createSwipeEffect: a container is required');
  const stage = container.querySelector(cfg.stageSelector);
  const slides = [...stage.querySelectorAll(cfg.slideSelector)];
  const chapters = [...stage.querySelectorAll(cfg.chapterSelector)];
  const count = slides.length;

  const reducedMotion =
    cfg.respectReducedMotion &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- setup ---------------------------------------------------------------
  // Structural styles are set inline so the module works without a stylesheet; destroy() takes them back.
  const media = slides.map((s) => s.querySelector('img, video, canvas')).filter(Boolean);
  const touched = [container, stage, ...slides, ...media, ...chapters];
  const saved = touched.map((el) => el.getAttribute('style'));

  stage.style.position = 'sticky';
  stage.style.top = '0';
  stage.style.height = '100vh';
  stage.style.overflow = 'hidden';
  slides.forEach((slide, i) => {
    Object.assign(slide.style, { position: 'absolute', inset: '0', margin: '0', zIndex: String(count - i) });
  });
  media.forEach((m) => Object.assign(m.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }));
  // the shade over each slide, deepening as it is wiped away
  const covers = slides.map((slide) => {
    const c = document.createElement('div');
    Object.assign(c.style, { position: 'absolute', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none' });
    slide.appendChild(c);
    return c;
  });
  // the edge line, above every slide
  const line = document.createElement('div');
  Object.assign(line.style, { position: 'absolute', inset: '0', zIndex: String(count + 1), pointerEvents: 'none' });
  stage.appendChild(line);
  chapters.forEach((ch) => { ch.style.zIndex = String(count + 2); ch.style.willChange = 'opacity, transform'; });

  function resize() {
    container.style.height = `calc(100vh + ${(Math.max(count, 1) - 1) * cfg.step}vh)`;
    target = progressFromScroll();
  }

  function progressFromScroll() {
    const span = container.offsetHeight - innerHeight;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, -container.getBoundingClientRect().top / span));
  }

  // --- render --------------------------------------------------------------
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);   // in-out quad, for the wipe itself
  const clampHold = () => Math.min(0.9, Math.max(0, cfg.hold));

  // The clip of a slide whose edge has travelled t (0 - 1): the edge's foot runs from -slant to 100, its top
  // always slant ahead, so it enters and leaves the frame fully.
  function edge(t) {
    const foot = -cfg.slant + t * (100 + cfg.slant);
    return { foot, head: foot + cfg.slant };
  }
  const mirror = (x) => (cfg.direction === 'rtl' ? 100 - x : x);

  function render(progress) {
    const u = progress * (count - 1);
    const index = Math.min(count - 2, Math.floor(u));
    const local = u - index;
    const hold = clampHold() / 2;
    const t = ease(Math.min(1, Math.max(0, (local - hold) / (1 - 2 * hold))));
    const zoom = reducedMotion ? 1 : cfg.zoom;

    slides.forEach((slide, k) => {
      let clip = 'none', shade = 0, scale = 1, hidden = false;
      if (k < index) hidden = true;                          // already wiped away
      else if (k === index) {                                // the one leaving
        const { foot, head } = edge(t);
        clip = cfg.direction === 'rtl'
          ? `polygon(0 0, ${mirror(head)}% 0, ${mirror(foot)}% 100%, 0 100%)`
          : `polygon(${head}% 0, 100% 0, 100% 100%, ${foot}% 100%)`;
        shade = cfg.shade * t;
        hidden = t >= 1;
      } else if (k === index + 1) scale = zoom - (zoom - 1) * t;   // the one being uncovered
      else scale = zoom;                                     // waiting underneath
      slide.style.clipPath = clip;
      slide.style.visibility = hidden ? 'hidden' : '';
      slide.style.transform = scale === 1 ? '' : `scale(${scale})`;
      covers[k].style.opacity = String(shade);
    });

    // the line rides the edge of the leaving slide, only while it is crossing
    const crossing = t > 0 && t < 1 && cfg.divider > 0;
    if (crossing) {
      const { foot, head } = edge(t);
      const w = cfg.divider;
      line.style.background = cfg.dividerColor;
      line.style.clipPath = `polygon(${mirror(head - w)}% 0, ${mirror(head)}% 0, ${mirror(foot)}% 100%, ${mirror(foot - w)}% 100%)`;
    }
    line.style.visibility = crossing ? '' : 'hidden';

    // captions crossfade with the wipe: the leaving chapter out, the arriving one in
    chapters.forEach((ch, k) => {
      const o = k === index ? 1 - t : k === index + 1 ? t : 0;
      ch.style.opacity = String(o);
      ch.style.transform = `translateY(${(1 - o) * (k === index ? -24 : 24)}px)`;
      ch.style.visibility = o > 0.001 ? '' : 'hidden';
    });

    if (typeof cfg.onUpdate === 'function') cfg.onUpdate(progress, index, t);
  }

  // --- loop ----------------------------------------------------------------
  // Runs only while the shown progress is catching up with the scroll; idle otherwise.
  let target = 0, shown = -1, rafId = 0;
  function frame() {
    rafId = 0;
    const k = reducedMotion ? 0 : Math.min(0.95, Math.max(0, cfg.smooth));
    shown = shown < 0 || k === 0 ? target : shown + (target - shown) * (1 - k);
    if (Math.abs(target - shown) < 0.0002) shown = target;
    render(shown);
    if (shown !== target) rafId = requestAnimationFrame(frame);
  }
  function update() { target = progressFromScroll(); if (!rafId) rafId = requestAnimationFrame(frame); }
  function onResize() { resize(); update(); }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', onResize);

  if (count > 1) { resize(); update(); }

  // --- public API ----------------------------------------------------------
  const api = {
    resize: onResize,

    // The contract sliders use: update a param and apply it live.
    set(name, value) {
      if (!(name in cfg)) return api;
      cfg[name] = value;
      if (name === 'step') resize();
      shown = -1;                 // redraw at once, no catch-up
      update();
      return api;
    },

    // Swap a slide's image for a URL, or for an <img>/<canvas>/<video> element.
    setSlide(index, source) {
      const slide = slides[index];
      if (!slide) return api;
      const old = slide.querySelector('img, video, canvas');
      let el = source;
      if (typeof source === 'string') { el = document.createElement('img'); el.src = source; el.alt = old?.alt ?? ''; }
      Object.assign(el.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
      if (old) old.replaceWith(el); else slide.prepend(el);
      return api;
    },

    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', onResize);
      covers.forEach((c) => c.remove());
      line.remove();
      touched.forEach((el, i) => { if (saved[i] === null) el.removeAttribute('style'); else el.setAttribute('style', saved[i]); });
    },
  };
  return api;
}

export { createSwipeEffect };
export default createSwipeEffect;

if (typeof window !== 'undefined') {
  window.createSwipeEffect = createSwipeEffect;
}
