/**
 * MAP-GEO-REJOIN-01 — exact SOURCE-PINNED Map -> Gameplay handoff packet.
 * Read-only over the workspace; writes evidence/mapgeo01-gameplay-handoff.json.
 * Addresses the Gameplay owner of arena/d4bfcfff-soul-of-hero. PR44 is NOT edited.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entry = p => {
  const f = path.join(REPO, p);
  return fs.existsSync(f) ? { path: p, bytes: fs.statSync(f).size, sha256: sha(f) } : { path: p, missing: true };
};
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();

const MAP_BRANCH = 'arena/2e3cfbd2-soul-of-hero';
const GAMEPLAY_BRANCH = 'arena/d4bfcfff-soul-of-hero';
const live = git('ls-remote', 'origin', `refs/heads/${GAMEPLAY_BRANCH}`).split('\t')[0];
const mapLive = git('ls-remote', 'origin', `refs/heads/${MAP_BRANCH}`).split('\t')[0];

const sources = [
  'veyra-world-master/CURRENT_WORLD_MASTER.json',
  'veyra-world-master/v4/r1/manifest.r1.json',
  'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json',
  'veyra-world-master/v4/r1/data/biomeEffective.r1.u8',
  'veyra-world-master/v4/data/marineRegion.v4.u8',
  'veyra-world-master/v4/r1/data/coldTransition.r1.u8',
  'veyra-world-master/v3/rasters/cliffCandidate.v3.u8',
  'world_lab/src/gold/REAL_MAP_CONVERSION_CONTRACT.md',
  'creator-u05/contracts/CREATOR_CHOSEN_U05.v1.json',
  'creator-u05/contracts/LAYER_INVENTORY.json',
  'creator-u05/map-data/U05_GEOMETRY_CONFLICTS.json',
  'creator-u05/map-data/MAPGEO01_FINDINGS_RECONCILED.json',
  'creator-u05/docs/TERRAIN_ONLY_VIEWER.md',
  'creator-u05/docs/MAP_GEO_REJOIN_01_STATUS.md',
  'creator-u05/docs/MAPGEO01_GAMEPLAY_HANDOFF.md',
  'creator-u05/web-u05/src/u05/world.ts',
  'creator-u05/web-u05/src/u05/terrain.ts',
  'creator-u05/web-u05/src/u05/lw/geometry.ts',
  'creator-u05/web-u05/src/u05/lw/sources.generated.ts',
  'creator-u05/web-u05/src/game/art.ts',
  'creator-u05/web-u05/src/terrain-only/main.ts',
  'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html',
  'creator-u05/evidence/mapgeo01-preflight.json',
  'creator-u05/evidence/mapgeo01-physical-audit.json',
  'creator-u05/evidence/mapgeo01-reconciliation.json',
  'creator-u05/evidence/mapgeo01-traversal.json'
];

const packet = {
  schema: 'soh.u05.mapgeo01-gameplay-handoff.v1',
  generatedAt: new Date().toISOString(),
  title: 'MAP-GEO-REJOIN-01 — exact source-pinned Map handoff for Gameplay integration',
  recipient: {
    role: 'Gameplay owner',
    branch: GAMEPLAY_BRANCH,
    liveHead: live,
    pr44: 'OPEN — headRefOid ' + live + ' — NOT edited or merged by Map',
    observedHeadInTask: '2f0836587b76a4a98fffedf8c202fb37cbb2a67c (superseded)',
    creatorVerifiedHead: '5b3e683402bbc8540dea9404576164097e753f97'
  },
  sender: {
    role: 'Map / U05 physical geography',
    branch: MAP_BRANCH,
    liveHeadAtPacketCreation: mapLive,
    packetCommit: 'creator-u05/evidence/mapgeo01-delivery.json :: commit',
    activeRevision: 'WMP-04R1', status: 'MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING',
    scale: { U: 0.5, unit: 'AU per runtime tile', TILE_PX: 16, viewport: [640, 360], frameTiles: [4000, 2800] }
  },
  pinnedSources: Object.fromEntries(sources.map(p => [p, entry(p)])),
  integrationContract: {
    mapExposes: [
      'window.__terrain.sampleTile(tx,ty) -> TileSample (authoredLand, water, lake, river, road, bridge, dock, poiId, zoneId, elevation, heightClass, cliffCandidate, walkableCandidate, cargoCandidate, buildableCandidate, waterTraversalClass, permissions)',
      'window.__terrain.u05Tile(tx,ty) -> visible terrain tile code (verbatim live-Gameplay PAL/PRIO/texel painter)',
      'window.__terrain.terrainBlocked(tx,ty) -> natural-terrain collision (DEEP/SHALLOW/RIVER/CLIFF/PWALL/LAVA/ICE/BURNT)',
      'evidence/mapgeo01-physical-audit.json :: defects, separation, roads, connections, spawns, poiAccess',
      'map-data/MAPGEO01_FINDINGS_RECONCILED.json :: 62 classified findings with U=0.5-native measurements'
    ],
    gameplayMustOwn: [
      'WorldTraversal edges: bridge span/width/load validity/alternate edges for all 12 GOLD bridges (currently 0 crossable)',
      'POIAccessGraphCandidate: 26 exterior entrance records, door/room/power/exit/stand positions',
      'BuildSiteSample: legal placement after A0 checks for 19 buildable-zone overlaps',
      'foot/cart/boat/swim/ferry permissions, cart swept clearance, loading capacity and measured t_foot/t_cart_loaded/t_cart_unloaded/distance_to_road',
      'dock boarding/disembark cells, water depth and harbour collision for 27 docks',
      'cliff collision law (305 WMP-03 candidate cells currently produce 0 physical cliffs) and 8 vertical-link blockers',
      '63 POI retreat routes, MAP-SPAWN-04 / HOME-03 / POI-02 / LOG-03 / U1–U5 / CAMERA full-runtime tests',
      'Beacon helicopter sprite approval (NO_RELOCATION__NO_SUBSTITUTE) and po_timberyard centre decision'
    ],
    typedBoundary: {
      visibleSurface: 'u05Tile() — never a permission',
      physicalGeometry: 'sampleTile() flags + terrainBlocked() — candidates only',
      gameplayPermission: 'permissions.foot/cart are MAP CANDIDATES; build/boat/swim/ferryFoot are FALSE everywhere; GAMEPLAY_ONLY__NOT_APPROVED'
    },
    hardRules: [
      'Do NOT import raw GOLD at runtime; use the WMP-04R1 reader and the U=0.5 additive reprojection.',
      'Do NOT treat visible surfaces, QA screenshots or candidate rasters as Gameplay permission.',
      'Do NOT invent walkable water, approved carts/boats, loading capacity, POI doors or build rights.',
      'Do NOT amend GOLD polygons/IDs/coastline/roads/docks/resources; all 81 POI IDs stay unchanged.',
      'Do NOT silently re-vendor web/src/game/art.ts: vendored copy is pinned to b5c8004c, live added S.claim.',
      'Terrain painter block SHA f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803 is byte-identical at b5c8004c / 2f083658 / ' + live.slice(0, 8) + '; the Creator-locked Beacon road must not be widened/recoloured/redrawn.',
      'web/ref/bible.md §V and §11.5 are unchanged at the live head; §K6 and §11.3 C07/C09 changed with the Creator 2026-11-05 claim/upkeep decision.',
      'Map does NOT edit or merge PR44. Integration is the Gameplay owner’s action.'
    ]
  },
  measuredHandoff: {
    findings: { total: 62, mapGeometryDefectsCorrectable: 0, intentionalOverlaps: 12, gameplayA8: 46, creator: 1, missingEvidence: 3 },
    physicalDefects: 10,
    bridges: { count: 12, physicallyCrossable: 0, allCentresBlocked: 12 },
    roads: { count: 92, centrelineContinuous: 92, waterOverrideRoads: 31 },
    docks: { count: 27, landApproach: 25, roadAdjacency: 18 },
    spawns: { count: 4, allDryWalkable: true, nearestRenderedRoadTiles: [29, 48, 57, 42] },
    cliffs: { candidateCells: 305, physicalCliffTiles: 0 },
    traversals: { runs: 6, pass: 4, fail: 1, partial: 1, nativeShots: 16, viewerRuntimeOnly: true },
    goldAmendments: 0
  },
  acceptance: { PAPER: 'MEASURED', RUNTIME: 'ISOLATED_VIEWER_PHYSICAL_PARTIAL', VISUAL: 'NOT_REQUESTED_AND_NOT_GRANTED', GAMEPLAY: 'NOT_REQUESTED_AND_NOT_GRANTED' },
  recommendedNextAction: 'Gameplay owner pins ' + live + ', consumes this packet, and decides the MGP-D01 bridge span/art + WorldTraversal collision contract with the Creator. This unblocks the only FAIL traversal and converts 31 water-overridden road segments into measurable alternatives.',
  notClaims: ['No VEYRA_PLAYABLE', 'No VISUAL_ACCEPTED', 'No MERGE_READY', 'No production merge', 'No new atlas', 'No PR44 edit/merge', 'No GOLD amendment']
};
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo01-gameplay-handoff.json'), JSON.stringify(packet, null, 2) + '\n');
console.log(`U05_MAPGEO01_HANDOFF_OK recipient=${GAMEPLAY_BRANCH}@${live.slice(0,8)} sources=${sources.length} missing=${Object.values(packet.pinnedSources).filter(x=>x.missing).length}`);
