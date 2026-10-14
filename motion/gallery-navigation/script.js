gsap.registerPlugin(ScrollTrigger);

const gallery = document.querySelector('.nsc-gallery');
const vertical = gallery.querySelector('.vertical');
const horizontal = gallery.querySelector('.horizontal');
const diagonal = gallery.querySelector('.diagonal');
const leftTrack = vertical.querySelector('.column.is-reversed .track');
const rightTrack = vertical.querySelector('.column:not(.is-reversed) .track');
const topTrack = horizontal.querySelector('.row.is-reversed .track');
const bottomTrack = horizontal.querySelector('.row:not(.is-reversed) .track');
const diagonalTrack = diagonal.querySelector('.track');

// The 2x2 the rows end on: top-left and bottom-right fade, top-right and bottom-left carry on into the diagonal.
const fading = [topTrack.firstElementChild, bottomTrack.lastElementChild];
// The two staying turn black and white as the others fade, ready for the diagonal, which is all black and white.
const greying = [topTrack.children[1], bottomTrack.lastElementChild.previousElementSibling].map((p) => p.querySelector('img'));

// The diagonal line: each photo one cell right of and one cell above the last, the first in the bottom-left.
// The small ones fill the two corners of each step from the line's second photo on: the cell above that photo
// (left of the next) and the cell right of it (below the next).
const linePhotos = diagonalTrack.querySelectorAll('.photo:not(.small)');
const rows = linePhotos.length;
linePhotos.forEach((photo, i) => { photo.style.gridArea = `${rows - i} / ${i + 1}`; });
diagonalTrack.querySelectorAll('.small.upper').forEach((photo, k) => { photo.style.gridArea = `${rows - k - 2} / ${k + 2}`; });
diagonalTrack.querySelectorAll('.small.lower').forEach((photo, k) => { photo.style.gridArea = `${rows - k - 1} / ${k + 3}`; });

// The last corner pair, which grows to full cells around the line's last two: the opening 2x2 again.
const growing = ['.small.upper', '.small.lower'].map((s) => [...diagonalTrack.querySelectorAll(s)].pop());
// As they grow, all four of that last 2x2 come back to colour, matching the opening 2x2 the loop returns to.
const colouring = [...[...linePhotos].slice(-2), ...growing].map((p) => p.querySelector('img')).filter(Boolean);

// How far a track moves to bring its far end into view: its length less the window it moves in. With four cells
// and two showing, that is two cells and two gaps; the diagonal's five, three steps.
const travelY = (track) => Math.max(0, track.offsetHeight - track.parentElement.clientHeight);
const travelX = (track) => Math.max(0, track.offsetWidth - track.parentElement.clientWidth);

/* One timeline on one pinned scroll, in pixels: one unit of the timeline is one pixel of scrolling, and outside
   the eased stretches below the photos move a steady amount per pixel - SCROLL sets how much, per phase.

   Phase 1: the right column runs up from its top, the left - which starts at its bottom - runs down. They end on
   the left column's first two photos and the right column's last two: a 2x2 filling the screen.
   Into the 2x2: the last cell of that travel decelerates to a stop instead of arriving at full speed.
   Hold: a quarter of a screen of scrolling (HOLD) where nothing moves, so the 2x2 lands as a moment of its own. The rows
   replace the columns inside it, holding the same four photos in the same places, so nothing on screen changes.
   Out of the 2x2: the first cell of the horizontal travel accelerates from rest.
   Phase 2: the top row runs right, bringing its two in from the left; the bottom row runs left, bringing its
   two in from the right. Their last cell decelerates into a second 2x2.
   Fade: the top-left and bottom-right photos fade out, a hold either side. The diagonal line then replaces the
   rows, its first two photos on the bottom-left and top-right that stayed.
   Phase 3: the line runs down and left along its diagonal - easing out of rest over its first cell and into rest
   over its last - bringing its three in from the top right, a smaller photo in each corner of the steps.
   Grow: the last corner pair grows to full cells, a hold either side, and the screen is the 2x2 the page opened
   on. At the end the scroll jumps back to the top, unseen, and it all plays again. Scrolling back plays all of it
   in reverse.

   The eased stretches are joined to the steady ones without a kink: power1 (a quadratic) leaves or reaches rest at twice the
   speed of a straight line over the same time, so giving an eased stretch of distance d a duration of 2d makes its
   far end exactly the steady speed; SCROLL scales both alike. On the diagonal, distance is measured along the line.

   The distances depend on the screen's shape, so the timeline is rebuilt when the window is resized (keeping the
   place you had scrolled to). */
// Pixels of scroll per pixel the photos travel, per phase: under 1 runs the photos faster than the scroll, and
// shortens the phase by the same share.
const SCROLL = { vertical: 0.7, horizontal: 0.7, diagonal: 0.5 };
const HOLD = 0.25;   // the pause on each 2x2, in screen heights of scrolling
const FADE = 0.525;  // the fade of the two photos leaving the second 2x2, in screen heights of scrolling
const GROW = 0.35;   // the last two corner photos growing to full cells, in screen heights of scrolling
let timeline = null;

// The cell sizes the easing is measured in: one photo plus its gap.
const cellY = () => leftTrack.firstElementChild.offsetHeight + parseFloat(getComputedStyle(leftTrack).rowGap);
const cellX = () => topTrack.firstElementChild.offsetWidth + parseFloat(getComputedStyle(topTrack).columnGap);

function build() {
  const progress = timeline?.scrollTrigger?.progress ?? 0;
  if (timeline) { timeline.scrollTrigger.kill(true); timeline.kill(); }
  gsap.set([leftTrack, rightTrack, topTrack, bottomTrack, diagonalTrack], { clearProps: 'transform' });
  gsap.set([vertical, horizontal, diagonal, ...fading], { clearProps: 'opacity,visibility' });
  gsap.set(growing, { clearProps: 'width,height' });
  gsap.set([...greying, ...colouring], { clearProps: 'filter' });

  const v = Math.max(travelY(leftTrack), travelY(rightTrack));
  const h = Math.max(travelX(topTrack), travelX(bottomTrack));
  const d = Math.hypot(travelX(diagonalTrack), travelY(diagonalTrack));
  const ev = Math.min(cellY(), v / 2);          // the eased stretch into the first 2x2
  const eh = Math.min(cellX(), h / 2);          // out of it, and into the second
  const ed = Math.min(Math.hypot(cellX(), cellY()), d / 2);   // out of the second, and into the last
  const hold = innerHeight * HOLD;
  const fade = innerHeight * FADE;
  const grow = innerHeight * GROW;

  // Scroll per pixel of travel in each phase, scaling the eased and the steady stretches alike so they still join.
  const sv = SCROLL.vertical, sh = SCROLL.horizontal, sd = SCROLL.diagonal;

  // Timeline positions, in pixels of scroll.
  const t1 = (v - ev) * sv;                     // steady vertical ends, easing in begins
  const t2 = t1 + 2 * ev * sv;                  // the first 2x2, at rest
  const t3 = t2 + hold;                         // hold over, easing out begins
  const t4 = t3 + 2 * eh * sh;                  // steady horizontal begins
  const t5 = t4 + (h - 2 * eh) * sh;            // steady horizontal ends, easing in begins
  const t6 = t5 + 2 * eh * sh;                  // the second 2x2, at rest
  const t7 = t6 + hold / 2 + fade + hold / 2;   // faded and held, easing out begins
  const t8 = t7 + 2 * ed * sd;                  // steady diagonal begins
  const t9 = t8 + (d - 2 * ed) * sd;            // steady diagonal ends, easing in begins
  const t10 = t9 + 2 * ed * sd;                 // the last 2x2 with its small corners, at rest
  const t11 = t10 + hold / 2;                   // the corners begin to grow
  const total = t11 + grow + hold / 2;          // the opening 2x2, held - and the loop

  // Each track: steady to within one cell of its end of phase 1 (or from one cell past its start of phase 2), and
  // eased over that cell. Positions are functions, measured again on every refresh.
  const vertical1 = (track, from, to) => {
    const at = (f) => () => { const d = travelY(track); return from(d) + (to(d) - from(d)) * f(d); };
    timeline
      .fromTo(track, { y: at(() => 0) }, { y: at((d) => (d - ev) / d), duration: t1 }, 0)
      .to(track, { y: at(() => 1), duration: 2 * ev * sv, ease: 'power1.out' }, t1);
  };
  const horizontal2 = (track, from, to) => {
    const at = (f) => () => { const d = travelX(track); return from(d) + (to(d) - from(d)) * f(d); };
    timeline
      .fromTo(track, { x: at(() => 0) }, { x: at((d) => eh / d), duration: t4 - t3, ease: 'power1.in', immediateRender: false }, t3)
      .to(track, { x: at((d) => (d - eh) / d), duration: t5 - t4 }, t4)
      .to(track, { x: at(() => 1), duration: t6 - t5, ease: 'power1.out' }, t5);
  };
  // From its bottom-left end in view (x 0, y up by its travel) to its top-right end (x left by its travel, y 0).
  const diagonal3 = (track) => {
    const at = (f) => ({ x: () => -travelX(track) * f, y: () => -travelY(track) * (1 - f) });
    timeline
      .fromTo(track, at(0), { ...at(ed / d), duration: t8 - t7, ease: 'power1.in', immediateRender: false }, t7)
      .to(track, { ...at((d - ed) / d), duration: t9 - t8 }, t8)
      .to(track, { ...at(1), duration: t10 - t9, ease: 'power1.out' }, t9);
  };

  timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: gallery,
      start: 'top top',
      end: `+=${total}`,
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
    onComplete: loop,
  });
  vertical1(rightTrack, () => 0, (d) => -d);          // up, from its top
  vertical1(leftTrack, (d) => -d, () => 0);           // down, from its bottom
  timeline
    .set(vertical, { autoAlpha: 0 }, t2 + hold / 2)   // the swap, halfway through the hold
    .set(horizontal, { autoAlpha: 1 }, t2 + hold / 2);
  horizontal2(topTrack, (d) => -d, () => 0);          // right, from its right end
  horizontal2(bottomTrack, () => 0, (d) => -d);       // left, from its left end
  timeline
    .to(fading, { autoAlpha: 0, duration: fade }, t6 + hold / 2)
    .fromTo(greying, { filter: 'grayscale(0)' }, { filter: 'grayscale(1)', duration: fade, immediateRender: false }, t6 + hold / 2)
    .set(horizontal, { autoAlpha: 0 }, t7)            // the second swap, once the fade has settled
    .set(diagonal, { autoAlpha: 1 }, t7);
  diagonal3(diagonalTrack);                           // down and left, from its bottom-left end
  // the last corners out to full cells, each held in its outer corner by its alignment
  timeline
    .to(growing, { width: () => linePhotos[0].offsetWidth, height: () => linePhotos[0].offsetHeight, duration: grow, ease: 'power2.inOut' }, t11)
    .fromTo(colouring, { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', duration: grow, ease: 'power2.inOut', immediateRender: false }, t11);
  // the rows and the line wait at their starting ends until they're shown
  gsap.set(topTrack, { x: () => -travelX(topTrack) });
  gsap.set(diagonalTrack, { x: 0, y: () => -travelY(diagonalTrack) });

  // Back to where the scroll was before the rebuild.
  const st = timeline.scrollTrigger;
  if (progress) scrollTo(0, st.start + progress * (st.end - st.start));
}

// The end looks exactly like the start, so jump the scroll back to the top and finish the scrub there at once -
// letting it catch up would play the whole timeline backwards on screen.
function loop() {
  const st = timeline.scrollTrigger;
  st.scroll(st.start);
  ScrollTrigger.update();
  st.getTween()?.progress(1);
}

build();
ScrollTrigger.refresh();

let resizing = 0;
addEventListener('resize', () => {
  clearTimeout(resizing);
  resizing = setTimeout(() => { build(); ScrollTrigger.refresh(); }, 150);
});
