#!/usr/bin/env node
// MAP-GEO-02 step 2: explicit, reproducible ownership-correction OVERLAY.
// MAP-GEO-01's accepted geography.v1.json is left byte-for-byte unchanged;
// its stale owner strings are listed here and superseded, not silently edited.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const GEO01 = path.resolve(ROOT, '../geo01/output');
const OUT = path.join(ROOT, 'output');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

const MAP_FIELDS = [
  { field: 'pois[].rooms', note: 'Physical rooms / working-space allocation.' },
  { field: 'pois[].entrances', note: 'Physical entrance openings in the shell.' },
  { field: 'pois[].passages', note: 'Physical passages between spaces.' },
  { field: 'pois[].doorOpenings', note: 'The OPENING is geometry; the lock/key/power state is Gameplay.' },
  { field: 'pois[].interiorCirculation', note: 'Physical circulation / approach / interior paths.' },
  { field: 'pois[].spatialSockets', note: 'Physical placement geometry only; functional assignment is Gameplay.' },
  { field: 'pois[].retreatPaths', note: 'Physical retreat geometry; retreat decisions are Gameplay.' },
  { field: 'pois[].footprint', note: 'Site boundary (foot / deep), not an interior layout.' },
  { field: 'criticalPaths.geometry', note: 'Contiguous path geometry; protection policy is Gameplay.' },
];
const GAMEPLAY_FIELDS = [
  'pois[].doors.lockedState', 'pois[].doors.keyCondition', 'pois[].doors.powerCondition',
  'pois[].powerNodes', 'pois[].hazardIntensity', 'pois[].hazardCells',
  'pois[].exteriorLootSites', 'pois[].interiorLootSites', 'pois[].interactions',
  'pois[].interactiveMachinery', 'pois[].furnaceRecipes', 'criticalPaths.protectionPolicy',
  'cargoPassable', 'passabilityRules', 'survivabilityRules',
];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const geoBuf = fs.readFileSync(path.join(GEO01, 'geography.v1.json'));
  const contractBuf = fs.readFileSync(path.join(GEO01, 'contract_boundary.v1.json'));
  const geo = JSON.parse(geoBuf.toString('utf8'));
  const contract = JSON.parse(contractBuf.toString('utf8'));
  const pois = geo.topology.pois.pois || geo.topology.pois.records;

  const stale = [];
  for (const p of pois) {
    const s = p.spatial || {};
    if (s.rooms && s.rooms.owner === 'Gameplay / level design') stale.push({ poiId: p.id, path: 'topology.pois.pois[].spatial.rooms.owner', staleOwner: s.rooms.owner });
    if (s.entrances && s.entrances.status === 'NOT_IN_SOURCE') stale.push({ poiId: p.id, path: 'topology.pois.pois[].spatial.entrances', staleOwner: 'UNSPECIFIED (MAP-GEO-01 docs said Gameplay-owned)' });
    if (s.circulation && s.circulation.status === 'UNDEFINED') stale.push({ poiId: p.id, path: 'topology.pois.pois[].spatial.circulation', staleOwner: 'UNSPECIFIED (MAP-GEO-01 docs said Gameplay-owned)' });
  }

  const out = {
    schema: 'soh.map.geo02.ownership_correction.v1',
    generatedBy: 'world_lab/geo02/src/ownership.mjs',
    rule: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
    supersedes: 'MAP-GEO-01 contract_boundary.v1.json / CONTRACT_DELTA.md (CD-04) / GEOGRAPHY_HANDOFF.md section 6',
    statusIsNotOwner: 'NOT_IN_SOURCE / UNDEFINED describes the current state of Veyra data; it NEVER transfers ownership to Gameplay.',
    correctedClassification: 'MAP_RESPONSIBILITY_NOT_IN_SOURCE',
    sourceInputs: {
      geographyExport: { file: '../geo01/output/geography.v1.json', bytes: geoBuf.length, sha256: sha(geoBuf), note: 'READ ONLY — not rewritten, not rescaled, not merged' },
      contractBoundary: { file: '../geo01/output/contract_boundary.v1.json', bytes: contractBuf.length, sha256: sha(contractBuf), ownershipCorrection: contract.ownershipCorrection },
    },
    mapOwns: MAP_FIELDS,
    gameplayOwns: GAMEPLAY_FIELDS,
    staleOwnerOccurrences: { count: stale.length, poiCount: pois.length, items: stale },
    geo02Deliverable: {
      file: 'output/poi_po_kilns.proposed.v1.json',
      status: 'PROPOSED',
      canonical: false,
      scope: 'po_kilns ONLY',
      content: 'physical footprint, approach, entrance options, interior working-space allocation, circulation, retreat',
      excluded: ['furnace recipes', 'loot', 'locks', 'power', 'interactive machinery', 'runtime merge', 'Gameplay population'],
    },
    noRuntimeMerge: true,
    noGameplayPopulation: true,
    noCanonicalRewrite: true,
  };
  json(path.join(OUT, 'ownership_correction.v1.json'), out);
  console.log(`OWNERSHIP_OK stale=${stale.length} pois=${pois.length} mapFields=${MAP_FIELDS.length} gameplayFields=${GAMEPLAY_FIELDS.length}`);
}
main();
