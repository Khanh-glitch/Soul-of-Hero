/**
 * AUTHORED U=0.5 WINDOWS — first-hour exploration routes and representative biome /
 * POI-category slices. Each window is one live-engine world (200x200 tiles = 100x100 AU)
 * cut from the streamed frame at a fixed origin, so its identity is stable.
 * `focusAu` is a spawn BIAS region (legal spawn is still chosen by Gameplay's
 * chooseLegalSpawn with real collision/resource checks) — never a spawn grant.
 */
import { auToTile, windowAround, WINDOW_W, WINDOW_H, type WindowSpec } from './frame';

/** One canonical profile for the whole continuous VEYRA frame. The initial
 * bounded window is centred on Greywater / the lake region; it then slides
 * across the same GOLD frame as the player walks. It is not a second map. */
export const U05_WORLD_LAYOUT_ID = 'veyra05-world';
export const U05_WORLD_FOCUS_TILE: readonly [number, number] = [1624, 1184];
export const unifiedWorldWindow = (): WindowSpec => windowAround(U05_WORLD_FOCUS_TILE[0], U05_WORLD_FOCUS_TILE[1]);

export interface Veyra05Scene { id: string; short: string; focusAu: [number, number]; biome: string; category: string; description: string; firstHour: boolean; goldRefs: string[] }
export const VEYRA05_SCENES: readonly Veyra05Scene[] = [
  { id: 'veyra05-greywater', short: 'Greywater Hamlet', focusAu: [814, 574], biome: 'temperate meadow / lakeshore village', category: 'village (6 dwellings) · filter · bridges(neg)', firstHour: true, goldRefs: ['po_greywater', 'po_pumphouse', 'sp_lake', 'rd_9', 'br_3', 'br_a', 'bz_greywater'], description: 'Greywater Hamlet (6 inset dwellings, 6 roofs, 6 doors, courtyard) & lakeside road approach rd_9; two UNRESOLVED bridge nodes remain water.' },
  { id: 'veyra05-elderwood', short: 'Elderwood Forest', focusAu: [735, 685], biome: 'temperate forest (NATURE-02 window inside)', category: 'sawmill · grove', firstHour: true, goldRefs: ['po_sawaion', 'po_glade', 'NATURE-02 window [1392,1288,1488,1352)'], description: 'The NATURE-02 forest vertical slice lives inside this window: dense interior, glades and the road–forest edge composed as stands, not scatter.' },
  { id: 'veyra05-westmouth', short: 'Westmouth Shore', focusAu: [372, 590], biome: 'western coast / port', category: 'port (2 sheds) · evac · gate', firstHour: true, goldRefs: ['sp_west', 'po_westmouth', 'po_evac_west', 'po_dpier'], description: 'GOLD spawn sp_west. Coastal shelf, Westmouth harbour sheds, evacuation pad; wet-sand line, shells and driftwood along the real GOLD coastline.' },
  { id: 'veyra05-hook', short: 'Hook Peninsula', focusAu: [1290, 370], biome: 'peninsula meadow / lake Verdant shore', category: 'village (6 dwellings) · pier', firstHour: true, goldRefs: ['sp_hook', 'po_hook', 'po_mere'], description: 'GOLD spawn sp_hook. Hook village (6 dwellings) and Mere pier on the Verdant shore; open meadow with wildflower clearings.' },
  { id: 'veyra05-gulf', short: 'Gulf West Bank', focusAu: [905, 905], biome: 'gulf shore / marsh fringe', category: 'pier · filter · vendor', firstHour: true, goldRefs: ['sp_gulf', 'po_westbank', 'po_filter'], description: 'GOLD spawn sp_gulf. West bank pier and water settling filter at the mouth of the Delta Marsh.' },
  { id: 'veyra05-delta', short: 'Delta Marsh', focusAu: [985, 800], biome: 'marsh / wetland', category: 'smelter · mill · bridges(neg)', firstHour: false, goldRefs: ['po_kilns', 'po_mill', 'br_5', 'br_6', 'Delta Marsh label'], description: 'Representative wetland: cattail banks, pools, mud cracks, dead reeds; the kilns and mill sit on the drier levees.' },
  { id: 'veyra05-greyback', short: 'Greyback Range', focusAu: [475, 690], biome: 'rocky hills / quarry', category: 'quarry · hamlet', firstHour: false, goldRefs: ['po_greyquarry', 'po_westwood', 'Greyback Range label'], description: 'Representative rocky environment: scree bands, outcrops, cliff faces from the live WMP-04R1 cliff rule, quarry terrace and West Wood hamlet.' },
  { id: 'veyra05-cinder', short: 'Cinder Isle', focusAu: [1700, 865], biome: 'volcanic ash (hazard)', category: 'elder site · powerplant · mine', firstHour: false, goldRefs: ['po_surtur', 'po_geo', 'po_sulfur', 'el_surtur'], description: 'Representative hazardous environment: cinder rock, ember cracks, ash mounds and bones around the Surtur ritual arena, geothermal plant and sulfur mine.' },
  { id: 'veyra05-argus', short: 'Argus Highlands', focusAu: [970, 215], biome: 'highland / cold transition', category: 'research · observatory · facility · elder', firstHour: false, goldRefs: ['po_academy', 'po_observatory', 'po_hall_eyes', 'po_archive'], description: 'Four landmark POIs in one window: Argus Academy (4 wings), observatory, Hall of Eyes and the archive; frosted shrubs and drifts where the cold class rises.' },
  { id: 'veyra05-mirage', short: 'Mirage Dunes', focusAu: [650, 1000], biome: 'desert / oasis', category: 'village · elder site', firstHour: false, goldRefs: ['po_oasis', 'po_necropolis', 'Mirage Pool label'], description: 'Representative desert: dry tufts, bones, the Mirage Pool oasis village (6 dwellings) and the Necropolis ritual ring.' },
  { id: 'veyra05-slag', short: 'Slag Flats', focusAu: [1175, 995], biome: 'toxic flats (hazard)', category: 'smelter · port · evac', firstHour: false, goldRefs: ['po_slag', 'po_southfoot', 'po_evac_south'], description: 'Representative toxic environment: slicks, dead shrubs and industrial buildings at the smelter.' },
  { id: 'veyra05-saltwick', short: 'Saltwick Isle', focusAu: [1610, 340], biome: 'salt flats / island coast', category: 'port · quarry · hamlet · cache', firstHour: false, goldRefs: ['po_saltharbor', 'po_saltpans', 'po_racks', 'po_rc_salt', 'br_7'], description: 'Island slice with a port, salt pans, drying racks, Ragnarok cache bunker and one unresolved bridge node.' },
];
export const SCENE_IDS = VEYRA05_SCENES.map(s => s.id);
export const isVeyra05Layout = (id: string) => id.startsWith('veyra05-');
/** Layout id -> window spec. Authored scenes are fixed; `veyra05-at-<tx>-<ty>` is an inspector window at an explicit origin. */
export function windowForLayout(id: string): { win: WindowSpec; scene: Veyra05Scene | null } | null {
  if (id === U05_WORLD_LAYOUT_ID) return { win: unifiedWorldWindow(), scene: null };
  const scene = VEYRA05_SCENES.find(s => s.id === id);
  if (scene) { const [tx, ty] = auToTile(scene.focusAu[0], scene.focusAu[1]); return { win: windowAround(tx, ty), scene }; }
  const m = /^veyra05-at-(\d+)-(\d+)$/.exec(id);
  if (m) { const win = windowAround(+m[1] + WINDOW_W / 2, +m[2] + WINDOW_H / 2); return { win, scene: null }; }
  return null;
}
export const layoutIdAt = (originTx: number, originTy: number) => `veyra05-at-${originTx}-${originTy}`;
/** Inspector hand-over: `?play=veyra05-at-<tx>-<ty>` or `#play=...` (file:// safe). */
export function requestedLayout(): string | null {
  try {
    const q = new URLSearchParams(location.search).get('play');
    const h = location.hash.startsWith('#play=') ? decodeURIComponent(location.hash.slice(6).split('&')[0]) : null;
    const id = q || h;
    return id && isVeyra05Layout(id) && windowForLayout(id) ? id : null;
  } catch { return null; }
}
export function extraListedWindows(): { id: string; title: string; description: string }[] {
  const id = requestedLayout();
  if (id === U05_WORLD_LAYOUT_ID) return [];
  if (!id || VEYRA05_SCENES.some(s => s.id === id)) return [];
  const w = windowForLayout(id)!.win;
  return [{ id, title: `Veyra U=0.5 · window ${w.originTx},${w.originTy}`, description: `Inspector window at global tiles ${w.originTx},${w.originTy} (AU ${w.originTx / 2},${w.originTy / 2}); 200×200 tiles streamed from the frame.` }];
}
