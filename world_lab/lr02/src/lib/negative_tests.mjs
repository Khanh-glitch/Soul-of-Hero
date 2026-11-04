// Deliberately INVALID inputs must fail EXPLICITLY. These are true negative
// tests: they mutate a COPY of the pinned LR01 layout and assert that the
// compiler refuses to invent a physical doorway. LR01 files are untouched.
import { compilePoi } from './portal_geometry.mjs';
import { r4 } from './lr02.mjs';

const clone = o => JSON.parse(JSON.stringify(o));

export function negativeTests(layouts) {
  const gw = layouts.layouts.find(l => l.poiId === 'po_greywater');
  const results = [];
  const add = (id, ok, detail) => results.push({ id, verdict: ok ? 'PASS' : 'FAIL', detail });

  // N-01 oversized door must be rejected, not silently clipped.
  {
    const bad = clone(gw); bad.entrance.openingAu = 999;
    const c = compilePoi(bad);
    const rec = c.portalRecords.find(p => p.kind === 'EXTERIOR_PORTAL');
    add('N-01_OVERSIZED_DOOR_REJECTED', rec.status === 'INVALID' && rec.connectionValid === false && c.staticOpenings.every(o => o.kind !== 'EXTERIOR_ENTRANCE'),
      { reason: rec.reason, cutOpenings: c.staticOpenings.length, exceptionCount: c.exceptions.length });
  }
  // N-02 entrance centre off the wall boundary must be rejected.
  {
    const bad = clone(gw); bad.entrance.atAu = [gw.entrance.atAu[0] + 250, gw.entrance.atAu[1] + 250];
    const c = compilePoi(bad);
    const rec = c.portalRecords.find(p => p.kind === 'EXTERIOR_PORTAL');
    add('N-02_OFF_WALL_ENTRANCE_REJECTED', rec.status === 'INVALID' && !c.staticOpenings.some(o => o.kind === 'EXTERIOR_ENTRANCE'),
      { reason: rec.reason, cutOpenings: c.staticOpenings.length });
  }
  // N-03 opening narrower than the wall thickness has no player clearance.
  {
    const bad = clone(gw); bad.entrance.openingAu = 0.4;
    const c = compilePoi(bad);
    const rec = c.portalRecords.find(p => p.kind === 'EXTERIOR_PORTAL');
    add('N-03_UNDERSIZED_CORRIDOR_REJECTED', rec.status === 'INVALID' && /CLEARANCE/.test(rec.reason || ''),
      { reason: rec.reason });
  }
  // N-04 a door claiming non-adjacent rooms must be rejected.
  {
    const bad = clone(gw);
    const p = bad.portals.find(x => x.kind === 'INTERIOR_PORTAL' || x.kind === 'INTERIOR_DOORWAY' || x.kind === 'HORIZONTAL_PORTAL' || x.kind === 'VERTICAL_PORTAL');
    const target = p || bad.portals.find(x => x.kind !== 'EXTERIOR_PORTAL' && x.kind !== 'VERTICAL_LINK');
    if (target) target.fromRoomId = 'room.po_greywater.9.9';
    const c = compilePoi(bad);
    const rec = c.portalRecords.find(x => x.id === target?.id);
    add('N-04_NON_ADJACENT_ROOM_DOOR_REJECTED', !!rec && rec.connectionValid === false && c.exceptions.some(e => /NO_SHARED_WALL|BOUNDARY/.test(e.reason)),
      { portalId: target?.id, status: rec?.status, reason: rec?.reason });
  }
  // N-05 overlapping openings on one wall must keep a solid post.
  {
    const bad = clone(gw);
    for (const p of bad.portals) if (p.kind !== 'EXTERIOR_PORTAL' && p.kind !== 'VERTICAL_LINK') p.openingAu = 13;
    bad.entrance.openingAu = 13;
    const c = compilePoi(bad);
    add('N-05_OVERLAPPING_OPENINGS_REJECTED', c.exceptions.some(e => /TOO_CLOSE|OUTSIDE_WALL|OUTSIDE_SHARED/.test(e.reason)) && c.portalRecords.some(p => p.status === 'INVALID'),
      { invalidCount: c.portalRecords.filter(p => p.status === 'INVALID').length, reasons: c.exceptions.slice(0, 3).map(e => e.reason) });
  }
  // N-06 open-air yard must NOT become an arbitrary closed compound.
  {
    const open = layouts.layouts.find(l => l.poiId === 'po_glade') || layouts.layouts.find(l => l.arche === 'grove' || l.policy === 'OPEN_YARD');
    const c = compilePoi(open);
    add('N-06_OPEN_YARD_NOT_ENCLOSED', c.policy.id === 'OPEN_YARD' && c.staticSolids.length === 0 && c.openBoundary.every(b => b.blocksMovement === false),
      { poiId: open.poiId, policy: c.policy.id, solids: c.staticSolids.length, boundary: c.openBoundary.length });
  }
  // N-07 regeneration must produce byte-identical stable IDs.
  {
    const a = compilePoi(gw), b = compilePoi(gw);
    const ids = x => JSON.stringify({ solids: x.staticSolids.map(s => s.id), openings: x.staticOpenings.map(o => o.id), map: x.idMapping });
    add('N-07_SOURCE_STABLE_IDS_THROUGH_REGENERATION', ids(a) === ids(b), { solidIds: a.staticSolids.length, openingIds: a.staticOpenings.length });
  }
  // N-08 graph BFS is not substituted for physical clearance: with every
  // opening removed, graph reachability must collapse while the walls stay solid.
  {
    const bad = clone(gw);
    bad.portals = bad.portals.filter(p => p.kind === 'VERTICAL_LINK');
    const c = compilePoi(bad);
    const one = c.circulation.physicallyReachableRoomCount;
    // The compiler must FLAG the graph-vs-physical mismatch rather than report
    // graph BFS as if it were physical clearance.
    add('N-08_GRAPH_ONLY_CONNECTION_CANNOT_OPEN_SOLID_WALL', c.tests.physicalConnectivityMatchesGraph === false && c.circulation.graphOnlyRooms.length > 0 && one === 0 && c.staticOpenings.length === 0 && c.staticSolids.length === gw.walls.length,
      { physicallyReachableRooms: one, graphOnlyRooms: c.circulation.graphOnlyRooms.length, cutOpenings: c.staticOpenings.length, solids: c.staticSolids.length, note: 'Mismatch correctly reported as FAIL, not silently accepted.' });
  }
  return { results, pass: results.filter(r => r.verdict === 'PASS').length, total: results.length, allPass: results.every(r => r.verdict === 'PASS') };
}
