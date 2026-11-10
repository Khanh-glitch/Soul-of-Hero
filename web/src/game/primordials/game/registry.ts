import type { BossId, Form } from '../art/clips';
import type { SkillDef } from './core';
import { SURTUR_MINI, SURTUR_ULT, TYPHON_MINI, TYPHON_ULT } from './skills_a';
import { AION_MINI, AION_ULT, ATLAS_MINI, ATLAS_ULT } from './skills_b';
import { ARGUS_MINI, ARGUS_ULT, ANUBIS_MINI, ANUBIS_ULT } from './skills_c';
import { basicAttack } from './helpers';
import { CATASTROPHE } from './ultimates';
import { BOSS_IDS } from '../art/clips';

export const SIGNATURE: Record<BossId, Record<Form, SkillDef[]>> = {
  surtur: { mini: SURTUR_MINI, ultimate: SURTUR_ULT }, typhon: { mini: TYPHON_MINI, ultimate: TYPHON_ULT },
  aion: { mini: AION_MINI, ultimate: AION_ULT }, atlas: { mini: ATLAS_MINI, ultimate: ATLAS_ULT },
  argus: { mini: ARGUS_MINI, ultimate: ARGUS_ULT }, anubis: { mini: ANUBIS_MINI, ultimate: ANUBIS_ULT },
};
// The fourth Ultimate signature is replaced by the redesigned arena-wide catastrophe.
for (const b of BOSS_IDS) SIGNATURE[b].ultimate[3] = CATASTROPHE[b];
const EL = { surtur: 'fire', typhon: 'force', aion: 'time', atlas: 'space', argus: 'mind', anubis: 'soul' } as const;
export function skillsFor(b: BossId, f: Form): SkillDef[] {
  return [...SIGNATURE[b][f], basicAttack(b, f, EL[b], f === 'mini' ? 34 : 80, f === 'mini' ? 7 : 12)];
}
export const BOSS_INFO: Record<BossId, { name: string; title: string; color: string; el: string; mini: string; ult: string; tactic: string }> = {
  surtur: { name: 'Surtur', title: 'Red · Volcanic Destruction', color: '#ff5a1f', el: 'fire', mini: 'Infernal executioner — sword weight, corner pressure, lingering hot zones', ult: 'Ragnarök walking — battlefield-consuming lanes and footfall eruptions', tactic: 'Tracks burn-lane budget; stops fissures when the target’s escape ring is >70% threatened.' },
  typhon: { name: 'Typhon', title: 'Purple · Raw Power', color: '#b066ff', el: 'force', mini: 'Brutal grappler — fists, grabs and two lashing serpent tails', ult: 'Cataclysmic fist titan — wavefronts, rampages, descent', tactic: 'Grab at short range, pull at mid, rush at long, tails when circled; can misjudge rampage legs.' },
  aion: { name: 'Aion', title: 'Green · Time', color: '#3fe07a', el: 'time', mini: 'Scythe assassin leaving future threats after every slash', ult: 'A deity whose strikes occupy several moments at once', tactic: 'Bounded echo registry (≤4/≤8); delays echoes when the pressure budget would be exceeded.' },
  atlas: { name: 'Atlas', title: 'Blue · Space', color: '#4aa8ff', el: 'space', mini: 'Spatial duelist — attacks from behind without arriving', ult: 'Sky-filling rift sovereign — portal networks and giant limbs', tactic: 'Maintains a portal graph (id, link, armed, cooldown); reuses portals; validates exits.' },
  argus: { name: 'Argus', title: 'Yellow · Mind', color: '#ffd23a', el: 'mind', mini: 'Precision hunter — gaze locks, false tells, lances', ult: 'All-seeing siege apparatus — distributed ocular battery', tactic: 'Assigns eye nodes real/fake/support roles under an ocular budget; real tells are always truthful.' },
  anubis: { name: 'Anubis', title: 'Orange · Soul', color: '#ff9a2a', el: 'soul', mini: 'Chained executioner with a small lethal entourage', ult: 'Leader of a vast spectral procession', tactic: 'Finite summon caps (2/4), bounded pulls with CC immunity, wavefront ownership.' },
};
