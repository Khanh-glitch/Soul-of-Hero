// Original C #05 late release after early membranes have fully disappeared.
// Zero base; compares source fields only, not SOH composition or viewport post.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Frame } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import { Rng } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import { TIDE } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/tide';
const dir = process.argv[2]; if (!dir) throw new Error('output required');
mkdirSync(dir, {recursive:true});
for (const tick of [372,396,420,450,480,510]) {
  const f = new Frame(); f.clear();
  const fx = {shake() {}, flash() {}, kick() {}, invert:0, desat:0, chroma:0, bloom:1, ambient:1, ambientEcho:0};
  const spell = TIDE.find(x => x.id === 5)!.make(new Rng(32676), fx as any);
  for (let i = 1; i <= tick; i++) spell.update(1 / 60, i / 60);
  spell.render(f, tick / 60);
  for (const kind of ['ink','light','disp'] as const)
    writeFileSync(`${dir}/original_${tick}.${kind}32f`, Buffer.from(f[kind].buffer));
}
