// Same approach as vue-playground/app/pages/zoom.vue: Zoomooz zooms the .zoomContainer so a clicked section
// fills most of the screen; the page's own controls live on <html>, outside every transform.
const $ = window.jQuery;
const $site = $('.nsc-zoom-site');
const $container = $site.find('.zoomContainer');
const sections = $site.find('.section').toArray();

// nativeanimation: one CSS transition on the container's transform (smooth, on the compositor) rather than
// Zoomooz stepping the matrix in JS every frame. Duration and curve come from --zoom-time / --zoom-ease.
const rootStyle = getComputedStyle(document.documentElement);
const zoom = {
  duration: parseFloat(rootStyle.getPropertyValue('--zoom-time')) * 1000,
  easing: rootStyle.getPropertyValue('--zoom-ease').trim(),
  nativeanimation: true,
  root: $container,
};

let current = -1;

// Closed titles: centered and scaled up from their open position (top left, open size). The scale is the ratio
// of the default closed and open sizes, not of the title's current size, so a size set with the type kit sticks
// in both states. Measured in layout pixels (offset*), which Zoomooz's transform doesn't touch; redone when the
// grid resizes or a title's style changes.
const sizeOf = (section, value) => {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;font-size:${value}`;
  section.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return px;
};
// Placing is instant (no transition), so titles are simply in place on load, refresh and resize rather than
// sliding there; they stay hidden until they've been placed in their real fonts, so they never flash in the
// corner or in a fallback face.
let fontsReady = false;
function placeTitles() {
  $site.addClass('is-placing');
  sections.forEach((section) => {
    const title = section.querySelector('.section-title');
    const vars = getComputedStyle(title);
    const scale = Math.max(1, sizeOf(section, vars.getPropertyValue('--title-big')) / sizeOf(section, vars.getPropertyValue('--title-open')));
    const w = title.offsetWidth * scale;
    const h = title.offsetHeight * scale;
    title.style.setProperty('--title-scale', scale);
    title.style.setProperty('--title-x', `${(section.clientWidth - w) / 2 - title.offsetLeft}px`);
    title.style.setProperty('--title-y', `${(section.clientHeight - h) / 2 - title.offsetTop}px`);
  });
  void $site[0].offsetWidth; // apply the new positions before transitions come back on
  $site.removeClass('is-placing').toggleClass('is-placed', fontsReady);
  styleWatch.takeRecords(); // drop the records of the writes above, so they don't call this again
}
new ResizeObserver(placeTitles).observe($site.find('.grid')[0]);
document.fonts.ready.then(() => { fontsReady = true; placeTitles(); });
// The type kit writes inline styles on titles; keep the closed position in step with them.
const titles = $site.find('.section-title').toArray();
const styleWatch = new MutationObserver(placeTitles);
titles.forEach((title) => styleWatch.observe(title, { attributes: true, attributeFilter: ['style'] }));


// The two studio tools, local copies in vendor/randomize-studio: textures (Shift+T) and fonts (Shift+Y).
const tools = document.createElement('div');
tools.className = 'zoom-tools';
tools.innerHTML = '<button type="button" class="zoom-tool" data-key="T">Textures (Shift+T)</button><button type="button" class="zoom-tool" data-key="Y">Fonts (Shift+Y)</button>';
document.documentElement.appendChild(tools);
// Each button presses its kit's own shortcut, so it opens the panel as it is (a data-texture-kit-open
// button would randomize the page first).
tools.addEventListener('click', (e) => {
  const key = e.target.closest('[data-key]')?.dataset.key;
  if (key) document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: true, bubbles: true }));
});

// While a kit is open it takes clicks, arrows and the wheel on the page to pick what it edits, so zooming
// stands aside until it closes. A set, not a flag: opening one kit closes the other, and that close event
// arrives after the new one's open.
const kits = new Set();
for (const kit of ['texture', 'type']) {
  document.addEventListener(kit + '-kit:open', () => kits.add(kit));
  document.addEventListener(kit + '-kit:close', () => kits.delete(kit));
}

function open(index) {
  const section = sections[index];
  if (!section || index === current) return;
  current = index;
  sections.forEach((el) => el.classList.toggle('is-zoomed', el === section));
  $site.addClass('is-open');
  // One movement: the zoom and the title's move start together, on the same timing and curve.
  $(section).zoomTo({ ...zoom, targetsize: 0.86 });
  history.replaceState(null, '', `#${section.dataset.label.toLowerCase()}`);
  moveBar(index);
  markMap(index);
}

function close() {
  if (current < 0) return;
  current = -1;
  sections.forEach((el) => el.classList.remove('is-zoomed'));
  $site.removeClass('is-open');
  $container.zoomTo({ ...zoom, targetsize: 1 });
  history.replaceState(null, '', location.pathname + location.search);
  bar.classList.remove('is-open');
  glideBar(0); // the overview is the top of the scrollbar, where the first scroll starts from
  markMap(-1);
}

/* ============================ mini-map ============================
   Beside the scrollbar while a section is open: a small copy of the grid with the open section filled, the
   others outlined, and a press on any cell flies there. The cells are measured from the real layout (offset*,
   which Zoomooz's transform doesn't touch), so they always match the grid, the split pair and the tall cell
   included. The line under it names the open section, or the one under the pointer. */
const map = document.createElement('nav');
map.className = 'zoom-map';
map.setAttribute('aria-label', 'Sections');
map.innerHTML = '<div class="cells"></div><div class="foot"><span class="name"></span>' +
  '<button type="button" class="close" aria-label="Close section, back to all sections">&times;</button></div>';
document.documentElement.appendChild(map);
const mapCells = sections.map((section, i) => {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'cell';
  cell.setAttribute('aria-label', section.dataset.label);
  cell.addEventListener('click', (e) => { e.stopPropagation(); if (!kits.size) open(i); });
  cell.addEventListener('pointerenter', () => { mapName.textContent = section.dataset.label; });
  cell.addEventListener('pointerleave', () => { mapName.textContent = sections[current]?.dataset.label || 'Overview'; });
  return map.querySelector('.cells').appendChild(cell);
});
const mapName = map.querySelector('.name');
// The map's close button takes you back out to all sections; it shows only while one is open.
map.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); if (!kits.size) close(); });

function placeMap() {
  const box = $container[0];
  const w = box.clientWidth;
  const h = box.clientHeight;
  map.style.setProperty('--ratio', `${w} / ${h}`);
  sections.forEach((section, i) => {
    let x = 0, y = 0;
    for (let el = section; el && el !== box; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    const s = mapCells[i].style;
    s.left = `${(x / w) * 100}%`;
    s.top = `${(y / h) * 100}%`;
    s.width = `${(section.offsetWidth / w) * 100}%`;
    s.height = `${(section.offsetHeight / h) * 100}%`;
  });
}
new ResizeObserver(placeMap).observe($site.find('.grid')[0]);
placeMap();

function markMap(index) {
  mapCells.forEach((cell, i) => {
    cell.classList.toggle('is-current', i === index);
    cell.toggleAttribute('aria-current', i === index);
  });
  mapName.textContent = sections[index]?.dataset.label || 'Overview';
  map.classList.toggle('is-open', index >= 0);
}
markMap(-1);

/* ============================ scrollbar ============================
   A 'fake' browser scrollbar down the right edge, as on motion/rotate-sectors: there is nothing to scroll, but
   it says the wheel does something. One step for the overview (step 0, the top) and one per section after it,
   on a rail with no ends: the thumb's position is unbounded, wrapped onto the rail, and a second thumb one
   rail-length behind it slides in at the top as the first leaves the bottom (and the reverse). A press on the
   rail goes to the step under it; dragging the thumb follows the pointer and goes to the nearest step on release. */
const bar = document.createElement('div');
bar.className = 'zoom-scrollbar';
bar.setAttribute('aria-hidden', 'true');
bar.innerHTML = '<div class="rail"><span class="thumb"></span><span class="thumb"></span></div>';
const steps = sections.length + 1; // the overview, then each section
bar.style.setProperty('--count', steps);
document.documentElement.appendChild(bar);
const rail = bar.querySelector('.rail');
const thumbs = [...rail.querySelectorAll('.thumb')];
const wrapStep = (n) => ((n % steps) + steps) % steps;
const stepOf = (index) => index + 1; // section index -> step; the overview (index -1) is step 0
// Go to a step: 0 is the overview, anything else opens that section.
const goToStep = (n) => { const st = wrapStep(n); if (st === 0) close(); else open(st - 1); };
let barPos = 0;
let barTween = 0;

function drawBar() {
  const p = wrapStep(barPos);
  thumbs[0].style.setProperty('--at', p);
  thumbs[1].style.setProperty('--at', p - steps);
  followThumb();
}

// The mini-map rides beside the thumb: centred on it, kept inside the rail's ends. On a wrap it hops from one
// end to the other along with the thumb.
function followThumb() {
  const r = rail.getBoundingClientRect();
  const centre = r.top + (wrapStep(barPos + 0.5) / steps) * r.height;
  const h = map.offsetHeight;
  map.style.top = `${Math.min(Math.max(centre - h / 2, r.top), r.bottom - h)}px`;
}
window.addEventListener('resize', followThumb);

// Glide to a step the short way round (so the last section steps on to the overview), on the zoom's timing.
function moveBar(index) {
  bar.classList.add('is-open');
  glideBar(stepOf(index));
}
function glideBar(target) {
  const half = Math.floor(steps / 2);
  const delta = ((target - wrapStep(Math.round(barPos)) + steps + half) % steps) - half;
  const from = barPos;
  const to = Math.round(barPos) + delta;
  const start = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  cancelAnimationFrame(barTween);
  const step = (now) => {
    const t = Math.min(1, (now - start) / zoom.duration);
    barPos = from + (to - from) * ease(t);
    drawBar();
    if (t < 1) barTween = requestAnimationFrame(step);
  };
  barTween = requestAnimationFrame(step);
}
drawBar();

let drag = null;
rail.addEventListener('pointerdown', (e) => {
  if (kits.size) return;
  e.stopPropagation();
  if (!e.target.closest('.thumb')) {
    const r = rail.getBoundingClientRect();
    goToStep(Math.min(steps - 1, Math.floor(((e.clientY - r.top) / r.height) * steps)));
    return;
  }
  e.preventDefault();
  cancelAnimationFrame(barTween);
  drag = { y: e.clientY, from: barPos, perPixel: steps / rail.clientHeight };
  rail.setPointerCapture(e.pointerId);
  bar.classList.add('is-dragging');
});
rail.addEventListener('pointermove', (e) => {
  if (!drag) return;
  barPos = drag.from + (e.clientY - drag.y) * drag.perPixel;
  drawBar();
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  bar.classList.remove('is-dragging');
  const st = wrapStep(Math.round(barPos));
  if (st === stepOf(current)) glideBar(st); // where we already are: just settle the thumb back onto it
  else goToStep(st);
};
rail.addEventListener('pointerup', endDrag);
rail.addEventListener('pointercancel', endDrag);

// A press on a section opens it (or switches to it from another); a press on the gaps goes back out.
$site.on('click', '.section', function (e) {
  if (kits.size) return;
  e.stopPropagation();
  if (e.target.closest('a')) e.preventDefault(); // mock links
  open(sections.indexOf(this));
});
$container.on('click', () => { if (!kits.size) close(); });

// The wheel steps through the scrollbar's steps in order, looping: the overview, then each section, then round
// to the overview again. Looping one way only: going back from the overview (step 0, where the page starts)
// would wrap to the last section, Contact, which is a confusing first move, so it does nothing there. The
// last section still steps on round to the overview.
const atTop = () => stepOf(current) === 0;
let cooldown = false;
window.addEventListener('wheel', (e) => {
  if (kits.size) return;
  e.preventDefault();
  if (cooldown || Math.abs(e.deltaY) < 4) return;
  if (e.deltaY < 0 && atTop()) return;
  cooldown = true;
  setTimeout(() => { cooldown = false; }, 750);
  goToStep(stepOf(current) + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (kits.size) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToStep(stepOf(current) + 1);
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && !atTop()) goToStep(stepOf(current) - 1);
});

// Arriving with #projects (etc.) opens that section.
const fromHash = sections.findIndex((el) => `#${el.dataset.label.toLowerCase()}` === location.hash);
if (fromHash >= 0) setTimeout(() => open(fromHash), 300);
