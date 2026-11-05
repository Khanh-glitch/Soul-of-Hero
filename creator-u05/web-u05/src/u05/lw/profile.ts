/**
 * LW-01 explicit dimension profiles. There is NO global WW/WH constant in this
 * path: every consumer takes `profile.w` / `profile.h` and uses `index(p,x,y)`.
 *
 * 10x LINEAR = 100x CELLS. 200x200 = 40,000; 2,000x2,000 = 4,000,000.
 * The real WMP-04R1 Veyra frame at U=1 is 2,000x1,400 = 2,800,000 cells and is
 * NOT square. No 600 rows of fabricated land are added.
 */
import { LW_SOURCES } from './sources.generated';

export type ProfileKind = 'CAPACITY_FIXTURE' | 'AUTHORED_VEYRA';
export interface WorldProfile {
  id: string;
  label: string;
  kind: ProfileKind;
  /** Runtime tiles, not analytical cells. */
  w: number; h: number;
  /** Authoring units per runtime tile. */
  U: number;
  /** Authoring frame (AU) that this profile represents. */
  frameAu: [number, number];
  chunkSize: number;
  maxResidentChunks: number;
  simRadiusChunks: number;
  sourceRevision: string;
  boundedPilot?: string;
  note: string;
}

export const CHUNK = 32;
export const PROFILES: readonly WorldProfile[] = [
  {
    id: 'capacity-2000x2000',
    label: 'ENGINE CAPACITY 2,000 × 2,000 (synthetic, NON-CANON)',
    kind: 'CAPACITY_FIXTURE', w: 2000, h: 2000, U: 1,
    frameAu: [2000, 2000], chunkSize: CHUNK, maxResidentChunks: 36, simRadiusChunks: 2,
    sourceRevision: 'NONE__RUNTIME_CAPACITY_FIXTURE',
    note: 'Generic engine-capacity fixture. Deterministic synthetic terrain only; explicitly NOT Veyra canon and NOT explorable authored land.',
  },
  {
    id: 'veyra-u2',
    label: 'VEYRA U=2 (prior diagnostic, 1,000 × 700)',
    kind: 'AUTHORED_VEYRA', w: 1000, h: 700, U: 2,
    frameAu: [2000, 1400], chunkSize: CHUNK, maxResidentChunks: 36, simRadiusChunks: 2,
    sourceRevision: 'WMP-04R1',
    note: 'Prior WMP-04R1 diagnostic scale. U=2 is NOT an approved final scale.',
  },
  {
    id: 'veyra-u1',
    label: 'VEYRA U=1 (primary candidate, 2,000 × 1,400)',
    kind: 'AUTHORED_VEYRA', w: 2000, h: 1400, U: 1,
    frameAu: [2000, 1400], chunkSize: CHUNK, maxResidentChunks: 36, simRadiusChunks: 2,
    sourceRevision: 'WMP-04R1',
    note: 'Primary U=1 test candidate. Full authored WMP-04R1 frame, no padded rows, no fabricated land.',
  },
  {
    id: 'beacon-u05',
    label: 'BEACON U=0.5 (bounded pilot, 4,000 × 2,800)',
    kind: 'AUTHORED_VEYRA', w: 4000, h: 2800, U: 0.5,
    frameAu: [2000, 1400], chunkSize: CHUNK, maxResidentChunks: 36, simRadiusChunks: 2,
    sourceRevision: 'WMP-04R1',
    boundedPilot: 'BEACON_ONLY__LAZY_CHUNKS_AROUND_BEACON',
    note: 'Bounded scale triage only: profile dimensions are real, but ONLY the Beacon scene is exercised here. Full 4,000×2,800 traversal / streaming is NOT claimed.',
  },
];
export const DEFAULT_PROFILE = 'veyra-u1';
export const profileById = (id: string): WorldProfile => PROFILES.find(p => p.id === id) || PROFILES.find(p => p.id === DEFAULT_PROFILE)!;

/** Authored scene anchors in GOLD authoring units (NOT tile coords). */
export interface SceneAnchor {
  id: string; label: string; atAu: [number, number];
  poiIds: string[]; note: string; helicopter?: boolean;
}
export const SCENES: readonly SceneAnchor[] = [
  { id: 'beacon', label: 'Beacon Rock shore / dock / lighthouse / helicopter site', atAu: [272, 652], poiIds: ['po_beacon'], helicopter: true,
    note: 'Helicopter landmark OBJECT PROVEN MISSING in Gameplay e11a9b44; only the authored POI and location are shown.' },
  { id: 'village', label: 'Mainland village & cart road (Greywater / Mossbrook)', atAu: [1002, 730], poiIds: ['po_mill', 'po_confluence', 'po_greywater'], note: 'Authored road centrelines + POI footprints sampled at tile centres.' },
  { id: 'snow', label: 'Typhon–Kestrel snowy / rocky highlands', atAu: [640, 320], poiIds: ['po_kestrel', 'po_typhon'], note: 'WMP-04R1 effective snow biome + restored rock (510 cells) + cold-transition class. Anchor chosen where both snow and rock are visible in one 640x360 view.' },
  { id: 'shore', label: 'Cinder geothermal sea / shore', atAu: [1380, 760], poiIds: [], note: 'Real GOLD coastline and static marine region; no damage/boat permission.' },
  { id: 'westmouth', label: 'Westmouth shore & port', atAu: [352, 556], poiIds: ['po_westmouth'], note: 'Mainland coast, authored dock.' },
];
export const sceneById = (id: string): SceneAnchor => SCENES.find(s => s.id === id) || SCENES[0];

export const SOURCE = {
  activeRevision: LW_SOURCES.activeRevision,
  activeManifest: LW_SOURCES.activeManifest,
  basePhysicalRevision: LW_SOURCES.basePhysicalRevision,
  mapHead: LW_SOURCES.mapHead,
  gameplayHead: LW_SOURCES.gameplayHead,
  analysisGrid: LW_SOURCES.analysisGrid,
  goldFrameAu: LW_SOURCES.goldFrameAu,
  rasterDigests: Object.fromEntries(Object.entries(LW_SOURCES.rasters).map(([k, v]: any) => [k, v.sha256])),
  manifestDigests: LW_SOURCES.manifestDigests,
  goldCounts: LW_SOURCES.goldCounts,
};
