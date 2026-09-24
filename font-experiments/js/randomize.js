/* randomize — the dice.
   One roll per layer, gathered by section. A lock on a layer or on the section
   holding it keeps it through a re-roll; rollable() folds the two together. */

/* ============================ randomize ============================ */
const rand = (a) => a[Math.floor(Math.random()*a.length)];
const rnd  = (lo,hi,step=1) => { const n = Math.round((lo + Math.random()*(hi-lo))/step)*step; return +n.toFixed(4); };
const HEADING_POOL = FONTS.filter(f => ['display','serif','sans'].includes(f.c));
const BODY_POOL    = FONTS.filter(f => ['sans','serif'].includes(f.c));
const heavy = (f) => { const big = f.w.filter(x=>x>=600); return big.length ? rand(big) : Math.max(...f.w); };

// per-role randomizers (mutate state[role]; honour fontsOnly for the style bits)
function rHeading(fontsOnly) {
  const hf = rand(HEADING_POOL);
  state.heading.font = hf.n; state.heading.weight = heavy(hf);
  state.heading.italic = hf.i && Math.random() < 0.15;
  if (!fontsOnly) {
    state.heading.transform = rand(['none','none','uppercase']);
    state.heading.size = state.heading.transform === 'uppercase' ? rnd(48,110) : rnd(60,150);
    state.heading.ls = state.heading.transform === 'uppercase' ? rnd(0.02,0.12,0.005) : rnd(-0.03,0.01,0.005);
    state.heading.lh = rnd(0.95,1.15,0.01);
    state.heading.align = rand(['left','left','center']);
    state.heading.amount = rnd(2,9);
  }
  loadFont(state.heading.font);
}
function rBody(fontsOnly) {
  const pool = BODY_POOL.filter(f => f.n !== state.heading.font);
  const diff = pool.filter(f => f.c !== byName(state.heading.font).c);
  const bf = rand(diff.length ? diff : pool);
  state.body.font = bf.n; state.body.weight = bf.w.includes(400) ? 400 : rand(bf.w); state.body.italic = false;
  if (!fontsOnly) {
    state.body.size = rnd(15,21); state.body.lh = rnd(1.5,1.85,0.01); state.body.ls = rnd(-0.01,0.01,0.005);
    state.body.columns = rand([1,1,2,2,3]); state.body.transform = 'none'; state.body.align = 'left';
    state.body.amount = rnd(90,340);
  }
  loadFont(state.body.font);
}
function rSub(fontsOnly) {
  const sf = byName(Math.random() < 0.4 ? state.heading.font : state.body.font);
  state.subheading.font = sf.n;
  const mid = sf.w.filter(x => x>=400 && x<=600);
  state.subheading.weight = mid.length ? rand(mid) : rand(sf.w);
  state.subheading.italic = sf.i && Math.random() < 0.2;
  if (!fontsOnly) {
    state.subheading.transform = rand(['none','uppercase','uppercase']);
    state.subheading.ls = state.subheading.transform === 'uppercase' ? rnd(0.08,0.24,0.005) : rnd(-0.01,0.02,0.005);
    state.subheading.size = state.subheading.transform === 'uppercase' ? rnd(13,20) : rnd(18,30);
    state.subheading.lh = rnd(1.2,1.45,0.01);
    state.subheading.align = state.heading.align;
    state.subheading.amount = rnd(6,22);
  }
  loadFont(state.subheading.font);
}
function rTopMenu(fontsOnly) {
  const f = rand(BODY_POOL);            // menus read best in clean text faces
  state.topmenu.font = f.n;
  const mid = f.w.filter(x => x>=400 && x<=700);
  state.topmenu.weight = mid.length ? rand(mid) : rand(f.w);
  if (!fontsOnly) {
    state.topmenu.transform = rand(['none','uppercase','uppercase']);
    state.topmenu.size = rnd(12,18);
    state.topmenu.ls = state.topmenu.transform === 'uppercase' ? rnd(0.04,0.18,0.005) : rnd(0,0.03,0.005);
    state.topmenu.align = rand(['spread','spread','left','center']);
    state.topmenu.links = rnd(3,6);
    state.topmenu.gap = rnd(16,44);
  }
  loadFont(state.topmenu.font);
}
const RFN = { heading: rHeading, body: rBody, subheading: rSub, topmenu: rTopMenu };

/* ---- the background sub-layer rolls ----
   One per entry in SUBLAYERS.

   A roll NEVER touches `enabled`. Whether a layer is on is the one decision
   that is yours alone: the eye says what the cover is made of, and a dice that
   quietly switched layers on and off would keep overruling it — you would turn
   the grain off, re-roll the type, and find it back. So the dice rolls what a
   layer looks like and the eye decides whether you see it, which also means a
   layer you have hidden is still being rolled and is ready the moment you show
   it. */

// The scrim: what makes type readable over a photograph.
function rollScrim() {
  const c = state.scrim;
  c.color = rand(['dark', 'dark', 'dark', 'light']);
  c.amount = rnd(0.15, 0.6, 0.05);
}

// Grain takes the standard params, because a random fps or cell size is noise
// rather than variety — so a roll of it is really just a reset.
function rollFx() { applyFx({ ...FX_DEF, enabled: state.fx.enabled }); }

// The pattern overlay. Rotation in right angles only, because a tile turned 37
// degrees rarely reads as anything.
function rollPattern() {
  const p = state.pattern;
  p.name = rand(OVERLAY_PATTERNS).n;
  p.scale = rnd(0.5, 3, 0.1);
  p.opacity = rnd(0.1, 0.4, 0.05);
  p.rotate = rnd(0, 3) * 90;
  p.blend = rand(['normal', 'normal', 'multiply', 'screen', 'overlay']);
  // Against a photograph the tint that reads is a flat one, so black or white
  // rather than a colour that fights whatever is underneath.
  p.color = rand(['#ffffff', '#000000']);
}

// Global randomize — every unlocked section (order matters: body/sub depend on heading).
function randomizeRoles(fontsOnly, skipBg) {
  // Every layer, in declaration order. Nothing here names one: a layer added to
  // SUBLAYERS is rolled by this loop without the loop changing.
  Object.entries(SUBLAYERS).forEach(([k, layer]) => {
    if (fontsOnly && layer.of === 'background') return;   // a fonts-only roll leaves the backdrop alone
    if (k === 'bg' && skipBg) return;                     // on load, loadRandomPhoto does the first paint
    if (rollable(k)) layer.roll(fontsOnly);
  });
  if (!fontsOnly) {
    // Back to the grid. This is the start-over button, so it also undoes where
    // blocks have been dragged to — and it is the way back for one dragged
    // clean off the screen, which is otherwise unreachable. Lock a section to
    // keep its placement.
    // Placement is part of the roll now. The container used to arrange the text
    // whatever happened, so randomize never had to think about where it went;
    // with free-standing blocks, a composition nobody places is a composition
    // that always looks the same.
    state.layout.align = rand(['left', 'left', 'center', 'right']);
    state.layout.vAlign = rand(['center', 'center', 'flex-end', 'flex-start']);
    state.layout.colW = rnd(560, 1120, 10);
    restack();
    // title & subtitle use the fixed cover copy + length here (their fonts/sizes
    // still vary). rollable(), not locks[] — a lock on the section holding these
    // has to hold their copy too, or locking Typography would still rewrite it.
    if (rollable('heading'))    { state.heading.amount = COVER.heading.words; state.heading.transform = 'none'; els.heading.textContent = COVER.heading.text; }
    if (rollable('subheading')) { state.subheading.amount = COVER.sub.words;  state.subheading.transform = 'none'; els.subheading.textContent = COVER.sub.text; }
    if (rollable('body'))       setText('body');
  }
  syncInputs(); render();
}

// Randomize just one section (explicit action — ignores its lock).
function randomizeSection(key) {
  // The plate has nothing to roll — the useful action in its place is refitting
  // it around the text, which is what its section button says it does. It fits
  // the plate whether or not the plate is showing: turning it on is the eye's
  // business, like everywhere else.
  if (key === 'plate') { syncInputs(); render(); plateToText(); return; }

  // A section dice rolls everything layered inside it; a layer dice rolls only
  // itself. Both ignore locks — a dice is an explicit act. Text layers also
  // need fresh copy, which rolling their type alone does not give them.
  const rollOne = (k) => { SUBLAYERS[k].roll(false); if (TEXT_ROLES.includes(k)) setText(k); };
  const inSection = Object.keys(SUBLAYERS).filter(k => SUBLAYERS[k].of === key);
  if (inSection.length) { inSection.forEach(rollOne); syncInputs(); render(); return; }
  if (SUBLAYERS[key]) { rollOne(key); syncInputs(); render(); return; }

  RFN[key](false);
  if (key !== 'topmenu') setText(key);
  syncInputs(); render();
}

$('randomize').addEventListener('click', () => randomizeRoles(false));
$('randFonts').addEventListener('click', () => randomizeRoles(true));
document.querySelectorAll('[data-rand]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); randomizeSection(b.dataset.rand); }));
$('helpToggle').addEventListener('click', e => {
  const open = $('help').hidden;
  $('help').hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
});
