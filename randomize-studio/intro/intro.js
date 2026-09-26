/* intro — the two things this page has to do in script.

   Both talk to the frame, and both work because the studio is served from the
   same origin as this page. */

const frame = document.querySelector('.frame iframe');

/* ============================ the frame's scale ============================
   The studio is laid out at its artboard's size, 1600 x 900, and scaled down to
   the frame as a whole (see .frame in intro.css), so the cover keeps the
   proportions it was made at. The scale is the frame's inner width over 1600,
   written as --frame-scale whenever the frame changes size - CSS cannot turn a
   width into a plain number for scale() in every browser yet.

   1600 x 900 is the studio's default artboard (--ref-w / --ref-h in
   css/base.css), which is what the covers in scenes/currated/ are made at. */
const ARTBOARD_W = 1600;
if (frame) {
  const box = frame.parentElement;
  const fit = () => box.style.setProperty('--frame-scale', String(box.clientWidth / ARTBOARD_W));
  new ResizeObserver(fit).observe(box);
  fit();
}

/* ============================ the scroll bridge ============================
   The studio forwards its wheel events to the parent rather than handling
   them: embedded in a portfolio it must not swallow the scroll of the page
   around it, so it calls preventDefault and posts { type: 'scroll', deltaY }
   upward (see the end of js/init.js).

   The frame does not take pointer events any more, so the wheel reaches this
   page directly and this listener no longer fires on THIS page. It stays
   because it is what makes the studio embeddable at all: turn pointer-events
   back on, or drop the frame into a page that wants it interactive, and the
   wheel goes to the studio again - with nothing listening up here, the page
   around it would appear stuck the moment the pointer crossed in. */
if (frame) {
  addEventListener('message', (e) => {
    // Only from our own frame, and only the message we know: a page is open to
    // anything that can reach postMessage.
    if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.type !== 'scroll' || typeof msg.deltaY !== 'number') return;
    scrollBy({ top: msg.deltaY });
  });
}

/* ============================ the cover cycle ============================
   A cover every three seconds from scenes/currated/, so the page shows what the
   studio makes rather than one still frame of it.

   It asks the frame to load the scene instead of changing its src. A new src
   re-runs the whole app: every script, the fonts, a fresh photo, a flash of
   empty artboard. The message swaps the cover the way clicking the scene list
   does, which is what a visitor sees the studio doing anyway.

   The folder is read from the manifest rather than listed here, so adding a
   cover to scenes/currated/ puts it in the rotation - run the update-scenes
   tools after adding one. If the manifest cannot be read, nothing cycles and
   the frame keeps the cover it opened with. */
(async () => {
  const CYCLE_MS = 3000;
  const FOLDER = 'currated';
  const button = document.querySelector('.cyclebtn');
  if (!frame || !button) return;

  const manifest = await fetch('../scenes/index.json', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  const files = ((manifest && manifest.scenes) || [])
    .map(s => s.file).filter(f => f.startsWith(FOLDER + '/'));
  // One cover is not a rotation.
  if (files.length < 2) return;

  // `editing` is a hold of its own, apart from `paused`: while the texture kit
  // is open the rotation stops, and closing the kit gives back whatever state
  // the pause button had - a rotation you had paused stays paused. The kit
  // says when it opens and closes with two events on the document; a kit that
  // is already open when this gets here (?texture, before the manifest came
  // back) is found by its panel.
  let at = -1, timer = null, paused = false;
  let editing = !!document.querySelector('body > [data-texture-kit]');
  const box = frame.parentElement;   // the frame, which is the black behind it
  // Long enough to read as a dip rather than a blink, short enough that the
  // cover is up for most of the turn. The two together are a fifth of it.
  const FADE_MS = 200;

  // The bar along the bottom of the cover grows over exactly one turn.
  // Infinite rather than restarted per swap so it never stutters, and pinned
  // to zero on every swap so it cannot drift away from an interval that is not
  // a metronome. Pausing leaves it part-grown, which is what a held rotation
  // should look like.
  const barEl = document.querySelector('.cyclebar');
  const bar = barEl && barEl.animate(
    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    { duration: CYCLE_MS, iterations: Infinity, easing: 'linear', fill: 'both' });

  const send = () => frame.contentWindow.postMessage({ type: 'scene', name: files[at] }, location.origin);

  // Out to black, change underneath, back in. What fades is the cover itself,
  // so what stays is the frame it sits in — black, the same black the studio
  // is dark on. Nothing white is ever drawn over it, and neither the swap nor
  // a slow-loading iframe can leave a pale hole in the page.
  //
  // The swap has to happen at the bottom of the dip or the change shows
  // through it, and the cover is only brought back after two frames: the
  // first is when the new one is applied, the second is when it has been
  // painted. Bringing it back on the same frame would put the OLD cover on
  // screen for one tick of it.
  //
  // A timer races those frames, because a window that is not being drawn parks
  // requestAnimationFrame indefinitely. Normally show() is not called then at
  // all - document.hidden says so - but the two are not the same thing, and a
  // window that stops drawing without saying it is hidden would leave the
  // frame black for good. Whichever arrives first wins; the second then takes
  // off a class that is already off.
  const lift = () => box.classList.remove('is-swapping');
  const show = () => {
    at = (at + 1) % files.length;
    if (bar) bar.currentTime = 0;
    box.classList.add('is-swapping');
    setTimeout(() => {
      send();
      requestAnimationFrame(() => requestAnimationFrame(lift));
      setTimeout(lift, FADE_MS);
    }, FADE_MS);
  };
  // Nothing happens while the tab is in the background: a cover a second is
  // work nobody is watching, and the app would be mid-swap on the way back.
  const tick = () => { if (!document.hidden) show(); };
  // Both clocks start together on a resume: setInterval counts from now, so a
  // bar left part-filled would reach the end before the swap did.
  const start = () => {
    if (paused || editing || timer) return;
    if (bar) { bar.currentTime = 0; bar.play(); }
    timer = setInterval(tick, CYCLE_MS);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    if (bar) bar.pause();
  };

  button.hidden = false;
  // aria-pressed is the whole of the state: the stylesheet draws the mark from
  // it, and the label says the same thing to anyone who cannot see the mark.
  const label = () => {
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Resume the cover rotation' : 'Pause the cover rotation');
  };

  const toggle = () => {
    paused = !paused;
    paused ? stop() : start();
    label();
  };

  // The button sits over the cover link, so its click must not also open the
  // studio underneath it.
  button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });

  // Hovering is reaching for it: the cover must not change out from under a
  // drag. The pointer leaving starts it again.
  frame.parentElement.addEventListener('pointerenter', stop);
  frame.parentElement.addEventListener('pointerleave', start);

  // Coming back to the tab restarts both clocks together. start() alone would
  // not: the interval has been running all along (its swaps skipped), while
  // the animation was parked with the rest of the page, so the bar would be
  // frozen part-way through a turn it is no longer in step with.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    stop();
    start();
  });

  document.addEventListener('texture-kit:open', () => { editing = true; stop(); });
  document.addEventListener('texture-kit:close', () => { editing = false; start(); });

  label();
  start();
})();
