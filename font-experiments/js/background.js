/* background — the photograph, the gradients and the grain.
   A background is stored as a DESCRIPTOR and resolved to a URL at paint time,
   which is what lets a saved scene reload the same picture. */

/* ============================ backgrounds ============================ */
function gradURL(draw) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
  draw(c.getContext('2d'), c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}
function linear(angle, stops) {
  return gradURL((g,w,h) => {
    const a = angle*Math.PI/180, x = Math.cos(a), y = Math.sin(a);
    const grd = g.createLinearGradient(w/2-x*w/2, h/2-y*h/2, w/2+x*w/2, h/2+y*h/2);
    stops.forEach(([o,col]) => grd.addColorStop(o, col));
    g.fillStyle = grd; g.fillRect(0,0,w,h);
  });
}
function mesh(base, blobs) {
  return gradURL((g,w,h) => {
    g.fillStyle = base; g.fillRect(0,0,w,h);
    g.globalCompositeOperation = 'lighter';
    blobs.forEach(([cx,cy,rad,col]) => {
      const rg = g.createRadialGradient(cx*w,cy*h,0, cx*w,cy*h,rad*w);
      rg.addColorStop(0,col); rg.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0,0,w,h);
    });
  });
}
const BG_PRESETS = [
  { name:'indigo',  url: linear(135, [[0,'#1e1b4b'],[0.5,'#4338ca'],[1,'#0f172a']]) },
  { name:'sunset',  url: linear(120, [[0,'#fde68a'],[0.45,'#f97316'],[1,'#7c2d12']]) },
  { name:'teal',    url: linear(160, [[0,'#0d9488'],[0.6,'#0f3d4a'],[1,'#020617']]) },
  { name:'charcoal',url: mesh('#0b0b0d', [[0.25,0.3,0.6,'rgba(80,80,95,.5)'],[0.8,0.8,0.5,'rgba(40,40,55,.6)']]) },
  { name:'cream',   url: linear(160, [[0,'#fdfcf8'],[0.6,'#efe7d8'],[1,'#d8c7a8']]) },
  { name:'plum',    url: mesh('#180a1f', [[0.2,0.2,0.55,'rgba(168,85,247,.55)'],[0.8,0.7,0.55,'rgba(236,72,153,.45)']]) },
  { name:'forest',  url: linear(150, [[0,'#14532d'],[0.6,'#052e16'],[1,'#000']]) },
  { name:'slate',   url: linear(135, [[0,'#64748b'],[0.5,'#334155'],[1,'#0f172a']]) },
];
const bgByName = (n) => (BG_PRESETS.find(p => p.name === n) || BG_PRESETS[0]).url;

/* ---- resolving a background descriptor to a URL ----
   state.bg says WHAT the background is; bgUrl is the URL that says so today.
   Only the descriptor is ever saved. */
let bgUrl = null;
let bgObjectUrl = null;            // an upload's blob: url — deliberately not persisted

// /seed/ rather than ?random=: picsum treats the query as a cache-buster and
// hands back a different photograph every call, so a saved scene would come
// back with the wrong picture. /seed/<s>/ is stable.
const photoURL = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${REF.w}/${REF.h}`;
const newSeed = () => Math.random().toString(36).slice(2, 9);

function resolveBg() {
  const bg = state.bg;
  if (bg.kind === 'gradient') return bgByName(bg.preset);
  if (bg.kind === 'image')    return encodeURI(bg.src || '');
  if (bg.kind === 'upload')   return bgObjectUrl || bgByName(null);
  return photoURL(bg.seed);
}
// Takes the descriptor change and the repaint together, because every caller
// wants both and forgetting the second leaves the old picture on screen.
function applyBg(patch) {
  if (patch) Object.assign(state.bg, patch);
  const url = resolveBg();
  if (state.bg.kind !== 'photo') { bgUrl = url; render(); return; }
  // Preload so a dead network shows a gradient rather than the bare backdrop
  // colour. The DESCRIPTOR is left alone: the scene still says which photo it
  // wants, and saving it offline records that rather than the stand-in.
  const im = new Image();
  im.onload  = () => { bgUrl = url; render(); };
  im.onerror = () => { bgUrl = bgByName(null); render(); };
  im.src = url;
}

let lastGrad = -1;
$('bgGradient').addEventListener('click', () => randomGradient());
$('bgUpload').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const prev = bgObjectUrl;                 // revoke the PREVIOUS url, never the new one
  bgObjectUrl = URL.createObjectURL(f);
  applyBg({ kind: 'upload' });
  if (prev) URL.revokeObjectURL(prev);
});
function loadRandomPhoto() { applyBg({ kind: 'photo', seed: newSeed() }); }
$('bgPhoto').addEventListener('click', loadRandomPhoto);
function randomGradient() {
  let i; do { i = Math.floor(Math.random()*BG_PRESETS.length); } while (BG_PRESETS.length > 1 && i === lastGrad);
  lastGrad = i;
  applyBg({ kind: 'gradient', preset: BG_PRESETS[i].name });
}
// Randomize the background = a fresh photo. Gradients are a manual-only choice
// (the "Random gradient" button); they're never picked by Randomize.
function randomBg() { loadRandomPhoto(); }

/* ---- treatment of the picture ----
   Saturation and blur belong to the layer, not to the file: a re-roll swaps the
   photograph and leaves the treatment standing, which is how "a washed-out,
   softly blurred backdrop" survives twenty rolls of what is behind the type. */
$('bg-sat').addEventListener('input', e => {
  state.bg.sat = +e.target.value;
  $('bg-satV').value = Math.round(state.bg.sat * 100) + '%';
  render();
});
$('bg-blur').addEventListener('input', e => {
  state.bg.blur = +e.target.value;
  $('bg-blurV').value = state.bg.blur + 'px';
  render();
});
function syncBgTreatment() {
  $('bg-sat').value = state.bg.sat;   $('bg-satV').value = Math.round(state.bg.sat * 100) + '%';
  $('bg-blur').value = state.bg.blur; $('bg-blurV').value = state.bg.blur + 'px';
}

/* ---- static-background effect (toggled from the Background section) ---- */
const FX_DEF = { opacity: 0.12, fps: 24, cell: 2 };
const fxStatic = createStaticBackground({ container: $('fxLayer'), opacity: FX_DEF.opacity, fps: FX_DEF.fps, cellSize: FX_DEF.cell, autostart: false });
$('fx-opacity').value = FX_DEF.opacity; $('fx-opacityV').value = FX_DEF.opacity;
$('fx-fps').value = FX_DEF.fps;         $('fx-fpsV').value = FX_DEF.fps;
$('fx-cell').value = FX_DEF.cell;       $('fx-cellV').value = FX_DEF.cell;
$('fx-opacity').addEventListener('input', e => { state.fx.opacity = +e.target.value; $('fx-opacityV').value = e.target.value; renderFx(); });
$('fx-fps').addEventListener('input',     e => { state.fx.fps = +e.target.value;     $('fx-fpsV').value = e.target.value; renderFx(); });
$('fx-cell').addEventListener('input',    e => { state.fx.cell = +e.target.value;    $('fx-cellV').value = e.target.value; renderFx(); });

// state.fx -> the grain instance. Only pushes the numbers while it is running;
// the instance is idle when off and has nothing to be told.
function renderFx() {
  const f = state.fx;
  fxStatic.toggle(f.enabled);
  if (!f.enabled) return;
  fxStatic.set('opacity', f.opacity);
  fxStatic.set('fps', f.fps);
  fxStatic.set('cellSize', f.cell);
}

// Presets and scene files hand over a partial { enabled, opacity?, fps?, cell? }.
function applyFx(fx) {
  Object.assign(state.fx, { enabled: false, ...fx });
  renderFx();
}
