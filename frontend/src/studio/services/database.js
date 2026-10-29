import { emptyState } from './domain';
let connection;
export function connect() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('drape-drop-studio-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('records');
      request.result.createObjectStore('assets');
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => { connection = null; reject(new Error('Browser storage could not open. Enable local storage or try another browser.')); };
    request.onblocked = () => { connection = null; reject(new Error('Close other Drape & Drop tabs, then retry.')); };
  });
  return connection;
}
export async function readState() {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').get('state');
    request.onsuccess = () => resolve(request.result || emptyState());
    request.onerror = () => reject(new Error('Could not read local studio data.'));
  });
}
// A single read/write transaction serializes mutations across browser tabs.
export async function mutate(change, assetWrites = [], assetDeletes = []) {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['records', 'assets'], 'readwrite');
    const records = tx.objectStore('records');
    const assets = tx.objectStore('assets');
    let next, value, failure;
    const request = records.get('state');
    request.onsuccess = () => {
      try {
        next = request.result || emptyState();
        value = change(next);
        records.put(next, 'state');
        assetWrites.forEach(([id, blob]) => assets.put(blob, id));
        assetDeletes.forEach(id => assets.delete(id));
        if (Array.isArray(value?.deleteAssets)) value.deleteAssets.forEach(id => assets.delete(id));
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve({ state: next, value });
    tx.onerror = tx.onabort = () => reject(failure || new Error('Could not save. Browser storage may be full or unavailable.'));
  });
}
export async function readAsset(id) {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const request = db.transaction('assets').objectStore('assets').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not load image.'));
  });
}
