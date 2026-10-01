/* presets - saved scenes (and later other presets) kept in Sanity.

   A static page cannot hold a write token, so this is the one piece that runs
   on a server: it keeps the token in Vercel's environment and does the reading
   and writing on the page's behalf. Reads go through here too, so the Sanity
   project needs no CORS entries and the dataset can stay private.

     GET  /api/presets/?kind=scene                  -> { presets: [{ name, data, updatedAt }] }
     POST /api/presets/  { action: 'save', kind, name, data }
     POST /api/presets/  { action: 'delete', kind, name }

   When PRESET_KEY is set, writes need the x-preset-key header to match it.
   That is a shared password, not real auth - enough to keep a stranger who
   finds the URL from writing to the dataset. Unset, anyone can write.

   Environment (Vercel -> Settings -> Environment Variables):
     SANITY_WRITE_TOKEN   an Editor token for the project
     PRESET_KEY           optional; any long random string, the panel asks for it once
     SANITY_PROJECT_ID    optional, defaults to the project below
     SANITY_DATASET       optional, defaults to production

   Called with a trailing slash: vercel.json has trailingSlash on, and the
   redirect it would answer /api/presets with breaks a CORS preflight. */

const PROJECT = process.env.SANITY_PROJECT_ID || 'bw7i7p31';
const DATASET = process.env.SANITY_DATASET || 'production';
const SANITY = `https://${PROJECT}.api.sanity.io/v2025-02-19/data`;
const KINDS = ['scene', 'texture'];
const MAX_BYTES = 200_000;

// Live Server and friends on this machine, the deployed site, and any deploy
// of this project calling itself (a preview URL is its own origin).
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const SITE = 'https://experiments-five-bice.vercel.app';
const allowed = (origin, host) => LOCAL.test(origin) || origin === SITE || origin === `https://${host}`;

const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled';
const docId = (kind, name) => `${kind}-${slug(name)}`;

async function sanity(path, init = {}) {
  const r = await fetch(SANITY + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SANITY_WRITE_TOKEN}`, ...init.headers }
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error?.description || body.message || `Sanity ${r.status}`), { status: r.status });
  return body;
}

const mutate = (mutations) => sanity(`/mutate/${DATASET}?returnIds=true`, { method: 'POST', body: JSON.stringify({ mutations }) });

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && allowed(origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-preset-key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.SANITY_WRITE_TOKEN) return res.status(500).json({ error: 'SANITY_WRITE_TOKEN is not set on the server' });

  try {
    if (req.method === 'GET') {
      const kind = KINDS.includes(req.query.kind) ? req.query.kind : 'scene';
      const q = '*[_type == "preset" && kind == $kind] | order(lower(name) asc) { name, data, _updatedAt }';
      const { result = [] } = await sanity(`/query/${DATASET}?query=${encodeURIComponent(q)}&$kind=${encodeURIComponent(JSON.stringify(kind))}`);
      // Stored as text (see save below), handed back as objects. One that will
      // not parse is skipped rather than failing the whole list.
      const presets = result.flatMap(p => {
        try { return [{ name: p.name, data: JSON.parse(p.data), updatedAt: p._updatedAt }]; } catch { return []; }
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ presets });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    // Open while PRESET_KEY is unset; set it on Vercel to lock writes again.
    if (process.env.PRESET_KEY && req.headers['x-preset-key'] !== process.env.PRESET_KEY) return res.status(401).json({ error: 'wrong or missing preset key' });

    const { action, kind, name, data } = req.body || {};
    if (!KINDS.includes(kind)) return res.status(400).json({ error: `kind must be one of ${KINDS.join(', ')}` });
    if (!name || typeof name !== 'string' || name.length > 120) return res.status(400).json({ error: 'a name is needed, 120 characters at most' });

    if (action === 'delete') {
      await mutate([{ delete: { id: docId(kind, name) } }]);
      return res.status(200).json({ ok: true });
    }
    if (action === 'save') {
      // The whole preset as one JSON string: its shape changes whenever a layer
      // or field is added, and the page already knows how to fill in what an
      // older one is missing. A schema per field would only drift behind it.
      const text = JSON.stringify(data);
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data must be an object' });
      if (text.length > MAX_BYTES) return res.status(413).json({ error: `preset is over ${MAX_BYTES / 1000}KB` });
      await mutate([{ createOrReplace: { _id: docId(kind, name), _type: 'preset', kind, name, data: text } }]);
      return res.status(200).json({ ok: true, id: docId(kind, name) });
    }
    return res.status(400).json({ error: 'action must be save or delete' });
  } catch (err) {
    return res.status(err.status === 401 || err.status === 403 ? 502 : 500).json({ error: err.message });
  }
}
