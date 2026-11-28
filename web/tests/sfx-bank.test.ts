/**
 * SFX bank (2026-11-28): how delivered sound files are fetched, decoded and kept.
 *
 * The promises held here:
 *   1. nothing waits for sound: only the sounds of the player's own hands and feet load ahead of play, the rest
 *      follows in the background or on first need, and beds and loops never load ahead;
 *   2. an event never sounds two different ways: while a slot's file is on its way the slot reports 'loading'
 *      (the caller stays quiet), and only a slot with no usable file hands the role back to the synthesizer;
 *   3. a sound that is asked for jumps the queue;
 *   4. decoded audio stays under its memory budget without ever dropping the first-priority sounds;
 *   5. the shipped files fit their budgets and every one of them names the recording it came from.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SFX_SLOT, SFX_SLOTS } from '../src/game/sfx/slots';
import { SfxBank, parseIndex, stageOf, kinOf, pcmBytes, CORE_GROUPS, type SfxFile } from '../src/game/sfx/bank';

const PUB = join(__dirname, '..', 'public', 'sfx');
const shipped = parseIndex(JSON.parse(readFileSync(join(PUB, 'index.json'), 'utf8')));

/** A fake site: every file answers when the test lets it. `size` is the decoded size of each file in bytes. */
function site(slots: Record<string, string[]>, opts: { size?: (f: string) => number; broken?: string[]; lean?: boolean; budget?: number } = {}) {
  const asked: string[] = []; const gates = new Map<string, () => void>(); let clock = 1_000;
  const fetcher = (url: string) => new Promise<Response>(resolve => {
    const f = url.replace('/sfx/', ''); asked.push(f);
    const answer = () => resolve({
      ok: !opts.broken?.includes(f), status: 200,
      json: async () => ({ version: 1, slots }),
      arrayBuffer: async () => new TextEncoder().encode(f).buffer,
    } as unknown as Response);
    if (f === 'index.json') answer(); else gates.set(f, answer);
  });
  const decode = async (bytes: ArrayBuffer) => {
    const f = new TextDecoder().decode(bytes);
    return { length: (opts.size?.(f) ?? 4000) / 4, numberOfChannels: 1, name: f } as unknown as AudioBuffer;
  };
  const bank = new SfxBank('/sfx/', { fetcher, decode, lean: opts.lean, budget: opts.budget, now: () => clock });
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    bank, asked,
    audio: () => asked.filter(f => f !== 'index.json'),
    /** Let the named files (or everything in flight) arrive. */
    async land(...files: string[]) { for (const f of files.length ? files : [...gates.keys()]) { gates.get(f)?.(); gates.delete(f); } await settle(); },
    async drain() { for (let i = 0; i < 400 && gates.size; i++) { for (const f of [...gates.keys()]) { gates.get(f)!(); gates.delete(f); } await settle(); } },
    settle, tick(ms: number) { clock += ms; },
  };
}
const file = (id: string, take = 1) => `${SFX_SLOT[id].group}/${id}__${String(take).padStart(2, '0')}.ogg`;

describe('SFX loading plan', () => {
  it('puts each slot in the stage its role calls for', () => {
    expect(stageOf(SFX_SLOT['ui.click'])).toBe(0);
    expect(stageOf(SFX_SLOT['step.grass'])).toBe(0);
    expect(stageOf(SFX_SLOT['hit.flesh'])).toBe(0);
    expect(stageOf(SFX_SLOT['door.wood.open'])).toBe(1);      // first priority, but not the player's own hands
    expect(stageOf(SFX_SLOT['cr.boar.tell'])).toBe(2);
    expect(stageOf(SFX_SLOT['cr.fox.idle'])).toBe(3);
    for (const s of SFX_SLOTS) if (s.mode !== 'shot') expect(stageOf(s), s.id).toBe(3);     // beds and loops are long: never ahead of need
    for (const g of CORE_GROUPS) expect(SFX_SLOTS.some(s => s.group === g), g).toBe(true);
  });
  it('names the relatives of a family slot, and none for a plain one', () => {
    expect(kinOf('cr.boar.tell').sort()).toEqual(['cr.boar.die', 'cr.boar.hurt', 'cr.boar.idle']);
    expect(kinOf('ui.click')).toEqual([]);
    expect(kinOf('core.blast.basic')).toContain('core.blast.signature');
  });
  it('loads only the first-minute sounds before play, then the rest of first and second priority, never beds, loops or third priority', async () => {
    const slots = { 'ui.click': [file('ui.click')], 'door.wood.open': [file('door.wood.open')], 'cr.boar.tell': [file('cr.boar.tell')], 'cr.fox.idle': [file('cr.fox.idle')], 'bed.night': [file('bed.night')], 'loop.campfire': [file('loop.campfire')] };
    const s = site(slots);
    await s.bank.prefetch(); await s.settle();
    expect(s.audio()).toEqual([file('ui.click')]);
    await s.bank.start(); await s.drain();
    expect(s.audio().sort()).toEqual([file('cr.boar.tell'), file('door.wood.open'), file('ui.click')].sort());
    expect(s.bank.load('bed.night')).toBe('loading');          // has a file; nobody has needed it yet
    expect(s.bank.counts().stagesReady).toEqual([1, 1, 1, 0]);
  });
  it('on a lean connection loads ahead only the first-minute sounds', async () => {
    const s = site({ 'ui.click': [file('ui.click')], 'door.wood.open': [file('door.wood.open')], 'cr.boar.tell': [file('cr.boar.tell')] }, { lean: true });
    await s.bank.start(); await s.drain();
    expect(s.audio()).toEqual([file('ui.click')]);
    expect(s.bank.take('door.wood.open', 0)).toBeNull();        // first need asks for it
    await s.drain();
    expect(s.bank.take('door.wood.open', 0)).not.toBeNull();
  });
  it('never fetches the same file twice, however often it is asked for', async () => {
    const s = site({ 'bed.night': [file('bed.night')] });
    await s.bank.start(); await s.settle();
    for (let i = 0; i < 50; i++) s.bank.take('bed.night', 0);
    await s.drain();
    for (let i = 0; i < 50; i++) s.bank.take('bed.night', 0);
    expect(s.audio()).toEqual([file('bed.night')]);
  });
});

describe('SFX in transit', () => {
  it('reports loading until the file lands, then plays it; the slot never falls back in between', async () => {
    const s = site({ 'bed.rain': [file('bed.rain')] });
    await s.bank.loadIndex();
    expect(s.bank.status('bed.rain')).toBe('file');
    expect(s.bank.load('bed.rain')).toBe('loading');
    expect(s.bank.take('bed.rain', 0)).toBeNull();
    await s.settle();
    expect(s.bank.load('bed.rain')).toBe('loading');
    await s.land();
    expect(s.bank.load('bed.rain')).toBe('ready');
    expect(s.bank.take('bed.rain', 0)?.from).toBe('bed.rain');
    expect(s.bank.load('npc.talk')).toBe('none');               // no file at all: the caller may use its stand-in
  });
  it('lets a sound that is asked for jump ahead of background work', async () => {
    const many: Record<string, string[]> = {};
    for (const sl of SFX_SLOTS.filter(x => stageOf(x) === 1).slice(0, 12)) many[sl.id] = [file(sl.id)];
    many['bed.night'] = [file('bed.night')];
    const s = site(many);
    await s.bank.start(); await s.settle();
    const before = s.audio().length;
    expect(before).toBeLessThanOrEqual(2);                      // background work takes two connections, no more
    s.bank.take('bed.night', 0); await s.settle();
    expect(s.audio()[before]).toBe(file('bed.night'));          // straight out, not behind the ten still queued
  });
  it('asks for the rest of a family right behind the one that was needed', async () => {
    const s = site({ 'cr.fox.idle': [file('cr.fox.idle')], 'cr.fox.hurt': [file('cr.fox.hurt')], 'cr.deer.idle': [file('cr.deer.idle')] });
    await s.bank.start(); await s.settle();
    expect(s.audio()).toEqual([]);                              // third priority: nothing ahead of need
    s.bank.take('cr.fox.idle', 0); await s.drain();
    expect(s.audio()).toEqual([file('cr.fox.idle'), file('cr.fox.hurt')]);
  });
  it('starts a sound that lands within the grace time, and drops the request when it lands later', async () => {
    const s = site({ 'door.wood.open': [file('door.wood.open')], 'box.chest.open': [file('box.chest.open')] });
    await s.bank.loadIndex();
    let a = 0, b = 0;
    s.bank.take('door.wood.open', 0); s.bank.whenReady('door.wood.open', 280, () => { a++; });
    s.bank.take('box.chest.open', 0); s.bank.whenReady('box.chest.open', 280, () => { b++; });
    await s.settle();
    s.tick(100); await s.land(file('door.wood.open'));
    s.tick(400); await s.land(file('box.chest.open'));
    expect([a, b]).toEqual([1, 0]);
  });
  it('gives a slot back to its stand-in for good once its file has failed twice', async () => {
    const s = site({ 'ui.click': [file('ui.click')], 'bed.night': [file('bed.night')] }, { broken: [file('ui.click'), file('bed.night')] });
    await s.bank.prefetch(); await s.drain();
    expect(s.bank.load('ui.click')).toBe('loading');            // one failure: it is tried once more, later
    s.tick(20_000); s.bank.take('ui.click', 0); await s.drain();
    expect(s.bank.load('ui.click')).toBe('none');
    expect(s.bank.status('ui.click')).toBe('synth');            // the synthesized click is back, and stays
    expect(s.bank.status('ui.tab')).toBe('synth');              // so is everything that borrowed it
    s.bank.take('bed.night', 0); await s.drain(); s.tick(20_000); s.bank.take('bed.night', 0); await s.drain();
    expect(s.bank.status('bed.night')).toBe('silent');
    expect(s.audio().filter(f => f === file('ui.click')).length).toBe(2);
    expect(s.bank.failures().sort()).toEqual([file('bed.night'), file('ui.click')].sort());
  });
  it('plays a named take for the test board, and a random one otherwise without repeating', async () => {
    const s = site({ 'ui.click': [file('ui.click', 1), file('ui.click', 2), file('ui.click', 3)] });
    await s.bank.prefetch(); await s.drain();
    expect((s.bank.take('ui.click', 0, 2)!.buffer as any).name).toBe(file('ui.click', 3));
    let last = '';
    for (let i = 0; i < 20; i++) { const n = (s.bank.take('ui.click', (i * 0.37) % 1)!.buffer as any).name; expect(n).not.toBe(last); last = n; }
  });
});

describe('SFX memory budget', () => {
  it('drops what was used longest ago, and never the first-priority sounds', async () => {
    const MB = 1024 * 1024;
    const slots = { 'ui.click': [file('ui.click')], 'door.wood.open': [file('door.wood.open')], 'bed.night': [file('bed.night')], 'bed.rain': [file('bed.rain')], 'bed.wind': [file('bed.wind')] };
    const s = site(slots, { budget: 22 * MB, size: f => (f.startsWith('bed/') ? 9 * MB : 1 * MB) });
    await s.bank.start(); await s.drain();
    s.bank.take('bed.night', 0); await s.drain(); s.tick(30_000);
    s.bank.take('bed.rain', 0); await s.drain(); s.tick(30_000);
    expect(s.bank.counts().pcm).toBe(20 * MB);
    s.bank.take('bed.wind', 0); await s.drain();                // 29 MB: one bed has to go, the oldest
    expect(s.bank.load('bed.night')).toBe('loading');
    expect(s.bank.load('bed.rain')).toBe('ready');
    expect(s.bank.load('bed.wind')).toBe('ready');
    expect(s.bank.load('ui.click')).toBe('ready');
    expect(s.bank.load('door.wood.open')).toBe('ready');
    expect(s.bank.counts().pcm).toBeLessThanOrEqual(22 * MB);
  });
  it('keeps a loop that is still playing', async () => {
    const MB = 1024 * 1024;
    const s = site({ 'bed.night': [file('bed.night')], 'bed.rain': [file('bed.rain')] }, { budget: 10 * MB, size: () => 9 * MB });
    await s.bank.loadIndex();
    s.bank.take('bed.night', 0); await s.drain(); s.tick(60_000);
    s.bank.touch('bed.night');                                   // the mixer says: still sounding
    s.bank.take('bed.rain', 0); await s.drain();
    expect(s.bank.load('bed.night')).toBe('ready');
    expect(s.bank.load('bed.rain')).toBe('ready');               // over budget for now rather than cutting a sound in use
  });
  it('gives up a bed that stopped before any short sound', async () => {
    const MB = 1024 * 1024;
    const slots = { 'cr.boar.tell': [file('cr.boar.tell')], 'bed.night': [file('bed.night')], 'bed.rain': [file('bed.rain')] };
    const s = site(slots, { budget: 12 * MB, size: f => (f.startsWith('bed/') ? 9 * MB : 1 * MB) });
    await s.bank.start(); await s.drain();
    s.bank.take('cr.boar.tell', 0); s.tick(30_000);              // the short sound was used longest ago
    s.bank.take('bed.night', 0); await s.drain(); s.tick(30_000);
    s.bank.take('bed.rain', 0); await s.drain();                 // 19 MB against 12: the idle bed goes, which is enough
    expect(s.bank.load('bed.night')).toBe('loading');
    expect(s.bank.load('cr.boar.tell')).toBe('ready');
    expect(s.bank.load('bed.rain')).toBe('ready');
  });
  it('stops filling in the background before the budget is reached, and still fetches on request', async () => {
    const MB = 1024 * 1024;
    const second = SFX_SLOTS.filter(x => stageOf(x) === 2).slice(0, 12).map(x => x.id);
    const slots = Object.fromEntries([['ui.click', [file('ui.click')]], ['door.wood.open', [file('door.wood.open')]], ...second.map(id => [id, [file(id)]])]);
    const s = site(slots, { budget: 10 * MB, size: () => 1 * MB });
    await s.bank.start(); await s.drain();
    const c = s.bank.counts();
    expect(c.stagesReady[0]).toBe(1); expect(c.stagesReady[1]).toBe(1);        // first priority always arrives
    expect(c.pcm).toBeGreaterThan(8 * MB); expect(c.pcm).toBeLessThanOrEqual(10 * MB);
    expect(s.audio().length).toBeLessThan(14);                                  // nothing was fetched only to be dropped
    const left = second.find(id => s.bank.load(id) === 'loading')!;
    expect(left).toBeTruthy();
    expect(s.bank.take(left, 0)).toBeNull(); await s.drain();
    expect(s.bank.load(left)).toBe('ready');
  });
  it('measures decoded audio as 32-bit samples per channel', () => {
    expect(pcmBytes({ length: 48000, numberOfChannels: 2 })).toBe(384000);
  });
});

describe('SFX shipped files', () => {
  const all = Object.entries(shipped.slots).flatMap(([id, list]) => (list as SfxFile[]).map(f => ({ id, ...f })));
  const bytes = (stage: number) => all.filter(f => stageOf(SFX_SLOT[f.id]) === stage).reduce((n, f) => n + (f.b ?? 0), 0);

  it('records the true size and a level trim for every file', () => {
    expect(all.length).toBeGreaterThan(400);
    for (const f of all) {
      expect(f.b, f.f).toBe(statSync(join(PUB, f.f)).size);
      expect(f.g, f.f).toBeGreaterThan(0.02); expect(f.g, f.f).toBeLessThanOrEqual(4);
    }
  });
  it('keeps each stage inside its download budget', () => {
    expect(bytes(0)).toBeLessThan(1.0e6);                        // before play: under 1 MB
    expect(bytes(0) + bytes(1) + bytes(2)).toBeLessThan(5.0e6);  // everything fetched without being asked for: under 5 MB
    expect(all.reduce((n, f) => n + (f.b ?? 0), 0)).toBeLessThan(12e6);
    for (const f of all) expect(f.b!, f.f).toBeLessThan(SFX_SLOT[f.id].mode === 'bed' ? 400_000 : SFX_SLOT[f.id].mode === 'loop' ? 150_000 : 60_000);
  });
  it('ships loops and beds in a format that loops without a gap', () => {
    for (const f of all) if (SFX_SLOT[f.id].mode !== 'shot') expect(f.f, f.f).toMatch(/\.(ogg|wav)$/);
  });
  it('names the library recording behind every shipped file', () => {
    const origin = JSON.parse(readFileSync(join(PUB, 'sources.json'), 'utf8')) as Record<string, string>;
    for (const f of all) expect(origin[f.f], f.f).toBeTruthy();
    expect(Object.keys(origin).length).toBe(all.length);
  });
  it('fills the first-priority slots that used to be silent, except where the library has nothing honest to offer', () => {
    const silent = SFX_SLOTS.filter(s => s.prio === 1 && !shipped.slots[s.id] && !s.synth && !(s.borrow && (shipped.slots[s.borrow] || SFX_SLOT[s.borrow]?.synth))).map(s => s.id);
    expect(silent).toEqual(['npc.talk']);                        // no neutral human murmur in the library
  });
});
