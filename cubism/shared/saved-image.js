// Remembers pictures in IndexedDB (copied from interactive-particles/shared, then given keys): the current one under
// 'current', and each template's uploaded photo under its own key. Failures are silent: no storage (private window,
// blocked site data) just means the page falls back to its default image.

const DB_NAME = 'cubism';
const STORE = 'images';
const KEY = 'current';

// open the database; the first time (or on a version bump) create the store it needs
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// run one request in a transaction and resolve with its result once the transaction has committed
async function run(mode, makeRequest) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = makeRequest(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

// The File itself is stored (structured clone), not a data URL: no base64, no 5 MB localStorage cap. A plain string
// works too: cubism stores a random photo's picsum address this way. Resolves true once stored.
export async function saveImage(file, key = KEY) {
  try { await run('readwrite', store => store.put(file, key)); return true; } catch { return false; }
}

export async function loadSavedImage(key = KEY) {
  try { return (await run('readonly', store => store.get(key))) ?? null; } catch { return null; }
}

export async function clearSavedImage(key = KEY) {
  try { await run('readwrite', store => store.delete(key)); } catch {}
}
