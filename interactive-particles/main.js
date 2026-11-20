// Interactive particles: the page. The effect itself is the module (interactive-particles.js); this page is the
// panel around it: controls, upload, badge, persistence, and the copy-prompt button.
import { createInteractiveParticles, SHAPES } from './interactive-particles.js';
import { saveImage, loadSavedImage } from './shared/saved-image.js';
import { restoreUi } from './shared/saved-ui.js';
import { bindCopyButton } from './shared/copy-button.js';
import { fineTune } from './shared/fine-tune.js';
import { foldSections } from './shared/fold.js';

// ---- the images on offer, each with its own look ----
// A preset is an image and the panel values it opens with, by control name, as the panel's inputs take them
// ('grid-size': '115', invert: true, shape: '1'...). Anything left out takes the panel's HTML default, so the
// first one, whose look is the defaults, lists nothing. To add one: put the image (max 1600px) and its 160px
// thumbnail in sample-media/img/interactive-particles/ (and thumbs/), credit it in that folder's CREDITS.md, and add
// an entry here; the copy button's prompt lists every current value to copy from.
const MEDIA = '../sample-media/img/interactive-particles/';
// A text preset has words instead of a file: `text: 'BAUHAUS'` (and 'text-spacing' among its values, if not 0); its
// tile shows the words, drawn as the particles will draw them.
const PRESETS = [
  {
    id: 'gropius', name: 'Walter Gropius, 1919', file: 'walter-gropius-1919.jpg', credit: 'photographer unknown, public domain',
    // dark particles on paper, slightly darkened and flattened, loose and slow
    values: {
      'grid-size': '115', brightness: '-15', contrast: '0.9', cover: '0', fill: false, background: '#ffffff', invert: true, threshold: '64',
      size: '1.7', variation: '0.55', shape: '0', edge: '0.3', tone: 'colour', random: '0.8', depth: '3.4', speed: '1.45',
      idle: '1', 'touch-radius': '0.21', 'touch-trail': '1.9', 'touch-push': '13'
    }
  },
  {
    id: 'guggenheim', name: 'Guggenheim, New York', file: 'guggenheim-new-york-bw.jpg', credit: 'source not recorded yet',
    // dark square particles on grey, a fine grid, loosely scattered, the page's edges filled with it mirrored
    values: {
      'grid-size': '175', brightness: '-19', contrast: '1', cover: '0', fill: true, background: '#b3b3b3', invert: true, threshold: '75',
      size: '1.5', variation: '0.8', shape: '1', edge: '0.35', tone: 'colour', random: '2.4', depth: '3.4', speed: '1.45',
      idle: '1', 'touch-radius': '0.22', 'touch-trail': '1.9', 'touch-push': '13'
    }
  },
  {
    id: 'blue-marble', name: 'The Blue Marble, 1972', file: 'blue-marble-apollo-17.jpg', credit: 'NASA, Apollo 17 crew, public domain',
    // big light particles on black, every lit pixel kept, deep and a little slower at rest
    values: {
      'grid-size': '190', brightness: '31', contrast: '1.4', cover: '0', fill: false, background: '#000000', invert: false, threshold: '0',
      size: '3.1', variation: '0.35', shape: '0', edge: '0.35', tone: 'colour', random: '2.4', depth: '10', speed: '1.45',
      idle: '0.8', 'touch-radius': '0.22', 'touch-trail': '1.9', 'touch-push': '13'
    }
  },
  {
    id: 'starry-night', name: 'The Starry Night, 1889', file: 'starry-night-van-gogh.jpg', credit: 'Vincent van Gogh, MoMA, public domain',
    // the Blue Marble's look on the painting, a coarser grid, and the page's edges filled with it mirrored
    values: {
      'grid-size': '150', brightness: '31', contrast: '1.4', cover: '0', fill: true, background: '#000000', invert: false, threshold: '0',
      size: '3.1', variation: '0.35', shape: '0', edge: '0.35', tone: 'colour', random: '2.4', depth: '10', speed: '1.45',
      idle: '0.8', 'touch-radius': '0.22', 'touch-trail': '1.9', 'touch-push': '13'
    }
  },
  {
    id: 'starry-pixel', name: 'The Starry Night, in pixels', file: 'starry-night-van-gogh.jpg', credit: 'Vincent van Gogh, MoMA, public domain',
    // the painting's darkest strokes as white square pixels on deep blue, a fine grid close up, still until touched.
    // The tile shows the look, drawn (lookThumb), so it doesn't repeat the painting's own tile.
    lookThumb: true,
    values: {
      'grid-size': '205', brightness: '0', contrast: '1', cover: '0.84', fill: false, background: '#0014a8', invert: true, threshold: '204',
      size: '1.05', variation: '0', shape: '1', edge: '0.3', tone: 'solid', 'tone-colour': '#ffffff', random: '0', depth: '0', speed: '0',
      idle: '0', 'touch-radius': '0.17', 'touch-trail': '0.2', 'touch-push': '10'
    }
  },
  {
    id: 'sure-shot', name: 'SURE SHOT', text: 'SURE\nSHOT', credit: 'text, Archivo black',
    // the page's default look: still black dots on yellow, the lines tightly set; the trail is gone in a blink
    values: {
      'text-spacing': '-0.07', 'text-leading': '0.8', 'text-colour': '#000000', 'grid-size': '95', brightness: '0', contrast: '1', cover: '0.33', fill: false,
      background: '#ffd22e', invert: true, threshold: '185', size: '1.05', variation: '0', shape: '0', edge: '0.3', tone: 'colour', random: '0',
      depth: '0', speed: '0', idle: '0', 'touch-radius': '0.17', 'touch-trail': '0.2', 'touch-push': '10'
    }
  },
  {
    id: 'pixel', name: 'PIXEL', text: 'PIXEL', credit: 'text, Archivo black',
    // white square pixels on deep red, a fine grid close up (fit / cover 0.84), still until touched
    values: {
      'text-spacing': '0', 'text-leading': '1', 'text-colour': '#ffffff', 'grid-size': '205', brightness: '0', contrast: '1', cover: '0.84', fill: false,
      background: '#a80000', invert: true, threshold: '185', size: '1.05', variation: '0', shape: '1', edge: '0.3', tone: 'colour', random: '0',
      depth: '0', speed: '0', idle: '0', 'touch-radius': '0.17', 'touch-trail': '0.2', 'touch-push': '10'
    }
  }
];
// A preset's image: a file of its own in sample-media (`file`), or a random photo kept by its picsum.photos seed
// (`seed`: the same seed always gives the same photo), as the copy button's prompt names it.
const PICSUM = (seed, w, h) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
const RANDOM_SIZE = [1200, 800]; // a random photo's size, fetched or kept by a preset
const imageOf = p => p.seed ? PICSUM(p.seed, ...RANDOM_SIZE) : MEDIA + p.file;
const thumbOf = p => p.seed ? PICSUM(p.seed, 240, 160) : `${MEDIA}thumbs/${p.file}`;
const IMAGE_PRESETS = PRESETS.filter(p => p.file || p.seed);
const DEFAULT_IMAGE = imageOf(IMAGE_PRESETS[0]); // the last resort, when a picked source can't be read
// One face for the words: Archivo at its black weight, centred; the letter spacing, line height and colour are the
// panel's. TEXT_PX is the letter height they are drawn at: the grid size decides how finely it is sampled.
const TEXT_FONT = '900 160px "Archivo", "Helvetica Neue", Arial, sans-serif';
const TEXT_PX = 160;
const THUMB = 160; // px, a drawn tile (a text preset's words, or a look): a tile of up to 80 px at 2x

const stage = document.querySelector('.stage');
const badge = document.querySelector('.stage-badge');
const panel = document.querySelector('.panel');
const field = name => document.querySelector(`[name="${name}"]`);
const checked = name => panel.querySelector(`[name="${name}"]:checked`)?.value; // a radio group's picked value

// every slider: [input name, the option it drives (none for the text's, which redraw the words), decimals shown]
const SLIDERS = [
  ['grid-size', 'gridSize', 0], ['brightness', 'brightness', 0], ['contrast', 'contrast', 2], ['cover', 'cover', 2], ['threshold', 'threshold', 0], ['size', 'size', 2], ['variation', 'variation', 2],
  ['edge', 'edge', 2], ['random', 'random', 1], ['depth', 'depth', 1], ['speed', 'speed', 2], ['idle', 'idle', 2],
  ['touch-radius', 'touchRadius', 2], ['touch-trail', 'touchTrail', 1], ['touch-push', 'touchPush', 0],
  ['text-spacing', null, 2], ['text-leading', null, 2]
];
const DIGITS = Object.fromEntries(SLIDERS.map(([name, , digits]) => [name, digits]));

// every other control that drives one option: [input name, the option, the option's value from the control's] (a
// checkbox gives checked, a radio group and a colour their value). Their handlers and the effect's starting options
// both come from here; a control that does more (tone's tint, dark particles' background) adds a handler of its own.
const CONTROLS = [
  ['invert', 'invert', Boolean], ['fill', 'fill', Boolean], ['background', 'background', String],
  ['shape', 'shape', Number], ['tone', 'grey', value => value === 'grey']
];

// A preset's whole look as panel values: its own, plus which source it is and, for text, its words.
const lookOf = p => ({ ...p.values, source: p.text ? 'text' : 'image', ...(p.text ? { 'text-words': p.text } : {}) });

// ---- the default look: the one preset a new tab opens with, kept in one place. Its values become the panel's
// defaults (the values written in index.html are only a fallback) and the effect's starting options. To change the
// default look, change this preset, or point DEFAULT_PRESET at another. ----
const DEFAULT_PRESET = PRESETS.find(p => p.id === 'sure-shot');

// the panel's defaults from a look: what a new tab shows, and what saved-ui.js compares a tab's record against
function setDefaults(values) {
  for (const input of panel.querySelectorAll('input[name], textarea[name]')) {
    if (!(input.name in values)) continue;
    const value = values[input.name];
    if (input.type === 'checkbox') input.defaultChecked = input.checked = !!value;
    else if (input.type === 'radio') input.defaultChecked = input.checked = input.value === String(value);
    else {
      input.defaultValue = input.value = String(value);
      const out = input.closest('.row')?.querySelector('output');
      if (out && input.name in DIGITS) out.value = Number(value).toFixed(DIGITS[input.name]);
    }
  }
}

// the effect's options from a look's panel values
function optionsOf(values) {
  const options = {};
  for (const [name, option] of SLIDERS) if (option && name in values) options[option] = Number(values[name]);
  for (const [name, option, of] of CONTROLS) if (name in values) options[option] = of(values[name]);
  return options;
}

// a preset's value for a control, else the panel's default for it (a checkbox's checked, a radio group's picked one)
function valueOf(p, name) {
  if (name in p.values) return p.values[name];
  const inputs = [...panel.querySelectorAll(`[name="${name}"]`)];
  if (inputs[0].type === 'checkbox') return inputs[0].defaultChecked;
  if (inputs[0].type === 'radio') return inputs.find(input => input.defaultChecked)?.value;
  return inputs[0].defaultValue;
}

setDefaults(lookOf(DEFAULT_PRESET));

// STEP 05 -> the particle count, coloured by a rough performance budget; hover the badge for the numbers.
// Each particle is 4 vertices running two noise calls and two texture reads, and overlapping particles are all
// blended, so cost grows with the count and with particle size. The original's ceiling was 320 x 180 = 57,600.
const BUDGET = [
  [150000, 'is-heavy', 'red: expect dropped frames on most non-gaming hardware'],
  [100000, 'is-high', 'orange: integrated laptop GPUs may stutter, especially full-screen with big particles'],
  [50000, 'is-busy', 'yellow: fine on laptops; older or low-end phones may drop frames']
];
const BUDGET_GUIDE = 'Rough performance budget: up to 50,000 runs smoothly almost anywhere, phones included; 50,000 to 100,000 yellow; 100,000 to 150,000 orange; over 150,000 red. Bigger particles cost more too: every overlap is blended.';

function showCount({ width, height, count, image }) {
  const tier = BUDGET.find(([limit]) => count > limit);
  const number = document.createElement('span');
  number.className = tier ? `count ${tier[1]}` : 'count';
  number.textContent = count.toLocaleString();
  // with fill edges on, the particles around the photo are counted apart from its own pixels
  badge.replaceChildren(number, count > image ? ` particles, ${image.toLocaleString()} of ${(width * height).toLocaleString()} pixels on the photo` : ` of ${(width * height).toLocaleString()} pixels`);
  badge.title = `${count.toLocaleString()} particles. Now: ${tier ? tier[2] : 'within budget'}.\n${BUDGET_GUIDE}`;
}

// one call: the module makes the canvas, the loop, the pointer handling and the transitions; it starts with the
// default preset's look
const fx = createInteractiveParticles({ container: stage, ...optionsOf(DEFAULT_PRESET.values), onUpdate: showCount });
stage.append(fx.touchCanvas); // the trail texture, shown by the preview switch
// <- STEP 05

for (const [name, option, digits] of SLIDERS) {
  const input = field(name);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    input.closest('.row').querySelector('output').value = value.toFixed(digits);
    if (option) fx.set(option, value);
  });
}

// STEP 05 -> the shape, the tone (colour or the original's grey), fill, the background and the particles' mode
for (const [name, option, of] of CONTROLS) {
  for (const input of panel.querySelectorAll(`[name="${name}"]`)) {
    input.addEventListener(input.type === 'color' ? 'input' : 'change', () => fx.set(option, of(input.type === 'checkbox' ? input.checked : input.value)));
  }
}

// tone can also be solid: one colour (the picker beside the chips) for every particle, through the effect's tint
for (const radio of panel.querySelectorAll('[name="tone"]')) radio.addEventListener('change', applyTint);
field('tone-colour').addEventListener('input', applyTint);

const backgroundInput = field('background');

// Dark particles would vanish on black: switching the mode by hand also flips the background to paper (and light
// particles back to black). Only a real click does it (isTrusted): restoring the tab's settings or a preset fires the
// switch too, and must leave the background they restore alone, whichever order the rows come in.
const invertInput = field('invert');
invertInput.addEventListener('change', e => {
  retext(); // the letters' ink follows: dark particles draw ink on paper
  if (!e.isTrusted) return;
  backgroundInput.value = invertInput.checked ? '#ffffff' : '#000000';
  backgroundInput.dispatchEvent(new Event('input', { bubbles: true }));
});
// <- STEP 05

const previewInput = field('touch-preview');
previewInput.addEventListener('change', () => stage.classList.toggle('is-showing-touch', previewInput.checked));

// ---- the image section: a tile per preset, then the upload's own tile; the picked tile is a radio (name
// "preset"), so saved-ui.js keeps it with the rest of the panel ----
const picker = panel.querySelector('.image-picker');

function tile(value, title, thumb) {
  const label = document.createElement('label');
  label.className = 'image-tile';
  label.title = title;
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'preset';
  input.value = value;
  const picture = document.createElement('span');
  picture.className = 'thumb';
  if (thumb) picture.style.backgroundImage = `url("${thumb}")`;
  label.append(input, picture);
  return label;
}

for (const p of PRESETS) {
  const t = tile(p.id, `${p.name} (${p.credit})`, p.text ? '' : thumbOf(p));
  if (p.text) drawTextThumb(t.querySelector('.thumb'), p);
  else if (p.lookThumb) drawLookThumb(t.querySelector('.thumb'), p);
  t.querySelector('input').defaultChecked = p === DEFAULT_PRESET; // the look a new tab opens on
  picker.append(t);
}
const uploadTile = tile('upload', 'Your photo (uploaded or random), with the look you give it');
uploadTile.hidden = true; // until there is an upload
picker.append(uploadTile);

// The last two tiles bring a photo in, dotted squares with their mark over their name: a random photo, then the
// upload, round the hidden file input (or drop a photo on the page).
const randomButton = document.createElement('button');
randomButton.type = 'button';
randomButton.className = 'image-tile action-tile random-tile';
randomButton.title = 'A random photo from picsum.photos, as in randomize-studio';
randomButton.dataset.mark = 'randomize';
randomButton.innerHTML = '<span class="tile-name">Random<br>image</span>';
const uploadButton = document.createElement('label');
uploadButton.className = 'image-tile action-tile upload-tile';
uploadButton.title = 'Upload a photo (or drop one on the page)';
uploadButton.dataset.mark = 'upload';
uploadButton.innerHTML = '<input type="file" name="image-file" accept="image/*" hidden><span class="tile-name">Upload<br>image</span>';
picker.append(randomButton, uploadButton);

let upload = null; // the uploaded File, kept in IndexedDB for the next visit
let uploadUrl = null;
function showUpload(file) {
  upload = file;
  if (uploadUrl) URL.revokeObjectURL(uploadUrl);
  uploadUrl = URL.createObjectURL(file);
  uploadTile.querySelector('.thumb').style.backgroundImage = `url("${uploadUrl}")`;
  showPicked();
}

const pickedValue = () => checked('preset');

// The photo tile holds whatever came in last, an upload or a random photo: its thumbnail is that photo (each roll
// replaces it) and it is the picked tile; the Random and Upload tiles are only buttons. A random photo is known by its
// file name, which carries its picsum seed (random-<seed>.jpg), kept with the photo in IndexedDB.
const randomSeed = () => /^random-([a-z0-9]+)\.jpg$/.exec(upload?.name ?? '')?.[1] ?? null;
function showPicked() {
  uploadTile.hidden = !upload;
  const seed = randomSeed();
  uploadTile.title = seed ? `A random photo (picsum.photos seed ${seed}), with the look you give it` : 'Your uploaded photo, with the look you give it';
}
const pickedPreset = () => PRESETS.find(p => p.id === pickedValue());

// The words laid out in the text's face, the same for the tile and for the particles' picture: the font and letter
// spacing set on g, each line's width, and the step from one line to the next.
function layoutText(g, words, spacing, leading) {
  g.font = TEXT_FONT;
  g.letterSpacing = `${Number(spacing) * TEXT_PX}px`;
  const lines = words.split('\n');
  return { lines, widths: lines.map(l => g.measureText(l).width), step: TEXT_PX * Number(leading) };
}

// the laid-out lines, each centred on x, the block centred on y
function fillLines(g, { lines, step }, x, y) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1) / 2) * step));
}

// An image preset's tile can show its look instead of its photo (lookThumb: true), for a look on an image another tile
// already shows: the photo's square middle sampled on a coarse grid as the particles sample it (toned, thresholded,
// in the look's tone: the photo's colours, grey, or one solid colour; square or round), on the preset's background.
// The tile keeps the plain thumbnail until then.
const LOOK_GRID = 40; // cells across the tile
function drawLookThumb(thumb, p) {
  const img = new Image();
  img.onload = () => {
    const [brightness, contrast, threshold] = ['brightness', 'contrast', 'threshold'].map(name => Number(valueOf(p, name)));
    const dark = valueOf(p, 'invert'), look = valueOf(p, 'tone'), solid = valueOf(p, 'tone-colour');
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const s = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    s.canvas.width = s.canvas.height = LOOK_GRID;
    s.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, LOOK_GRID, LOOK_GRID);
    const px = s.getImageData(0, 0, LOOK_GRID, LOOK_GRID).data;
    const c = document.createElement('canvas');
    c.width = c.height = THUMB;
    const g = c.getContext('2d');
    g.fillStyle = valueOf(p, 'background');
    g.fillRect(0, 0, THUMB, THUMB);
    const cell = THUMB / LOOK_GRID, dot = cell * 0.85; // a hairline between them, as the soft edge leaves
    const tone = v => Math.min(255, Math.max(0, (v - 128) * contrast + 128 + brightness));
    for (let i = 0; i < LOOK_GRID * LOOK_GRID; i++) {
      const [r, gr, b] = [tone(px[i * 4]), tone(px[i * 4 + 1]), tone(px[i * 4 + 2])];
      const lum = 0.21 * r + 0.72 * gr + 0.07 * b;
      if (dark ? lum >= 255 - threshold : lum <= threshold) continue; // the threshold's skip, as the particles'
      const x = (i % LOOK_GRID + 0.5) * cell, y = (Math.floor(i / LOOK_GRID) + 0.5) * cell;
      const grey = Math.round(0.21 * r + 0.71 * gr + 0.07 * b);
      g.fillStyle = look === 'solid' ? solid : look === 'grey' ? `rgb(${grey}, ${grey}, ${grey})` : `rgb(${r}, ${gr}, ${b})`;
      if (String(valueOf(p, 'shape')) === '1') g.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      else { g.beginPath(); g.arc(x, y, dot / 2, 0, Math.PI * 2); g.fill(); }
    }
    thumb.style.backgroundImage = `url("${c.toDataURL()}")`;
  };
  img.src = imageOf(p);
}

// a text preset's tile: its words in the text's own face, on the preset's background, in its colour (else black
// letters for dark particles and white for light ones), fitted into the square
function drawTextThumb(thumb, p) {
  const c = document.createElement('canvas');
  c.width = c.height = THUMB;
  const g = c.getContext('2d');
  const draw = () => {
    const dark = valueOf(p, 'invert');
    g.fillStyle = valueOf(p, 'background');
    g.fillRect(0, 0, THUMB, THUMB);
    const layout = layoutText(g, p.text, valueOf(p, 'text-spacing'), valueOf(p, 'text-leading'));
    const inner = THUMB * 0.86; // a margin round the words
    const scale = Math.min(inner / Math.max(...layout.widths, 1), inner / (layout.lines.length * layout.step));
    g.setTransform(scale, 0, 0, scale, THUMB / 2, THUMB / 2);
    g.fillStyle = p.values['text-colour'] ?? (dark ? '#000000' : '#ffffff');
    fillLines(g, layout, 0, 0);
    thumb.style.backgroundImage = `url("${c.toDataURL()}")`;
  };
  document.fonts.load(TEXT_FONT, p.text).then(draw, draw);
}

// the picked source on screen: the text, or the picked image tile (an upload, else the first image preset)
function loadPicked() {
  if (textOn()) return loadText(true);
  const preset = pickedPreset();
  const source = !preset && upload ? upload : imageOf(preset && !preset.text ? preset : IMAGE_PRESETS[0]);
  return fx.setImage(source).catch(() => { badge.textContent = 'Could not read that image'; });
}

// A look's values onto the panel, through the same events a person fires, so every handler applies them (the text's
// colour, for one, reaches the particles as their tint). The image picker itself and the trail preview aren't part of
// a look, and an image's look leaves the text's settings as they are.
function applyLook(values) {
  const text = values.source === 'text';
  for (const input of panel.querySelectorAll('input[name], textarea[name]')) {
    if (input.name === 'preset' || input.name === 'touch-preview' || (input.name.startsWith('text-') && !text) || (input.name === 'source' && !('source' in values)) || !['range', 'color', 'checkbox', 'radio', 'textarea'].includes(input.type)) continue;
    if (input.type === 'radio') {
      const want = input.name in values ? String(values[input.name]) : (input.defaultChecked ? input.value : null);
      if (want !== input.value || input.checked) continue;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (input.type === 'checkbox') {
      const want = input.name in values ? !!values[input.name] : input.defaultChecked;
      if (input.checked === want) continue;
      input.checked = want;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const want = input.name in values ? String(values[input.name]) : input.defaultValue;
      if (input.value === want) continue;
      input.value = want;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// a tile picked: its image on screen and, for a preset, its look. (Not while the panel is being restored: the
// restored values are the look already, and the image is loaded once, after.)
let ready = false;
let applying = false; // a look going onto the panel: its events mustn't load a source of their own

// A look onto the panel without a load per change (its source tab, its words): the caller loads once, after.
function applyLookQuietly(values) {
  applying = true;
  try { applyLook(values); } finally { applying = false; }
}
picker.addEventListener('change', e => {
  if (!ready || e.target.name !== 'preset') return;
  const preset = pickedPreset();
  if (preset) applyLookQuietly(lookOf(preset));
  else setSource('image'); // the upload: an image, the current look kept
  loadPicked();
});

// ---- text as the source: the typed words drawn into a picture, which the effect samples like a photo ----
// The tabs under the tiles pick the source; below them, the picked one's options (the image's tone, the text's words). The words are drawn in the
// particles' own terms: ink on paper for dark particles, white on black for light ones, so the threshold keeps the
// letters. Typing redraws after a short pause, straight to the new letters (no scatter and assemble per keystroke).
const textOn = () => checked('source') === 'text';
// the source tab set from code (no event of its own): a preset or an upload saying which source it is
function setSource(value) {
  const tab = panel.querySelector(`[name="source"][value="${value}"]`);
  if (tab.checked) return;
  tab.checked = true;
  showSource();
}

async function textImage() {
  const words = field('text-words').value.replace(/\s+$/, '') || ' ';
  try { await document.fonts.load(TEXT_FONT, words); } catch {}
  const g = document.createElement('canvas').getContext('2d');
  const spacing = field('text-spacing').value, leading = field('text-leading').value;
  const { lines, widths, step } = layoutText(g, words, spacing, leading);
  const pad = TEXT_PX * 0.3;
  g.canvas.width = Math.ceil(Math.max(...widths, TEXT_PX) + pad * 2);
  g.canvas.height = Math.ceil(lines.length * step + pad * 2);
  const ink = field('invert').checked; // dark particles: letters on paper, light ones: letters on black
  g.fillStyle = ink ? '#ffffff' : '#000000';
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  // the letters in ink on paper (or white on black): the threshold keeps them whatever their colour; the colour is
  // the particles' tint (showSource). Laid out again: resizing the canvas reset its state.
  g.fillStyle = ink ? '#000000' : '#ffffff';
  fillLines(g, layoutText(g, words, spacing, leading), g.canvas.width / 2, g.canvas.height / 2);
  return new Promise(resolve => g.canvas.toBlob(resolve, 'image/png'));
}

// the text on screen; animate: the usual scatter and assemble (switching to text), else straight to it (typing)
async function loadText(animate) {
  const blob = await textImage();
  if (!textOn()) return;
  const transition = fx.get().transition;
  if (!animate) fx.set('transition', 0);
  await fx.setImage(blob).catch(() => {});
  if (!animate) fx.set('transition', transition);
}

let textTimer = 0;
function retext() {
  if (!ready || applying || !textOn()) return; // a preset loads its text itself, once, after its values are on
  clearTimeout(textTimer);
  textTimer = setTimeout(() => loadText(false), 300);
}

// one source's options on screen at a time: the image's tone, or the text's words
function showSource() {
  panel.querySelector('.source-image').hidden = textOn();
  panel.querySelector('.source-text').hidden = !textOn();
  // brightness and contrast are the image's: text is drawn untoned, and the image gets its sliders' values back; the
  // text's colour tints every particle, the image keeps its own colours
  fx.set('brightness', textOn() ? 0 : Number(field('brightness').value));
  fx.set('contrast', textOn() ? 1 : Number(field('contrast').value));
  applyTint();
}

// The particles' one colour, if they have one: the solid tone's colour wins, else typed text's colour, else none (the
// image's own colours, or grey).
const solidOn = () => checked('tone') === 'solid';
function applyTint() {
  fx.set('tint', solidOn() ? field('tone-colour').value : textOn() ? field('text-colour').value : '');
}

for (const tab of panel.querySelectorAll('[name="source"]')) {
  tab.addEventListener('change', () => {
    showSource();
    if (!ready || applying) return;
    // the image tab with a text tile picked: the image shown is the first image preset, its tile picked (no look change)
    if (!textOn() && pickedPreset()?.text) panel.querySelector(`[name="preset"][value="${IMAGE_PRESETS[0].id}"]`).checked = true;
    loadPicked();
  });
}
for (const input of panel.querySelectorAll('[name^="text-"]')) {
  if (input.name === 'text-colour') input.addEventListener('input', applyTint); // no redraw: a tint
  else input.addEventListener(input.type === 'radio' ? 'change' : 'input', retext);
}

// an upload: remembered for the next visit, given its tile, and picked, keeping the current look
function useFile(file) {
  saveImage(file);
  showUpload(file);
  setSource('image');
  const radio = uploadTile.querySelector('input');
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

// A random photo's own look: dark particles on black, the photo continued past its edges (fill), loose and slowly
// breathing. Applied before the photo comes in, so it lands in it; the panel can change it after, as with any upload.
const RANDOM_LOOK = {
  'grid-size': '115', brightness: '-6', contrast: '1', cover: '0', fill: true, background: '#000000', invert: true, threshold: '53',
  size: '1.65', variation: '0.7', shape: '0', edge: '0.32', tone: 'colour', random: '0.8', depth: '3.4', speed: '1.45',
  idle: '1', 'touch-radius': '0.21', 'touch-trail': '1.9', 'touch-push': '13'
};

// a random photo, as randomize-studio's: picsum.photos with a fresh /seed/ (picsum treats ?random= as a cache-buster).
// It is fetched whole and comes in as an upload would (its own tile, kept for the next visit), in RANDOM_LOOK.
randomButton.addEventListener('click', async () => {
  if (randomButton.classList.contains('is-loading')) return; // one at a time
  randomButton.classList.add('is-loading');
  badge.textContent = 'Loading a random photo...';
  try {
    const seed = Math.random().toString(36).slice(2, 10);
    const response = await fetch(PICSUM(seed, ...RANDOM_SIZE));
    if (!response.ok) throw new Error(response.status);
    const blob = await response.blob();
    applyLookQuietly({ ...RANDOM_LOOK, source: 'image' }); // the look first: the photo's load follows
    useFile(new File([blob], `random-${seed}.jpg`, { type: blob.type || 'image/jpeg' }));
  } catch {
    badge.textContent = 'Could not load a random photo';
  }
  randomButton.classList.remove('is-loading');
});

field('image-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) useFile(file);
  e.target.value = ''; // so picking the same file again still fires change
});

stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('is-dragging'); });
stage.addEventListener('dragleave', () => stage.classList.remove('is-dragging'));
stage.addEventListener('drop', e => {
  e.preventDefault();
  stage.classList.remove('is-dragging');
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (file) useFile(file);
});

// a prompt that rebuilds the effect as it looks right now: the technique plus every current value. The image is
// left out, to be attached separately.
const SDFS = ['0.5 - length(p)', '0.5 - max(a.x, a.y)', '0.5 - (a.x + a.y)', '0.12 - abs(length(p) - 0.36)', 'min(0.14 - min(a.x, a.y), 0.4 - max(a.x, a.y))'];

function promptText() {
  const cfg = fx.get();
  // the picked source: a random photo (or a seed preset) can be named, everything else is attached
  const preset = pickedPreset();
  const seed = textOn() ? null : preset ? preset.seed : randomSeed();
  const now = fx.info();
  const shapeName = SHAPES[cfg.shape];
  const keep = cfg.invert
    ? `brightness < ${255 - cfg.threshold}, that is 255 - threshold ${cfg.threshold} (dark particles: the threshold counts from the dark end; keep the dark pixels, skip the light ones)`
    : `brightness > ${cfg.threshold} (light particles: keep the light pixels, skip the dark ones)`;
  const aspect = now ? `The current image makes a ${now.width} x ${now.height} grid; ${now.count} pixels become particles.` : '';
  return `Recreate this WebGL effect: an image turned into interactive particles, after the Codrops tutorial "Interactive Particles with Three.js" (Bruno Imbrizi, 2019). ${textOn() ? 'The source is typed text (step 0).' : seed ? `The source image is a random photo from picsum.photos, seed ${seed}: ${PICSUM(seed, ...RANDOM_SIZE)} (the same seed always gives the same photo).` : "I'll attach the source image separately."}

Stack: three.js 0.170.0 as an ES module (import map, jsdelivr), no build step, one full-window canvas, devicePixelRatio capped at 2. Package it as createInteractiveParticles({ container, image, ...options }) returning { setImage, set(name, value), destroy }.

Pipeline
${textOn() ? `0. The source is typed text, not a photo: "${field('text-words').value.replace(/\n/g, ' / ')}", drawn into a canvas in ${TEXT_FONT} (Archivo black), centred, letter spacing ${field('text-spacing').value} of the letter height, line height ${field('text-leading').value} of it, padded by 0.3 of the letter height, ${fx.get().invert ? 'black letters on white (dark particles)' : 'white letters on black (light particles)'}, so the threshold keeps them; every particle is then tinted ${field('text-colour').value} (fragment: rgb = mix(rgb, uTint, uTintOn), the tint in linear light); that canvas (as a PNG blob) is the image below. Typing redraws it after 300 ms with no transition.\n` : ''}1. Draw the image to an offscreen canvas so its longest side is ${cfg.gridSize} px, keeping the aspect ratio ("contain"), and read it with getImageData. Tone every channel first: v = clamp((v - 128) * ${cfg.contrast} + 128 + ${cfg.brightness}, 0, 255), and put the toned pixels back (they are the colours too). ${aspect}
2. Perceived brightness per pixel: 0.21 R + 0.72 G + 0.07 B (0-255). Keep a pixel when ${keep}.
3. One InstancedBufferGeometry: a 1 x 1 quad (4 vertices, uv, index [0,2,1, 2,3,1]) drawn once per kept pixel. Instanced attributes: offset = (column, height - 1 - row, 0), pindex = the pixel's index in the grid, angle = random 0..PI.
4. The grid canvas as a CanvasTexture: SRGBColorSpace, NearestFilter for min and mag, no mipmaps. Sample it at the pixel centre: vPUv = (offset.xy + 0.5) / textureSize.
5. ShaderMaterial, transparent, depthTest false; mesh.frustumCulled = false (the bounding sphere is the quad's, not the image's).
6. PerspectiveCamera, fov 50, placed between fit and cover by cover = ${cfg.cover}: fitZ = the farther of the height and width fits with a 1.1 margin, coverZ = the nearer with none, camera.z = 1 / ((1 - cover) / fitZ + cover / coverZ) (1 world unit = 1 grid pixel; the camera moves, the particles are the same).${cfg.fill ? ' Fill is on: past the image, every second column and row of what the camera sees (plus the scatter) gets a particle too, its colour the image mirrored past its edge (texture wrap MirroredRepeatWrapping, the same mirror on the CPU for the threshold test), pindex = gridWidth * gridHeight + its own index; the touch texture and the hit plane then span that whole area (touch uv = (offset + 0.5 - areaOrigin) / areaSize), the trail radius scaled by gridWidth / areaWidth.' : ''} Clear colour ${cfg.background}.

Vertex shader (2D simplex noise snoise from Ashima Arts; random(n) = fract(sin(n) * 43758.5453123))
- hide = 1.0 - uShow (the transition: uShow 0 scattered, 1 assembled)
- grey = brightness of the texture at vPUv (0.21, 0.71, 0.07)${cfg.invert ? ', then grey = 1.0 - grey (dark particles: darkness sets the size)' : ''}
- displaced = offset; displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * (uRandom + hide * 8.0)
- rndz = random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1)); displaced.z += rndz * random(pindex) * 2.0 * (uDepth + hide * 40.0)
- touch: t = texture2D(uTouch, vPUv).r; displaced.z += t * uTouchPush * rndz; displaced.xy += vec2(cos(angle), sin(angle)) * t * uTouchPush * rndz
- displaced.xy -= textureSize * 0.5 (centre the grid)
- varied = (snoise(vec2(uTime, pindex) * 0.5) + 2.0) * max(grey, 0.2); psize = uSize * max(mix(1.0, varied, uVariation), 0.0) * uShow
- billboard: mvPosition = modelViewMatrix * vec4(displaced, 1.0); mvPosition.xyz += position * psize

Fragment shader
- colour = texture2D(uTexture, vPUv).rgb${solidOn() ? `, then every particle in one colour, ${field('tone-colour').value}: rgb = mix(rgb, uTint, uTintOn) with uTintOn 1 (the tint in linear light)` : cfg.grey ? ', drawn in grey: vec3(0.21 r + 0.71 g + 0.07 b)' : textOn() ? '' : ', keeping the image\'s colours'}; end with #include <colorspace_fragment>
- shape ${shapeName}, a distance function of p = vUv - 0.5, a = abs(p): d = ${SDFS[cfg.shape]}
- alpha = smoothstep(0.0, max(uEdge, 0.001), d)

Touch texture (the pointer's trail, sampled by the vertex shader as uTouch)
- a 64 x 64 canvas, cleared to black every frame, uploaded as a CanvasTexture (needsUpdate each frame)
- pointermove on the canvas: NDC from the pointer, Raycaster.setFromCamera, intersect an invisible PlaneGeometry(gridWidth, gridHeight) at the origin; its hit uv is the trail point
- each point: force = min(squared distance to the previous point * 10000, 1) (0 for the first); age += dt; removed after ${cfg.touchTrail} s
- drawn every frame: life = easeOutSine(age / (0.3 * trail)) while growing, then easeOutSine(1 - (age - 0.3 * trail) / (0.7 * trail)); radius = 64 * ${cfg.touchRadius} * life * force; a radial gradient from radius * 0.25 (rgba(255,255,255,0.2)) to radius (transparent) at (x * 64, (1 - y) * 64)

Transitions: a new image tweens uShow to 0 over ${(cfg.transition * 0.6).toFixed(2)} s, rebuilds, then tweens it to 1 over ${cfg.transition} s (easeInOutCubic); the first image assembles the same way.

Animation: setAnimationLoop; uTime += min(dt, 0.1) * speed with dt in real seconds (times idle = ${cfg.idle} while the pointer is not over the canvas: pointerenter / pointerleave), and the touch texture updates with the same dt. The loop runs only while the canvas is on screen (IntersectionObserver). Under prefers-reduced-motion: no noise motion, no transitions; the loop runs only while a touch trail is fading. destroy() stops the loop, disconnects observers, removes listeners and disposes geometry, materials, both textures and the renderer.

Current values
${seed ? `- image: picsum.photos seed ${seed}, ${RANDOM_SIZE.join(' x ')}\n` : ''}- grid size (longest side): ${cfg.gridSize} px, brightness ${cfg.brightness}, contrast ${cfg.contrast}
- particles from: ${cfg.invert ? 'dark' : 'light'} pixels, threshold ${cfg.threshold}
- uSize: ${cfg.size}
- uVariation: ${cfg.variation}
- shape: ${shapeName}, uEdge: ${cfg.edge}, tone: ${solidOn() ? `solid ${field('tone-colour').value}` : cfg.grey ? 'grey' : 'colour'}
- uRandom: ${cfg.random}
- uDepth: ${cfg.depth}
- speed: ${cfg.speed}, idle: ${cfg.idle}
- touch radius: ${cfg.touchRadius} of the texture width, trail: ${cfg.touchTrail} s, uTouchPush: ${cfg.touchPush}
- transition: ${cfg.transition} s, background: ${cfg.background}`;
}

bindCopyButton(document.getElementById('copyPrompt'), promptText);

// a small ▲ / ▼ at the end of every slider row, for fine tuning
fineTune(panel);
foldSections(panel); // every section folds, chevron on the left; Motion and Touch start shut (data-fold-shut)

// the panel as it was before a refresh in this tab (after the handlers above, so they apply it)
restoreUi(panel);

// start with the picked tile's image (the upload's, if that was picked and it's still there); it assembles in
const saved = await loadSavedImage();
if (saved) showUpload(saved);
else if (pickedValue() === 'upload') {
  // the upload is gone: back to the default tile and its look
  panel.querySelector(`[name="preset"][value="${DEFAULT_PRESET.id}"]`).checked = true;
  applyLook(lookOf(DEFAULT_PRESET));
}
showSource();
showPicked();
ready = true;
loadPicked().catch(() => fx.setImage(DEFAULT_IMAGE));
