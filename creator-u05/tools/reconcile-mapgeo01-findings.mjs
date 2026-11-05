/**
 * MAP-GEO-REJOIN-01 — RECONCILE THE 62 U05 GEOMETRY FINDINGS (read-only).
 *
 * MAP-OWNED CORRECTIONS APPLIED HERE ARE EVIDENCE-LAYER ONLY:
 *   C-01 remeasure every polygon finding at U=0.5 native tile centres
 *        (0.5 AU) using a UNION of shapes, replacing the 1 AU-cell / AU2
 *        approximations in the original register (which double-count
 *        overlapping POI+Elder cells inside one zone).
 *   C-02 classify all 62 findings into the 5 required categories with one
 *        owner, one severity and one decision each.
 *   C-03 publish a source-pinned provenance record. ZERO GOLD geometry
 *        amendments; no polygon is shrunk, relocated, expanded, recoloured
 *        or widened; no door/prop/building is generated.
 *
 * Inputs : creator-u05/map-data/U05_GEOMETRY_CONFLICTS.json (unchanged)
 *          veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json (read only)
 * Outputs: creator-u05/map-data/MAPGEO01_FINDINGS_RECONCILED.json
 *          creator-u05/evidence/mapgeo01-reconciliation.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const F = path.join(ROOT, 'map-data/U05_GEOMETRY_CONFLICTS.json');
const GOLD = path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const src = JSON.parse(fs.readFileSync(F, 'utf8'));
const G = JSON.parse(fs.readFileSync(GOLD, 'utf8')).project;
const pois = new Map(G.pois.map(p => [p.id, p]));
const zones = new Map(G.zones.map(z => [z.id, z]));
const elders = new Map(G.elders.map(e => [e.id, e]));

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** Count grid-cell centres inside `host` AND inside the UNION of `shapes`. */
function countCells(host, shapes, stepAu) {
  const xs = host.map(p => p[0]), ys = host.map(p => p[1]);
  for (const s of shapes) { xs.push(...s.map(p => p[0])); ys.push(...s.map(p => p[1])); }
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  let n = 0;
  for (let iy = 0; iy < Math.ceil((y1 - y0) / stepAu); iy++) {
    const y = y0 + (iy + 0.5) * stepAu;
    for (let ix = 0; ix < Math.ceil((x1 - x0) / stepAu); ix++) {
      const x = x0 + (ix + 0.5) * stepAu;
      if (!inside(host, x, y)) continue;
      for (const s of shapes) if (inside(s, x, y)) { n++; break; }
    }
  }
  return n;
}
const U = 0.5, TILES_PER_AU = 2;

const CLASS = {
  mapDefect: 'MAP_GEOMETRY_DEFECT__SOURCE_BACKED_CORRECTABLE',
  intentional: 'INTENTIONAL_OVERLAP_OR_HOST_SUBSITE',
  gameplay: 'GAMEPLAY_A8_SEMANTIC_DECISION',
  creator: 'CREATOR_DECISION_REQUIRED',
  noEvidence: 'MISSING_EVIDENCE'
};
const SEV = { mapDefect: 'HIGH', intentional: 'INFO', gameplay: 'HIGH', creator: 'MEDIUM', noEvidence: 'MEDIUM' };
const OWNER = {
  mapDefect: 'MAP_U05', intentional: 'MAP_U05 / CREATOR', gameplay: 'GAMEPLAY A8 / A0',
  creator: 'CREATOR / GAMEPLAY A8', noEvidence: 'GAMEPLAY / CREATOR'
};

function classify(kind) {
  switch (kind) {
    case 'POI_ENVELOPE_OVERLAP':
    case 'ROAD_CENTRELINE_ENTERS_POI_ENVELOPE': return 'intentional';
    case 'MISSING_EXTERIOR_ENTRANCE_RECORD':
    case 'BUILDABLE_SITE_OVERLAPS_POI_OR_ELDER':
    case 'MARINE_FOOT_PERMISSION': return 'gameplay';
    case 'HELICOPTER_VS_LIGHTHOUSE': return 'creator';
    case 'CART_SWEPT_CLEARANCE':
    case 'POI_RETREAT_POLYLINE':
    case 'VERTICAL_LINK_NAMED_BLOCKERS': return 'noEvidence';
    default: return 'noEvidence';
  }
}
const decisionFor = (k, cls) => ({
  mapDefect: 'Implement a source-backed U=0.5 derived-layer correction with before/after runtime evidence; do not amend GOLD.',
  intentional: 'Confirm host/subsite relationship in the Gameplay site registry. NO shrink / relocate / expand / door generation.',
  gameplay: 'Gameplay must author the semantic record (entrance / legal placement / marine permission). Map supplies candidate geometry only.',
  creator: 'Creator decision on the missing sprite / separation. NO_RELOCATION__NO_SUBSTITUTE remains in force.',
  noEvidence: 'Produce the missing source evidence or declare the interface GAMEPLAY_UNRESOLVED. No invented clearance / exit / vertical law.'
})[cls];

const items = src.items.map((raw, idx) => {
  const cls = classify(raw.kind);
  const rec = {
    index: idx + 1,
    id: `MG01-F${String(idx + 1).padStart(2, '0')}`,
    kind: raw.kind,
    sourceIds: raw.a ? [raw.a, raw.b] : raw.poiId ? [raw.poiId] : raw.zoneId ? [raw.zoneId] : raw.poiIds || raw.ids || [],
    original: { status: raw.status, owner: raw.owner, resolution: raw.resolution,
      measurement: raw.measureAu2 !== undefined ? { value: raw.measureAu2, unit: 'AU2' } :
        raw.measureTile2 !== undefined ? { value: raw.measureTile2, unit: 'tile2_analytic' } :
        raw.measureCells1Au !== undefined ? { value: raw.measureCells1Au, unit: 'cells_1AU' } :
        raw.measure !== undefined ? { value: raw.measure, unit: 'record_count' } :
        raw.measureAu !== undefined ? { value: raw.measureAu, unit: 'AU' } :
        raw.count !== undefined ? { value: raw.count, unit: 'count' } : { value: null, unit: 'none' } },
    classification: CLASS[cls], severity: SEV[cls], owner: OWNER[cls],
    decisionRequired: decisionFor(raw.kind, cls),
    mapGeometryCorrectionApplied: false,
    goldAmendment: false,
    u05Evidence: {}
  };

  if (raw.kind === 'POI_ENVELOPE_OVERLAP') {
    const a = pois.get(raw.a), b = pois.get(raw.b);
    const u05 = countCells(a.foot, [b.foot], U);
    const au1 = countCells(a.foot, [b.foot], 1);
    rec.u05Evidence = {
      method: 'exact GOLD foot polygon intersection at U=0.5 tile centres (0.5 AU step)',
      before: { analyticAu2: raw.measureAu2, analyticTile2: raw.measureTile2, cells1Au: au1 },
      after: { nativeTileCount: u05, unit: 'U=0.5 tiles' },
      deltaVsAnalyticTile2: +(u05 - raw.measureTile2).toFixed(2),
      hostArche: a.arche, subsiteArche: b.arche,
      hostAccess: a.access || null, subsiteAccess: b.access || null,
      relationshipEvidence: `${a.name} (${a.arche}) / ${b.name} (${b.arche}); foot envelopes overlap, GOLD IDs unchanged`
    };
  } else if (raw.kind === 'BUILDABLE_SITE_OVERLAPS_POI_OR_ELDER') {
    const zone = zones.get(raw.zoneId).ring;
    const shapes = [], members = [];
    for (const id of Object.keys(raw.poiCells || {})) {
      if (!pois.has(id)) continue; shapes.push(pois.get(id).foot); members.push({ id, kind: 'poi', cells1Au: raw.poiCells[id] });
    }
    for (const id of Object.keys(raw.elderCells || {})) {
      if (!elders.has(id)) continue; shapes.push(elders.get(id).outer); members.push({ id, kind: 'elder', cells1Au: raw.elderCells[id] });
    }
    const u05 = countCells(zone, shapes, U);
    const au1 = countCells(zone, shapes, 1);
    const naive4x = raw.measureCells1Au * 4;
    rec.u05Evidence = {
      method: 'zone ring ∩ UNION(POI foot / Elder outer) at exact U=0.5 tile centres; no double counting',
      before: { cells1Au: raw.measureCells1Au, unit: '1 AU cells (sum of per-object counts)', naive4xTileEstimate: naive4x,
        recomputedUnionCells1Au: au1, doubleCountedCells1Au: raw.measureCells1Au - au1 },
      after: { nativeTileCount: u05, unit: 'U=0.5 tiles' },
      deltaVsNaive4x: u05 - naive4x,
      members,
      zoneSoil: zones.get(raw.zoneId).soil, zoneSlope: zones.get(raw.zoneId).slope,
      note: 'Legal placement after A0 protection/collision/route/resource/dynamic occupancy checks is GAMEPLAY-owned. This remeasurement changes the EVIDENCE UNIT only.'
    };
  } else if (raw.kind === 'MISSING_EXTERIOR_ENTRANCE_RECORD') {
    const p = pois.get(raw.poiId);
    const u05 = p && p.foot ? countCells(p.foot, [p.foot], U) : 0;
    rec.u05Evidence = {
      footEnvelopeNativeTiles: u05, arche: p?.arche ?? null, gate: p?.gate ?? null,
      accessText: p?.access ?? null, hasRetreat: !!(p?.retreat || []).length,
      hasDeepPolygon: !!(p?.deep || []).length, explicitDoorRecord: false,
      note: 'GOLD provides a SITE ENVELOPE and a qualitative access string only. An exterior entrance/door is an A8 interaction record; no prop or door was generated.'
    };
  } else if (raw.kind === 'HELICOPTER_VS_LIGHTHOUSE') {
    rec.u05Evidence = { separationAu: raw.measureAu, separationTiles: +(raw.measureAu / U).toFixed(4),
      helicopterAtAu: raw.helicopterAtAu, lighthouseAtAu: raw.lighthouseAtAu,
      sprite: 'PROVEN_MISSING__NO_SUBSTITUTE__NO_RELOCATION' };
  } else if (raw.kind === 'ROAD_CENTRELINE_ENTERS_POI_ENVELOPE') {
    rec.u05Evidence = { distinctPois: raw.distinctPois, pairs: raw.pairs,
      schematicConnector: true, authoredEntrance: false,
      note: 'GOLD road centreline touches a GOLD foot envelope. Not an entrance; no road was moved, widened or recoloured.' };
  } else if (raw.kind === 'VERTICAL_LINK_NAMED_BLOCKERS') {
    rec.u05Evidence = { count: raw.count, blockerIds: raw.ids, verticalSeparationRule: 'NOT_AUTHORED' };
  } else if (raw.kind === 'POI_RETREAT_POLYLINE') {
    const withRetreat = G.pois.filter(p => (p.retreat || []).length).length;
    rec.u05Evidence = { poisWithoutRetreatPolyline: raw.count, poisWithRetreatPolyline: withRetreat,
      totalPois: G.pois.length, exitRouteLaw: 'NOT_AUTHORED' };
  } else if (raw.kind === 'CART_SWEPT_CLEARANCE') {
    rec.u05Evidence = { poiIds: raw.poiIds, cartClearanceLaw: 'NOT_AUTHORED', cartApproved: false,
      note: 'No cart width/turn radius/loading capacity may be invented.' };
  } else if (raw.kind === 'MARINE_FOOT_PERMISSION') {
    rec.u05Evidence = { footOnSea: false, boat: false, swim: false, ferryFoot: false,
      wmp04Policy: 'FIXED_DOCKS__FREE_OPEN_WATER_TRAVEL — footOnSea FORBIDDEN',
      note: 'Open-water traversal is a Gameplay vehicle/permission decision, not Map geometry.' };
  }
  return rec;
});

const byClass = items.reduce((m, i) => (m[i.classification] = (m[i.classification] || 0) + 1, m), {});
const byKind = items.reduce((m, i) => (m[i.kind] = (m[i.kind] || 0) + 1, m), {});
const remeasured = items.filter(i => i.u05Evidence.after && i.u05Evidence.after.nativeTileCount !== undefined);
const doubleCount = items.filter(i => i.u05Evidence.before && i.u05Evidence.before.doubleCountedCells1Au > 0);

const provenance = {
  gold: { path: 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json', sha256: sha(GOLD), bytes: fs.statSync(GOLD).size },
  originalFindings: { path: 'creator-u05/map-data/U05_GEOMETRY_CONFLICTS.json', sha256: sha(F), bytes: fs.statSync(F).size, unchanged: true },
  activeWorldMaster: { path: 'veyra-world-master/CURRENT_WORLD_MASTER.json', sha256: sha(path.join(REPO, 'veyra-world-master/CURRENT_WORLD_MASTER.json')) },
  activeManifest: { path: 'veyra-world-master/v4/r1/manifest.r1.json', sha256: sha(path.join(REPO, 'veyra-world-master/v4/r1/manifest.r1.json')) },
  u05Contract: { path: 'creator-u05/contracts/CREATOR_CHOSEN_U05.v1.json', sha256: sha(path.join(ROOT, 'contracts/CREATOR_CHOSEN_U05.v1.json')) },
  protectedViewer: { path: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', sha256: sha(path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html')), unchanged: true },
  immutableGoldAssertions: { amendedPolygons: 0, relocatedObjects: 0, expandedEnvelopes: 0,
    recolouredRoads: 0, widenedRoads: 0, newBuildings: 0, newDoors: 0, newProps: 0,
    canonicalIdsChanged: 0, note: 'GOLD JSON and WMP-04R1 rasters were READ ONLY. All changes are in new Map evidence files.' }
};

const reconciled = {
  schema: 'soh.u05.mapgeo01-findings-reconciled.v1',
  generatedAt: new Date().toISOString(),
  pilot: 'MAP-GEO-REJOIN-01',
  sourceRegister: 'creator-u05/map-data/U05_GEOMETRY_CONFLICTS.json (62 findings, preserved verbatim)',
  transform: { U: 0.5, TILES_PER_AU, tileAu: 0.5,
    rule: 'cell centre = (x0 + (i+0.5)*step); polygon vertices evaluated in continuous AU; NO rounding to whole tiles before point-in-polygon',
    unionRule: 'overlapping POI/Elder shapes inside one zone are counted ONCE (union), not summed per object' },
  categories: Object.fromEntries(Object.values(CLASS).map(c => [c, { count: byClass[c] || 0, severity: SEV[Object.keys(CLASS).find(k => CLASS[k] === c)],
    owner: OWNER[Object.keys(CLASS).find(k => CLASS[k] === c)] }])),
  summary: {
    totalFindings: items.length, classified: items.length,
    unresolvedBefore: src.items.filter(i => i.status.startsWith('UNRESOLVED') || i.status.includes('UNRESOLVED')).length,
    explicitlyClassifiedAfter: items.length,
    genuineMapGeometryDefectsCorrectable: byClass[CLASS.mapDefect] || 0,
    intentionalOverlaps: byClass[CLASS.intentional] || 0,
    gameplayA8Decisions: byClass[CLASS.gameplay] || 0,
    creatorDecisions: byClass[CLASS.creator] || 0,
    missingEvidence: byClass[CLASS.noEvidence] || 0,
    polygonFindingsRemeasuredAtU05: remeasured.length,
    zonesWithDoubleCountedOriginalMeasurement: doubleCount.length,
    mapGeometryCorrectionsApplied: items.filter(i => i.mapGeometryCorrectionApplied).length,
    goldAmendments: 0
  },
  corrections: [
    { id: 'C-01', name: 'U=0.5-native remeasurement of polygon findings',
      before: 'AU2 analytic / tile2 analytic / 1-AU-cell sums (per-object, double counting)',
      after: 'exact 0.5 AU tile-centre counts using a UNION of shapes',
      measured: { findingsRemeasured: remeasured.length, zonesWithDoubleCount: doubleCount.length,
        example: { id: 'bz_cinder', beforeCells1Au: 2131, naive4x: 8524, afterNativeTiles: remeasured.find(i => i.sourceIds[0] === 'bz_cinder')?.u05Evidence.after.nativeTileCount } },
      geometryChanged: false },
    { id: 'C-02', name: 'Explicit 5-category classification for every finding',
      before: { unresolved: src.items.filter(i => i.status.startsWith('UNRESOLVED') || i.status.includes('UNRESOLVED')).length,
        distinctOwnerStrings: [...new Set(src.items.map(i => i.owner))].length, categories: 0 },
      after: { classified: items.length, categories: Object.keys(CLASS).length,
        ownerStrings: [...new Set(items.map(i => i.owner))].length },
      geometryChanged: false },
    { id: 'C-03', name: 'Source-pinned immutable GOLD provenance record',
      before: 'no per-reconciliation SHA/provenance block', after: provenance, geometryChanged: false }
  ],
  byKind, items,
  provenance,
  physicalDefectRegister: 'creator-u05/evidence/mapgeo01-physical-audit.json :: defects (10 named, measured, owner + severity)',
  notClaims: ['No VISUAL_ACCEPTED','No VEYRA_PLAYABLE','No MERGE_READY','No production merge','No new atlas','No GOLD amendment','No invented doors/props/build rights']
};
fs.writeFileSync(path.join(ROOT, 'map-data/MAPGEO01_FINDINGS_RECONCILED.json'), JSON.stringify(reconciled, null, 2) + '\n');
const brief = {
  schema: 'soh.u05.mapgeo01-reconciliation.v1', generatedAt: reconciled.generatedAt,
  total: items.length, categories: byClass, byKind, summary: reconciled.summary,
  corrections: reconciled.corrections.map(c => ({ id: c.id, name: c.name, geometryChanged: c.geometryChanged })),
  provenance, output: 'creator-u05/map-data/MAPGEO01_FINDINGS_RECONCILED.json'
};
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo01-reconciliation.json'), JSON.stringify(brief, null, 2) + '\n');
console.log(`U05_MAPGEO01_RECONCILE_OK findings=${items.length} classified=${Object.values(byClass).reduce((a,b)=>a+b,0)} remeasured=${remeasured.length} mapDefects=${byClass[CLASS.mapDefect]||0} goldAmendments=0`);
