// The pads' recordings live in the browser's IndexedDB (too big for localStorage).
// Each is stored with a fingerprint of the loop it came from, so a changed loop gets recorded again.
const DB = 'banadaw', STORE = 'pads';
type Stored = { sig: string; rate: number; chans: Float32Array[] };

let dbp: Promise<IDBDatabase> | null = null;
function db() {
  return (dbp ??= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  }));
}
function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(d => new Promise((ok, fail) => { const r = fn(d.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); }));
}
// a quick fingerprint of a loop
export function sigOf(json: string) {
  let h = 5381; for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  return `${json.length}:${(h >>> 0).toString(36)}`;
}
export async function putPad(i: number, sig: string, buf: AudioBuffer) {
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c).slice());
  try { await run('readwrite', s => s.put({ sig, rate: buf.sampleRate, chans } satisfies Stored, i)); } catch {}
}
export async function getPad(i: number): Promise<{ sig: string; buf: AudioBuffer } | null> {
  try {
    const v = await run<Stored | undefined>('readonly', s => s.get(i));
    if (!v?.chans?.length) return null;
    const buf = new AudioBuffer({ length: v.chans[0].length, numberOfChannels: v.chans.length, sampleRate: v.rate });
    v.chans.forEach((c, n) => buf.copyToChannel(c, n));
    return { sig: v.sig, buf };
  } catch { return null; }
}
export async function delPad(i: number) { try { await run('readwrite', s => s.delete(i)); } catch {} }
