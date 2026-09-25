/* init — first paint, and the console handle.
   Last file in, so everything it calls exists. The artboard bootstrap lives
   here rather than in artboard.js for exactly that reason: fitScene() reaches
   forward into interact.js, and a function is hoisted within its own file but
   not across separate <script>s. */

addEventListener('resize', fitScene);
fitScene();

/* ============================ init ============================ */
const params = new URLSearchParams(location.search);

/* ---- how much of the interface to open with ----
   ?ui=hide      no panel and nothing to bring it back, for a frame in a page
                 where the cover is the whole point
   ?ui=minimize  folded away to the maximize button, a click from opening
   ?ui=full      the panel up, whatever the rest of the URL says

   With no ?ui at all, a URL that names a cover — ?curated or ?scene= — is
   taken as asking for the cover to be looked at rather than edited, so it
   minimizes. Plain / opens with the panel up, because that is the app.

   Minimizing measures the dock vector first, so pressing the maximize button
   grows the window back out of it exactly as it would had you folded it
   yourself. That measurement reads layout, though, which settles the panel at
   full size and leaves the class change to animate from there: an embed would
   open on a panel flying into a corner. Hence the suspended transition — it
   arrives folded, and only afterwards is it a thing that moves. */
// Not UI: js/state.js already has one, and these scripts share a scope.
const UI_MODES = { hide: 'hide', minimize: 'minimize', min: 'minimize', full: 'full', show: 'full' };
const namesACover = params.has('curated') || params.has('scene');
const ui = UI_MODES[(params.get('ui') || '').toLowerCase()] || (namesACover ? 'minimize' : 'full');

if (ui === 'hide') {
  document.body.classList.add('panel-gone');
} else if (ui === 'minimize') {
  const panel = $('panel'), held = panel.style.transition;
  panel.style.transition = 'none';
  dockPanel();
  document.body.classList.add('panel-hidden');
  void panel.offsetWidth;            // commit the folded state before animation returns
  panel.style.transition = held;
}
if (params.has('curated')) {
  // ?curated → a hand-picked cover (deterministic, offline-safe)
  const n = parseInt(params.get('curated'), 10);
  const preset = Number.isInteger(n)
    ? CURATED[((n % CURATED.length) + CURATED.length) % CURATED.length]
    : CURATED[Math.floor(Math.random() * CURATED.length)];
  applyPreset(preset);
} else {
  // Three ways to open, each falling through to the next:
  //
  //   ?scene=<path|name|folder|random>  the cover named in the URL
  //   nothing                           a random cover from scenes/initial-load/
  //   neither could be read             a random pairing + a random photo
  //
  // The last one runs only as a fallback, and only once the others have said
  // no: firing it first would leave loadRandomPhoto's fetch to land after the
  // scene and paint over its background.
  loadNamedScene(params.get('scene'))
    .then(ok => ok || loadInitialScene())
    .then(ok => {
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
