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
  // The treatment travels with the descriptor: it is part of how the background
  // looks, and a scene that reloaded the right photograph with the wrong
  // saturation would be the wrong cover.
  return { enabled: b.enabled, kind: b.kind, sat: b.sat, blur: b.blur, ...(key ? { [key]: b[key] } : {}) };
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
  // The menu's position is written down the way its anchor says: live it is
  // plain left/top, on paper it is a distance from the corner it is anchored
  // to. That is the whole job of the anchor, and this is one of the two places
  // it happens.
  Object.assign(out.topmenu, menuOffsets());
  return out;
}

function applyScene(data) {
  if (!data || typeof data !== 'object') throw new Error('not a scene file');
  if (data.v !== SCENE_V) throw new Error(`scene version ${data.v} is not supported`);
  if (typeof data.name === 'string') $('sceneName').value = data.name;
  if (data.ref) setRef(+data.ref.w, +data.ref.h);
  // Default first, then what the scene says. A scene saved before a layer
  // existed says nothing about it, and "nothing" has to mean the default —
  // otherwise loading an older cover leaves the newer layers of the one you
  // were just looking at sitting on top of it, which is how a scene with no
  // drawn background used to arrive still wearing one.
  const put = (k) => Object.assign(state[k], DEFAULTS[k], data[k] || {});
  ['bg', 'scrim', 'layout', 'pattern'].forEach(put);
  BLOCKS.forEach(put);
  // The one nested value in a scene, so the one that cannot be copied flat.
  put('svgbg');
  state.svgbg.overrides = { ...(data.svgbg ? data.svgbg.overrides : DEFAULTS.svgbg.overrides) };
  if (data.text) {
    if (typeof data.text.heading === 'string') els.heading.textContent = data.text.heading;
    if (typeof data.text.subheading === 'string') els.subheading.textContent = data.text.subheading;
    if (typeof data.text.body === 'string') els.body.textContent = data.text.body;
  }
  applyFx({ ...DEFAULTS.fx, ...data.fx });   // same rule: unmentioned is default, not current
  TYPE_BLOCKS.forEach(k => loadFont(state[k].font));
  deselect();
  syncInputs();
  applyBg();                      // resolves the descriptor, then renders
  // The other half of the anchor: the file's numbers are a distance from the
  // corner it names, and this turns them back into left/top for the window that
  // is actually here. After the render above, because the bar's own size is
  // half of that sum and only a laid-out bar knows it.
  const saved = data.topmenu || {};
  menuFromOffsets(saved.x ?? DEFAULTS.topmenu.x, saved.y ?? DEFAULTS.topmenu.y);
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

// A scene's folder is its group in the dropdown, and the empty string is the
// root of scenes/ itself. Paths are relative to SCENES_DIR throughout.
const groupOf = (file) => file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';

// One directory: the .json files in it, and the folders under it. Returns null
// when the path is not a listing at all, which is how an empty folder is told
// apart from a host that answers every path with the same page.
async function readDir(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) return null;
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const hrefs = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
  // A generated index always links to its parent; an app's own index page does
  // not. Without that distinction an empty scenes/ would probe for the manifest
  // and log a 404 on every load.
  const isListing = hrefs.some(h => /(^|\/)\.\.\/?$/.test(h));
  const names = hrefs
    .filter(h => !/(^|\/)\.\.\/?$/.test(h))
    .map(h => decodeURIComponent(h.replace(/\/$/, '').split('/').filter(Boolean).pop() || '') + (h.endsWith('/') ? '/' : ''));
  const files = names.filter(n => /\.json$/i.test(n) && n !== 'index.json');
  const dirs = names.filter(n => n.endsWith('/')).map(n => n.slice(0, -1)).filter(Boolean);
  if (!files.length && !dirs.length && !isListing) return null;
  return { files, dirs };
}

// { scenes: [{ file, name, group }], folders: [name] } — the folders separately,
// because an empty one still has to be listed. A folder that is simply missing
// from the panel reads as "subfolders are not being read"; one that says it is
// empty reads as what it is.
async function listScenes() {
  try {
    const root = await readDir(SCENES_DIR);
    if (root) {
      // One level down and no further: a folder is a way to keep a set of
      // covers together, not a tree to go exploring, and every extra level is
      // another request on every load.
      const nested = await Promise.all(root.dirs.map(async d => {
        const sub = await readDir(`${SCENES_DIR}${encodeURIComponent(d)}/`);
        return (sub ? sub.files : []).map(f => `${d}/${f}`);
      }));
      // Names are timestamps as often as not, so reverse-alphabetical puts the
      // newest on top within each group.
      const files = [...root.files, ...nested.flat()].sort((a, b) => b.localeCompare(a));
      return {
        source: 'listing',
        scenes: files.map(f => ({ file: f, name: sceneName(f.split('/').pop()), group: groupOf(f) })),
        folders: [...root.dirs].sort((a, b) => a.localeCompare(b)),
      };
    }
  } catch {}
  try {
    // No listing: a plain file host, a server with directory indexes turned
    // off, or the page opened straight off the disk. The manifest is the way
    // in then — tools/build-scenes-index.js writes it — and it can name a
    // folder too: "covers/dark.json" groups the same way a real folder does.
    const j = await getJSON(SCENES_DIR + 'index.json');
    const arr = Array.isArray(j) ? j : (j.scenes || []);
    const scenes = arr.map(e => typeof e === 'string' ? { file: e } : e)
      .map(e => ({ file: e.file, name: e.name || sceneName(e.file.split('/').pop()), group: e.group ?? groupOf(e.file) }));
    const named = Array.isArray(j) ? [] : (j.folders || []);
    return { source: 'manifest', scenes, folders: [...new Set([...named, ...scenes.map(s => s.group).filter(Boolean)])].sort() };
  } catch {}
  // Neither route answered, which is a thing worth saying rather than an empty
  // list to puzzle over — the rescan note says it.
  return { source: 'none', scenes: [], folders: [] };
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

/* ---- the list: both sources, open ----
   Every scene on screen under a heading for where it lives, rather than behind
   a dropdown that has to be opened before it says how much is in there.
   Values are prefixed by their source, because a browser scene and a file can
   carry the same name and they are fetched differently. */
let picked = '';                     // 'local:<name>' or 'file:<path>', or nothing yet

async function refreshScenes(selectValue) {
  const list = $('sceneList');
  const local = Object.keys(readStore()).sort((a, b) => a.localeCompare(b));
  const { scenes: files, folders, source } = await listScenes();
  const total = local.length + files.length;

  list.replaceChildren();
  const group = (label, entries, showEmpty = false) => {
    if (!entries.length && !showEmpty) return;
    const h = document.createElement('div');
    h.className = 'scenegroup';
    h.textContent = label;
    list.append(h);
    for (const [text, value] of entries) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scenerow';
      b.dataset.scene = value;
      b.title = text;
      // textContent, not innerHTML: a scene names itself and a name cannot be
      // allowed to bring markup with it.
      b.textContent = text;
      b.setAttribute('aria-pressed', String(value === picked));
      list.append(b);
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'scene-empty';
      empty.textContent = 'empty';
      list.append(empty);
    }
  };
  // This browser first: it is where the one you saved a minute ago is.
  group('this browser · local storage', local.map(n => [n, 'local:' + n]));
  // Then a heading per folder under scenes/, in name order, with whatever sits
  // loose in scenes/ itself first — a folder is how a set of covers is kept
  // together, so it is how they are listed. Folders come from the listing
  // rather than from the scenes in them, so an empty one is still on screen
  // saying it is empty: a folder that quietly disappears looks like a folder
  // that was never read.
  const groups = [...new Set([...files.map(s => s.group), ...folders])]
    .sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b));
  groups.forEach(folder => {
    const inside = files.filter(s => s.group === folder);
    if (!inside.length && !folder) return;            // nothing loose in scenes/ itself
    group(SCENES_DIR + folder, inside.map(s => [s.name, 'file:' + s.file]), !inside.length);
  });

  if (!total) {
    const empty = document.createElement('p');
    empty.className = 'scene-empty';
    empty.textContent = 'Nothing saved yet — ★ keeps one in this browser.';
    list.append(empty);
  }
  if (selectValue) picked = selectValue;
  markScene();
  return { local: local.length, files: files.length, folders: folders.length, total, source };
}

function markScene() {
  const list = $('sceneList');
  let row = null;
  list.querySelectorAll('[data-scene]').forEach(b => {
    const on = b.dataset.scene === picked;
    b.setAttribute('aria-pressed', String(on));
    if (on) row = b;
  });
  // The list scrolls itself to what is loaded rather than scrollIntoView, which
  // would drag the panel along with it.
  if (row && (row.offsetTop < list.scrollTop ||
      row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight))
    list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2;
  syncSceneButtons();
}

// Only a browser scene can be deleted from here; a file in scenes/ is not ours
// to remove, and nothing in a web page should pretend otherwise.
function syncSceneButtons() {
  $('sceneDelete').disabled = !picked.startsWith('local:');
}

// Per segment, so a scene inside a folder keeps its slash: encoding the whole
// path would turn scenes/dark/a.json into one long filename.
const sceneUrl = (file) => SCENES_DIR + file.split('/').map(encodeURIComponent).join('/');

/* ---- the cover a refresh opens on ----
   scenes/initial-load/ holds finished covers meant to be seen cold, and one of
   them at random is a better first impression than a random pairing of fonts.
   Resolves false when there is nothing to open with — the folder is empty, or
   unreadable because the page was opened off the disk with no manifest beside
   it — and init.js falls back to the random first paint. Nothing is painted on
   the way out of here, so the fallback is never racing a half-applied scene. */
const INITIAL_DIR = 'initial-load';
async function loadInitialScene() {
  try {
    const { scenes } = await listScenes();
    const pool = scenes.filter(s => s.group === INITIAL_DIR);
    if (!pool.length) return false;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    applyScene(await getJSON(sceneUrl(pick.file)));
    picked = 'file:' + pick.file;       // so the list opens with it marked
    markScene();
    sceneNote(`Opened with ${pick.file}.`);
    return true;
  } catch { return false; }
}

async function loadScene(value) {
  picked = value;
  markScene();
  const id = value.slice(value.indexOf(':') + 1);
  try {
    if (value.startsWith('local:')) {
      const scene = readStore()[id];
      if (!scene) throw new Error('it is no longer in this browser');
      applyScene(scene);
      sceneNote(`Loaded "${id}" from this browser.`);
    } else {
      applyScene(await getJSON(sceneUrl(id)));
      sceneNote(`Loaded ${id}.`);
    }
  } catch (err) {
    sceneNote(`Could not load: ${err.message}`);
  }
}

$('sceneList').addEventListener('click', e => {
  const row = e.target.closest('[data-scene]');
  if (row) loadScene(row.dataset.scene);
});

/* Up and down walk the list, headings and all, and load as they go: flicking
   through saved covers is the point of having them in one place. The rows are
   buttons, so the focus ring, Enter and Space are already the browser's. */
$('sceneList').addEventListener('keydown', async e => {
  const STEP = { ArrowDown: 1, ArrowUp: -1, Home: 0, End: 0 };
  if (!(e.key in STEP)) return;
  const rows = [...$('sceneList').querySelectorAll('[data-scene]')];
  if (!rows.length) return;
  e.preventDefault();
  const at = rows.findIndex(r => r.dataset.scene === picked);
  const next = e.key === 'Home' ? rows[0]
             : e.key === 'End' ? rows[rows.length - 1]
             // From nothing picked, down starts at the top and up at the bottom.
             : at < 0 ? (STEP[e.key] > 0 ? rows[0] : rows[rows.length - 1])
             : rows[(at + STEP[e.key] + rows.length) % rows.length];
  // Focus after the load, not before: applying a scene rebuilds enough of the
  // panel that the focus would be handed back to the document on the way.
  await loadScene(next.dataset.scene);
  next.focus();
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
  if (!picked.startsWith('local:')) return;
  const name = picked.slice(6);
  picked = '';
  const map = readStore();
  delete map[name];
  if (!writeStore(map)) return;
  refreshScenes();
  sceneNote(`Deleted "${name}" from this browser.`);
});

$('sceneRefresh').addEventListener('click', async () => {
  const { local, files, folders, total, source } = await refreshScenes();
  // A rescan that finds nothing has two very different reasons — the folder is
  // empty, or nothing could read it — and only one of them is yours to fix.
  if (source === 'none')
    sceneNote(`Cannot read ${SCENES_DIR}: this page is served without directory listings. ` +
              `Run "node tools/build-scenes-index.js" to write ${SCENES_DIR}index.json, then rescan.`);
  else
    sceneNote(`${local} in this browser, ${files} in ${SCENES_DIR}` +
              (folders ? ` across ${folders} folder${folders > 1 ? 's' : ''}` : '') +
              // The manifest is a snapshot, so a scene added since it was
              // written is not in it — which looks exactly like a scene that
              // is not being read.
              (source === 'manifest' ? ' — from index.json, so re-run tools/build-scenes-index.js after adding one' : ''));
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
