// Original C #09 mk()/vars and drawBoltTree, isolated at endpoints, clock and
// seed recorded from real moving-world connectors. This deliberately uses C's
// CORE/HALO and k=1 to isolate geometry/raster, not the fusion's A/B palette,
// event envelope, world composition or full spell. No source archive is edited.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { Frame } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import { hash, TAU } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import { boltPts, boltTree, drawBoltTree, type Branch } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/kit';

const dir = process.argv[2];
for (const filename of readdirSync(dir).filter(n => /^r17_\d+\.json$/.test(n))) {
  const r = JSON.parse(readFileSync(`${dir}/${filename}`, 'utf8'));
  const q = r.chosen_bolt;
  if (!q || !q.a || !q.b) continue;
  // #11 seed mapping is the candidate's adaptation from A connector identity;
  // #09 uses A's graph seed. C source has its own different spell/event seeds.
  const seed = r.skill === 11 ? q.seed * 131 : q.seed;
  const t = q.t;
  const pts = boltPts(seed, q.a[0], q.a[1], q.b[0], q.b[1], 0.32, 3);
  const v = Math.floor(t * 30) % 3;
  // Emit original five-branch successful C channel AND the explicitly
  // density-adapted prefix used by the rotor. Do not call the latter Gold.
  for (const [label, count] of [['c-original', r.skill === 11 ? 5 : q.branch_count], ['c-adapted', q.branch_count]] as const) {
    const br: Branch[] = [{pts: pts.map((p,j) => j === 0 || j === pts.length - 1 ? p :
      {x:p.x+(hash(seed+v*31+j)-0.5)*3,y:p.y+(hash(seed+v*17+j*3)-0.5)*3}), w:1, depth:0}];
    for (let b = 0; b < count; b++) {
      const j = Math.floor(hash(seed + v * 7 + b * 13) * (pts.length - 2)) + 1, p = pts[j];
      const a = hash(seed + b * 5 + v) * TAU, l = 6 + hash(seed + b) * 18;
      br.push(...boltTree(seed + v * 100 + b, p.x, p.y, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, 1, 0.35, 1));
    }
    const f = new Frame(); f.clear();
    drawBoltTree(f, br, 1, [0.92,0.96,1], [0.28,0.4,1], 1);
    writeFileSync(`${dir}/${filename.replace('.json', '.' + label + '.rgba32f')}`, Buffer.from(f.light.buffer));
  }
}
