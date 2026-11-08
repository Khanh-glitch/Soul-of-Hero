/**
 * VEYRA05 CANDIDATE ENVIRONMENT ART KIT — ISOLATED from the canonical production art (src/game/art.ts is untouched).
 *
 * Every asset is ORIGINAL pixel art authored here as pattern strings (one character = one native pixel), rasterised at boot
 * with the game's own `mk()` (automatic 1 px outline for objects, none for ground decals). Provenance: original work for this
 * reconstruction, licence = project licence; no third-party sprites. Palette: derived from the live terrain PAL (render.ts)
 * so decor sits inside the existing colour world instead of floating on it.
 *
 * Classification (per asset): layer 'decal' (flat, drawn under actors) | 'object' (y-sorted with actors); solid:false;
 * harvestable:false (ALL decor). Harvestable/solid things remain real catalog sources placed by Gameplay's compiler.
 * The kit is only drawn in `veyra05-*` layouts through the sanctioned compositor hook (decor-client.ts).
 */
import { mk, type Sprite } from '../game/art';
import { F } from './chunks';

export interface DecorAsset { code: number; name: string; layer: 'decal' | 'object'; solid: false; harvestable: false; variants: Sprite[]; w: number; h: number; anchor: [number, number]; biomes: string[]; rule: string; palette: string[] }
const PAL: Record<string, string> = {
  // leaf greens (forest PAL) / meadow / marsh / rock / sand / snow / ash / toxic / wood
  a: '#24501e', b: '#33662a', c: '#3a6e30', d: '#4c863a', e: '#76b24e', f: '#a2cc6a', g: '#2e4a2a', h: '#4a6a3e', i: '#6a8a4e',
  r: '#4e4a48', s: '#6e6a66', t: '#7a7672', u: '#9a9690', v: '#3a3634', w: '#8a7a62', x: '#a8987c', y: '#5e5446',
  n: '#c4aa74', o: '#dcc68e', p: '#f2e4b4', q: '#9a7a58', k: '#6a5a4a', j: '#4a2e1a', l: '#8a6038', m: '#3a2414',
  S: '#e6eef6', T: '#b8c8dc', U: '#ffffff', A: '#2e2a2c', B: '#5e5458', C: '#c0501e', D: '#ff7a2a', X: '#8a9040', Y: '#a8b840', Z: '#464c28',
  W: '#2e6ea0', V: '#4a90c0', Q: '#3a5a5a', P: '#c08ad8', O: '#e8d870', N: '#e05a7a', M: '#5a3a22', L: '#4a3e2a', K: '#e0e8f0', J: '#d8d0c0',
};
const pat = (rows: string[], outline = true): Sprite => { const h = rows.length, w = Math.max(...rows.map(r => r.length)); return mk(w, h, g => { for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch === '.' || ch === ' ') continue; g.fillStyle = PAL[ch] || ch; g.fillRect(x, y, 1, 1); } }, outline ? undefined : null); };
const proc = (w: number, h: number, fn: (put: (x: number, y: number, c: string) => void, seed: number) => void, seed: number, outline = false): Sprite => mk(w, h, g => fn((x, y, c) => { g.fillStyle = PAL[c] || c; g.fillRect(x, y, 1, 1); }, seed), outline ? undefined : null);
const rnd = (s: number) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const scatter = (w: number, h: number, n: number, cols: string[], seed: number, sz = 1) => proc(w, h, (put, s) => { const r = rnd(s); for (let i = 0; i < n; i++) { const x = Math.floor(r() * (w - sz)), y = Math.floor(r() * (h - sz)), c = cols[Math.floor(r() * cols.length)]; for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) put(x + dx, y + dy, c); } }, seed);

let KIT: Map<number, DecorAsset> | null = null;
function def(code: number, name: string, layer: 'decal' | 'object', variants: Sprite[], anchor: [number, number], biomes: string[], rule: string, palette: string[]): DecorAsset {
  return { code, name, layer, solid: false, harvestable: false, variants, w: variants[0].width, h: variants[0].height, anchor, biomes, rule, palette };
}
/** Built lazily in the browser (needs canvas). */
export function decorKit(): Map<number, DecorAsset> {
  if (KIT) return KIT; const m = new Map<number, DecorAsset>(); const add = (a: DecorAsset) => m.set(a.code, a);
  // ---- FOREST understory ----
  add(def(F.FERN, 'fern', 'object', [pat(['....d.......', '..e.d.e.....', '.d.ded.d....', '..dbdbd.....', '...dbd..e...', '..e.b.e.d...', '...dbd.d....', '....b.d.....', '....bb......']), pat(['......e.....', '..e...d..e..', '...d..d.d...', '....ddddd...', '..e..dbd..e.', '...d.dbd.d..', '....dbdbd...', '.....bbb....'])], [2, -2], ['forest'], 'interior & general forest floor; never on a source tile', ['#4c863a', '#33662a', '#76b24e']));
  add(def(F.FERN_LARGE, 'fern (large)', 'object', [pat(['.......e........', '...e...d...e....', '....d..d..d.....', '.e...d.d.d...e..', '..d...ddd...d...', '...d..dbd..d....', '....ddbbbdd.....', '......bbb.......', '.......b........', '......bb........'])], [0, -3], ['forest'], 'dense interior (CL.INTERIOR)', ['#4c863a', '#33662a']));
  add(def(F.SAPLING, 'sapling', 'object', [pat(['....e...', '...ede..', '..edede.', '...ded..', '....l...', '....l...', '....l...', '...ml...']), pat(['....e...', '..e.d.e.', '...ded..', '..edbde.', '...dbd..', '....l...', '....l...', '...ll...'])], [4, -6], ['forest edge', 'clearing'], 'forest edge / glade regrowth', ['#76b24e', '#4c863a', '#8a6038']));
  add(def(F.BIRCH_SAPLING, 'birch sapling', 'object', [pat(['....f...', '...fef..', '..fe.ef.', '...fef..', '....U...', '....U...', '...vU...', '....U...', '...UU...'])], [4, -7], ['forest edge'], 'light-demanding pioneer at stand edges', ['#a2cc6a', '#ffffff', '#3a3634']));
  add(def(F.STUMP, 'stump', 'object', [pat(['..qqqqqq..', '.qnnnnnnq.', '.qnqqqqnq.', '.qnqnnqnq.', '.lqnnnnql.', '.llllllll.', '..ljjjjl..', '..ljjjjl..']), pat(['...qqqqq..', '..qnnnnnq.', '..qnqqqnq.', '..lqnnnql.', '..llllll..', '...ljjjl..', '...ljjjl..'])], [3, 2], ['clearing', 'forest'], 'glades & interior; reads as a cut tree, not a harvestable', ['#9a7a58', '#c4aa74', '#8a6038', '#4a2e1a']));
  add(def(F.LOG, 'fallen log', 'object', [pat(['...lllllllllllll....', '..lqqqqqqqqqqqqql...', '.jlqnnqqqqqnnqqqlj..', '.jlqqqqqqqqqqqqqlj..', '..jjjjjjjjjjjjjjj...', '....d......d........']), pat(['..lllllllllll...', '.lqqqqqnqqqqql..', 'jlqqqqqqqqqqqlj.', '.jjjjjjjjjjjjj..', '...d.....d......'])], [-2, 4], ['forest', 'clearing', 'marsh'], 'deadfall; low silhouette so it never hides the hero', ['#8a6038', '#9a7a58', '#4a2e1a']));
  add(def(F.MOSS_ROCK, 'mossy rock', 'object', [pat(['....ssss....', '..ssddtss...', '.sddtuttss..', '.stuuttsss..', '.ssttssrss..', '..rsssrrr...', '...rrrr.....']), pat(['...ssss...', '..sddtss..', '.sddtttss.', '.ssttsrss.', '..rrrrrr..'])], [2, 2], ['forest', 'marsh'], 'moss-topped stone in shade', ['#6e6a66', '#9a9690', '#4c863a']));
  add(def(F.ROOTS, 'surface roots', 'decal', [pat(['................', '..l.......l.....', '...ll....ll.....', '.....ll.ll......', '.......l........', '......l.ll......', '....ll....ll....', '...l........l...', '................'], false)], [0, 0], ['forest'], 'ground break under old stands', ['#8a6038']));
  add(def(F.LEAF_LITTER, 'leaf litter', 'decal', [scatter(16, 16, 14, ['k', 'q', 'y', 'b'], 11), scatter(16, 16, 10, ['k', 'q', 'y'], 12)], [0, 0], ['forest'], 'micro texture; drawn under everything', ['#6a5a4a', '#9a7a58']));
  add(def(F.WILDFLOWERS, 'wildflowers', 'object', [pat(['.P..O..N..P.', 'dPdOdOdNdPd.', '.d..d..d..d.', '.d..d..d..d.']), pat(['..O...N..', '.dOd.dNd.', '..d...d..', '..d...d..'])], [2, 0], ['clearing', 'meadow'], 'glades and meadow; uses the live meadow/grass accent colours', ['#c08ad8', '#e8d870', '#e05a7a']));
  add(def(F.GRASS_TUFT, 'grass tuft', 'object', [pat(['e..e.e..', '.e.ede.e', '.ededed.', '..ddd...']), pat(['..e.e...', '.ededee.', '..ddd...'])], [4, 2], ['grass', 'meadow', 'forest edge'], 'generic ground break', ['#76b24e', '#4c863a']));
  add(def(F.FLOWER_SMALL, 'small flowers', 'decal', [pat(['.O...N..', 'd....d..', '...P....', '...d..O.', '......d.'], false)], [4, 4], ['grass', 'meadow'], 'micro accent', ['#e8d870', '#e05a7a', '#c08ad8']));
  add(def(F.DIRT_PATCH, 'dirt patch', 'decal', [proc(16, 16, (put, s) => { const r = rnd(s); for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) if (Math.hypot(x - 8, y - 8) < 5.5 + r() * 1.5) put(x, y, r() < 0.2 ? 'k' : 'q'); }, 21)], [0, 0], ['grass', 'meadow'], 'wear', ['#9a7a58', '#6a5a4a']));
  // ---- MARSH / WETLAND ----
  add(def(F.CATTAIL, 'cattail', 'object', [pat(['....q.....', '....j.....', '....j..d..', '.d..j..d..', '.d..d.d...', '..d.d.d...', '..d.dd....', '...dd.....', '...d......', '...d......']), pat(['......q...', '......j...', '.e....j...', '.d....d...', '..d...d.e.', '..d..d.d..', '...d.d.d..', '....dd....', '....d.....'])], [3, -4], ['marsh'], 'water-adjacent banks', ['#4a2e1a', '#4c863a']));
  add(def(F.REED_CLUMP, 'reed clump', 'object', [pat(['.i..i.i.', 'i.i.i.i.', '.i.ii.i.', '..iii...', '...ii...'])], [4, 0], ['marsh', 'shore'], 'wet margins (visual only; harvestable reeds are catalog sources)', ['#6a8a4e']));
  add(def(F.DEAD_REED, 'dead reeds', 'object', [pat(['n..n....', '.n.n..n.', '.nn...n.', '..n..n..', '..n.n...', '..nn....'])], [4, 0], ['marsh', 'toxic'], 'drier marsh ground', ['#c4aa74']));
  add(def(F.LILYPAD, 'lily pads', 'decal', [pat(['....ddd.....', '...ddedd....', '...dd.dd..dd', '....ddd..ded', '.........dd.'], false)], [2, 4], ['lake'], 'still lake water only (ring8 all water)', ['#4c863a', '#76b24e']));
  add(def(F.PUDDLE, 'puddle', 'decal', [proc(16, 12, (put, s) => { const r = rnd(s); for (let y = 2; y < 10; y++) for (let x = 2; x < 14; x++) if (Math.hypot((x - 8) / 1.5, y - 6) < 3.2 + r() * .8) put(x, y, (x + y) % 7 === 0 ? 'V' : 'W'); }, 31)], [0, 4], ['marsh'], 'pools where the wet field is high', ['#2e6ea0', '#4a90c0']));
  add(def(F.MUD_CRACK, 'mud cracks', 'decal', [pat(['L....L..........', '.L..L...L.......', '..LL.....L......', '..L.......LL....', '.L..LLL.....L...', 'L..L...L........', '......L.........'], false)], [0, 4], ['marsh', 'toxic'], 'dry marsh micro detail', ['#4a3e2a']));
  // ---- ROCKY / HILLS ----
  add(def(F.PEBBLES, 'pebbles', 'decal', [scatter(16, 16, 7, ['s', 't', 'u'], 41, 2), scatter(16, 16, 5, ['s', 'u'], 42, 2)], [0, 0], ['hill', 'grass', 'sand'], 'micro', ['#6e6a66', '#9a9690']));
  add(def(F.SMALL_BOULDER, 'small boulder', 'object', [pat(['....tttt....', '..ttuuutts..', '.ttuuttttss.', '.tttttsssss.', '.sssssrrrrs.', '..rrrrrrrr..']), pat(['...ttt....', '..tuutts..', '.ttttssss.', '.sssrrrrs.', '..rrrrr...'])], [2, 2], ['hill', 'snow', 'coast'], 'step-over stone (no collision); boulders that block are catalog sources', ['#7a7672', '#9a9690', '#4e4a48']));
  add(def(F.ROCK_CRACK, 'rock crack', 'decal', [pat(['v...............', '.v..............', '..vv............', '....v...v.......', '.....vvv.v......', '..........vv....', '............v...'], false)], [0, 0], ['hill', 'cliff'], 'geological micro detail', ['#3a3634']));
  add(def(F.SCREE, 'scree band', 'decal', [scatter(16, 16, 18, ['r', 's', 'y', 'v'], 51, 1), scatter(16, 16, 12, ['s', 't', 'r'], 52, 2)], [0, 0], ['hill'], 'rock field where rockField > 0.6', ['#4e4a48', '#6e6a66']));
  add(def(F.DRY_TUFT, 'dry grass tuft', 'object', [pat(['n..o.n..', '.n.non.n', '.nonon..', '..nnn...'])], [4, 2], ['steppe', 'desert'], 'dry ground', ['#c4aa74', '#dcc68e']));
  // ---- COAST ----
  add(def(F.SHELL, 'shells', 'decal', [pat(['..p.........', '.pJp....J...', '..p....JpJ..', '........J...', '.....p......'], false)], [2, 6], ['coast'], 'beach micro', ['#f2e4b4', '#d8d0c0']));
  add(def(F.DRIFTWOOD, 'driftwood', 'object', [pat(['..........xx......', '.xxwwwwwwwwwwx....', 'xwwwkkwwwwwwwwwx..', '.xxxxxxxxxxxxxx...', '......w......w....']), pat(['.xxwwwwwwx....', 'xwwwwkwwwwx...', '.xxxxxxxxx....'])], [-1, 4], ['coast'], 'tide line', ['#8a7a62', '#a8987c']));
  add(def(F.DUNE_GRASS, 'dune grass', 'object', [pat(['i...i..i', '.i.i.i.i', '.i.iii..', '..iii...', '...i....', '...i....'])], [4, 0], ['coast', 'sand'], 'dune stabiliser clumps', ['#6a8a4e']));
  add(def(F.WET_SAND, 'wet sand', 'decal', [proc(16, 16, (put, s) => { const r = rnd(s); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (r() < 0.35) put(x, y, 'n'); }, 61)], [0, 0], ['coast'], 'darkened band within 1.2 AU of the GOLD coastline', ['#c4aa74']));
  add(def(F.KELP, 'kelp', 'decal', [pat(['.g.', 'g.g', '.g.'], false)], [6, 6], ['sea'], 'unused (reserved)', ['#2e4a2a']));
  // ---- SNOW ----
  add(def(F.SNOW_DRIFT, 'snow drift', 'decal', [proc(16, 10, (put, s) => { const r = rnd(s); for (let y = 2; y < 9; y++) for (let x = 1; x < 15; x++) if (Math.hypot((x - 8) / 1.8, (y - 6)) < 2.6 + r() * .6) put(x, y, y < 5 ? 'U' : 'S'); }, 71)], [0, 6], ['snow'], 'wind-blown drift', ['#ffffff', '#e6eef6']));
  add(def(F.FROSTED_SHRUB, 'frosted shrub', 'object', [pat(['...SbS....', '..SbbbTS..', '.SbSbbbbS.', '..bbbSbb..', '...Tbb....', '....l.....'])], [3, 0], ['snow', 'cold forest'], 'cold-transition understory', ['#e6eef6', '#33662a']));
  add(def(F.ICE_SHARD, 'ice shards', 'object', [pat(['....T...', '...TUT..', '...TUT.T', '..TUUTTU', '..TTTTTT'])], [4, 2], ['snow'], 'frozen ground', ['#b8c8dc', '#ffffff']));
  // ---- VOLCANIC ASH ----
  add(def(F.CINDER_ROCK, 'cinder rock', 'object', [pat(['...BBBB...', '..BAABBAB.', '.BAACBAAAB', '.BAAAAAAB.', '..AAAAAA..']), pat(['..BBB...', '.BAACAB.', '.BAAAAB.', '..AAAA..'])], [3, 2], ['ash'], 'scoria blocks with ember glints', ['#5e5458', '#2e2a2c', '#c0501e']));
  add(def(F.EMBER_CRACK, 'ember crack', 'decal', [pat(['................', '..C.............', '...CD...........', '....C.C.........', '.....CDC........', '.......C.C......', '.........CDC....', '...........C....'], false)], [0, 0], ['ash'], 'glowing fissure (visual only, no damage)', ['#c0501e', '#ff7a2a']));
  add(def(F.ASH_MOUND, 'ash mound', 'decal', [proc(16, 10, (put, s) => { const r = rnd(s); for (let y = 2; y < 9; y++) for (let x = 1; x < 15; x++) if (Math.hypot((x - 8) / 1.8, (y - 6)) < 2.6 + r() * .6) put(x, y, r() < 0.3 ? 'A' : 'B'); }, 81)], [0, 6], ['ash'], 'wind-piled ash', ['#5e5458', '#2e2a2c']));
  // ---- TOXIC ----
  add(def(F.DEAD_SHRUB, 'dead shrub', 'object', [pat(['k..k.k..', '.k.kk.k.', '..kkk.k.', '...kkk..', '....k...', '....k...'])], [4, 0], ['toxic', 'ash'], 'leafless scrub', ['#6a5a4a']));
  add(def(F.SLICK, 'toxic slick', 'decal', [proc(16, 12, (put, s) => { const r = rnd(s); for (let y = 2; y < 10; y++) for (let x = 2; x < 14; x++) if (Math.hypot((x - 8) / 1.6, y - 6) < 3 + r() * .8) put(x, y, (x * 3 + y) % 5 === 0 ? 'Y' : 'X'); }, 91)], [0, 4], ['toxic'], 'surface sheen (visual only; hazard law stays Gameplay)', ['#8a9040', '#a8b840']));
  add(def(F.BONES, 'bones', 'decal', [pat(['.J..........', '.JJJJJJJ....', '.J..J..J....', '........JJJ.', '.......J..J.'], false)], [2, 6], ['toxic', 'ash', 'desert'], 'storytelling micro', ['#d8d0c0']));
  // ---- POI SITE ENVELOPE ----
  add(def(F.RUBBLE, 'rubble', 'object', [pat(['....ss.t....', '..ttsuuss...', '.sstsstssts.', '.rssrrsrrss.', '..rrr..rr...']), pat(['..sst....', '.tsuuss..', '.rrsrrss.', '..rr..r..'])], [2, 2], ['poi'], 'envelope edge of ruin/military archetypes', ['#6e6a66', '#9a9690', '#4e4a48']));
  add(def(F.FOUNDATION, 'foundation line', 'decal', [pat(['sssssssssssssss.', 's.............s.', 's.............s.', 's.............s.', 'sss.........sss.'], false)], [0, 4], ['poi'], 'interior of envelopes: wall footings without inventing walls', ['#6e6a66']));
  add(def(F.WORN_GROUND, 'worn ground', 'decal', [proc(16, 16, (put, s) => { const r = rnd(s); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (r() < 0.45) put(x, y, r() < 0.3 ? 'k' : 'q'); }, 101)], [0, 0], ['poi'], 'trampled site ground', ['#9a7a58', '#6a5a4a']));
  add(def(F.POST_STUB, 'post stub', 'object', [pat(['..ll..', '..jl..', '..jl..', '.mjlm.', '.mmmm.'])], [5, 6], ['poi'], 'fence/palisade remnant at the envelope edge', ['#8a6038', '#4a2e1a']));
  add(def(F.CRATE_DEBRIS, 'crate debris', 'object', [pat(['.qqqqqqq..', '.qnqnqnq..', '.qqqqqqq..', 'jqnqnqnqj.', 'jqqqqqqqj.', '.jjjjjjj..']), pat(['..qqqqq...', '..qnqnq...', '.jqqqqqj..', '.jjjjjjj..'])], [3, 2], ['poi industrial'], 'industrial/port/mining archetypes (visual; no loot)', ['#9a7a58', '#c4aa74', '#4a2e1a']));
  // ---- ROAD ----
  add(def(F.RUT, 'cart ruts', 'decal', [pat(['..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..', '..k..........k..'], false)], [0, 0], ['road'], 'wear on authored cart roads', ['#6a5a4a']));
  add(def(F.MILESTONE, 'milestone', 'object', [pat(['..uu..', '.utuu.', '.ussu.', '.utsu.', '.ussu.', '.rrrr.'])], [5, 2], ['road'], 'roadside marker (no text, no function)', ['#9a9690', '#7a7672']));
  add(def(F.ROADSIDE_GRASS, 'roadside grass', 'object', [pat(['.d.d.d..', 'd.ded.d.', '.ddd.d..'])], [4, 3], ['road margin'], 'verges', ['#4c863a', '#76b24e']));
  KIT = m; return m;
}
/** Inventory for the handoff (no canvas needed). */
export const DECOR_INVENTORY = () => [...decorKit().values()].map(a => ({ code: a.code, name: a.name, layer: a.layer, px: `${a.w}x${a.h}`, variants: a.variants.length, anchor: a.anchor, solid: a.solid, harvestable: a.harvestable, biomes: a.biomes, rule: a.rule, palette: a.palette, provenance: 'original pixel art, this reconstruction (pattern strings in src/veyra05/art-nature.ts)' }));
