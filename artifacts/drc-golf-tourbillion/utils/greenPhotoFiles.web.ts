import { checkGreenPhotoName } from './greenPhotoReference';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('Photo storage is unavailable in this browser.')); return; }
    const request = indexedDB.open('drc-golf-tourbillion-green-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open local photo storage.'));
    request.onblocked = () => reject(new Error('Close other DRC tabs and try again.'));
  });
}

async function transaction<T>(name: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  checkGreenPhotoName(name);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode);
    const request = action(tx.objectStore('photos'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(new Error('Photo storage failed. Your browser may be out of space.')); };
    tx.onerror = () => { db.close(); reject(new Error('Could not read or save this photo.')); };
  });
}

export async function storeGreenPhoto(uri: string, name: string): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the selected photo.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('The selected photo is empty.');
  await transaction(name, 'readwrite', store => store.add(blob, name));
}

export async function getGreenPhotoUri(name: string): Promise<string> {
  const blob = await transaction<Blob | undefined>(name, 'readonly', store => store.get(name));
  if (!blob) throw new Error('This photo is not in this browser. The note is still available; export photos separately from JSON backups.');
  return URL.createObjectURL(blob);
}

export function releaseGreenPhotoUri(uri: string): void { URL.revokeObjectURL(uri); }

export async function deleteGreenPhoto(name: string): Promise<void> {
  await transaction(name, 'readwrite', store => store.delete(name));
}

export async function shareGreenPhoto(name: string): Promise<void> {
  const uri = await getGreenPhotoUri(name);
  const link = document.createElement('a');
  link.href = uri; link.download = name; link.click();
  setTimeout(() => releaseGreenPhotoUri(uri), 1000);
}
