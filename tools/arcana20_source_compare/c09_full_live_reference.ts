// Unmodified C #09 spell code, rerun at each captured #09 source tick with
// actual A-local live caster/target anchors converted uniformly into the C
// canvas. C's own graph/timing are NOT the A fusion graph/timing; static hard-
// coded C waypoints remain. Re-instantiation and seeded Math.random mean
// particles are diagnostic reconstructions, not the original continuous cast.
// Empty C base/ground and no browser compositor/post: this is not Gold/world.
import { readFileSync, writeFileSync } from 'node:fs';
import { Frame } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import { Rng } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import { CASTER, TARGETS } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/floor';
import { TEMPEST } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/tempest';
const dir = process.argv[2];
if (!dir) throw new Error('captured output directory required');
const timeline = JSON.parse(readFileSync(`${dir}/timeline.json`, 'utf8'));
if (timeline.skill !== 9) throw new Error('expected skill 9 capture');
const spellDef = TEMPEST.find(s => s.id === 9)!;
const savedRandom = Math.random;
const rows: any[] = [];
for (let i = 0; i < timeline.frames.length; ++i) {
  const frame = timeline.frames[i], nodes = frame.r17_actor_nodes;
  if (!Array.isArray(nodes) || nodes.length < 5 || nodes.slice(0, 5).some((p: any) => !Array.isArray(p))) {
    rows.push({frame_index:i, skipped:'missing actual actor anchor'}); continue;
  }
  const k = 384 / 416; // same as 216 / 234: uniform similarity, not axis stretch
  CASTER.x = nodes[0][0] * k - 6; CASTER.y = nodes[0][1] * k + 16;
  // C builds N in order TARGETS[0], TARGETS[2], TARGETS[1], TARGETS[3].
  for (let n = 0; n < 4; ++n) {
    const index = [0, 2, 1, 3][n];
    TARGETS[index].x = nodes[n+1][0] * k;
    TARGETS[index].y = nodes[n+1][1] * k + 8;
  }
  const random = new Rng(0x9090);
  Math.random = () => random.next();
  // Record the original stage commands rather than silently discarding them;
  // they are not composited onto the actual captured SOH world.
  const screenOps: any[] = []; let updateTick = 0;
  const fx = {shake(a: number) {screenOps.push({tick:updateTick,kind:'shake',value:a});},
    flash(c: number[], k: number) {screenOps.push({tick:updateTick,kind:'flash',color:c,k});},
    kick(a: number) {screenOps.push({tick:updateTick,kind:'kick',value:a});},
    invert:0, desat:0, chroma:0, bloom:1, ambient:1, ambientEcho:0};
  const source = spellDef.make(new Rng(1000 + 8 * 7919), fx as any);
  const tick = frame.r17_source_tick;
  for (let step = 0; step < tick; ++step) { updateTick = step; source.update(1 / 60, step / 60); }
  const f = new Frame(); f.clear(); f.t = tick / 60; source.render(f, tick / 60);
  const stem = `${dir}/r17_full_${String(i).padStart(5, '0')}.c`;
  for (const [name, data] of [['light32f',f.light],['ink32f',f.ink],['disp32f',f.disp],['ground8',f.ground]] as const)
    writeFileSync(`${stem}.${name}`, Buffer.from(data.buffer));
  const outside = nodes.slice(0,5).filter((p: number[]) => p[0] * k < 0 || p[0] * k >= 384 || p[1] * k < 0 || p[1] * k >= 216).length;
  rows.push({frame_index:i, tick, source_scale:k, actor_nodes:nodes.slice(0,5), reference_nodes_outside:outside, screen_ops:screenOps});
}
Math.random = savedRandom;
writeFileSync(`${dir}/c09_full_reference_manifest.json`, JSON.stringify({
  source:'original C #09 code; Stage seed 1000+8*7919', rows,
  scope:'Actual captured actor anchors mapped uniformly; per-frame reference recreated with deterministic Math.random, C fixed waypoints and C original timing, not actual continuous particles, not A fusion or original C browser floor/compositor/post. All C ground/ink/light/disp operations and screen commands are saved separately; no fake actors or damage.'
}, null, 2));
console.log(`R17_C09_FULL_REFERENCE ${rows.filter(x => !x.skipped).length}/${rows.length} captured frames`);
