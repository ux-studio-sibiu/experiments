/* scenes — whole compositions, saved and loaded.
   The curated presets, the scenes/ folder, the ones kept in this browser, and
   the dropdown that lists both. Every number in a scene is in artboard units,
   so a scene describes a composition rather than a window. */

/* ============================ curated presets ============================ */
// Hand-picked, deterministic covers. Loaded instead of a random combo when the
// URL carries ?curated  (?curated=N selects preset N; bare ?curated picks one at
// random). Backgrounds use the offline gradient presets by name so a curated
// link looks identical with or without a network connection.
// Each preset is a partial of `state`; unspecified fields keep their defaults.
const CURATED = [
  { name:'Editorial', bg:'curated bk/a4.jpg', scrim:{amount:0.4,color:'dark'}, textColor:'#ffffff',
    heading:{font:'Playfair Display', weight:700, size:104, lh:1.02, ls:-0.02, transform:'none', align:'left'},
    subheading:{font:'Inter', weight:500, size:21, ls:0.16, transform:'uppercase', align:'left'},
    body:{font:'Source Serif 4', weight:400, size:18, lh:1.7, ls:0, columns:2, transform:'none', align:'left', amount:120},
    topmenu:{enabled:true, font:'Inter', weight:500, size:14, ls:0.1, transform:'uppercase', align:'spread', brand:true, links:4},
    fx:{enabled:false} },
  { name:'Brutalist', bg:'curated bk/bk15.jpg', scrim:{amount:0.5,color:'dark'}, textColor:'#ffffff', shadow:true,
    layout:{vAlign:'flex-end', hAlign:'flex-start', width:1070, offX:0, offY:0, cardColor:'#000000', cardA:0.36, cardPad:14},
    heading:{font:'Archivo', weight:900, size:97, lh:0.95, ls:-0.03, italic:false, transform:'uppercase', align:'left'},
    subheading:{font:'Space Grotesk', weight:500, size:36, lh:1.57, ls:0.04, italic:false, transform:'none', align:'left'},
    body:{font:'Inter', weight:300, size:15, lh:1.48, ls:0.005, italic:false, transform:'none', align:'justify', columns:3, amount:160},
    topmenu:{enabled:false, links:5, font:'Space Grotesk', weight:500, size:13, ls:0.12, transform:'uppercase', align:'spread', gap:28, pad:28, color:'#ffffff', brand:false, bg:'#0b0b0d', bgA:0},
    fx:{enabled:true, opacity:0.1, fps:11, cell:2} },
  { name:'Gilded', bg:'curated bk/1000.jpg', scrim:{amount:0.14,color:'dark'}, textColor:'#ffdd00', shadow:true,
    layout:{vAlign:'flex-end', hAlign:'flex-start', width:540, offX:0, offY:0, cardColor:'#000000', cardA:0.44, cardPad:24},
    heading:{font:'Playfair Display', weight:600, size:60, lh:1, ls:-0.005, italic:true, transform:'none', align:'left'},
    subheading:{font:'Playfair Display', weight:600, size:18, lh:1.3, ls:0.16, italic:false, transform:'none', align:'left'},
    body:{font:'Work Sans', weight:400, size:12, lh:1.11, ls:-0.045, italic:false, transform:'none', align:'justify', columns:2, amount:211},
    topmenu:{enabled:true, links:4, font:'Archivo', weight:600, size:12, ls:0.17, transform:'uppercase', align:'center', gap:72, pad:38, color:'#d8ff6b', brand:false, bg:'#0b0b0d', bgA:0},
    fx:{enabled:true, opacity:0.07, fps:17, cell:1.5} },
  { name:'Warm display', bg:'curated bk/bk28.jpg', scrim:{amount:0.4,color:'dark'}, textColor:'#ffffff',
    heading:{font:'Fraunces', weight:600, size:96, lh:1.05, ls:-0.01, transform:'none', align:'left'},
    subheading:{font:'Fraunces', weight:400, size:23, ls:0, transform:'none', align:'left'},
    body:{font:'Lora', weight:400, size:18, lh:1.75, ls:0, columns:2, transform:'none', align:'left', amount:120},
    topmenu:{enabled:true, font:'Lora', weight:500, size:15, ls:0.02, transform:'none', align:'left', brand:true, links:4},
    fx:{enabled:false} },
];
function applyPreset(p) {
  for (const k in p) {
    if (k === 'bg' || k === 'fx' || k === 'name' || k === 'layout' || k === 'textColor' || k === 'shadow') continue;
    if (state[k] && typeof state[k] === 'object' && typeof p[k] === 'object') Object.assign(state[k], p[k]);
    else state[k] = p[k];
  }
  /* The presets were written against the shared container: one text colour, one
     shadow switch and one card for the lot. Fan those out to the per-block
     fields they became, rather than rewriting eight presets by hand. */
  if (p.textColor) TYPE_BLOCKS.forEach(k => { state[k].color = p.textColor; });
  if (typeof p.shadow === 'boolean') TYPE_BLOCKS.forEach(k => { state[k].shadow = p.shadow; });
  if (p.topmenu && p.topmenu.color) state.topmenu.color = p.topmenu.color;
  if (p.layout) {
    const L = p.layout;
    if (L.hAlign) state.layout.align = { 'flex-start':'left', center:'center', 'flex-end':'right' }[L.hAlign] || 'left';
    if (L.vAlign) state.layout.vAlign = L.vAlign;
    if (L.width) state.layout.colW = L.width;
    // A card with any opacity becomes a plate; no card means no plate.
    state.plate.enabled = L.cardA > 0;
    // cardPad is dropped: the plate's inset is a constant now, not a setting.
    if (L.cardA > 0) Object.assign(state.plate, { color: L.cardColor || '#000000', alpha: L.cardA });
  }
  els.heading.textContent = COVER.heading.text;  state.heading.amount = COVER.heading.words;
  els.subheading.textContent = COVER.sub.text;   state.subheading.amount = COVER.sub.words;
  setText('body');
  restack();
  if (p.bg) {
    // image path → a bundled file; anything else names a gradient preset
    const isImg = /\.(jpe?g|png|webp|avif|gif)$/i.test(p.bg) || p.bg.includes('/');
    applyBg(isImg ? { kind: 'image', src: p.bg, preset: null }
                  : { kind: 'gradient', preset: p.bg, src: null });
  }
  applyFx(p.fx);
  [state.heading.font, state.subheading.font, state.body.font, state.topmenu.font].forEach(loadFont);
  syncInputs(); render();
}

/* ============================ save / load a scene ============================
   The whole point of the artboard: every number below is in artboard units, so
   a scene file describes a composition rather than a window, and reloads the
   same at any size. The reference box travels with the file so changing the
   default later cannot invalidate an old scene.
   ========================================================================== */
// 2: blocks are free-standing. Each owns its x, y, box, colour and shadow,
//    where v1 had a shared container with one text colour, one shadow switch
//    and a card. Nothing maps cleanly, so v1 files are refused rather than
//    half-applied — re-save them from this build.
const SCENE_V = 2;
const SCENES_DIR = 'scenes/';        // where a saved scene is picked up from again
const nameField = () => $('sceneName').value.trim();
const sceneStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

// `kind` decides which of seed/preset/src means anything; the others are stale
// leftovers from whatever the background was before. Write only the live one,
// so a scene file says exactly what it is.
const BG_KEY = { photo: 'seed', gradient: 'preset', image: 'src' };
function bgOut() {
  const b = state.bg, key = BG_KEY[b.kind];
  return { enabled: b.enabled, kind: b.kind, ...(key ? { [key]: b[key] } : {}) };
}

function serializeScene() {
  const out = {
    v: SCENE_V,
    name: nameField(),
    ref: { w: REF.w, h: REF.h },
    bg: bgOut(),
    scrim: { ...state.scrim },
    fx: { ...state.fx },
    // The one nested value in the whole scene: which colours of the drawn
    // background were swapped for which.
    svgbg: { ...state.svgbg, overrides: { ...state.svgbg.overrides } },
    layout: { ...state.layout },
    pattern: { ...state.pattern },
    // The copy is edited by hand on the stage, so it is part of the scene, not
    // something `amount` can regenerate.
    text: {
      heading: els.heading.textContent,
      subheading: els.subheading.textContent,
      body: els.body.textContent,
    },
  };
  BLOCKS.forEach(k => { out[k] = { ...state[k] }; });   // all scalars now, so a shallow copy is a whole one
  return out;
}

function applyScene(data) {
  if (!data || typeof data !== 'object') throw new Error('not a scene file');
  if (data.v !== SCENE_V) throw new Error(`scene version ${data.v} is not supported`);
  if (typeof data.name === 'string') $('sceneName').value = data.name;
  if (data.ref) setRef(+data.ref.w, +data.ref.h);
  if (data.bg) Object.assign(state.bg, data.bg);
  if (data.scrim) Object.assign(state.scrim, data.scrim);
  if (data.svgbg) Object.assign(state.svgbg, data.svgbg, { overrides: { ...data.svgbg.overrides } });
  if (data.layout) Object.assign(state.layout, data.layout);
  if (data.plate) Object.assign(state.plate, data.plate);
  if (data.pattern) Object.assign(state.pattern, data.pattern);
  BLOCKS.forEach(k => { if (data[k]) Object.assign(state[k], data[k]); });
  if (data.text) {
    if (typeof data.text.heading === 'string') els.heading.textContent = data.text.heading;
    if (typeof data.text.subheading === 'string') els.subheading.textContent = data.text.subheading;
    if (typeof data.text.body === 'string') els.body.textContent = data.text.body;
  }
  applyFx(data.fx);
  TYPE_BLOCKS.forEach(k => loadFont(state[k].font));
  deselect();
  syncInputs();
  applyBg();                      // resolves the descriptor, then renders
}

const NOTE_DEFAULT = $('sceneNote').textContent;
let noteTimer = 0;
function sceneNote(msg) {
  $('sceneNote').textContent = msg;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { $('sceneNote').textContent = NOTE_DEFAULT; }, 6000);
}

let savedTimer = 0;
function saveScene(btn) {
  const blob = new Blob([JSON.stringify(serializeScene(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = nameField().replace(/[^a-z0-9._ -]+/gi, '').trim().replace(/\s+/g, '-');
  a.download = `scene-${slug || new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  sceneNote(state.bg.kind === 'upload'
    ? 'Saved — but an uploaded background is not stored in the file; it will fall back to a gradient.'
    : `Saved at ${REF.w}×${REF.h} — move it into ${SCENES_DIR} to list it above.`);
  // The note above sits at the bottom of a section that is collapsed by
  // default, so a save from the titlebar has to answer for itself.
  if (btn && btn.id === 'sceneSaveTop') {
    btn.textContent = '✓';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { btn.textContent = '⤓'; }, 1200);
  }
}
// Two ways in: the titlebar, which is always on screen, and the Scene section,
// which is where Load lives and so is where you go looking for the pair.
$('sceneSave').addEventListener('click', e => saveScene(e.currentTarget));
$('sceneSaveTop').addEventListener('click', e => saveScene(e.currentTarget));

// The whole browser store, one file each — the way out of localStorage and into
// scenes/, and the way to keep what is there before clearing site data.
//
// One file per scene rather than an archive: these are already JSON, and a zip
// would mean a library to make it and a step to undo it. They are spaced out
// because a browser that is handed a dozen downloads at once takes the first
// and quietly drops the rest.
function downloadStore(btn) {
  const store = readStore();
  const names = Object.keys(store);
  if (!names.length) { sceneNote('Nothing is stored in this browser yet.'); return; }
  names.forEach((name, i) => setTimeout(() => {
    const blob = new Blob([JSON.stringify(store[name], null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = name.replace(/[^a-z0-9._ -]+/gi, '').trim().replace(/\s+/g, '-');
    a.download = `scene-${slug || 'untitled'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, i * 180));
  sceneNote(`Downloading ${names.length} scene${names.length > 1 ? 's' : ''} — move them into ${SCENES_DIR} to list them above.`);
  if (btn) {
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '⇊'; }, 1200);
  }
}
$('sceneDumpAll').addEventListener('click', e => downloadStore(e.currentTarget));

/* ---- the scenes folder ----
   A page cannot read a directory, so the list is asked for two ways, in order:

   1. the dev server's own directory listing, parsed for .json links. Zero
      upkeep, which is what makes the folder just work while you are building,
      and it is tried FIRST so the usual path makes no failing request — a
      manifest probe that 404s on every load is console noise you would then
      have to learn to ignore.
   2. scenes/index.json, a manifest — either ["a.json", …] or
      { scenes: [{ file, name }, …] }. Reached whenever no listing is served,
      which is the static-host case: a plain file host, or GitHub Pages, or
      wherever the portfolio ends up embedding this. It is also the only way to
      give a scene a real name rather than its timestamp.

   Neither can watch the folder, hence the refresh button beside the dropdown. */
const getJSON = (url) => fetch(url, { cache: 'no-store' }).then(r => {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
});

// scene-2026-09-21-06-30-11.json -> "2026-09-21 06:30"
function sceneName(file) {
  const base = file.replace(/\.json$/i, '');
  const m = base.match(/^scene-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-\d{2}$/);
  return m ? `${m[1]} ${m[2]}:${m[3]}` : base;
}

async function listScenes() {
  try {
    const res = await fetch(SCENES_DIR, { cache: 'no-store' });
    if (res.ok) {
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const hrefs = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
      const files = hrefs
        .map(h => decodeURIComponent(h.split('/').filter(Boolean).pop() || ''))
        .filter(f => /\.json$/i.test(f) && f !== 'index.json')
        // Names are timestamps, so reverse-alphabetical puts the newest on top.
        .sort((a, b) => b.localeCompare(a));
      // A generated index always links to its parent, and an app's own index
      // page does not — which is how an EMPTY folder is told apart from a host
      // that answers every path with the same page. Without that distinction an
      // empty scenes/ would probe for the manifest and log a 404 on every load.
      const isListing = hrefs.some(h => /(^|\/)\.\.\/?$/.test(h));
      if (files.length || isListing) return files.map(f => ({ file: f, name: sceneName(f) }));
    }
  } catch {}
  try {
    const j = await getJSON(SCENES_DIR + 'index.json');
    const arr = Array.isArray(j) ? j : (j.scenes || []);
    return arr.map(e => typeof e === 'string'
      ? { file: e, name: sceneName(e) }
      : { file: e.file, name: e.name || sceneName(e.file) });
  } catch {}
  return [];
}

/* ---- scenes kept in the browser ----
   A page cannot write into the project, so exporting a file means a trip
   through the downloads folder. That is fine for a keeper and far too much
   ceremony for "let me try this again in a minute", which is what this is for:
   localStorage, one JSON object keyed by name, surviving reloads and restarts.
   Perhaps 3KB a scene against a ~5MB budget, so the count is not worth
   policing. Every access is guarded — storage throws outright in a private
   window, and setItem throws on quota. */
const LS_KEY = 'randomizeStudio.scenes';
function readStore() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function writeStore(map) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); return true; }
  catch (err) { sceneNote(`This browser refused to store it (${err.name}) — use Export instead.`); return false; }
}

/* ---- the dropdown: both sources in one list ----
   Values are prefixed by where they live, because a browser scene and a file
   can carry the same name and they are fetched differently. */
async function refreshScenes(selectValue) {
  const sel = $('sceneList');
  const local = Object.keys(readStore()).sort((a, b) => a.localeCompare(b));
  const files = await listScenes();
  const total = local.length + files.length;

  sel.replaceChildren(new Option(total ? '— pick a scene —' : '— none saved —', ''));
  const group = (label, entries) => {
    if (!entries.length) return;
    const g = document.createElement('optgroup');
    g.label = label;
    // new Option() sets text, not HTML: a name cannot inject markup here.
    entries.forEach(([text, value]) => g.append(new Option(text, value)));
    sel.append(g);
  };
  group('this browser', local.map(n => [n, 'local:' + n]));
  group(SCENES_DIR, files.map(s => [s.name, 'file:' + s.file]));

  sel.disabled = !total;
  if (selectValue) sel.value = selectValue;
  syncSceneButtons();
  return { local: local.length, files: files.length, total };
}

// Only a browser scene can be deleted from here; a file in scenes/ is not ours
// to remove, and nothing in a web page should pretend otherwise.
function syncSceneButtons() {
  $('sceneDelete').disabled = !$('sceneList').value.startsWith('local:');
}

$('sceneList').addEventListener('change', async e => {
  const v = e.target.value;
  syncSceneButtons();
  if (!v) return;
  const id = v.slice(v.indexOf(':') + 1);
  try {
    if (v.startsWith('local:')) {
      const scene = readStore()[id];
      if (!scene) throw new Error('it is no longer in this browser');
      applyScene(scene);
      sceneNote(`Loaded "${id}" from this browser.`);
    } else {
      applyScene(await getJSON(SCENES_DIR + encodeURIComponent(id)));
      sceneNote(`Loaded ${id}.`);
    }
  } catch (err) {
    sceneNote(`Could not load: ${err.message}`);
  }
});

$('sceneStore').addEventListener('click', () => {
  const name = nameField() || sceneStamp();
  const map = readStore();
  const replacing = name in map;
  map[name] = serializeScene();
  if (!writeStore(map)) return;
  $('sceneName').value = name;
  refreshScenes('local:' + name);
  sceneNote(`${replacing ? 'Replaced' : 'Saved'} "${name}" in this browser.`);
});

$('sceneDelete').addEventListener('click', () => {
  const v = $('sceneList').value;
  if (!v.startsWith('local:')) return;
  const name = v.slice(6);
  const map = readStore();
  delete map[name];
  if (!writeStore(map)) return;
  refreshScenes();
  sceneNote(`Deleted "${name}" from this browser.`);
});

$('sceneRefresh').addEventListener('click', async () => {
  const { local, files, total } = await refreshScenes();
  sceneNote(total ? `${local} in this browser, ${files} in ${SCENES_DIR}`
                  : `Nothing saved yet — Save here keeps one in this browser.`);
});
refreshScenes();

$('sceneLoad').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';                    // so re-picking the same file fires again
  if (!f) return;
  try {
    applyScene(JSON.parse(await f.text()));
    sceneNote(`Loaded ${f.name}.`);
  } catch (err) {
    sceneNote(`Could not load: ${err.message}`);
  }
});
