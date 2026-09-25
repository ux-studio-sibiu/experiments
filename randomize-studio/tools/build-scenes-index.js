/* Write scenes/index.json — the manifest the panel falls back to.

   Run from the randomize-studio folder:  node tools/build-scenes-index.js

   The scene list normally reads the dev server's own directory listing, which
   needs no upkeep at all. Plenty of ways of serving this folder have no such
   listing — a static host, a server with indexes turned off, or the page opened
   straight off the disk — and there the panel has nothing to read. This writes
   what a listing would have said, one level deep, folders included so an empty
   one is still on screen.

   It is a snapshot, so run it again after adding or removing a scene. */
const fs = require('fs');
const path = require('path');

const DIR = 'scenes';
const isScene = (f) => f.endsWith('.json') && f !== 'index.json';

if (!fs.existsSync(DIR)) {
  console.error(`No ${DIR}/ here — run this from the randomize-studio folder.`);
  process.exit(1);
}

const entries = fs.readdirSync(DIR, { withFileTypes: true });
const folders = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
const files = [
  ...entries.filter(e => e.isFile() && isScene(e.name)).map(e => e.name),
  ...folders.flatMap(d => fs.readdirSync(path.join(DIR, d))
    .filter(isScene)
    .map(f => `${d}/${f}`)),
].sort((a, b) => b.localeCompare(a));   // newest first, names being timestamps as often as not

// `name` is left to the panel unless a scene carries one of its own: the file
// knows what it was called better than its filename does.
const scenes = files.map(file => {
  let name;
  try { name = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')).name; } catch {}
  return name ? { file, name } : { file };
});

fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ folders, scenes }, null, 2) + '\n');
console.log(`${scenes.length} scene(s) in ${folders.length} folder(s) -> ${DIR}/index.json`);
for (const f of folders) {
  const n = scenes.filter(s => s.file.startsWith(f + '/')).length;
  console.log(`  ${f}/  ${n || 'empty'}`);
}
