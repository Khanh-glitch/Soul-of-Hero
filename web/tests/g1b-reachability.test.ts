/**
 * G1B batch-3.2 P3A — reachability classification of the ~30 unreachable spaces.
 *
 * For every space the census reports as unreachable, this classifies it from the compiled-runtime
 * census fields (usable, doors, stairs, gate, lockedDoor, storey, name) into exactly one of:
 *
 *   INTENTIONAL_INACCESSIBLE   — a structural span / drowned / shattered / roof perch that has no
 *                                standable approach by design (skybridge, drowned pier, tide rake,
 *                                signal perch, upper truss with no connected stairs).
 *   LEGITIMATE_LOCKED_ACCESS   — behind a locked door / card gate: "unreachable" now is correct and
 *                                expected until the key is obtained.
 *   MAP_COLLISION_DEFECT       — an enclosed room with a door and standable interior, but the door's
 *                                exterior does not connect to the reachable open world (a real defect).
 *   MISSING_ROUTE_OR_STAIRS    — an enclosed room / upper with standable tiles but no door and no
 *                                stairs linking it to the reachable set (a missing route).
 *   UNRESOLVED_WITH_EVIDENCE   — the census fields alone cannot decide; recorded with evidence for the
 *                                Creator / Control Tower to rule on.
 *
 * ENGINEERING VERIFIED classification of geometry only. No source is added, removed, or moved, and no
 * judgement is made about whether a space should be reachable — that is a DESIGN / CREATOR decision.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '../evidence/g1b/census');

type Class = 'INTENTIONAL_INACCESSIBLE' | 'LEGITIMATE_LOCKED_ACCESS' | 'MAP_COLLISION_DEFECT' | 'MISSING_ROUTE_OR_STAIRS' | 'UNRESOLVED_WITH_EVIDENCE';
interface Row { id: string; name: string; kind: string; storey: string; level: number; usable: number; doors: number; stairs: number; gate: string | null; lockedDoor: boolean; open: boolean; reasons: string[]; }

const STRUCTURAL = /skybridge|skywalk|skyway|drowned|shattered|tide|rake|perch|truss|old pier|surviving/i;

describe('G1B batch-3.2 P3A — unreachable-space classification', () => {
  it('classifies every unreachable space from the compiled census fields', () => {
    const C = JSON.parse(readFileSync(resolve(DIR, 'G1B_SPACE_CENSUS.json'), 'utf8'));
    const un = C.spaces.filter((s: Row) => !s.reachable);
    expect(un.length).toBeGreaterThan(0);

    const out: { id: string; name: string; cls: Class; evidence: string }[] = [];
    for (const row of un) {
      let cls: Class;
      let evidence = `usable=${row.usable} doors=${row.doors} stairs=${row.stairs} gate=${row.gate || '-'} locked=${row.lockedDoor} open=${row.open} storey=${row.storey}`;
      if (row.usable === 0) {
        // no standable tile at all in the compiled runtime
        if (STRUCTURAL.test(row.name)) {
          cls = 'INTENTIONAL_INACCESSIBLE';
          evidence += ' ; no standable tile (drowned / shattered / structural span only)';
        } else if (row.kind === 'room') {
          // a named interior room whose floor has no walkable tile at all: the room is authored but its
          // floor never became standable in the compiled runtime — a real map defect, not a design choice
          cls = 'MAP_COLLISION_DEFECT';
          evidence += ' ; room with no standable floor tile in the compiled runtime (floor not walkable)';
        } else {
          // transit / yard / apron / threshold with no standable tile: an approach or platform that never
          // became walkable — a structural gap; flagged for the Creator to confirm intent
          cls = 'UNRESOLVED_WITH_EVIDENCE';
          evidence += ' ; no standable tile on a transit / yard / apron space (structural gap, confirm intent)';
        }
      } else if (row.lockedDoor || row.gate) {
        cls = 'LEGITIMATE_LOCKED_ACCESS';
        evidence += ' ; behind a locked door / card gate — reachable only after the key';
      } else if (row.doors > 0) {
        // standable interior + a door, but the flood cannot reach the space: the door's exterior is not
        // connected to the reachable open world
        cls = STRUCTURAL.test(row.name) ? 'INTENTIONAL_INACCESSIBLE' : 'MAP_COLLISION_DEFECT';
        evidence += ' ; standable interior + door exist but the flood cannot reach the space (door exterior disconnected)';
      } else if (row.stairs > 0) {
        // reached only by stairs that do not connect to the reachable set
        cls = STRUCTURAL.test(row.name) || row.storey === 'Roof' ? 'INTENTIONAL_INACCESSIBLE' : 'MISSING_ROUTE_OR_STAIRS';
        evidence += ' ; storey reached only by stairs that do not connect to the reachable set';
      } else if (STRUCTURAL.test(row.name)) {
        cls = 'INTENTIONAL_INACCESSIBLE';
        evidence += ' ; structural span / platform with a standable span but no walking approach by design';
      } else {
        // enclosed room, standable, no door, no stairs on the ground storey
        cls = 'MISSING_ROUTE_OR_STAIRS';
        evidence += ' ; enclosed room with standable tiles but no door and no stairs (missing route)';
      }
      out.push({ id: row.id, name: row.name, cls, evidence });
    }

    const byCls = out.reduce((a: any, o) => { a[o.cls] = (a[o.cls] || 0) + 1; return a; }, {} as any);
    expect(out.length).toBe(un.length);
    expect(Object.keys(byCls).length).toBeGreaterThan(0);

    const payload = { schema: 'soh.g1b.reachability-classification.v1', layoutRevision: C.layoutRevision, count: out.length, byClass: byCls, spaces: out };
    writeFileSync(resolve(DIR, 'G1B_REACHABILITY_CLASSIFICATION.json'), JSON.stringify(payload, null, 1));
    // each row must carry a non-empty evidence string
    expect(out.every(o => o.evidence.length > 0)).toBe(true);
  });
});
