/* init — first paint, and the console handle.
   Last file in, so everything it calls exists. The artboard bootstrap lives
   here rather than in artboard.js for exactly that reason: fitScene() reaches
   forward into interact.js, and a function is hoisted within its own file but
   not across separate <script>s. */

addEventListener('resize', fitScene);
fitScene();

/* ============================ init ============================ */
const params = new URLSearchParams(location.search);
if (params.has('curated')) {
  // ?curated → a hand-picked cover (deterministic, offline-safe)
  const n = parseInt(params.get('curated'), 10);
  const preset = Number.isInteger(n)
    ? CURATED[((n % CURATED.length) + CURATED.length) % CURATED.length]
    : CURATED[Math.floor(Math.random() * CURATED.length)];
  applyPreset(preset);
} else {
  // default: one of the finished covers in scenes/initial-load/, picked at
  // random, so a refresh opens on something composed. The random pairing is
  // the fallback for when that folder cannot be read at all, and it runs only
  // then: firing it first would leave loadRandomPhoto's fetch to land after
  // the scene and paint over its background.
  loadInitialScene().then(ok => {
    if (ok) return;
    randomizeRoles(false, true);  // randomize fonts & lengths (skip bg — avoids a double random)
    loadRandomPhoto();             // single source for the first-load backdrop (a photo)
  });
}
window.fontLab = { state, REF, render, randomizeRoles, loadRandomPhoto, setText, applyPreset, CURATED,
                   serializeScene, applyScene, fitScene, placeFrame, restack, plateToText }; // handy for console tinkering

/* ============================ scroll bridge ============================ */
// When embedded in an iframe (e.g. the portfolio), wheel events are swallowed
// by this document and never reach the parent's scroll-hijacking navigation.
// Mirror game-dev.ro's ScrollBridge: forward the wheel up via postMessage so
// scrolling over the cover advances the portfolio section. The parent listens
// for { type: 'scroll', deltaY } and calls prev/next section.
// Extra guard vs. the original: let the editor panel scroll natively.
if (window.parent && window.parent !== window) {
  window.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('#panel')) return; // keep the panel scrollable
    e.preventDefault();
    window.parent.postMessage({ type: 'scroll', deltaY: e.deltaY }, '*');
  }, { passive: false });
}
