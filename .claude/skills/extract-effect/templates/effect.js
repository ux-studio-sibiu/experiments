/**
 * <effect-name> — <one-line description of the effect and where it's from>.
 *
 * Isolated, zero-dependency reproduction. Pure <Canvas2D | CSS | WebGL>.
 *
 * Usage (ES module):
 *   import { create<EffectName> } from './<effect-name>.js';
 *   const fx = create<EffectName>({ container: el });
 *   fx.set('someParam', 0.5);   // tweak at runtime (this is what sliders call)
 *   fx.destroy();
 *
 * Usage (script tag): window.create<EffectName> is exposed.
 */

// Every tunable param lives here. Each one should be exposed as a slider in the
// demo and handled in `set()` below so it can change at runtime.
const DEFAULTS = {
  container: null,        // element to attach to (default document.body)
  // …effect-specific params with sensible defaults…
  respectReducedMotion: true,
};

function create<EffectName>(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const container = cfg.container || document.body;

  const reducedMotion =
    cfg.respectReducedMotion &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- setup ---------------------------------------------------------------
  // Create canvas/DOM, attach to container. Keep the visible element sized to
  // the container and cap devicePixelRatio for perf.

  function resize() {
    // re-measure container, resize buffers
  }

  // --- render --------------------------------------------------------------
  function render() {
    // one frame of the effect, reading from `cfg`
  }

  // --- loop ----------------------------------------------------------------
  let rafId = 0, running = false;
  function frame() {
    if (!running) return;
    render();
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running || reducedMotion) { if (reducedMotion) render(); return api; }
    running = true; rafId = requestAnimationFrame(frame); return api;
  }
  function stop() { running = false; cancelAnimationFrame(rafId); return api; }

  // pause work the user can't see
  function onVisibilityChange() {
    if (document.hidden) stop(); else start();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  resize();
  start();

  // --- public API ----------------------------------------------------------
  const api = {
    start, stop, resize,

    // The contract sliders use: update a param and apply it live.
    set(name, value) {
      if (!(name in cfg)) return api;
      cfg[name] = value;
      // apply param-specific side effects here (restyle, resize, rebuild…)
      if (reducedMotion) render();
      return api;
    },

    destroy() {
      stop();
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // remove created DOM, dispose GL/textures
    },
  };
  return api;
}

export { create<EffectName> };
export default create<EffectName>;

if (typeof window !== 'undefined') {
  window.create<EffectName> = create<EffectName>;
}
