// Cache local IndexedDB : "kv" (config, état de synchro) et "media" (fichiers).

const DB_NAME = 'weborganizer';
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('kv');
        db.createObjectStore('media');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const kvGet = key => run('kv', 'readonly', s => s.get(key));
export const kvSet = (key, value) => run('kv', 'readwrite', s => s.put(value, key));
export const mediaGet = id => run('media', 'readonly', s => s.get(id));
export const mediaPut = (id, blob) => run('media', 'readwrite', s => s.put(blob, id));
export const mediaDelete = id => run('media', 'readwrite', s => s.delete(id));
export const mediaKeys = () => run('media', 'readonly', s => s.getAllKeys());
