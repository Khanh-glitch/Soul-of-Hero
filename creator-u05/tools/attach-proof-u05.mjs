/**
 * P5 — attach the measured P4 runtime-walk proof to the six generated scene
 * JSONs. Scene geometry / GOLD envelopes are NOT modified; only the
 * `physicalProof` block is upgraded from PENDING to PROVEN with explicit
 * evidence pointers. Re-running this after a fresh QA keeps proof honest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const qa = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'qa-report.json'), 'utf8'));
const byId = new Map(qa.scenes.map(s => [s.id, s]));
let n = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'scenes')).filter(f => f.endsWith('.u05.json')).sort()) {
  const file = path.join(ROOT, 'scenes', f);
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const q = byId.get(s.id);
  if (!q) throw Error('U05_PROOF_MISSING_FOR ' + s.id);
  const proven = q.approach.arrived && q.reentry.arrived && q.collision?.blocked === true && q.roof.transitionProven === true &&
    q.approach.realKeyboardEvents > 0 && q.reentry.realKeyboardEvents > 0 && q.beforeAfter.cameraIdentical;
  s.physicalProof.runtimeWalkProof = proven ? 'PROVEN_BY_P4_QA' : 'PARTIAL__SEE_QA_REPORT';
  s.physicalProof.artComplete = false;
  s.physicalProof.whiteboxPhysicalProof = true;
  s.physicalProof.runtimeWalkEvidence = {
    report: 'creator-u05/evidence/qa-report.json',
    sceneId: q.id,
    realKeyboardApproachEvents: q.approach.realKeyboardEvents,
    realKeyboardReentryEvents: q.reentry.realKeyboardEvents,
    approachArrived: q.approach.arrived,
    reentryArrived: q.reentry.arrived,
    wallCollisionBlocked: q.collision?.blocked === true,
    roofHiddenInside: q.roof.roofHiddenInside,
    roofHiddenOutside: q.roof.roofHiddenOutside,
    roofTransitionProven: q.roof.transitionProven,
    shots: [q.beforeAfter.beforeShot, q.beforeAfter.afterShot, q.approach.startShot, q.approach.goalShot,
            q.reentry.shot, q.roof.insideShot, q.roof.outsideShot, q.collisionShot].filter(Boolean),
    spawnFixtureDisclosed: q.spawnFixture.recorded === true && q.spawnFixture.teleportUsedAsRoute === false,
    note: 'Runtime WALK / collision / roof-occlusion proof for the ISOLATED six-scene Creator audition ONLY. NOT full Gameplay runtime integration, NOT visual acceptance, NOT art-complete.'
  };
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  n++;
}
console.log(`U05_ATTACH_PROOF_OK scenes=${n} proven=${[...byId.values()].filter(q => q.approach.arrived && q.reentry.arrived && q.collision?.blocked && q.roof.transitionProven).length}`);
