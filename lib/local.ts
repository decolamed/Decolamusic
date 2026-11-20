// Músicas do próprio usuário, guardadas só neste dispositivo (IndexedDB).
export type LocalMeta = { key: string; title: string; channel: string; thumbnail: string; duration: number; created: number };
type Rec = LocalMeta & { blob: Blob };
const DB = 'decola-local', ST = 'files';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'key' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = fn(db.transaction(ST, mode).objectStore(ST));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export const putFile = (rec: Rec) => tx('readwrite', (s) => s.put(rec));
export const getFile = (key: string) => tx<Rec | undefined>('readonly', (s) => s.get(key));
export const delFile = (key: string) => tx('readwrite', (s) => s.delete(key));
export async function listMeta(): Promise<LocalMeta[]> {
  const all = await tx<Rec[]>('readonly', (s) => s.getAll());
  return all.map(({ blob, ...m }) => m).sort((a, b) => b.created - a.created);
}
