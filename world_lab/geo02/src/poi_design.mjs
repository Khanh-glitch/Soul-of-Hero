#!/usr/bin/env node
// MAP-GEO-02 step 4: bounded MAP-OWNED spatial design candidate for po_kilns ONLY.
//
// Everything under `proposed` is NEW, PROPOSED, NON-CANONICAL geometry. Nothing
// under `existingAuthored` is modified. No recipes / loot / locks / power /
// interactive machinery. No runtime merge and no Gameplay population.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadMapLabSource } from './lib/maplab_source.mjs';
import { dist, nearestOnLine, pip, cellOf, chamfer, segInt } from './lib/maplab.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'output');
const RAS = path.join(OUT, 'rasters');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const r4 = v => +v.toFixed(4);

function canon() {
  const raw = Buffer.from(execFileSync('git', ['show',
    '19d8c6ec820f324a6ac12733165e43b5e2c6eab2:map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json'],
    { cwd: path.resolve(ROOT, '../..'), maxBuffer: 32 * 1024 * 1024 }));
  return { raw, p: JSON.parse(raw.toString('utf8')).project };
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const area = pts => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return r4(Math.abs(s) / 2);
};

function main() {
  const { raw, p } = canon();
  const sem = loadMapLabSource().semantics;
  const poi = p.pois.find(q => q.id === 'po_kilns');
  const foot = poi.foot.map(q => [q[0], q[1]]);
  const [F0, F1, F2, F3] = foot;
  // Bilinear coordinates inside the authored 4-point foot. u=0 west, u=1 east,
  // v=0 north edge, v=1 south edge. Deterministic; no hand-placed coordinates.
  const P = (u, v) => {
    const top = lerp(F0, F1, u), bot = lerp(F3, F2, u);
    return lerp(top, bot, v).map(r4);
  };
  const rect = (u0, v0, u1, v1) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];

  const readMask = f => Uint8Array.from(fs.readFileSync(path.join(RAS, f)));
  const masks = { land: readMask('landMaplab.u8'), lake: readMask('lakeMaplab.u8'), river: readMask('riverMaplab.u8') };
  const obstacle = new Uint8Array(masks.land.length);
  for (let k = 0; k < obstacle.length; k++) obstacle[k] = (!masks.land[k] || masks.lake[k] || masks.river[k]) ? 1 : 0;
  const clearanceAu = chamfer(obstacle, p.terrain.gw, p.terrain.gh, p.terrain.cell);

  /** Design check only: geometric context, NOT a passability or clearance verdict. */
  const check = pts => {
    const n = Math.max(2, Math.ceil(pts.reduce((a, q, i) => i ? a + dist(pts[i - 1], q) : 0, 0) / 2));
    let land = 0, river = 0, lake = 0, minClr = Infinity;
    const flat = [];
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j <= n; j++) {
      const q = lerp(pts[i], pts[i + 1], j / n);
      flat.push(q);
      const k = cellOf(p, q);
      if (masks.land[k]) land++;
      if (masks.river[k]) river++;
      if (masks.lake[k]) lake++;
      minClr = Math.min(minClr, clearanceAu[k]);
    }
    return {
      sampledPoints: flat.length, onLandFraction: r4(land / flat.length),
      riverCells: river, lakeCells: lake, minClearanceAu: r4(minClr),
      insideAuthoringSpace: flat.every(q => q[0] >= 0 && q[0] <= p.world.w && q[1] >= 0 && q[1] <= p.world.h),
      note: 'Geometric context against MapLab source-semantic masks. NOT a passability rule, NOT swept clearance, NOT a survivability claim.',
    };
  };

  // ---- EXISTING AUTHORED GEOMETRY (verbatim, read-only) ----
  const rd16 = p.roads.find(r => r.id === 'rd_16');
  const rd20 = p.roads.find(r => r.id === 'rd_20');
  const rdn = p.roads.find(r => r.id === 'rd_n');
  const roadInsideFoot = rd16.points.filter(q => pip(q, foot));
  const westCross = (() => {
    // EXACT intersection of the authored rd_16 last segment with the west edge
    const a = rd16.points[rd16.points.length - 2], b = rd16.points[rd16.points.length - 1];
    const h = segInt(a, b, F3, F0);
    if (!h) throw new Error('rd_16 last segment does not intersect the po_kilns west foot edge');
    const q = nearestOnLine([F3, F0], b);
    return {
      roadSegment: [a.map(r4), b.map(r4)], intersectionAu: h.p.map(r4),
      edgeParameterFromF3: r4(h.u), bilinearV: r4(1 - h.u),
      westEdgePointAu: q.pt.map(r4), distanceToWestEdgeAu: r4(q.d),
      note: 'h.u runs F3->F0; bilinear v runs F0->F3, so v = 1 - h.u. The PROPOSED primary opening is centred on this EXACT source crossing.',
    };
  })();
  const vCross = westCross.bilinearV;

  // ---- PROPOSED GEOMETRY ----
  const designParameters = {
    authority: 'PROPOSED_DESIGN_PARAMETERS__NOT_SOURCE_VALUES__NOT_VALIDATED',
    coordinateSpace: '2000x1400 authoring units, unchanged; bilinear (u,v) inside the verbatim authored foot quad',
    bayInset: { u: 0.10, v: 0.10 }, bayGap: { u: 0.12, v: 0.12 },
    entranceOpeningFractions: {
      west: [r4(vCross - 0.10), r4(vCross + 0.10)], north: [0.62, 0.82], south: [0.36, 0.58],
      westDerivedFromSource: 'centred on the exact rd_16 x west-foot-edge intersection; +/-0.10 is a PROPOSED opening extent, not a source width',
    },
    note: 'Fractions are DESIGN CHOICES for a bounded candidate, not source values and not physical dimensions. No width, height, material, collision envelope or swept clearance is validated.',
  };
  const workingSpaces = [
    { id: 'PROPOSED_WS_1', label: 'covered enclosure (spatial allocation only)', uv: [0.10, 0.10, 0.44, 0.44], polygonAu: rect(0.10, 0.10, 0.44, 0.44) },
    { id: 'PROPOSED_WS_2', label: 'open yard (spatial allocation only)', uv: [0.56, 0.10, 0.90, 0.44], polygonAu: rect(0.56, 0.10, 0.90, 0.44) },
    { id: 'PROPOSED_WS_3', label: 'staging enclosure (spatial allocation only)', uv: [0.10, 0.56, 0.44, 0.90], polygonAu: rect(0.10, 0.56, 0.44, 0.90) },
    { id: 'PROPOSED_WS_4', label: 'transfer / circulation enclosure (spatial allocation only)', uv: [0.56, 0.56, 0.90, 0.90], polygonAu: rect(0.56, 0.56, 0.90, 0.90) },
  ].map(s => ({ ...s, status: 'PROPOSED', canonical: false, owner: 'MAP', areaAu2: area(s.polygonAu), insideAuthoredFoot: true, check: check([...s.polygonAu, s.polygonAu[0]]) }));

  const entranceOptions = [
    { id: 'PROPOSED_EN_A', label: 'primary west opening', face: 'west', edge: 'F3->F0',
      openingAu: [P(0, r4(vCross - 0.10)), P(0, r4(vCross + 0.10))], midpointAu: P(0, vCross),
      openingWidthAu: r4(dist(P(0, r4(vCross - 0.10)), P(0, r4(vCross + 0.10)))),
      facesSourceRoadId: 'rd_16', rationale: `Centred on the exact rd_16 x west-foot-edge intersection at ${JSON.stringify(westCross.intersectionAu)}; rd_16 already terminates INSIDE the foot.`,
      widthStatus: 'PROPOSED_GEOMETRIC_OPENING__NO_VALIDATED_DOOR_DIMENSION' },
    { id: 'PROPOSED_EN_B', label: 'secondary north opening', face: 'north', edge: 'F0->F1',
      openingAu: [P(0.62, 0), P(0.82, 0)], midpointAu: P(0.72, 0), openingWidthAu: r4(dist(P(0.62, 0), P(0.82, 0))),
      facesSourceRoadId: 'rd_20', rationale: 'rd_20 (riverside) authored control point [926.9056,772.7915] lies ~22au NE of the shell.',
      widthStatus: 'PROPOSED_GEOMETRIC_OPENING__NO_VALIDATED_DOOR_DIMENSION' },
    { id: 'PROPOSED_EN_C', label: 'retreat / service south opening', face: 'south', edge: 'F2->F3',
      openingAu: [P(0.36, 1), P(0.58, 1)], midpointAu: P(0.47, 1), openingWidthAu: r4(dist(P(0.36, 1), P(0.58, 1))),
      facesSourceRoadId: 'rd_n', rationale: 'rd_n (cart) has an authored control point [908,863] to the south; NO cart access to po_kilns is claimed.',
      widthStatus: 'PROPOSED_GEOMETRIC_OPENING__NO_VALIDATED_DOOR_DIMENSION' },
  ].map(e => ({ ...e, status: 'PROPOSED', canonical: false, owner: 'MAP', physicalDoorOpeningOnly: true,
    note: 'The OPENING is physical Map geometry. Any lock/key/power condition, door hardware or interaction is GAMEPLAY_OWNED and is NOT defined here.' }));

  const approach = {
    id: 'PROPOSED_AP_1', status: 'PROPOSED', canonical: false, owner: 'MAP',
    existingAuthoredApproach: {
      roadId: 'rd_16', kind: rd16.kind, sourceRef: 'roads[rd_16].points',
      verbatimLastSegmentAu: [rd16.points[rd16.points.length - 2].map(r4), rd16.points[rd16.points.length - 1].map(r4)],
      status: 'EXISTING_AUTHORED',
      observation: 'The authored road terminates AT po_kilns.at [905,785], which is INSIDE the authored foot. The road already penetrates the site boundary; that is a source fact, not a proposal.',
      authoredControlPointsInsideFoot: roadInsideFoot.map(q => q.map(r4)),
      westEdgeCrossingProxy: westCross,
    },
    proposedApproachCentrelineAu: [westCross.intersectionAu, P(0.08, vCross), P(0.08, 0.50)],
    width: 'NOT_DEFINED', clearance: 'NOT_VALIDATED', surface: 'NOT_DEFINED',
    check: check([westCross.intersectionAu, P(0.08, vCross), P(0.08, 0.50)]),
    note: 'Centreline only. No physical width, no apron polygon, no swept envelope is claimed.',
  };

  const circulation = {
    status: 'PROPOSED', canonical: false, owner: 'MAP',
    note: 'Interior circulation centrelines joining the proposed openings to the proposed working spaces. 2D only; no vertical dimension, no collision envelope.',
    paths: [
      { id: 'PROPOSED_C_SPINE', label: 'east-west interior spine', centrelineAu: [P(0.08, 0.50), P(0.92, 0.50)] },
      { id: 'PROPOSED_C_CROSS', label: 'north-south interior cross', centrelineAu: [P(0.50, 0.08), P(0.50, 0.92)] },
      { id: 'PROPOSED_C_A', label: 'primary opening to spine', centrelineAu: [P(0, vCross), P(0.08, vCross), P(0.08, 0.50)] },
      { id: 'PROPOSED_C_B', label: 'secondary opening to north bay', centrelineAu: [P(0.72, 0), P(0.72, 0.10)] },
      { id: 'PROPOSED_C_C', label: 'south opening to spine', centrelineAu: [P(0.47, 1), P(0.47, 0.92)] },
    ].map(c => ({ ...c, check: check(c.centrelineAu) })),
  };

  const retreatAnchor = rdn.points.reduce((best, q) => dist(q, [905, 840]) < dist(best, [905, 840]) ? q : best, rdn.points[0]);
  const retreat = {
    status: 'PROPOSED', canonical: false, owner: 'MAP',
    note: 'Geometric egress from the south opening back toward an EXISTING authored road control point. NOT a survivability, escape-time or Gameplay-behaviour claim.',
    fromOpeningId: 'PROPOSED_EN_C', toSourceRoadId: 'rd_n',
    toAuthoredControlPointAu: retreatAnchor.map(r4),
    centrelineAu: [P(0.47, 1), retreatAnchor.map(r4)],
    width: 'NOT_DEFINED', clearance: 'NOT_VALIDATED',
    check: check([P(0.47, 1), retreatAnchor.map(r4)]),
  };

  const out = {
    schema: 'soh.map.geo02.poi_spatial_design.proposed.v1',
    generatedBy: 'world_lab/geo02/src/poi_design.mjs',
    status: 'PROPOSED',
    canonical: false,
    owner: 'MAP',
    scope: 'po_kilns ONLY',
    authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
    separationRule: 'existingAuthored[] is verbatim canonical geometry and is NEVER modified; proposed[] is NEW, PROPOSED, non-canonical and is NEVER merged into the source or runtime.',
    frame: {
      authoringSpace: [p.world.w, p.world.h], grid: { gw: p.terrain.gw, gh: p.terrain.gh, cell: p.terrain.cell },
      transform: 'UNDECIDED (MAP-GEO-01 frame.transform); no rescale, all coordinates remain 2000x1400 authoring units',
    },
    sourceEvidence: {
      veyra: { commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2', bytes: raw.length, sha256: sha(raw) },
      poi: { id: poi.id, at: poi.at, arche: poi.arche, depth: poi.depth, gate: poi.gate, conf: poi.conf || null,
        foot: foot.map(q => q.map(r4)), deep: poi.deep, retreat: poi.retreat, links: poi.links,
        footAreaAu2: 496.7424, sourceRef: 'pois[po_kilns].foot' },
      maplabSmelterLibraryDefault: sem.ARCHETYPE,
      editorNote: 'AGENT_HANDOFF.md (Greywater input package): foot is a SITE BOUNDARY, not a finished interior layout.',
    },
    existingAuthored: [
      { id: 'po_kilns.foot', geometryAu: foot.map(q => q.map(r4)), sourceRef: 'pois[po_kilns].foot', status: 'EXISTING_AUTHORED' },
      { id: 'rd_16', geometryAu: rd16.points.map(q => q.map(r4)), sourceRef: 'roads[rd_16].points', kind: rd16.kind, status: 'EXISTING_AUTHORED' },
      { id: 'rd_20', geometryAu: rd20.points.map(q => q.map(r4)), sourceRef: 'roads[rd_20].points', kind: rd20.kind, status: 'EXISTING_AUTHORED' },
      { id: 'rd_n', geometryAu: rdn.points.map(q => q.map(r4)), sourceRef: 'roads[rd_n].points', kind: rdn.kind, status: 'EXISTING_AUTHORED' },
    ],
    designParameters,
    proposed: {
      physicalFootprint: {
        id: 'PROPOSED_FP_1', status: 'PROPOSED', canonical: false, owner: 'MAP',
        boundary: 'REUSE of existingAuthored po_kilns.foot (no expansion, no rewrite)',
        boundarySourceRef: 'existingAuthored[0]',
        areaAu2: area(foot),
        note: 'The candidate does NOT enlarge the canonical site boundary. All new geometry lies inside it except the approach/retreat centrelines, which are explicitly centreline-only with no claimed width.',
      },
      approach,
      entranceOptions,
      interiorWorkingSpaces: workingSpaces,
      circulation,
      retreat,
    },
    excludedFields: [
      'furnace / kiln recipes', 'loot tables or loot sites', 'locked / key / power states',
      'power nodes or generators', 'interactive machinery', 'hazard intensity',
      'spawn / resource / NPC placement', 'climate', 'survivability or travel-time claims',
      'physical road/river/door width approval', 'swept clearance validation',
    ],
    unresolvedConstraints: [
      'No authoring-unit -> runtime-tile transform; world scale UNDECIDED.',
      'Road width, river channel width, bridge deck span and cart/foot footprint are UNDEFINED in source.',
      'Swept clearance, collision and vertical/roof dimension are NOT modelled; this is a 2D spatial candidate.',
      'po_kilns has NO cart road within editor ACCESS_R=48; no cart access or physically traversable cart route is claimed.',
      'Entrances are geometric openings only; door hardware, lock/key/power conditions and interactions are Gameplay-owned.',
      'rd_16 already terminates inside the foot; the source geometry conflict is reported, not silently fixed.',
      'Human/creator approval is required before any PROPOSED geometry becomes canonical.',
    ],
    noRuntimeMerge: true,
    noGameplayPopulation: true,
    noCanonicalRewrite: true,
    noPhysicallyTraversableCartRouteClaim: true,
  };
  json(path.join(OUT, 'poi_po_kilns.proposed.v1.json'), out);
  console.log(`POI_DESIGN_OK status=PROPOSED spaces=${workingSpaces.length} entrances=${entranceOptions.length} circulation=${circulation.paths.length} retreat=${retreat.centrelineAu.length} existing=${out.existingAuthored.length}`);
  console.log(`  footArea=${area(foot)}au2 westOpening=${entranceOptions[0].openingWidthAu}au sourceRoadInsideFoot=${roadInsideFoot.length}`);
}
main();
