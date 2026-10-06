const DB = 'drc-golf-tourbillion-videos';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('Video storage is unavailable in this browser.')); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('clips');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open local video storage.'));
    request.onblocked = () => reject(new Error('Close other DRC app tabs and try again.'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', mode);
    const request = action(tx.objectStore('clips'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(new Error('Video storage failed. Your browser may be out of space.')); };
    tx.onerror = () => { db.close(); reject(new Error('Could not read or save this video.')); };
  });
}
export async function storeVideoFile(uri: string, name: string): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the selected video.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('The selected video is empty.');
  await transaction('readwrite', (store) => store.add(blob, name));
}
export async function getVideoUri(name: string): Promise<string> {
  const blob = await transaction<Blob | undefined>('readonly', (store) => store.get(name));
  if (!blob) throw new Error('This video is no longer in this browser’s storage.');
  return URL.createObjectURL(blob);
}
export function releaseVideoUri(uri: string): void { URL.revokeObjectURL(uri); }
export async function deleteVideoFile(name: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete(name));
}
export async function shareVideoFile(name: string): Promise<void> {
  const uri = await getVideoUri(name);
  const link = document.createElement('a');
  link.href = uri; link.download = name; link.click();
  setTimeout(() => releaseVideoUri(uri), 1000);
}