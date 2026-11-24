// Background half of a save: envelope + checksum + the IndexedDB transaction. The game thread only has to produce the
// state text; the bytes written here are exactly what the game thread would have written (see save-wire.ts).
// Requests are answered strictly in arrival order, so an older snapshot can never land after a newer one.
import { wrapSnapshot, type SaveWriteReply, type SaveWriteRequest } from './save-wire';

const dbs = new Map<string, Promise<IDBDatabase | null>>();
function open(name: string, store: string): Promise<IDBDatabase | null> {
  let p = dbs.get(name);
  if (!p) {
    p = new Promise(res => { try { const rq = indexedDB.open(name, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(store); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch { res(null); } });
    dbs.set(name, p);
  }
  return p;
}
let tail: Promise<unknown> = Promise.resolve();
self.onmessage = ({ data }: { data: SaveWriteRequest }) => {
  const run = async (): Promise<SaveWriteReply['status']> => {
    const d = await open(data.db, data.store); if (!d) return 'idb-init';
    const text = data.text ?? wrapSnapshot(data.payload!);
    return await new Promise<SaveWriteReply['status']>(res => { try { const tx = d.transaction(data.store, 'readwrite'); tx.objectStore(data.store).put(text, data.key); tx.oncomplete = () => res('ok'); tx.onerror = () => res('idb-transaction'); tx.onabort = () => res('idb-transaction'); } catch { res('idb-transaction'); } });
  };
  const job = tail.then(run, run).then(status => { (self as unknown as { postMessage(m: SaveWriteReply): void }).postMessage({ id: data.id, status }); }, () => { (self as unknown as { postMessage(m: SaveWriteReply): void }).postMessage({ id: data.id, status: 'idb-transaction' }); });
  tail = job;
};
