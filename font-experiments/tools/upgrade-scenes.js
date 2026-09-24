/* Fill in what an old scene never knew about.

   Run from the font-experiments folder:  node tools/upgrade-scenes.js
   Add --dry to see what it would change without writing anything.

   A scene saved before a layer existed says nothing about it. The panel now
   treats "nothing" as the default rather than as "keep what is on screen", so
   these files already load correctly — this is the other half: writing the
   missing layers into the files so each one describes the whole cover on its
   own, whatever the app grows next.

   Defaults are read out of js/state.js rather than repeated here, so there is
   one place that says what a cover starts as. */
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const DIR = 'scenes';

// The state literal, lifted whole: from `const state = {` to its matching brace.
function readDefaults() {
  const src = fs.readFileSync(path.join('js', 'state.js'), 'utf8');
  const start = src.indexOf('const state = {');
  if (start < 0) throw new Error('no state literal in js/state.js');
  const open = src.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) { end = i; break; } }
  }
  if (end < 0) throw new Error('unbalanced state literal');
  return eval('(' + src.slice(open, end + 1) + ')');   // a plain literal, nothing to call
}

// What serializeScene() writes, minus the parts that are not layer state.
const LAYERS = ['bg', 'svgbg', 'scrim', 'fx', 'pattern', 'layout',
                'heading', 'subheading', 'body', 'topmenu', 'cta', 'plate'];

const defaults = readDefaults();
const files = [];
(function walk(dir, depth) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth < 1) walk(p, depth + 1);
    else if (e.isFile() && e.name.endsWith('.json') && e.name !== 'index.json') files.push(p);
  }
})(DIR, 0);

let touched = 0;
for (const file of files) {
  let scene;
  try { scene = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { console.log(`  !! ${file}: ${err.message}`); continue; }

  const added = LAYERS.filter(k => !(k in scene));
  // A layer that IS there but predates a field of its own gets the field too:
  // same rule, one level down.
  const filled = [];
  for (const k of LAYERS) {
    if (!(k in scene) || typeof scene[k] !== 'object' || !defaults[k]) continue;
    for (const f of Object.keys(defaults[k]))
      if (!(f in scene[k])) { scene[k][f] = structuredClone(defaults[k][f]); filled.push(`${k}.${f}`); }
  }
  for (const k of added) scene[k] = structuredClone(defaults[k]);

  if (!added.length && !filled.length) { console.log(`  ok ${file}`); continue; }
  touched++;
  console.log(`  ${DRY ? '--' : '->'} ${file}`);
  if (added.length) console.log(`       layers: ${added.join(', ')}`);
  if (filled.length) console.log(`       fields: ${filled.join(', ')}`);
  if (!DRY) fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
}
console.log(`${files.length} scene(s), ${touched} ${DRY ? 'would change' : 'updated'}`);
