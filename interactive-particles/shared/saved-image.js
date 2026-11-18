// Remembers the last uploaded image across refreshes, in IndexedDB. Failures are silent: no storage
// (private window, blocked site data) just means the page falls back to its default image.

const DB_NAME = 'interactive-particles';
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

// the File itself is stored (structured clone), not a data URL: no base64, no 5 MB localStorage cap
export async function saveImage(file) {
  try { await run('readwrite', store => store.put(file, KEY)); } catch {}
}

export async function loadSavedImage() {
  try { return (await run('readonly', store => store.get(KEY))) ?? null; } catch { return null; }
}

export async function clearSavedImage() {
  try { await run('readwrite', store => store.delete(KEY)); } catch {}
}
