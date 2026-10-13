const root = document.querySelector('.nsc-zoom');
const stage = root.querySelector('.stage');
const caption = root.querySelector('.season');
const sources = [...root.querySelectorAll('.sources li')].map((li) => ({ src: li.dataset.src, name: li.textContent.trim() }));

const defaults = {
  ratio: 5.6,             // how much bigger each frame is than the one inside it (the inner picture starts at 1 / ratio)
  depth: 2,               // frames drawn inside the one that fills the screen
  twist: 0,               // degrees each level is rotated against the one around it
  fadeFrom: -1.05,        // a frame is invisible at scale ratio^fadeFrom ...
  fadeTo: -0.6,           // ... and fully opaque by ratio^fadeTo, so pictures fade in as they grow out of the center
  fadeCurve: 0.7,         // shape of that fade: below 1 appears early, above 1 holds back then arrives late
  feather: 18,            // soft edge, % of the picture's width and height
  sensitivity: 0.0025,    // zoom levels per pixel of wheel delta
  smoothing: 0.2,         // 0..1, how quickly the zoom catches up with the wheel
  drift: 0,               // idle zoom, levels per second, in the last scrolled direction (0 = off)
  captionAt: 0,           // zoom level at which the caption switches to the incoming picture (0 = as it fills the screen)
  caption: true,
  titleFont: 'Montserrat', // any family in the panel's list, loaded from Google Fonts when picked
  titleSize: 16,          // px
  titleWeight: 700,
  titleTracking: 0.19,    // em
  titleBottom: 17,        // px from the bottom edge
  shadowOpacity: 0.75,    // title text-shadow darkness, 0 = none
  shadowBlur: 9,          // px
  plateOpacity: 0.15,     // box behind the title, 0 = no plate
  plateColor: '#707070',
  platePadding: 19,       // px around the word (vertically 0.6 of it)
  plateRadius: 0,         // px
  plateBlur: 3,           // px, frosts the picture behind the plate
};
const STORE = 'infinite-zoom-params-v5'; // bumped when defaults change, so old saved settings don't override them
const params = { ...defaults };
try {
  // Only settings that have a control in the panel are restored; the rest always come from the defaults above.
  const saved = JSON.parse(localStorage.getItem(STORE)) || {};
  document.querySelectorAll('.panel input[name]').forEach(({ name }) => { if (name in saved) params[name] = saved[name]; });
} catch {}

// One element per slot, from one frame past the camera (i = -1) to the deepest (i = depth).
// Slot i shows picture k = floor(zoom) + i at scale ratio^(zoom - k). The extra outer frame keeps covering
// the screen edges while the full-screen picture's feathered border is in view, so nothing ever pops.
let frames = [];
const buildFrames = () => {
  frames.forEach((el) => el.remove());
  frames = Array.from({ length: params.depth + 2 }, () => stage.appendChild(Object.assign(document.createElement('div'), { className: 'frame' })));
};
buildFrames();
sources.forEach(({ src }) => { new Image().src = src; });

const wrap = (n) => ((n % sources.length) + sources.length) % sources.length;
const fade = (level) => {
  const to = Math.max(params.fadeTo, params.fadeFrom + 0.01);
  return gsap.utils.clamp(0, 1, (level - params.fadeFrom) / (to - params.fadeFrom)) ** params.fadeCurve;
};

let zoom = 0;
let target = 0;
let direction = 1;
let shown = null;
let shownK = 0;
let captionFade = null;

const render = () => {
  const base = Math.floor(zoom);
  const last = frames.length - 1;
  frames.forEach((el, slot) => {
    const i = slot - 1;
    const k = base + i;
    const level = zoom - k;
    if (el.dataset.k !== String(k)) {
      el.dataset.k = k;
      el.style.backgroundImage = `url("${sources[wrap(k)].src}")`;
    }
    // Deeper frames are drawn on top, each fading in with its size. The deepest slot also fades with the
    // fractional zoom, so a frame never pops in even when the fade starts deeper than the frames drawn.
    el.style.zIndex = slot;
    el.style.opacity = fade(level) * (slot === last ? zoom - base : 1);
    el.style.transform = `rotate(${params.twist * level}deg) scale(${params.ratio ** level})`;
  });

  // The caption names a picture once it has grown to most of the screen (zoom passes k + captionAt),
  // with a little hysteresis so scrolling back and forth around that point doesn't flicker it.
  const edge = zoom - params.captionAt;
  const nearest = Math.floor(edge);
  if (shown === null || Math.abs(edge - (shownK + 0.5)) > 0.5 + 0.06) {
    shownK = nearest;
    const current = wrap(nearest);
    if (shown === null) {
      shown = current;
      caption.textContent = sources[current].name;
    } else if (current !== shown && params.caption) {
      shown = current;
      captionFade?.kill();
      captionFade = gsap.timeline()
        .to(caption, { autoAlpha: 0, duration: 0.12, ease: 'power2.in' })
        .set(caption, { textContent: sources[current].name })
        .to(caption, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
    }
  }
};

gsap.ticker.add((time, deltaTime) => {
  target += params.drift * direction * (deltaTime / 1000);
  zoom += (target - zoom) * params.smoothing;
  render();
});

// Wheel down zooms in (pictures come toward you and pass by); wheel up zooms out (they shrink back into the center).
// Input on the settings panel is left to the panel.
const onPanel = (e) => e.target instanceof Element && e.target.closest('.panel');

window.addEventListener('wheel', (e) => {
  if (onPanel(e)) return;
  e.preventDefault();
  target += e.deltaY * params.sensitivity;
  if (Math.abs(e.deltaY) > 1) direction = Math.sign(e.deltaY);
}, { passive: false });

let touchY = null;
root.addEventListener('touchstart', (e) => { touchY = onPanel(e) ? null : e.touches[0].clientY; }, { passive: true });
root.addEventListener('touchmove', (e) => {
  if (touchY === null) return;
  const dy = touchY - e.touches[0].clientY;
  touchY = e.touches[0].clientY;
  target += dy * params.sensitivity * 2.5;
  if (Math.abs(dy) > 1) direction = Math.sign(dy);
}, { passive: true });
root.addEventListener('touchend', () => { touchY = null; });

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'p' || e.key === 'P') { togglePanel(); return; }
  if (e.target.closest?.('button')) return;
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { target += 0.5; direction = 1; }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { target -= 0.5; direction = -1; }
});

/* ============================ settings panel ============================ */

const panel = root.querySelector('.panel');
const toggle = panel.querySelector('.panel-toggle');
const inputs = [...panel.querySelectorAll('input[name]')];
const show = root.querySelector('.panel-show');

const pct = (level) => `${Math.round(params.ratio ** level * 100)}%`;
const formats = {
  ratio: (v) => `${v.toFixed(1)}x`,
  twist: (v) => `${v}deg`,
  fadeFrom: (v) => `${pct(v)} size`,
  fadeTo: (v) => `${pct(v)} size`,
  fadeCurve: (v) => v.toFixed(2),
  feather: (v) => `${v}%`,
  sensitivity: (v) => v.toFixed(4),
  smoothing: (v) => v.toFixed(2),
  drift: (v) => (v ? v.toFixed(3) : 'off'),
};

// The title settings have no controls; they are fixed by defaults (the face itself is loaded in index.html).
const apply = () => {
  root.style.setProperty('--title-font', `"${params.titleFont}"`);
  root.style.setProperty('--title-size', `${params.titleSize}px`);
  root.style.setProperty('--title-weight', params.titleWeight);
  root.style.setProperty('--title-tracking', `${params.titleTracking}em`);
  root.style.setProperty('--title-bottom', `${params.titleBottom}px`);
  root.style.setProperty('--shadow-opacity', params.shadowOpacity);
  root.style.setProperty('--shadow-blur', `${params.shadowBlur}px`);
  root.style.setProperty('--plate-opacity', params.plateOpacity);
  root.style.setProperty('--plate-color', params.plateColor);
  root.style.setProperty('--plate-padding', `${params.platePadding}px`);
  root.style.setProperty('--plate-radius', `${params.plateRadius}px`);
  root.style.setProperty('--plate-blur', `${params.plateBlur}px`);
  root.style.setProperty('--feather', `${params.feather}%`);
  caption.parentElement.hidden = !params.caption;
  if (frames.length !== params.depth + 2) buildFrames();
  inputs.forEach((input) => {
    const out = input.parentElement.querySelector('output');
    if (out) out.textContent = formats[input.name](params[input.name]);
  });
  try { localStorage.setItem(STORE, JSON.stringify(params)); } catch {}
};

const fill = () => inputs.forEach((input) => {
  if (input.type === 'checkbox') input.checked = params[input.name];
  else input.value = params[input.name];
});

panel.addEventListener('input', (e) => {
  const input = e.target;
  if (!input.name) return; // the photo picker has its own handler
  params[input.name] = input.type === 'checkbox' ? input.checked : Number(input.value);
  apply();
});

panel.addEventListener('submit', (e) => e.preventDefault());
panel.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'reset') { Object.assign(params, defaults); fill(); apply(); }
  if (action === 'reset-photos') resetPhotos();
  if (action === 'copy') {
    const button = e.target.closest('[data-action]');
    try { await navigator.clipboard.writeText(JSON.stringify(params, null, 2)); button.textContent = 'Copied'; }
    catch { button.textContent = 'Copy failed'; }
    setTimeout(() => { button.textContent = 'Copy params'; }, 1200);
  }
});

/* Minimizing, as in randomize-studio: the window shrinks along a vector into the button that brings it back
   (bottom right, as in the studio), so you can see where it went; restoring plays the same journey backwards. */
function togglePanel() {
  const minimize = !panel.classList.contains('is-minimized');
  if (minimize) {
    const p = panel.getBoundingClientRect();
    const b = show.getBoundingClientRect();
    panel.style.setProperty('--dock-x', `${b.left + b.width / 2 - (p.left + p.width / 2)}px`);
    panel.style.setProperty('--dock-y', `${b.top + b.height / 2 - (p.top + p.height / 2)}px`);
  }
  panel.classList.toggle('is-minimized', minimize);
  show.classList.toggle('is-visible', minimize);
  (minimize ? show : toggle).focus({ preventScroll: true });
}
toggle.addEventListener('click', togglePanel);
show.addEventListener('click', togglePanel);

fill();
apply();

/* ============================ photos ============================
   The loop's photos, in the panel: drag a thumbnail to move it, x to remove it, Add photos (or drop image files on
   the list) to add your own. The order is saved in localStorage; photos added from disk are kept in IndexedDB, so
   both come back on reload. The built-in photos are the list in index.html; Reset photos goes back to them. */
sources.forEach((p) => { p.id = `b:${p.src}`; }); // built-in photos are known by their file
const builtIn = sources.map((p) => ({ ...p }));
const ORDER = 'infinite-zoom-photos';
const photoList = panel.querySelector('.photos');

// IndexedDB: one store, a record per added photo ({ id, name, blob }). Every call degrades to a no-op without it.
const db = new Promise((resolve) => {
  try {
    const req = indexedDB.open('infinite-zoom', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});
async function store(mode, fn) {
  const d = await db;
  if (!d) return null;
  return new Promise((resolve) => {
    const tx = d.transaction('photos', mode);
    const req = fn(tx.objectStore('photos'));
    tx.oncomplete = () => resolve(req?.result ?? null);
    tx.onerror = () => resolve(null);
  });
}

// Swap the loop's photos for a new list: the frames repaint and the caption follows on the next frame.
function setPhotos(list) {
  sources.splice(0, sources.length, ...list);
  list.forEach(({ src }) => { new Image().src = src; });
  frames.forEach((el) => { delete el.dataset.k; });
  shown = null;
  try { localStorage.setItem(ORDER, JSON.stringify(list.map((p) => p.id))); } catch {}
  renderPhotos();
}

function renderPhotos() {
  photoList.replaceChildren(...sources.map((p) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.id = p.id;
    li.title = p.name;
    li.innerHTML = '<img alt=""><span></span><button type="button" class="remove">&times;</button>';
    li.querySelector('img').src = p.src;
    li.querySelector('span').textContent = p.name;
    const remove = li.querySelector('.remove');
    remove.setAttribute('aria-label', `Remove ${p.name}`);
    remove.disabled = sources.length <= 1; // the loop needs at least one photo
    return li;
  }));
}

async function addFiles(files) {
  const added = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const id = `u:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    added.push({ id, name, src: URL.createObjectURL(f) });
    await store('readwrite', (st) => st.put({ id, name, blob: f }));
  }
  if (added.length) setPhotos([...sources, ...added]);
}

function removePhoto(id) {
  if (sources.length <= 1) return;
  const photo = sources.find((p) => p.id === id);
  if (photo && id.startsWith('u:')) {
    store('readwrite', (st) => st.delete(id));
    URL.revokeObjectURL(photo.src);
  }
  setPhotos(sources.filter((p) => p.id !== id));
}

async function resetPhotos() {
  sources.filter((p) => p.id.startsWith('u:')).forEach((p) => URL.revokeObjectURL(p.src));
  await store('readwrite', (st) => st.clear());
  setPhotos(builtIn.map((p) => ({ ...p })));
  try { localStorage.removeItem(ORDER); } catch {}
}

panel.querySelector('.add-photos input').addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  e.target.value = ''; // so the same file can be picked again
});
photoList.addEventListener('click', (e) => {
  const button = e.target.closest('.remove');
  if (button) removePhoto(button.closest('li').dataset.id);
});

// Drag to reorder: the thumbnail lands before or after the one under the pointer, by which half it is over.
let dragId = null;
const clearMarks = () => photoList.querySelectorAll('.is-before, .is-after').forEach((el) => el.classList.remove('is-before', 'is-after'));
photoList.addEventListener('dragstart', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
});
photoList.addEventListener('dragend', () => {
  dragId = null;
  photoList.querySelectorAll('.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
  clearMarks();
  photoList.classList.remove('is-dropping');
});
const sideOf = (li, e) => { const r = li.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'before' : 'after'; };
photoList.addEventListener('dragover', (e) => {
  e.preventDefault();
  const files = [...e.dataTransfer.types].includes('Files');
  e.dataTransfer.dropEffect = files ? 'copy' : 'move';
  photoList.classList.toggle('is-dropping', files);
  clearMarks();
  const li = e.target.closest('li');
  if (li && dragId && li.dataset.id !== dragId) li.classList.add(`is-${sideOf(li, e)}`);
});
photoList.addEventListener('dragleave', (e) => {
  if (!photoList.contains(e.relatedTarget)) { photoList.classList.remove('is-dropping'); clearMarks(); }
});
photoList.addEventListener('drop', (e) => {
  e.preventDefault();
  photoList.classList.remove('is-dropping');
  if (e.dataTransfer.files.length) { addFiles([...e.dataTransfer.files]); return; }
  const li = e.target.closest('li');
  if (!dragId || !li || li.dataset.id === dragId) return;
  const moving = sources.find((p) => p.id === dragId);
  const rest = sources.filter((p) => p.id !== dragId);
  const at = rest.findIndex((p) => p.id === li.dataset.id) + (sideOf(li, e) === 'after' ? 1 : 0);
  rest.splice(at, 0, moving);
  setPhotos(rest);
});

// Start from the saved order and any photos added before; built-ins no longer in the list stay removed.
renderPhotos();
(async () => {
  let order = null;
  try { order = JSON.parse(localStorage.getItem(ORDER)); } catch {}
  const added = (await store('readonly', (st) => st.getAll())) || [];
  if (!order && !added.length) return;
  const byId = new Map(builtIn.map((p) => [p.id, { ...p }]));
  added.forEach((rec) => byId.set(rec.id, { id: rec.id, name: rec.name, src: URL.createObjectURL(rec.blob) }));
  const list = order ? order.map((id) => byId.get(id)).filter(Boolean) : [...byId.values()];
  added.forEach((rec) => { if (!list.some((p) => p.id === rec.id)) list.push(byId.get(rec.id)); });
  setPhotos(list.length ? list : builtIn.map((p) => ({ ...p })));
})();
