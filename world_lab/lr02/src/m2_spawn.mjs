// MAP-LR02 M2 — full-world geography-only spawn / build eligibility package.
import path from 'node:path';
import { OUT, CONST, loadLr01, loadSources, writeRevisionPackage, sourceHeader } from './lib/lr02.mjs';
import { compileEligibility } from './lib/spawn_eligibility.mjs';

const lr = loadLr01();
const src = loadSources();
const eligibility = compileEligibility({ I: src.I, P: src.P, V: src.V, GEO: src.GEO }, lr);

const body = {
  ...eligibility,
  version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m2_spawn.mjs',
  parent: { ...sourceHeader().parent, geographyFile: 'world_lab/lr01/output/geography.v1.json', buildSitesFile: 'world_lab/lr01/output/build_sites.v1.json', regionExports: 41 },
  source: { ...sourceHeader(), canonSha256: src.V.fingerprint.sha256, sourceRasterLayers: 21, note: 'GEO-01 250x175 uint8 rasters + canonical Veyra GOLD vectors; full 2000x1400 frame retained.' },
  status: 'DERIVED_STATIC_ELIGIBILITY__NOT_RUNTIME_SPAWN_AUTHORITY',
  compatibility: {
    gameplayHeadObserved: CONST.gameplayLr02HeadObserved,
    finding: 'CMP-05: Gameplay projection currently uses internal compiler reachability anchors and returns starts: []. No reader exists for this contract yet.',
    owner: 'GAMEPLAY',
    transformStatus: 'UNDECIDED',
    note: 'Cell indices are in the global 8au source grid. A consumer must apply its own approved originAu/U before sampling runtime tiles.',
  },
};

const digest = writeRevisionPackage(path.join(OUT, 'spawn_eligibility.v1.json'), body);
const envStatus = {};
for (const s of body.buildSiteEnvelopes) envStatus[s.geometricEnvelopeStatus] = (envStatus[s.geometricEnvelopeStatus] || 0) + 1;
console.log(`M2_SPAWN_ELIGIBILITY_OK candidateRegions=${eligibility.candidateRegions.length} landmasses=${eligibility.coverage.distinctLandmasses} eligibleCells=${eligibility.coverage.staticallyEligibleCells}/${eligibility.coverage.totalLandCells}`);
console.log(`  buildSiteEnvelopes=${body.buildSiteEnvelopes.length} statuses=${JSON.stringify(envStatus)} unknowns=${body.criteria.unknownConditions.length}`);
console.log(`  revisionDigest=${digest}`);
