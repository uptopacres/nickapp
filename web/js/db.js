// IndexedDB stores (spec §9). One database per environment so test never mixes with live.
//   outbox  – pending day submissions, keyed by entryId (step 4)
//   entries – local copy of DailyLog rows, keyed by entryId
//   config, home, meta – single values under explicit keys
import { ENV } from './config.js';

const STORES = { outbox: 'entryId', entries: 'entryId', config: null, home: null, meta: null };
let dbPromise;

function open() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(`nickapp-${ENV}`, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, keyPath ? { keyPath } : undefined);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const get = (store, key) => tx(store, 'readonly', s => s.get(key));
export const getAll = store => tx(store, 'readonly', s => s.getAll());
export const put = (store, value, key) => tx(store, 'readwrite', s => s.put(value, key));
export const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));

/** Replaces a keyPath store's contents in one transaction. */
export const replaceAll = (store, values) =>
  tx(store, 'readwrite', s => {
    s.clear();
    values.forEach(v => s.put(v));
  });
