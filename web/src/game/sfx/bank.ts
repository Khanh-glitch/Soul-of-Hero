// ============================================================================
// SFX sample bank: which files fill which slot, and the decoded audio.
//
// public/sfx/index.json lists the files (written by `node scripts/sfx.mjs index`).
// A slot with no file of its own uses the files of the slot it borrows from.
// One-shots are fetched in the background right after the index arrives; loops
// and beds are fetched the first time they are needed, because they are long.
// ============================================================================
import { SFX_SLOT, type SfxSlot } from './slots';

export interface SfxFile { f: string; g?: number }
export interface SfxIndex { version: 1; slots: Record<string, (string | SfxFile)[]> }
export const EMPTY_INDEX: SfxIndex = { version: 1, slots: {} };

/** Reads an index.json body. Anything malformed gives the empty index: the game then runs on synthesized sound alone. */
export function parseIndex(raw: unknown): SfxIndex {
  if (!raw || typeof raw !== 'object' || (raw as any).version !== 1 || typeof (raw as any).slots !== 'object' || !(raw as any).slots) return EMPTY_INDEX;
  const slots: SfxIndex['slots'] = {};
  for (const [id, list] of Object.entries((raw as any).slots as Record<string, unknown>)) {
    if (!SFX_SLOT[id] || !Array.isArray(list)) continue;
    const files = list.map(v => (typeof v === 'string' ? { f: v } : v && typeof (v as any).f === 'string' ? { f: (v as any).f as string, g: typeof (v as any).g === 'number' ? (v as any).g as number : undefined } : null))
      .filter((v): v is SfxFile => !!v && !v.f.includes('..') && !/^([a-z]+:)?\/\//i.test(v.f));
    if (files.length) slots[id] = files;
  }
  return { version: 1, slots };
}

/** The files a slot plays: its own, else those of the slot it borrows from (followed up to four steps). */
export function resolveFiles(index: SfxIndex, id: string): { from: string; files: SfxFile[] } | null {
  let cur: string | undefined = id;
  for (let hop = 0; cur && hop < 5; hop++) {
    const own = index.slots[cur] as SfxFile[] | undefined;
    if (own?.length) return { from: cur, files: own };
    cur = SFX_SLOT[cur]?.borrow;
  }
  return null;
}
/** Old synthesized cue that stands in for a slot: its own, else the one of the slot it borrows from. */
export function synthOf(id: string): string | null {
  let cur: string | undefined = id;
  for (let hop = 0; cur && hop < 5; hop++) {
    const s: SfxSlot | undefined = SFX_SLOT[cur];
    if (!s) return null;
    if (s.synth) return s.synth;
    cur = s.borrow;
  }
  return null;
}
export type SlotStatus = 'file' | 'borrowed' | 'synth' | 'silent';
export function slotStatus(index: SfxIndex, id: string): SlotStatus {
  const r = resolveFiles(index, id);
  if (r) return r.from === id ? 'file' : 'borrowed';
  return synthOf(id) ? 'synth' : 'silent';
}
/** Next take to play: any of them, but never the one that just played when there is a choice. */
export function pickTake(count: number, last: number, rand: number): number {
  if (count <= 1) return 0;
  const i = Math.floor(rand * (count - 1));
  return last >= 0 && i >= last ? i + 1 : i;
}

type Decode = (bytes: ArrayBuffer) => Promise<AudioBuffer>;
export class SfxBank {
  index: SfxIndex = EMPTY_INDEX;
  loaded = false;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private lastTake = new Map<string, number>();
  private decode: Decode | null = null;
  private listeners = new Set<() => void>();
  constructor(private base: string, private fetcher: (url: string) => Promise<Response> = url => fetch(url)) {}

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() { for (const fn of this.listeners) fn(); }

  private indexing: Promise<void> | null = null;
  /** Fetch the list of files only (no audio device needed). Never throws. */
  loadIndex(): Promise<void> {
    return this.indexing ??= (async () => {
      try {
        const res = await this.fetcher(this.base + 'index.json');
        this.index = res.ok ? parseIndex(await res.json()) : EMPTY_INDEX;
      } catch { this.index = EMPTY_INDEX; }
      this.loaded = true; this.changed();
    })();
  }
  /** Fetch the index, then start fetching every one-shot in the background. Never throws. */
  async load(decode: Decode): Promise<void> {
    this.decode = decode;
    await this.loadIndex();
    const queue: string[] = [];
    const byPrio = Object.keys(this.index.slots).filter(id => SFX_SLOT[id]?.mode === 'shot').sort((a, b) => SFX_SLOT[a].prio - SFX_SLOT[b].prio);
    for (const id of byPrio) for (const file of this.index.slots[id] as SfxFile[]) queue.push(file.f);
    const worker = async () => { for (let f = queue.shift(); f; f = queue.shift()) await this.fetchOne(f); };
    void Promise.all([worker(), worker()]).then(() => this.changed());
  }
  /** Resolves true when this call fetched the file (successfully or not), false when there was nothing to do. */
  private async fetchOne(f: string): Promise<boolean> {
    if (this.buffers.has(f) || this.pending.has(f) || this.failed.has(f) || !this.decode) return false;
    this.pending.add(f);
    try {
      const res = await this.fetcher(this.base + f);
      if (!res.ok) throw new Error(String(res.status));
      this.buffers.set(f, await this.decode(await res.arrayBuffer()));
    } catch { this.failed.add(f); }
    this.pending.delete(f);
    return true;
  }
  status(id: string): SlotStatus { return slotStatus(this.index, id); }
  /** Files that could not be fetched or decoded (shown on the sound test board). */
  failures(): string[] { return [...this.failed]; }
  counts() { return { files: Object.values(this.index.slots).reduce((n, l) => n + l.length, 0), ready: this.buffers.size, failed: this.failed.size }; }

  /** A decoded take for the slot, or null when it has no file or the file has not arrived yet (it is then requested). */
  take(id: string, rand: number): { buffer: AudioBuffer; gain: number; from: string } | null {
    const r = resolveFiles(this.index, id);
    if (!r) return null;
    const ready = r.files.filter(f => this.buffers.has(f.f));
    if (!ready.length) { for (const f of r.files) void this.fetchOne(f.f).then(did => { if (did) this.changed(); }); return null; }
    const i = pickTake(ready.length, this.lastTake.get(r.from) ?? -1, rand);
    this.lastTake.set(r.from, i);
    const file = ready[i];
    return { buffer: this.buffers.get(file.f)!, gain: file.g ?? 1, from: r.from };
  }
}
