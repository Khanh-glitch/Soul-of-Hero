// ============================================================================
// SFX sample bank: which files fill which slot, and the decoded audio.
//
// public/sfx/index.json lists the files (written by `node scripts/sfx.mjs index`).
// A slot with no file of its own uses the files of the slot it borrows from.
//
// Loading is staged so that nothing waits for sound and sound never stutters:
//   stage 0  what the first minute of play needs (interface, items, steps, the
//            player's own body, swings, hits, gathering, warnings): asked for
//            as soon as the page is idle, before the first click;
//   stage 1  the rest of the first-priority one-shots, in the background;
//   stage 2  second-priority one-shots, a slow trickle while the page is idle;
//   stage 3  third priority, every loop and every bed: fetched the first time
//            the game asks for them, together with their close relatives.
// A sound that is asked for before it has arrived jumps the queue. Decoded
// audio is kept under a memory budget; what was not used lately goes first,
// and stage 0 and 1 are never dropped.
// ============================================================================
import { SFX_SLOT, type SfxSlot } from './slots';

/** f: path under public/sfx; g: level trim (1 when absent); b: size in bytes, when the index knows it. */
export interface SfxFile { f: string; g?: number; b?: number }
export interface SfxIndex { version: 1; slots: Record<string, (string | SfxFile)[]> }
export const EMPTY_INDEX: SfxIndex = { version: 1, slots: {} };

/** Reads an index.json body. Anything malformed gives the empty index: the game then runs on synthesized sound alone. */
export function parseIndex(raw: unknown): SfxIndex {
  if (!raw || typeof raw !== 'object' || (raw as any).version !== 1 || typeof (raw as any).slots !== 'object' || !(raw as any).slots) return EMPTY_INDEX;
  const slots: SfxIndex['slots'] = {};
  for (const [id, list] of Object.entries((raw as any).slots as Record<string, unknown>)) {
    if (!SFX_SLOT[id] || !Array.isArray(list)) continue;
    const files = list.map(v => (typeof v === 'string' ? { f: v } : v && typeof (v as any).f === 'string' ? { f: (v as any).f as string, g: typeof (v as any).g === 'number' ? (v as any).g as number : undefined, b: typeof (v as any).b === 'number' ? (v as any).b as number : undefined } : null))
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

// --- loading plan -------------------------------------------------------------
export type SfxStage = 0 | 1 | 2 | 3;
/** Groups whose first-priority sounds answer the player's own hands and feet: they must be there before play starts. */
export const CORE_GROUPS: readonly string[] = ['ui', 'item', 'step', 'player', 'swing', 'hit', 'gather', 'warn'];
export function stageOf(slot: Pick<SfxSlot, 'mode' | 'prio' | 'group'>): SfxStage {
  if (slot.mode !== 'shot') return 3;
  if (slot.prio === 1) return CORE_GROUPS.includes(slot.group) ? 0 : 1;
  return slot.prio === 2 ? 2 : 3;
}
/** Slots that tend to be needed together with `id`: the same family (cr.boar.*, core.blast.*, door.wood.*). */
export function kinOf(id: string): string[] {
  const parts = id.split('.');
  if (parts.length < 3) return [];
  const stem = parts[0] + '.' + parts[1] + '.';
  return Object.keys(SFX_SLOT).filter(k => k !== id && k.startsWith(stem) && SFX_SLOT[k].mode === 'shot');
}
/** Bytes of decoded audio a buffer holds (32-bit samples). */
export function pcmBytes(b: { length: number; numberOfChannels: number }): number { return b.length * b.numberOfChannels * 4; }

export type SlotLoad = 'ready' | 'loading' | 'none';
export interface BankOptions {
  /** Decodes one file. In the browser this runs off the main thread. */
  decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>;
  fetcher?: (url: string) => Promise<Response>;
  /** Resolves when the page has a moment to spare; background work waits for it between files. */
  idle?: () => Promise<void>;
  /** Decoded audio kept in memory, in bytes. Stage 0 and 1 do not count against eviction: they are never dropped. */
  budget?: number;
  /** Slow or metered connection, or a small device: only stage 0 loads ahead, the rest on first need. */
  lean?: boolean;
  now?: () => number;
}
const NET = 6;            // files in flight at once
const NET_BG = 2;         // of which background (stage 1 and 2)
const FILL = 0.85;        // background loading stops at this share of the memory budget
const KEEP_MS = 20_000;   // a sound used this recently is not dropped to make room
const RETRY_MS = 15_000;  // a file that failed once is tried once more, not sooner than this

export class SfxBank {
  index: SfxIndex = EMPTY_INDEX;
  loaded = false;
  private buffers = new Map<string, AudioBuffer>();
  private used = new Map<string, number>();
  private inflight = new Set<string>();
  private fails = new Map<string, { n: number; at: number }>();
  private lastTake = new Map<string, number>();
  private slotOf = new Map<string, string>();
  private hot: string[] = []; private core: string[] = []; private bg: string[] = [];
  private active = 0; private activeBg = 0;
  private started = false; private primed = false;
  private pcm = 0; private net = 0;
  private waiters: { id: string; until: number; fn: () => void }[] = [];
  private listeners = new Set<() => void>();
  private notify: ReturnType<typeof setTimeout> | null = null;
  private fetcher: (url: string) => Promise<Response>;
  private decode: BankOptions['decode'];
  private idle: () => Promise<void>;
  private budget: number; private lean: boolean; private now: () => number;
  private base: string;
  constructor(base: string, opts: BankOptions) {
    this.base = base;
    this.decode = opts.decode;
    this.fetcher = opts.fetcher ?? (url => fetch(url));
    this.idle = opts.idle ?? (() => Promise.resolve());
    this.budget = opts.budget ?? 72 * 1024 * 1024;
    this.lean = !!opts.lean;
    this.now = opts.now ?? (() => Date.now());
  }

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  /** Listeners hear about arrivals at most ten times a second, however many files land. */
  private changed() {
    if (this.notify) return;
    this.notify = setTimeout(() => { this.notify = null; for (const fn of this.listeners) fn(); }, 100);
  }

  private indexing: Promise<void> | null = null;
  /** Fetch the list of files only. `usable` drops files this browser cannot decode. Never throws. */
  loadIndex(usable: (f: string) => boolean = () => true): Promise<void> {
    return this.indexing ??= (async () => {
      try {
        const res = await this.fetcher(this.base + 'index.json');
        const all = res.ok ? parseIndex(await res.json()) : EMPTY_INDEX;
        const slots: SfxIndex['slots'] = {};
        for (const [id, list] of Object.entries(all.slots)) { const ok = (list as SfxFile[]).filter(f => usable(f.f)); if (ok.length) slots[id] = ok; }
        this.index = { version: 1, slots };
      } catch { this.index = EMPTY_INDEX; }
      for (const [id, list] of Object.entries(this.index.slots)) for (const f of list as SfxFile[]) this.slotOf.set(f.f, id);
      this.loaded = true; this.changed();
    })();
  }
  private filesOfStage(stage: SfxStage): string[] {
    const out: string[] = [];
    for (const [id, list] of Object.entries(this.index.slots)) if (stageOf(SFX_SLOT[id]) === stage) for (const f of list as SfxFile[]) out.push(f.f);
    return out;
  }
  /** Stage 0 only. Safe to call before the first click: it needs no audio device. Never throws. */
  async prefetch(): Promise<void> {
    await this.loadIndex();
    if (this.primed) return; this.primed = true;
    this.core.push(...this.filesOfStage(0)); this.pump();
  }
  /** The whole plan: stage 0 now, then stage 1 and 2 in the background (stage 0 only on a lean connection). Never throws. */
  async start(): Promise<void> {
    await this.prefetch();
    if (this.started) return; this.started = true;
    if (!this.lean) { this.bg.push(...this.filesOfStage(1), ...this.filesOfStage(2)); this.pump(); }
  }

  private dead(f: string): boolean { return (this.fails.get(f)?.n ?? 0) >= 2; }
  private wanted(f: string): boolean {
    if (this.buffers.has(f) || this.inflight.has(f) || this.dead(f)) return false;
    const fail = this.fails.get(f);
    return !fail || this.now() - fail.at >= RETRY_MS;
  }
  private pump() {
    while (this.active < NET) {
      let f = this.hot.shift(); let bg = false;
      if (f === undefined) f = this.core.shift();
      if (f === undefined) { if (this.activeBg >= NET_BG) break; f = this.bg.shift(); bg = true; }
      if (f === undefined) break;
      if (!this.wanted(f)) continue;
      // Background filling stops short of the memory budget: what would only push other sounds out again is left
      // to be fetched when the game first asks for it.
      if (bg && this.pcm > this.budget * FILL && stageOf(SFX_SLOT[this.slotOf.get(f)!]) >= 2) continue;
      this.active++; if (bg) this.activeBg++;
      const file = f, background = bg;
      void this.fetchOne(file, background).then(() => { this.active--; if (background) this.activeBg--; this.pump(); });
    }
  }
  private async fetchOne(f: string, background: boolean): Promise<void> {
    this.inflight.add(f);
    try {
      if (background) await this.idle();
      const res = await this.fetcher(this.base + f);
      if (!res.ok) throw new Error(String(res.status));
      const bytes = await res.arrayBuffer(); this.net += bytes.byteLength;
      const buffer = await this.decode(bytes);
      this.buffers.set(f, buffer); this.used.set(f, this.now()); this.pcm += pcmBytes(buffer); this.fails.delete(f);
      this.trim(f);
    } catch { this.fails.set(f, { n: (this.fails.get(f)?.n ?? 0) + 1, at: this.now() }); }
    this.inflight.delete(f);
    if (this.waiters.length) {
      const t = this.now(); const due = this.waiters.filter(w => w.until >= t && this.load(w.id) === 'ready');
      this.waiters = this.waiters.filter(w => w.until >= t && !due.includes(w));
      for (const w of due) w.fn();
    }
    this.changed();
  }
  /** Over budget: drop beds and loops that stopped playing first (one of them frees as much as forty short sounds),
   *  then what was used longest ago. Never stage 0 or 1, never something used in the last moments, never `keep`. */
  private trim(keep: string) {
    if (this.pcm <= this.budget) return;
    const t = this.now();
    const short = (f: string) => (SFX_SLOT[this.slotOf.get(f)!].mode === 'shot' ? 1 : 0);
    const loose = [...this.buffers.keys()].filter(f => f !== keep && stageOf(SFX_SLOT[this.slotOf.get(f)!]) >= 2 && t - (this.used.get(f) ?? 0) > KEEP_MS)
      .sort((a, b) => short(a) - short(b) || (this.used.get(a) ?? 0) - (this.used.get(b) ?? 0));
    for (const f of loose) {
      if (this.pcm <= this.budget) break;
      this.pcm -= pcmBytes(this.buffers.get(f)!); this.buffers.delete(f); this.used.delete(f);
    }
  }

  /** The files a slot plays, leaving out files that could not be fetched or decoded. */
  private resolve(id: string): { from: string; files: SfxFile[] } | null {
    let cur: string | undefined = id;
    for (let hop = 0; cur && hop < 5; hop++) {
      const own = (this.index.slots[cur] as SfxFile[] | undefined)?.filter(f => !this.dead(f.f));
      if (own?.length) return { from: cur, files: own };
      cur = SFX_SLOT[cur]?.borrow;
    }
    return null;
  }
  /** Where the slot's sound comes from. A slot whose files all failed counts as having none: it falls back for good. */
  status(id: string): SlotStatus {
    const r = this.resolve(id);
    if (r) return r.from === id ? 'file' : 'borrowed';
    return synthOf(id) ? 'synth' : 'silent';
  }
  /** 'ready': a take can play now. 'loading': the slot has a file that is on its way. 'none': no file at all. */
  load(id: string): SlotLoad {
    const r = this.resolve(id);
    if (!r) return 'none';
    return r.files.some(f => this.buffers.has(f.f)) ? 'ready' : 'loading';
  }
  /** Ask for a slot's files ahead of everything else, and for its relatives right behind the first-priority work. */
  request(id: string) {
    const r = this.resolve(id); if (!r) return;
    const missing = r.files.map(f => f.f).filter(f => this.wanted(f) && !this.hot.includes(f));
    if (!missing.length) return;
    this.hot.push(...missing);
    const kin: string[] = [];
    for (const k of kinOf(r.from)) for (const f of (this.index.slots[k] as SfxFile[] | undefined) ?? []) if (this.wanted(f.f)) kin.push(f.f);
    if (kin.length) this.bg.unshift(...kin);
    this.pump();
  }
  /** Run `fn` once if the slot becomes playable within `ms`. For sounds long enough to start a moment late. */
  whenReady(id: string, ms: number, fn: () => void) {
    if (this.waiters.length < 24) this.waiters.push({ id, until: this.now() + ms, fn });
  }
  /** Mark a slot's sound as in use (a loop that keeps playing), so it is not dropped to make room. */
  touch(id: string) { const r = this.resolve(id); if (r) { const t = this.now(); for (const f of r.files) if (this.buffers.has(f.f)) this.used.set(f.f, t); } }

  /** A decoded take for the slot, or null when it has no file or the file has not arrived yet (it is then requested).
   *  `pick` asks for one take by its place in the list (the sound test board), instead of a random one. */
  take(id: string, rand: number, pick?: number): { buffer: AudioBuffer; gain: number; from: string } | null {
    const r = this.resolve(id);
    if (!r) return null;
    const ready = r.files.filter(f => this.buffers.has(f.f));
    if (ready.length < r.files.length) this.request(id);
    let file: SfxFile | undefined;
    if (pick !== undefined) { file = r.files[pick]; if (!file || !this.buffers.has(file.f)) return null; }
    else {
      if (!ready.length) return null;
      const i = pickTake(ready.length, this.lastTake.get(r.from) ?? -1, rand);
      this.lastTake.set(r.from, i); file = ready[i];
    }
    this.used.set(file.f, this.now());
    return { buffer: this.buffers.get(file.f)!, gain: file.g ?? 1, from: r.from };
  }

  /** Files that could not be fetched or decoded (shown on the sound test board). */
  failures(): string[] { return [...this.fails.keys()]; }
  counts() {
    let files = 0, bytes = 0; const stages = [0, 0, 0, 0], stagesReady = [0, 0, 0, 0];
    for (const [id, list] of Object.entries(this.index.slots)) {
      const st = stageOf(SFX_SLOT[id]);
      for (const f of list as SfxFile[]) { files++; bytes += f.b ?? 0; stages[st]++; if (this.buffers.has(f.f)) stagesReady[st]++; }
    }
    return { files, ready: this.buffers.size, failed: this.fails.size, bytes, fetched: this.net, pcm: this.pcm, budget: this.budget, stages, stagesReady, lean: this.lean, busy: this.active + this.hot.length + this.core.length + this.bg.length };
  }
}
