const rotor = document.querySelector('.nsc-rotor');
const disc = rotor.querySelector('.disc');
const sectors = [...rotor.querySelectorAll('.sector')];
const slides = [...rotor.querySelectorAll('.slide')];
const windowEl = rotor.querySelector('.window');
const count = sectors.length;
const duration = 1.1;
const subtlety = 0.35; // share of the distance to the edge the copy travels in from (1 = all the way)

let step = 0;
let busy = false;

const wrap = (n) => ((n % count) + count) % count;

// dir 1 (scrolling down) moves the copy up: the new block rises from below and the old one leaves upward. dir -1 mirrors it.
const showSlide = (index, from, dir) => {
  const next = slides[index];

  // Every other slide goes, not just the one we came from: a fast scrollbar drag can pass several seasons
  // before their animations finish, and a slide-in still waiting on its delay would otherwise fire later and
  // bring an old title back over the new one. So each slide's pending tweens are cancelled first.
  // The title moves out a touch while fading; the column text only fades.
  slides.forEach((slide) => {
    if (slide === next) return;
    const movers = slide.querySelectorAll('.mover');
    gsap.killTweensOf(movers);
    if (!slide.classList.contains('is-active')) return;
    const [title, note] = movers;
    gsap.to(title, { y: -12 * dir, autoAlpha: 0, duration: 0.5, ease: 'sine.in' });
    gsap.to(note, {
      autoAlpha: 0, duration: 0.7, ease: 'sine.inOut',
      onComplete: () => { if (slides[wrap(step)] !== slide) slide.classList.remove('is-active'); },
    });
  });

  // A slow, gentle wash to the season's tint, a little longer than the turn so it settles after the wheel does.
  gsap.to(document.documentElement, { '--bg': next.dataset.bg, duration: 1.6, ease: 'sine.inOut', overwrite: true });

  // The title comes in from its band's boundary (a third of the way); the column text cross-fades in place.
  const wasShowing = next.classList.contains('is-active');
  next.classList.add('is-active');
  const [title, note] = next.querySelectorAll('.mover');
  gsap.killTweensOf([title, note]);
  const band = title.parentElement;
  const top = title.offsetTop; // relative to its band, its offsetParent
  const start = (dir > 0 ? band.clientHeight - top : -(top + title.offsetHeight)) * subtlety;
  // Coming back to a slide that hasn't finished fading out (a drag that turns back): carry on from where it is
  // rather than blinking to nothing and starting over.
  if (wasShowing && Number(gsap.getProperty(title, 'opacity')) > 0.01) {
    gsap.to(title, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
    gsap.to(note, { autoAlpha: 1, duration: 0.6, ease: 'sine.inOut' });
    return;
  }
  gsap.fromTo(title, { y: start, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: 'power2.out', delay: 0.35 });
  gsap.fromTo(note, { y: 0, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: 'sine.inOut', delay: 0.25 });
};


// Each step is one full quarter turn. Counter-clockwise (negative) brings the next sector into the window upright;
// the rotation keeps accumulating, so the wheel loops forever in either direction.
// `steps` > 1 is a jump (a press on the scrollbar): still one turn, just a longer one.
const go = (dir, steps = 1) => {
  if (busy) return;
  busy = true;
  const from = step;
  step += dir * steps;
  gsap.to(disc, { rotation: -90 * step, duration, ease: 'power3.inOut', onComplete: () => { busy = false; } });
  gsap.to(bar, { pos: step, duration, ease: 'power3.inOut', onUpdate: drawBar });
  showSlide(wrap(step), from, dir);
};

/* ============================ scrollbar ============================
   A browser-style scrollbar down the right edge with no ends: the thumb's position is the unbounded step,
   wrapped onto the rail, and a second thumb one rail-length behind it means that as one slides out past the
   bottom the other slides in at the top (and the reverse scrolling up). A press on the rail jumps to the
   season under it, the shortest way round. */
const bar = { pos: 0 };
const rail = rotor.querySelector('.browser-bar .rail');
const thumbs = [...rail.querySelectorAll('.thumb')];
function drawBar() {
  const p = ((bar.pos % count) + count) % count;
  thumbs[0].style.setProperty('--at', p);
  thumbs[1].style.setProperty('--at', p - count);
}
drawBar();

const goToIndex = (i) => {
  const delta = ((i - wrap(step) + count + count / 2) % count) - count / 2;
  if (delta) go(Math.sign(delta), Math.abs(delta));
};
rail.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.thumb')) return;
  const r = rail.getBoundingClientRect();
  goToIndex(Math.min(count - 1, Math.floor(((e.clientY - r.top) / r.height) * count)));
});

// Dragging the thumb turns the wheel live: one rail-length is one full loop of the seasons. The season, copy
// and tint switch as the drag passes each halfway point; on release everything snaps to the nearest season.
let drag = null;
rail.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.thumb') || busy) return;
  e.preventDefault();
  busy = true;
  gsap.killTweensOf([disc, bar]);
  drag = { y: e.clientY, from: bar.pos, perPixel: count / rail.clientHeight };
  rail.setPointerCapture(e.pointerId);
  rail.classList.add('is-dragging');
});
rail.addEventListener('pointermove', (e) => {
  if (!drag) return;
  bar.pos = drag.from + (e.clientY - drag.y) * drag.perPixel;
  drawBar();
  gsap.set(disc, { rotation: -90 * bar.pos });
  const nearest = Math.round(bar.pos);
  if (nearest !== step) {
    const from = step;
    step = nearest;
    showSlide(wrap(step), from, Math.sign(step - from));
  }
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  rail.classList.remove('is-dragging');
  gsap.to(disc, { rotation: -90 * step, duration: 0.45, ease: 'power3.out', onComplete: () => { busy = false; } });
  gsap.to(bar, { pos: step, duration: 0.45, ease: 'power3.out', onUpdate: drawBar });
};
rail.addEventListener('pointerup', endDrag);
rail.addEventListener('pointercancel', endDrag);

// The page splits into four shaded quarters around the disc center; keep that point on the window's corner.
const placeCenter = () => {
  const w = windowEl.getBoundingClientRect();
  const r = rotor.getBoundingClientRect();
  rotor.style.setProperty('--cx', `${w.right - r.left}px`);
  rotor.style.setProperty('--cy', `${w.bottom - r.top}px`);
};
new ResizeObserver(placeCenter).observe(rotor);
placeCenter();

slides[0].classList.add('is-active');
gsap.from(slides[0].querySelector('.title-band .mover'), { yPercent: 100 * subtlety, autoAlpha: 0, duration: 1, ease: 'power2.out', delay: 0.2 });
gsap.from(slides[0].querySelector('.note-band .mover'), { autoAlpha: 0, duration: 0.9, ease: 'sine.inOut', delay: 0.3 });

// The move-resize kit (Shift+L) and type kit (Shift+T) take clicks, drags and arrow keys while open, so the wheel stands aside.
// A set, not a flag: opening one kit closes the other, and its close event lands after the new one's open.
const kitsOpen = new Set();
for (const kit of ['move-resize', 'type']) {
  document.addEventListener(kit + '-kit:open', () => kitsOpen.add(kit));
  document.addEventListener(kit + '-kit:close', () => kitsOpen.delete(kit));
}

// One wheel gesture = one turn. The lock holds until the wheel has been quiet for a moment,
// so a trackpad's inertia tail can't fire a second turn. Only wheel and touch are listened to, never clicks.
let wheelLocked = false;
let wheelTimer;
window.addEventListener('wheel', (e) => {
  if (kitsOpen.size) return;
  e.preventDefault();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { wheelLocked = false; }, 180);
  if (wheelLocked || Math.abs(e.deltaY) < 4) return;
  wheelLocked = true;
  go(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

let touchY = null;
rotor.addEventListener('touchstart', (e) => { touchY = kitsOpen.size || e.target.closest('.controls') ? null : e.touches[0].clientY; }, { passive: true });
rotor.addEventListener('touchend', (e) => {
  if (touchY === null) return;
  const dy = touchY - e.changedTouches[0].clientY;
  touchY = null;
  if (Math.abs(dy) > 40) go(dy > 0 ? 1 : -1);
});

window.addEventListener('keydown', (e) => {
  if (kitsOpen.size) return;
  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) go(1);
  if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) go(-1);
});

// Kit buttons are handled by the kits themselves; if a kit script didn't load, say so instead of doing nothing.
document.querySelectorAll('[data-move-resize-kit-open], [data-type-kit-open]').forEach((button) => {
  button.addEventListener('click', () => {
    setTimeout(() => {
      const kit = button.hasAttribute('data-type-kit-open') ? 'type' : 'move-resize';
      if (!document.querySelector(`[data-${kit}-kit-panel]`)) console.warn(`The ${kit} kit did not open - check that its script loaded (vendor/ folder next to index.html).`);
    }, 600);
  });
});

// The type kit edits one element; mirror its inline style onto the same role in every season so all four stay in one face.
for (const role of ['.season', '.subheading']) {
  const els = [...rotor.querySelectorAll(role)];
  const sync = new MutationObserver((records) => {
    const source = records.at(-1).target;
    const style = source.getAttribute('style');
    els.forEach((el) => { if (el !== source && el.getAttribute('style') !== style) style === null ? el.removeAttribute('style') : el.setAttribute('style', style); });
  });
  els.forEach((el) => sync.observe(el, { attributes: true, attributeFilter: ['style'] }));
}
