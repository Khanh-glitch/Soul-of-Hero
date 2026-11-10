import { Clip, ClipFrame, Pose } from './kit';
import TIMING from './skillTiming.json';

export type BossId = 'surtur' | 'typhon' | 'aion' | 'atlas' | 'argus' | 'anubis';
export type Form = 'mini' | 'ultimate';
export const BOSS_IDS: BossId[] = ['surtur', 'typhon', 'aion', 'atlas', 'argus', 'anubis'];

export const SKILL_IDS: Record<BossId, Record<Form, string[]>> = {
  surtur: { mini: ['kings_cleave', 'furnace_trap', 'burning_pursuit', 'executioner'], ultimate: ['worldcleaver', 'caldera_march', 'rain_of_ruin', 'ragnarok'] },
  typhon: { mini: ['titanic_onslaught', 'serpent_ambush', 'crushing_grasp', 'vortex_reversal'], ultimate: ['continental_fist', 'titans_rampage', 'maelstrom_grip', 'worldbreaker_descent'] },
  aion: { mini: ['pendulum_reap', 'time_skip', 'suspended_blades', 'broken_hour'], ultimate: ['epoch_split', 'still_moment', 'requiem_rewind', 'zero_hour'] },
  atlas: { mini: ['blindside_gate', 'folded_lance', 'rift_pursuit', 'gravity_snare'], ultimate: ['titan_through_rift', 'horizon_array', 'orbital_transference', 'worldfold'] },
  argus: { mini: ['piercing_gaze', 'oracle_lances', 'false_witnesses', 'psychic_command'], ultimate: ['eyes_of_heaven', 'sovereign_spearfield', 'dominion_of_sight', 'omniscient_judgment'] },
  anubis: { mini: ['reapers_dance', 'soul_chains', 'grave_step', 'wraith_hunt'], ultimate: ['death_procession', 'gates_of_underworld', 'judgment_chains', 'final_passage'] },
};

type PhaseDef = [Pose[], number];
interface SkillPoses { open: PhaseDef; active: PhaseDef; recover: PhaseDef; hold?: PhaseDef }
interface Style {
  idle: Pose; stride: number; lift: number; walkMs: number; runMs: number; run: Pose;
  light: Pose[]; heavy: Pose[]; cast: Pose; summon: Pose; serpent?: boolean;
  skills: Record<string, SkillPoses>;
}
const P = (o: Pose[], ms: number): PhaseDef => [o, ms];

const STYLES: Record<BossId, Record<Form, Style>> = {
  surtur: {
    mini: {
      idle: { wA: 0.55, reach: 0.4, wB: 0.9, glow: 0.25 }, stride: 6, lift: 3, walkMs: 120, runMs: 85, run: { lean: 3, wA: 2.3, reach: 0.9 },
      light: [{ wA: -1.2, twist: -0.6, reach: 0.6 }, { wA: -0.2, reach: 1, lean: 2 }, { wA: 1.2, reach: 1, lean: 3, twist: 0.5 }, { wA: 0.9, reach: 0.6 }],
      heavy: [{ wA: -2.5, grip2: 1, crouch: 0.2, glow: 0.5 }, { wA: -2.8, grip2: 1, glow: 0.7, charge: 0.5 }, { wA: 0.2, grip2: 1, lean: 4, crouch: 0.4, glow: 0.9 }, { wA: 1.3, grip2: 1, crouch: 0.5, lean: 3 }, { wA: 1.0, grip2: 1, crouch: 0.3 }],
      cast: { wA: 1.57, grip2: 1, crouch: 0.4, glow: 0.9 }, summon: { wA: -2.05, reach: 1, glow: 1, charge: 1 },
      skills: {
        kings_cleave: { open: P([{ wA: -1.6, twist: -1, reach: 0.4, crouch: 0.2, glow: 0.4 }, { wA: -2.1, twist: -1, crouch: 0.3, glow: 0.5, wB: -0.4 }], 170), active: P([{ wA: -0.4, reach: 1, lean: 3 }, { wA: 1.3, twist: 0.8, reach: 1, lean: 4 }, { wA: 0.6, twist: 0.4, reach: 0.9 }, { wA: -1.4, twist: -0.6, reach: 1, lean: 2 }], 90), recover: P([{ wA: 1.1, crouch: 0.35, lean: 2 }, { wA: 0.8, crouch: 0.15 }], 180) },
        furnace_trap: { open: P([{ wA: -2.4, grip2: 1, glow: 0.5 }, { wA: -2.7, grip2: 1, glow: 0.8, charge: 0.6 }], 180), active: P([{ wA: 1.57, grip2: 1, crouch: 0.6, glow: 1, charge: 1 }, { wA: 1.57, grip2: 1, crouch: 0.55, glow: 0.9, charge: 0.8 }], 140), recover: P([{ wA: 1.2, crouch: 0.3, glow: 0.5 }, { wA: 0.7 }], 180) },
        burning_pursuit: { open: P([{ wA: 2.3, reach: 1, lean: 3, crouch: 0.4, legL: -4, legR: 4 }, { wA: 2.4, reach: 1, lean: 4, crouch: 0.5, legL: -5, legR: 5, glow: 0.6 }], 160), active: P([{ wA: 2.4, lean: 6, legL: 6, legR: -6, liftR: 3, glow: 0.7 }, { wA: 2.4, lean: 6, legL: 0, legR: 0, glow: 0.7 }, { wA: 2.4, lean: 6, legL: -6, legR: 6, liftL: 3, glow: 0.7 }, { wA: 2.4, lean: 6, legL: 0, legR: 0, glow: 0.7 }], 70), recover: P([{ wA: -1.2, lean: -2, crouch: 0.5, legL: 6, legR: -2 }, { wA: 1.4, twist: 1, reach: 1, lean: 3 }, { wA: 0.9, crouch: 0.3 }], 150) },
        executioner: { open: P([{ wA: -2.9, grip2: 1, glow: 0.7, charge: 0.3, head: -1 }, { wA: -3.0, grip2: 1, glow: 1, charge: 1, bob: -1 }], 220), active: P([{ wA: 0.6, grip2: 1, lean: 5, crouch: 0.5, glow: 1, charge: 1 }, { wA: 1.45, grip2: 1, crouch: 0.7, lean: 5, glow: 0.8 }], 80), recover: P([{ wA: 1.5, grip2: 1, crouch: 0.6, glow: 0.5 }, { wA: 1.5, grip2: 1, crouch: 0.5, glow: 0.3, twist: -0.4 }, { wA: 1.0, crouch: 0.3 }], 220) },
      },
    },
    ultimate: {
      idle: { wA: 0.65, reach: 0.4, wB: 0.9, glow: 0.45 }, stride: 12, lift: 7, walkMs: 190, runMs: 140, run: { lean: 5, wA: 1.0 },
      light: [{ wA: -1.4, twist: -0.8 }, { wA: 0.2, reach: 1, lean: 4 }, { wA: 1.3, reach: 1, lean: 5, twist: 0.6 }, { wA: 1.0 }],
      heavy: [{ wA: -2.6, grip2: 1, glow: 0.7 }, { wA: -2.9, grip2: 1, glow: 1, charge: 0.6 }, { wA: 0.4, grip2: 1, lean: 6, crouch: 0.5, glow: 1, charge: 1 }, { wA: 1.4, grip2: 1, crouch: 0.6, lean: 5 }, { wA: 1.1, grip2: 1, crouch: 0.3 }],
      cast: { wA: -2.05, reach: 1, glow: 1, charge: 1 }, summon: { wA: -2.05, reach: 1, glow: 1, charge: 1 },
      skills: {
        worldcleaver: { open: P([{ wA: -1.9, twist: -1.2, glow: 0.6, charge: 0.3 }, { wA: -2.3, twist: -1.3, charge: 0.7, glow: 0.8 }, { wA: -2.4, twist: -1.4, charge: 1, glow: 1, crouch: 0.2 }], 260), active: P([{ wA: -0.6, twist: -0.4, reach: 1, charge: 1, lean: 4, glow: 1 }, { wA: 0.7, twist: 0.6, reach: 1, lean: 6, charge: 1, glow: 1 }, { wA: 1.6, twist: 1.2, reach: 1, lean: 5, charge: 0.7, glow: 0.9 }], 120), recover: P([{ wA: 1.5, twist: 1, crouch: 0.3 }, { wA: 1.3, twist: 0.7, crouch: 0.25 }, { wA: 1.1, twist: 0.5, crouch: 0.2 }], 260) },
        caldera_march: { open: P([{ liftL: 9, legL: 6, glow: 0.6, wA: 0.7 }, { liftL: 12, legL: 9, glow: 0.8, wA: 0.7, lean: 2 }], 260), active: P([{ legL: 10, legR: -6, liftR: 7, glow: 0.7, wA: 0.7, crouch: 0.1 }, { legL: 8, legR: -8, glow: 1, crouch: 0.3, wA: 0.8 }, { legL: -6, legR: 10, liftL: 7, glow: 0.7, wA: 0.6 }, { legL: -8, legR: 8, crouch: 0.3, glow: 1 }], 210), recover: P([{ crouch: 0.25, glow: 0.6, spread: 3 }, { crouch: 0.1, glow: 0.4 }], 260) },
        rain_of_ruin: { open: P([{ wA: -2.0, reach: 1, glow: 0.6, charge: 0.4, head: -2 }, { wA: -2.05, reach: 1, glow: 1, charge: 1 }], 260), active: P([{ wA: -2.1, reach: 1, glow: 1, charge: 1, bob: -1 }, { wA: -2.0, reach: 1, glow: 0.9, charge: 0.8 }], 200), recover: P([{ wA: 0.4, glow: 0.4 }, { wA: 0.6, glow: 0.3 }], 240) },
        ragnarok: { open: P([{ kneel: 0.3, wA: -2.8, grip2: 1, glow: 0.8, charge: 0.2 }, { wA: -2.95, grip2: 1, glow: 1, charge: 0.6, bob: -2 }, { wA: -3.05, grip2: 1, glow: 1, charge: 1, bob: -3, spread: 4 }], 420), active: P([{ wA: -3, grip2: 1, glow: 1, charge: 1, spread: 6 }, { wA: 0.5, grip2: 1, lean: 8, crouch: 0.6, glow: 1, charge: 1 }, { wA: 1.5, grip2: 1, crouch: 0.8, lean: 6, glow: 1, charge: 1 }], 160), recover: P([{ kneel: 0.5, wA: 1.5, grip2: 1, glow: 0.4 }, { kneel: 0.35, wA: 1.3, glow: 0.2 }, { crouch: 0.2, wA: 0.8, glow: 0.2 }], 380) },
      },
    },
  },
  typhon: {
    mini: {
      idle: { wA: 0.4, wB: 0.4, reach: 0.25, offReach: 0.25, crouch: 0.15 }, stride: 5, lift: 2, walkMs: 110, runMs: 80, run: { lean: 4, crouch: 0.3, wA: 1.2, wB: 1.2 }, serpent: true,
      light: [{ wB: -0.3, offReach: 0.3, crouch: 0.3 }, { wB: 0.1, offReach: 1, lean: 4 }, { wB: 0.5, offReach: 0.5 }],
      heavy: [{ wA: -2.4, wB: -2.4, reach: 0.8, offReach: 0.8, crouch: 0.2 }, { wA: -2.7, wB: -2.7, reach: 1, offReach: 1 }, { wA: 1.3, wB: 1.3, reach: 1, offReach: 1, crouch: 0.6, lean: 3 }, { wA: 1.0, wB: 1.0, crouch: 0.4 }],
      cast: { wA: 0, wB: 0, reach: 0.2, offReach: 0.2, glow: 0.8 }, summon: { wA: -1.5, wB: -1.5, reach: 1, offReach: 1, hands: 1 },
      skills: {
        titanic_onslaught: { open: P([{ crouch: 0.35, wA: 0.9, wB: -0.4, offReach: 0.3, twist: -0.6 }], 200), active: P([{ wB: 0.1, offReach: 1, lean: 4, twist: 0.6, wA: 0.6 }, { wA: 0.0, reach: 1, wB: 0.6, offReach: 0.2, lean: 4, twist: -0.7 }, { wA: -1.0, reach: 1, lean: 5, crouch: -0.1, legL: 6, twist: -1 }], 110), recover: P([{ wA: 0.6, crouch: 0.25, lean: 1 }, { wA: 0.5, crouch: 0.2 }], 180) },
        serpent_ambush: { open: P([{ tailA: -0.4, tailB: -0.4, crouch: 0.3, wA: 0.6, wB: 0.6 }, { tailA: -0.6, tailB: -0.5, crouch: 0.35, wA: 0.6, wB: 0.6 }], 180), active: P([{ tailA: 1, tailB: -0.3, twist: -0.5 }, { tailA: 0.6, tailB: 1, twist: 0.5 }], 150), recover: P([{ tailA: 0.2, tailB: 0.2 }], 200) },
        crushing_grasp: { open: P([{ hands: 1, crouch: 0.4, wA: 0.2, reach: 0.4, lean: -1, twist: -0.4 }], 220), active: P([{ hands: 1, wA: 0, reach: 1, lean: 5 }, { hands: 0, wA: -1.5, reach: 1 }, { hands: 0, wA: 1.2, reach: 1, lean: 4, crouch: 0.5 }], 140), recover: P([{ wA: 0.8, crouch: 0.3 }, { wA: 0.5, crouch: 0.2 }], 200) },
        vortex_reversal: { open: P([{ wA: 0.2, wB: 0.2, reach: 0.1, offReach: 0.1, hands: 0, glow: 0.4 }], 200), active: P([{ wA: -1.2, wB: -1.2, reach: 1, offReach: 1, hands: 1, glow: 0.8 }, { wA: 0.0, wB: 0.0, reach: 0.6, offReach: 0.6, hands: 1, crouch: 0.3, glow: 1 }], 160), recover: P([{ wA: 0.8, wB: 0.8, glow: 0.3 }], 220) },
      },
    },
    ultimate: {
      idle: { wA: 0.5, wB: 0.5, reach: 0.3, offReach: 0.3, crouch: 0.2, glow: 0.3 }, stride: 10, lift: 6, walkMs: 170, runMs: 120, run: { lean: 6, crouch: 0.3 }, serpent: true,
      light: [{ wA: -0.6, reach: 0.4 }, { wA: 0.2, reach: 1, lean: 6 }, { wA: 0.7, reach: 0.6 }],
      heavy: [{ wA: -2.5, wB: -2.5, reach: 1, offReach: 1 }, { wA: -2.8, wB: -2.8, reach: 1, offReach: 1, glow: 0.8 }, { wA: 1.4, wB: 1.4, reach: 1, offReach: 1, crouch: 0.7 }, { wA: 1.1, wB: 1.1, crouch: 0.4 }],
      cast: { wA: -1.4, wB: -1.4, reach: 1, offReach: 1, hands: 1, glow: 1 }, summon: { wA: -1.4, wB: -1.4, reach: 1, offReach: 1, hands: 1 },
      skills: {
        continental_fist: { open: P([{ wA: -2.5, reach: 0.6, twist: -1, crouch: 0.2 }, { wA: -2.8, reach: 0.8, twist: -1.2, glow: 0.8 }], 300), active: P([{ wA: 0.5, reach: 1, lean: 8, crouch: 0.5, glow: 1 }, { wA: 1.2, reach: 1, lean: 8, crouch: 0.7 }], 140), recover: P([{ wA: 1.1, reach: 0.8, crouch: 0.5 }, { wA: 0.6, crouch: 0.2 }], 320) },
        titans_rampage: { open: P([{ lean: 4, crouch: 0.4, tailA: 0.3, wA: 1.2, wB: -0.6 }], 260), active: P([{ lean: 8, legL: 10, legR: -10, liftR: 6, wA: -0.5, wB: 1.2, tailA: 0.5 }, { lean: 8, legL: -10, legR: 10, liftL: 6, wA: 1.2, wB: -0.5, tailB: 0.5 }], 120), recover: P([{ lean: -3, crouch: 0.5, wA: -1.0, wB: -1.0, reach: 1, offReach: 1 }, { crouch: 0.3 }], 260) },
        maelstrom_grip: { open: P([{ wA: -1.4, wB: -1.4, reach: 1, offReach: 1, hands: 1 }], 300), active: P([{ wA: -0.6, wB: -0.6, reach: 1, offReach: 1, hands: 1, glow: 1 }, { wA: -2.6, reach: 1, glow: 1, wB: -0.6 }, { wA: 0.4, reach: 1, lean: 6, glow: 0.8 }], 200), recover: P([{ wA: 0.8, wB: 0.8 }], 280) },
        worldbreaker_descent: { open: P([{ crouch: 1, tailA: -0.5, tailB: -0.5, wing: 1 }, { crouch: 1.2, wing: 1, glow: 0.8 }], 320), active: P([{ bob: -18, wing: 1, wA: -2.6, wB: -2.6, reach: 1, offReach: 1 }, { bob: 0, crouch: 0.9, wA: 1.4, wB: 1.4, reach: 1, offReach: 1, glow: 1 }], 200), recover: P([{ crouch: 0.8, wA: 1.3, wB: 1.3 }, { crouch: 0.4 }], 340) },
      },
    },
  },
  aion: {
    mini: {
      idle: { wA: 0.3, reach: 0.4, wB: 0.8, glow: 0.3 }, stride: 5, lift: 2, walkMs: 120, runMs: 80, run: { lean: 4, wA: 2.2 },
      light: [{ wA: -1.6, twist: -0.6 }, { wA: 0.2, reach: 1, lean: 3 }, { wA: 1.4, reach: 1, twist: 0.8 }, { wA: 1.0 }],
      heavy: [{ wA: -2.6, reach: 1 }, { wA: -2.9, reach: 1, glow: 0.8 }, { wA: 0.6, reach: 1, lean: 5 }, { wA: 1.4, reach: 1, crouch: 0.4 }, { wA: 1.0 }],
      cast: { wA: 1.57, grip2: 1, crouch: 0.4, glow: 0.8 }, summon: { wA: -2.6, reach: 1, glow: 1 },
      skills: {
        pendulum_reap: { open: P([{ wA: -1.9, twist: -0.8, crouch: 0.15, glow: 0.4 }, { wA: -2.3, twist: -1, crouch: 0.2, glow: 0.6 }], 180), active: P([{ wA: -0.6, reach: 1, lean: 3, glow: 0.8 }, { wA: 1.5, reach: 1, lean: 4, twist: 1, glow: 0.8 }], 90), recover: P([{ wA: 1.3, twist: 0.6 }, { wA: 1.0, twist: 0.3 }], 160) },
        time_skip: { open: P([{ wB: -1.5, offReach: 1, crouch: 0.4, dissolve: 0.15 }, { wB: -1.4, offReach: 1, crouch: 0.5, dissolve: 0.45 }], 120), active: P([{ wA: -1.6, crouch: 0.3, manifest: 1 }, { wA: 0.4, reach: 1, lean: 6 }], 100), recover: P([{ wA: 1.2, lean: 2 }, { wA: 0.9 }], 160) },
        suspended_blades: { open: P([{ wA: -2.8, reach: 1, glow: 0.6 }, { wA: -3.2, reach: 1, glow: 0.9 }], 180), active: P([{ wA: -2.2, reach: 1, glow: 1, wB: -1.0, offReach: 1 }, { wA: -3.3, reach: 1, glow: 1, wB: -1.2, offReach: 1 }], 160), recover: P([{ wA: 0.8 }], 200) },
        broken_hour: { open: P([{ wA: 1.57, grip2: 1, crouch: 0.4, glow: 0.8 }, { wA: 1.57, grip2: 1, crouch: 0.5, glow: 1 }], 220), active: P([{ wA: -1.8, crouch: 0.3, lean: 2 }, { wA: 1.0, reach: 1, lean: 8, crouch: 0.2 }], 110), recover: P([{ wA: 0.9, crouch: 0.2 }], 200) },
      },
    },
    ultimate: {
      idle: { wA: 0.4, reach: 0.4, wB: 0.8, glow: 0.5 }, stride: 9, lift: 4, walkMs: 170, runMs: 120, run: { lean: 5, wA: 2.2 },
      light: [{ wA: -1.6, twist: -0.6 }, { wA: 0.2, reach: 1, lean: 5 }, { wA: 1.4, reach: 1, twist: 0.8 }, { wA: 1.0 }],
      heavy: [{ wA: -2.6, reach: 1 }, { wA: -2.9, reach: 1, glow: 1 }, { wA: 0.6, reach: 1, lean: 6 }, { wA: 1.4, reach: 1, crouch: 0.4 }, { wA: 1.0 }],
      cast: { wA: -2.6, reach: 1, glow: 1 }, summon: { wA: -2.6, reach: 1, glow: 1 },
      skills: {
        epoch_split: { open: P([{ wA: -2.6, reach: 1, glow: 1, bob: -2 }, { wA: -2.8, reach: 1, glow: 1, bob: -3, dissolve: 0.1 }], 260), active: P([{ wA: -0.3, reach: 1, lean: 4 }, { wA: 1.4, reach: 1, twist: 1 }], 140), recover: P([{ wA: 1.0 }, { wA: 0.7 }], 240) },
        still_moment: { open: P([{ wA: 2.0, reach: 1, crouch: 0.3 }, { wA: -2.0, reach: 1, glow: 1 }], 260), active: P([{ wA: -2.4, reach: 1, wB: -1.5, offReach: 1, glow: 1 }], 300), recover: P([{ wA: 0.8 }], 260) },
        requiem_rewind: { open: P([{ wA: -1.2, lean: 3, legL: 5, legR: -5 }, { wA: -1.6, lean: 3, legL: -5, legR: 5 }], 200), active: P([{ wA: -2.9, reach: 1, glow: 1, dissolve: 0.25 }, { wA: 0.9, reach: 1, glow: 1 }], 160), recover: P([{ wA: 0.8, crouch: 0.2 }], 260) },
        zero_hour: { open: P([{ wA: 1.57, grip2: 1, crouch: 0.5, glow: 0.7 }, { wA: -3, reach: 1, glow: 1, bob: -3 }, { wA: -3.1, reach: 1, glow: 1, bob: -4, wB: -1.6, offReach: 1 }], 380), active: P([{ wA: -2.9, reach: 1, glow: 1, wB: -1.6, offReach: 1 }, { wA: 1.3, reach: 1, lean: 5, glow: 1 }], 220), recover: P([{ kneel: 0.4, wA: 1.4, glow: 0.2 }, { kneel: 0.2, wA: 1.0 }, { wA: 0.8 }], 380) },
      },
    },
  },
  atlas: {
    mini: {
      idle: { wA: 0.5, wB: 0.5, reach: 0.4, offReach: 0.4, glow: 0.3 }, stride: 5, lift: 3, walkMs: 130, runMs: 90, run: { lean: 3, wA: 1.4, wB: 1.4 },
      light: [{ wA: -1.4, twist: -0.6 }, { wA: 0.3, reach: 1, lean: 3 }, { wA: 1.3, reach: 1 }, { wA: 0.8 }],
      heavy: [{ wA: -2.6, wB: -2.6, reach: 1, offReach: 1 }, { wA: -2.9, wB: -2.9, reach: 1, offReach: 1, glow: 0.8 }, { wA: 1.2, wB: 1.2, reach: 1, offReach: 1, crouch: 0.5, lean: 4 }, { wA: 0.9, wB: 0.9, crouch: 0.3 }],
      cast: { wB: -1.2, offReach: 1, glow: 1, hands: 1 }, summon: { wA: -1.5, wB: -1.5, reach: 1, offReach: 1, glow: 1 },
      skills: {
        blindside_gate: { open: P([{ wB: -1.4, offReach: 1, twist: 0.6, glow: 0.6 }, { wB: -1.0, offReach: 1, twist: 0.4, glow: 0.8 }], 180), active: P([{ wB: -0.2, offReach: 1, glow: 1, lean: 2 }], 260), recover: P([{ wB: 0.6 }], 200) },
        folded_lance: { open: P([{ wA: -0.4, wB: -0.4, reach: 0.3, offReach: 0.3, glow: 0.5, charge: 0.5 }, { wA: -0.2, wB: -0.2, reach: 0.5, offReach: 0.5, charge: 1, glow: 1 }], 200), active: P([{ wA: -0.1, reach: 1, wB: 0.6, lean: 4 }], 200), recover: P([{ wA: 0.6 }], 200) },
        rift_pursuit: { open: P([{ lean: 4, legL: 6, wA: -2.4, reach: 0.6, crouch: 0.3 }, { lean: 5, legL: 8, wA: -2.5, reach: 0.6, crouch: 0.3, dissolve: 0.4 }], 160), active: P([{ manifest: 1, wA: -2.6, reach: 1, crouch: 0.4 }, { wA: 1.3, reach: 1, lean: 6, twist: 1 }], 120), recover: P([{ wA: 1.0, crouch: 0.3 }], 220) },
        gravity_snare: { open: P([{ wB: -0.6, offReach: 0.5, hands: 1, glow: 0.8 }, { wB: -0.8, offReach: 0.4, hands: 1, glow: 1 }], 200), active: P([{ wB: -0.2, offReach: 1, lean: 3, glow: 1 }], 200), recover: P([{ wB: 0.8 }], 200) },
      },
    },
    ultimate: {
      idle: { wA: 0.6, wB: 0.6, reach: 0.4, offReach: 0.4, glow: 0.5 }, stride: 11, lift: 6, walkMs: 200, runMs: 140, run: { lean: 5 },
      light: [{ wA: -1.4 }, { wA: 0.3, reach: 1, lean: 5 }, { wA: 1.3, reach: 1 }, { wA: 0.8 }],
      heavy: [{ wA: -2.6, wB: -2.6, reach: 1, offReach: 1 }, { wA: -2.9, wB: -2.9, reach: 1, offReach: 1, glow: 1 }, { wA: 1.2, wB: 1.2, reach: 1, offReach: 1, crouch: 0.6 }, { wA: 0.9, wB: 0.9 }],
      cast: { wA: -1.5, wB: -1.5, reach: 1, offReach: 1, glow: 1 }, summon: { wA: -1.5, wB: -1.5, reach: 1, offReach: 1, glow: 1 },
      skills: {
        titan_through_rift: { open: P([{ wA: -2.0, reach: 1, glow: 0.8 }, { wA: -2.3, reach: 1, glow: 1 }], 280), active: P([{ wA: 0.3, reach: 1, lean: 6, glow: 1 }, { wA: 0.5, reach: 1, lean: 5, glow: 1 }], 200), recover: P([{ wA: 0.8 }], 280) },
        horizon_array: { open: P([{ wA: -1.5, wB: -1.5, reach: 1, offReach: 1, glow: 0.8 }], 300), active: P([{ wA: -1.3, wB: -1.3, reach: 1, offReach: 1, glow: 1, bob: -2 }, { wA: -1.4, wB: -1.2, reach: 1, offReach: 1, glow: 1, bob: -1 }], 240), recover: P([{ wA: 0.7, wB: 0.7 }], 280) },
        orbital_transference: { open: P([{ wA: -2.8, wB: -2.8, reach: 1, offReach: 1, glow: 1 }], 320), active: P([{ wA: -0.6, wB: -0.6, reach: 1, offReach: 1, lean: 4, glow: 1 }], 260), recover: P([{ wA: 0.8, wB: 0.8 }], 280) },
        worldfold: { open: P([{ wA: -1.6, wB: -1.6, reach: 1, offReach: 1, glow: 1, spread: 4 }, { wA: -2.6, wB: -2.6, reach: 1, offReach: 1, glow: 1, bob: -3 }], 420), active: P([{ wA: -1.2, wB: -1.2, reach: 1, offReach: 1, glow: 1, crouch: 0.4 }, { wA: 1.2, wB: 1.2, reach: 1, offReach: 1, lean: 5, glow: 1 }], 220), recover: P([{ kneel: 0.4, wA: 1.4, wB: 1.4 }, { wA: 0.8, wB: 0.8 }], 380) },
      },
    },
  },
  argus: {
    mini: {
      idle: { wA: 0.5, wB: 0.5, reach: 0.3, offReach: 0.3, open: 1, glow: 0.3 }, stride: 4, lift: 2, walkMs: 140, runMs: 100, run: { lean: 3, open: 1 },
      light: [{ wA: -1.0, open: 1 }, { wA: 0.1, reach: 1, lean: 3, open: 1 }, { wA: 0.8, open: 1 }],
      heavy: [{ wA: -2.4, wB: -2.4, reach: 1, offReach: 1, open: 1, charge: 0.6 }, { wA: -2.7, wB: -2.7, reach: 1, offReach: 1, open: 1, charge: 1 }, { wA: 0.4, wB: 0.4, reach: 1, offReach: 1, lean: 4, open: 1 }, { wA: 0.7, wB: 0.7, open: 1 }],
      cast: { wA: -1.2, wB: -1.2, reach: 0.8, offReach: 0.8, open: 1, charge: 1 }, summon: { charge: 1, open: 1, wA: -1.6, wB: -1.6, reach: 1, offReach: 1 },
      skills: {
        piercing_gaze: { open: P([{ open: 1, glow: 0.5, head: 1 }, { open: 1, glow: 1, crouch: 0.2 }], 200), active: P([{ open: 1, glow: 1, lean: -2 }], 200), recover: P([{ open: 0.2, glow: 0.1 }, { open: 1 }], 160) },
        oracle_lances: { open: P([{ wA: -1.6, wB: -1.6, reach: 1, offReach: 1, charge: 1, open: 1 }], 220), active: P([{ wA: -0.3, reach: 1, lean: 3, charge: 0.6, open: 1, wB: -1.6, offReach: 1 }, { wB: -0.3, offReach: 1, wA: 0.6, charge: 0.3, open: 1 }], 140), recover: P([{ wA: 0.6, wB: 0.6, open: 1 }], 180) },
        false_witnesses: { open: P([{ charge: 1, open: 0.6, wA: -1.2, wB: -1.2, reach: 0.8, offReach: 0.8 }], 220), active: P([{ charge: 1, open: 1, wA: -1.6, wB: -1.6, reach: 1, offReach: 1 }], 260), recover: P([{ charge: 0, open: 1 }], 180) },
        psychic_command: { open: P([{ wB: -0.4, offReach: 1, open: 1, glow: 0.6 }], 200), active: P([{ wB: -0.1, offReach: 1, lean: 3, glow: 1, open: 1 }], 180), recover: P([{ wB: 0.6, open: 1 }], 180) },
      },
    },
    ultimate: {
      idle: { wA: 0.5, wB: 0.5, reach: 0.3, offReach: 0.3, open: 1, glow: 0.5, charge: 0.4 }, stride: 6, lift: 3, walkMs: 200, runMs: 150, run: { lean: 3, open: 1 },
      light: [{ wA: -1.0, open: 1 }, { wA: 0.1, reach: 1, lean: 4, open: 1 }, { wA: 0.8, open: 1 }],
      heavy: [{ wA: -2.4, wB: -2.4, reach: 1, offReach: 1, open: 1, charge: 1 }, { wA: 0.4, wB: 0.4, reach: 1, offReach: 1, lean: 4, open: 1 }, { wA: 0.7, wB: 0.7, open: 1 }],
      cast: { wA: -2.4, wB: -2.4, reach: 1, offReach: 1, open: 1, charge: 1, glow: 1 }, summon: { wA: -2.4, wB: -2.4, reach: 1, offReach: 1, open: 1, charge: 1 },
      skills: {
        eyes_of_heaven: { open: P([{ wA: -2.4, wB: -2.4, reach: 1, offReach: 1, charge: 1, open: 1 }], 300), active: P([{ wA: -2.8, wB: -2.8, reach: 1, offReach: 1, charge: 1, glow: 1, open: 1 }], 260), recover: P([{ wA: 0.6, wB: 0.6, open: 1 }], 260) },
        sovereign_spearfield: { open: P([{ wA: -2.8, reach: 1, charge: 1, open: 1 }], 300), active: P([{ wA: 0.4, reach: 1, lean: 4, open: 1, charge: 0.6 }], 240), recover: P([{ wA: 0.6, open: 1 }], 260) },
        dominion_of_sight: { open: P([{ open: 1, glow: 1, head: -2 }], 300), active: P([{ open: 1, glow: 1, wA: -0.8, wB: -0.8, reach: 1, offReach: 1 }], 300), recover: P([{ open: 1, glow: 0.4 }], 260) },
        omniscient_judgment: { open: P([{ open: 0, charge: 0, glow: 0 }, { open: 0.4, charge: 0.5, glow: 0.6 }, { open: 1, glow: 1, charge: 1, bob: -2 }], 380), active: P([{ open: 1, glow: 1, charge: 1, crouch: 0.3 }, { open: 1, glow: 1, charge: 1, crouch: 0.35, lean: -2 }], 240), recover: P([{ open: 0.1, kneel: 0.3 }, { open: 0.5, kneel: 0.15 }, { open: 1 }], 380) },
      },
    },
  },
  anubis: {
    mini: {
      idle: { wA: 0.4, reach: 0.4, wB: 0.8, glow: 0.3 }, stride: 6, lift: 3, walkMs: 115, runMs: 80, run: { lean: 4, wA: 2.2 },
      light: [{ wA: -1.6, twist: -0.6 }, { wA: 0.2, reach: 1, lean: 3 }, { wA: 1.4, reach: 1, twist: 0.8 }, { wA: 1.0 }],
      heavy: [{ wA: -2.6, reach: 1, glow: 0.6 }, { wA: -2.9, reach: 1, glow: 1 }, { wA: 0.6, reach: 1, lean: 5 }, { wA: 1.4, reach: 1, crouch: 0.4 }, { wA: 1.0 }],
      cast: { wA: -2.8, reach: 1, glow: 0.8 }, summon: { wA: -2.9, reach: 1, wB: -1.5, offReach: 1, glow: 1 },
      skills: {
        reapers_dance: { open: P([{ wA: -1.8, twist: -1, crouch: 0.2 }], 170), active: P([{ wA: 0.4, reach: 1, lean: 3, twist: 0.3 }, { wA: -1.2, reach: 1, twist: -1, lean: 2 }, { wA: 1.5, reach: 1, twist: 1.2, lean: 5 }], 120), recover: P([{ wA: 1.1, crouch: 0.3 }, { wA: 0.8, crouch: 0.15 }], 180) },
        soul_chains: { open: P([{ wB: -1.2, offReach: 1, glow: 0.6 }], 200), active: P([{ wB: -0.1, offReach: 1, lean: 3, glow: 1 }, { wB: 0.4, offReach: 0.6, lean: -2 }], 160), recover: P([{ wB: 0.7 }], 180) },
        grave_step: { open: P([{ lean: -2, crouch: 0.4, wA: -1.4, dissolve: 0.2 }], 160), active: P([{ lean: 8, wA: 1.2, reach: 1, legL: 7, legR: -6 }], 140), recover: P([{ wA: 1.0, crouch: 0.3 }], 200) },
        wraith_hunt: { open: P([{ wA: -2.8, reach: 1, glow: 0.8 }], 240), active: P([{ wA: -2.9, reach: 1, wB: -1.5, offReach: 1, glow: 1 }], 280), recover: P([{ wA: 0.8 }], 200) },
      },
    },
    ultimate: {
      idle: { wA: 0.4, reach: 0.4, wB: 0.8, glow: 0.5 }, stride: 10, lift: 5, walkMs: 180, runMs: 130, run: { lean: 5, wA: 2.2 },
      light: [{ wA: -1.6, twist: -0.6 }, { wA: 0.2, reach: 1, lean: 5 }, { wA: 1.4, reach: 1, twist: 0.8 }, { wA: 1.0 }],
      heavy: [{ wA: -2.6, reach: 1, glow: 0.8 }, { wA: -2.9, reach: 1, glow: 1 }, { wA: 0.6, reach: 1, lean: 6 }, { wA: 1.4, reach: 1, crouch: 0.4 }, { wA: 1.0 }],
      cast: { wA: -2.8, reach: 1, glow: 1, wB: -1.5, offReach: 1 }, summon: { wA: -2.9, reach: 1, wB: -1.5, offReach: 1, glow: 1 },
      skills: {
        death_procession: { open: P([{ wB: -1.6, offReach: 1, wA: -0.5, glow: 0.8 }, { wB: -2.0, offReach: 1, wA: -0.6, glow: 1 }], 300), active: P([{ wB: -0.4, offReach: 1, lean: 3, glow: 1 }], 300), recover: P([{ wB: 0.8 }], 260) },
        gates_of_underworld: { open: P([{ wA: -2.8, reach: 1, glow: 0.8 }], 300), active: P([{ wA: 1.57, grip2: 1, crouch: 0.5, glow: 1 }], 260), recover: P([{ wA: 0.8 }], 260) },
        judgment_chains: { open: P([{ wA: -1.6, wB: -1.6, reach: 1, offReach: 1, glow: 1 }], 300), active: P([{ wA: -0.4, wB: -0.4, reach: 1, offReach: 1, lean: 4, glow: 1 }], 260), recover: P([{ wA: 0.8, wB: 0.8 }], 260) },
        final_passage: { open: P([{ wA: 1.57, grip2: 1, crouch: 0.5, glow: 0.8 }, { wA: 1.57, grip2: 1, crouch: 0.4, glow: 1, bob: -2 }, { wA: -2.9, reach: 1, glow: 1, bob: -3 }], 420), active: P([{ wA: 0.4, reach: 1, lean: 6, glow: 1 }, { wA: 1.5, reach: 1, twist: 1, lean: 5, glow: 1 }], 200), recover: P([{ kneel: 0.4, wA: 1.4 }, { kneel: 0.2, wA: 1.0 }, { wA: 0.8 }], 380) },
      },
    },
  },
};

export const GENERIC_CLIPS = ['spawn', 'idle', 'turn', 'walk', 'run', 'alert', 'charge', 'light_attack', 'heavy_attack', 'skill_start', 'skill_loop', 'skill_release', 'recover', 'hurt', 'stagger', 'summon', 'collapse', 'death'];

// ---------------- In-between engine ----------------
// Key poses are authored above; every clip is generated by easing between keys (anticipation → wind-up → held
// tension → snap strike with smear + overshoot → spring settle). Phase lengths come from skillTiming.json, which
// is MEASURED from the real gameplay scripts, so animation frames and hitbox events share one timeline.
const TM = TIMING as Record<string, number>;
const DEF: Record<string, number> = { bob: 0, lean: 0, crouch: 0, twist: 0, legL: 0, legR: 0, liftL: 0, liftR: 0, spread: 0, wA: 0.9, reach: 0.5, wB: 0.9, offReach: 0.5, grip2: 0, glow: 0.25, charge: 0, open: 1, kneel: 0, fall: 0, dissolve: 0, hurt: 0, tailA: 0, tailB: 0, punchL: 0, punchR: 0, hands: 0, head: 0, wing: 0, manifest: 0 };
const NUM = Object.keys(DEF);
const C01 = new Set(['kneel', 'fall', 'dissolve', 'charge', 'open', 'hurt', 'manifest', 'wing', 'reach', 'offReach']);
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o: Record<string, number> = {};
  for (const k of NUM) {
    const av = (a as Record<string, number>)[k] ?? DEF[k], bv = (b as Record<string, number>)[k] ?? DEF[k];
    let x = av + (bv - av) * t;
    if (C01.has(k)) x = Math.max(0, Math.min(k === 'reach' || k === 'offReach' ? 1.15 : 1, x));
    if (k === 'glow') x = Math.max(0, Math.min(1.2, x));
    o[k] = x;
  }
  o.grip2 = o.grip2 >= 0.5 ? 1 : 0; o.hands = o.hands >= 0.5 ? 1 : 0;
  return o as Pose;
}
const EASE = {
  io: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t,
  back: (t: number) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  lin: (t: number) => t,
};
interface Seg { to: Pose; ms: number; ease: keyof typeof EASE; hold?: number; smear?: boolean; mark?: string }
function tween(start: Pose, segs: Seg[], frameMs: number): { frames: ClipFrame[]; marks: [number, string][] } {
  const frames: ClipFrame[] = [], marks: [number, string][] = [];
  let prev = start, prevWA = start.wA ?? DEF.wA, fi = 0;
  for (const s of segs) {
    if (s.mark) marks.push([frames.length, s.mark]);
    // Contact is a pose, not a tween. Dead Cells' workflow deliberately avoids interpolation
    // through the key contact: snap there in one frame, hold it for its real gameplay duration,
    // then add interpolation on the follow-through/recovery side.
    const n = s.mark === 'ACTIVE' ? 1 : s.smear ? Math.max(1, Math.min(3, Math.round(s.ms / frameMs))) : Math.max(1, Math.min(10, Math.round(s.ms / frameMs)));
    for (let j = 1; j <= n; j++) {
      const p = lerpPose(prev, s.to, EASE[s.ease](j / n)); p.f = fi++;
      if (Math.abs((p.wA ?? 0) - prevWA) > 0.4) p.smear = prevWA;
      if (s.smear) {
        // arc + breakdown: limbs do not travel in straight lines; add a mid-swing bow and body counter-shove
        const m = Math.sin(Math.PI * (j / n));
        p.reach = Math.max(0.05, (p.reach ?? DEF.reach) - 0.14 * m);
        const dl = Math.sign(((s.to.lean ?? 0) - (prev.lean ?? 0)) || 1);
        p.lean = (p.lean ?? 0) + 0.85 * m * dl;
        p.bob = (p.bob ?? 0) - 0.5 * m;
        p.twist = (p.twist ?? 0) + 0.07 * m * Math.sign(((s.to.twist ?? 0) - (prev.twist ?? 0)) || 1);
      }
      // secondary motion: tails / mane / wings / head lag behind the torso twist and settle on the next frames
      const dt = (p.twist ?? 0) - (prev.twist ?? 0);
      if (Math.abs(dt) > 0.01) { p.tailA = (p.tailA ?? 0) - dt * 0.8; p.tailB = (p.tailB ?? 0) - dt * 1.1; p.head = (p.head ?? 0) + dt * 0.35; p.wing = Math.min(1, Math.max(0, (p.wing ?? 0) + Math.abs(dt) * 0.35)); }
      const dl = (p.lean ?? 0) - (prev.lean ?? 0); if (Math.abs(dl) > 0.5) { p.bob = (p.bob ?? 0) - dl * 0.12; p.kneel = Math.max(0, Math.min(1, (p.kneel ?? 0) + Math.max(0, dl) * 0.02)); }
      prevWA = p.wA ?? DEF.wA; frames.push({ p, ms: Math.max(16, s.ms / n) });
    }
    if (s.hold && s.hold > 30) { // held tension: micro-tremble + glow pulse variants (no exact consecutive duplicates)
      const k = Math.max(1, Math.min(8, Math.round(s.hold / 85)));
      for (let j = 0; j < k; j++) {
        const p = lerpPose(s.to, s.to, 1);
        const alt = j % 2 ? 1 : -1;
        p.bob = (p.bob ?? 0) + alt * 0.8; p.glow = Math.min(1.2, (p.glow ?? 0.25) + (j % 2 ? 0.16 : 0.05)); p.twist = (p.twist ?? 0) + alt * 0.09;
        p.crouch = Math.max(0, (p.crouch ?? 0) + alt * 0.03); p.head = (p.head ?? 0) + alt * 0.18; p.spread = (p.spread ?? 0) + alt * 0.25;
        p.f = fi++; prevWA = p.wA ?? DEF.wA; frames.push({ p, ms: s.hold / k });
      }
    }
    prev = s.to;
  }
  return { frames, marks };
}
function mk(name: string, frames: ClipFrame[], loop: boolean, evs: [number, string][] = []): Clip {
  return { name, frames, loop, events: evs.map(([frame, tag]) => ({ frame: Math.min(frame, frames.length - 1), tag })) };
}
const merge = (a: Pose, b: Pose): Pose => ({ ...a, ...b });
const T = (k: string, fb: number) => TM[k] ?? fb;

export function buildClips(boss: BossId, form: Form): Record<string, Clip> {
  const st = STYLES[boss][form], I = st.idle, out: Record<string, Clip> = {}, U = form === 'ultimate';
  const FM = U ? 62 : 50, key = (n: string) => `${boss}/${form}/${n}`;
  const seq = (name: string, start: Pose, segs: Seg[], loop = false, extra: [number, string][] = [], fm = FM) => { const r = tween(start, segs, fm); out[name] = mk(name, r.frames, loop, [...r.marks, ...extra]); return out[name]; };
  const antic = (next: Pose): Pose => merge(I, { crouch: (I.crouch ?? 0) + 0.2, lean: -1.6, twist: (I.twist ?? 0) - Math.sign(next.twist ?? 1) * 0.25, bob: 1, glow: (I.glow ?? 0.25) + 0.1 });

  // idle: breathing cycle, weapon sway, tail/wing secondary motion
  out.idle = mk('idle', Array.from({ length: 8 }, (_, i) => { const ph = (i / 8) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return { p: merge(I, { bob: 0.6 + 0.7 * s, crouch: (I.crouch ?? 0) + 0.03 * s, wA: (I.wA ?? DEF.wA) + 0.06 * s, wB: (I.wB ?? DEF.wB) - 0.07 * c, glow: (I.glow ?? 0.25) + 0.1 * (s + 1) * 0.5, tailA: 0.25 * s, tailB: 0.25 * c, head: s > 0.7 ? 0.5 : 0, wing: 0.15 + 0.1 * s, f: i }), ms: U ? 170 : 140 }; }), true);
  // walk / run: contact-down / passing-up, counter-swinging arms, shoulder rotation, secondary tails
  const cyc = (n: number, ms: number, extra: Pose, k: number, runB: number) => Array.from({ length: n }, (_, i) => {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return { p: merge(I, { ...extra, legL: s * st.stride * k, legR: -s * st.stride * k, liftL: Math.max(0, c) * st.lift * k, liftR: Math.max(0, -c) * st.lift * k, bob: Math.abs(s) * runB, twist: s * 0.22 * k, wB: (extra.wB ?? I.wB ?? DEF.wB) - s * 0.4 * k, wA: (extra.wA ?? I.wA ?? DEF.wA) + s * 0.1 * k, tailA: s * 0.6, tailB: -s * 0.6, head: Math.abs(c) > 0.9 ? 0.5 : 0, f: i }), ms } as ClipFrame;
  });
  out.walk = mk('walk', cyc(8, (st.walkMs * 6) / 8, {}, 1, 1.2), true, [[0, 'FOOT_L'], [4, 'FOOT_R']]);
  out.run = mk('run', cyc(8, (st.runMs * 6) / 8, st.run, 1.35, 2.2), true, [[0, 'FOOT_L'], [4, 'FOOT_R']]);
  seq('turn', I, [{ to: merge(I, { twist: -0.7, crouch: (I.crouch ?? 0) + 0.1 }), ms: 70, ease: 'out' }, { to: merge(I, { twist: 0.25 }), ms: 70, ease: 'io' }, { to: I, ms: 60, ease: 'out' }]);
  seq('spawn', merge(I, { dissolve: 1, crouch: 0.7, glow: 1 }), [{ to: merge(I, { dissolve: 0.45, crouch: 0.6, glow: 1 }), ms: 300, ease: 'out' }, { to: merge(I, { dissolve: 0, crouch: 0.35, glow: 0.9, bob: 1 }), ms: 250, ease: 'io' }, { to: merge(I, { bob: -1, glow: 0.7 }), ms: 120, ease: 'out' }, { to: I, ms: 150, ease: 'back' }], false, [[0, 'OPEN']]);
  const roar = merge(I, { bob: -1, head: -1.5, glow: 1, open: 1, wB: -0.9, offReach: 1, twist: 0.2, wing: 1 });
  seq('alert', I, [{ to: antic(roar), ms: 140, ease: 'out' }, { to: roar, ms: 110, ease: 'back', hold: 240, mark: 'ROAR' }, { to: I, ms: 220, ease: 'io' }]);
  out.charge = mk('charge', Array.from({ length: 6 }, (_, i) => ({ p: merge(st.cast, { charge: 0.75 + 0.25 * Math.sin(i), glow: 0.85 + 0.15 * Math.cos(i * 2), bob: i % 2, f: i }), ms: 95 })), true);
  const atk = (name: string, keys: Pose[], fb: number, activeAt: number) => {
    const D = T(key(name), fb), ks = keys.map((k) => merge(I, k)), w0 = D * 0.32, wA = D * 0.38 / Math.max(1, ks.length - 1 - activeAt + 1), w1 = D * 0.3;
    const segs: Seg[] = [{ to: antic(ks[0]), ms: w0 * 0.4, ease: 'out', mark: 'OPEN' }];
    ks.forEach((k, i) => segs.push(i < activeAt ? { to: k, ms: (w0 * 0.6) / Math.max(1, activeAt), ease: 'io', hold: i === activeAt - 1 ? 60 : 0 } : { to: k, ms: wA, ease: i === ks.length - 1 ? 'back' : 'out', smear: true, mark: i === activeAt ? 'ACTIVE' : undefined }));
    segs.push({ to: I, ms: w1, ease: 'io', mark: 'RECOVERY' });
    seq(name, I, segs);
  };
  atk('light_attack', st.light, 580, 1);
  atk('heavy_attack', st.heavy, 760, 2);
  seq('skill_start', I, [{ to: antic(st.cast), ms: 110, ease: 'out', mark: 'OPEN' }, { to: merge(st.cast, { charge: 0.5 }), ms: 160, ease: 'io' }, { to: merge(st.cast, { charge: 0.9 }), ms: 120, ease: 'out' }]);
  out.skill_loop = mk('skill_loop', Array.from({ length: 6 }, (_, i) => ({ p: merge(st.cast, { charge: 0.85 + 0.15 * Math.sin(i * 1.05), glow: 0.9 + 0.1 * Math.cos(i * 2.1), bob: i % 3 === 0 ? 1 : 0, twist: 0.05 * Math.sin(i), f: i }), ms: 90 })), true, [[0, 'SUSTAIN']]);
  seq('skill_release', st.cast, [{ to: merge(st.cast, { lean: 4, glow: 1.1, crouch: 0.2 }), ms: 70, ease: 'out', smear: true, mark: 'ACTIVE' }, { to: merge(I, { lean: 2, glow: 0.7 }), ms: 140, ease: 'back' }, { to: I, ms: 150, ease: 'io' }]);
  seq('recover', merge(I, { crouch: 0.4, glow: 0.2, lean: 2 }), [{ to: merge(I, { crouch: 0.25, lean: 1 }), ms: 140, ease: 'out', mark: 'RECOVERY' }, { to: merge(I, { crouch: -0.05, bob: -0.5 }), ms: 130, ease: 'io' }, { to: I, ms: 120, ease: 'back', mark: 'END' }]);
  seq('hurt', merge(I, { hurt: 1, lean: -4, head: 1.5 }), [{ to: merge(I, { hurt: 0.5, lean: -2.5, crouch: 0.2 }), ms: 60, ease: 'out' }, { to: merge(I, { lean: 0.8 }), ms: 90, ease: 'io' }, { to: I, ms: 90, ease: 'back' }]);
  seq('stagger', merge(I, { hurt: 1, lean: -5, crouch: 0.3 }), [{ to: merge(I, { lean: -3, crouch: 0.55, head: 2.5, twist: 0.4 }), ms: 160, ease: 'out' }, { to: merge(I, { kneel: 0.35, head: 2.5, twist: -0.3, glow: 0.1 }), ms: 220, ease: 'io', hold: 180 }, { to: merge(I, { crouch: 0.35, lean: 1 }), ms: 200, ease: 'io' }, { to: I, ms: 150, ease: 'back' }]);
  seq('summon', I, [{ to: antic(st.summon), ms: 140, ease: 'out' }, { to: st.summon, ms: 160, ease: 'io' }, { to: merge(st.summon, { glow: 1.1, bob: -1 }), ms: 100, ease: 'back', hold: 160, mark: 'SPAWN' }, { to: I, ms: 200, ease: 'io' }]);
  seq('collapse', I, [{ to: merge(I, { hurt: 1, lean: -4 }), ms: 80, ease: 'out' }, { to: merge(I, { kneel: 0.45, head: 2, glow: 0.2, lean: -1 }), ms: 220, ease: 'io' }, { to: merge(I, { kneel: 0.85, head: 3, fall: 0.3, glow: 0.1 }), ms: 220, ease: 'in' }, { to: merge(I, { kneel: 1, fall: 0.62, head: 4, glow: 0 }), ms: 180, ease: 'out' }]);
  const dead = merge(I, { kneel: 1, fall: 0.8, head: 4, glow: 0 });
  seq('death', I, [{ to: merge(I, { hurt: 1, lean: -5, head: 1 }), ms: 80, ease: 'out', mark: 'OPEN' }, { to: merge(I, { kneel: 0.6, fall: 0.2, head: 2, lean: -2, glow: 0.3 }), ms: 260, ease: 'io' }, { to: merge(I, { kneel: 1, fall: 0.6, head: 3.5, glow: 0.1 }), ms: 240, ease: 'in' }, { to: merge(dead, { bob: 1 }), ms: 120, ease: 'out' }, { to: dead, ms: 100, ease: 'out' }, { to: merge(dead, { dissolve: 0.28 }), ms: 420, ease: 'lin', mark: 'TERMINAL' }]);
  out.death.events = [{ frame: 0, tag: 'OPEN' }, { frame: out.death.frames.length - 1, tag: 'TERMINAL' }];

  for (const id of SKILL_IDS[boss][form]) {
    const sk = st.skills[id];
    // planted footwork: wind-up shifts weight onto the rear foot, strikes step the lead foot in proportion to body lean
    const foot = (p: Pose, k: number): Pose => (p.legL !== undefined || p.kneel ? p : { ...p, legL: (p.lean ?? 0) * 1.3 * k, legR: -(p.lean ?? 0) * 0.5 * k, liftR: Math.abs(p.lean ?? 0) > 4 ? 1 : 0 });
    const ok = sk.open[0].map((p) => merge(I, foot({ ...p, lean: (p.lean ?? 0) - 1.2, legR: p.legR ?? -st.stride * 0.6 }, 1)));
    const ak = sk.active[0].map((p, i) => {
      const x = { ...p, glow: Math.max(p.glow ?? I.glow ?? 0.25, 0.65), legL: (p.legL ?? 0) + (i === 0 ? 2 : 0) };
      // Typhon's action read is anatomy, not magic: extreme shoulder rotation, a planted rear foot
      // and a little more reach on contact. Ultimate already has mass; Mini needs the exaggeration.
      if (boss === 'typhon' && i === 0) { x.reach = Math.max(x.reach ?? 0.5, 1.12); x.offReach = Math.max(x.offReach ?? 0.5, 0.75); x.twist = (x.twist ?? 0) + 0.35; x.lean = (x.lean ?? 0) + 2; x.legL = (x.legL ?? 0) + st.stride * 0.45; x.legR = (x.legR ?? 0) - st.stride * 0.35; }
      return merge(I, foot(x, 1));
    });
    const rk = sk.recover[0].map((p) => merge(I, foot(p, 0.6)));
    const Do = T(key(`${id}_open`), sk.open[1] * ok.length + 150), Da = T(key(`${id}_active`), sk.active[1] * ak.length), Dr = T(key(`${id}_recover`), sk.recover[1] * rk.length + 120);
    // OPEN: anticipation dip (18%) → eased wind-up through keys (52%) → held tension with tremble (30%)
    const holdShare = Do > 320 ? 0.3 : 0.12;
    seq(`${id}_open`, I, [{ to: antic(ok[0]), ms: Do * 0.18, ease: 'out', mark: 'OPEN' }, ...ok.map((k, i): Seg => ({ to: k, ms: (Do * (0.82 - holdShare)) / ok.length, ease: 'io', hold: i === ok.length - 1 ? Do * holdShare : 0, mark: i === ok.length - 1 ? 'COMMIT' : undefined }))]);
    // ACTIVE: snap strikes (ease-out, smear), last key overshoots into follow-through
    // impact hold: the fully-extended strike pose is held ~2.4x longer than transition frames
    const w = ak.map((_, i) => (i === 0 ? 2.4 : 1)), ws = w.reduce((a, b) => a + b, 0);
    seq(`${id}_active`, ok[ok.length - 1], ak.map((k, i): Seg => ({ to: { ...k, bob: (k.bob ?? 0) + (i === 0 ? -1 : i === ak.length - 1 ? 1 : 0) }, ms: (Da * w[i]) / ws, ease: i === ak.length - 1 ? 'back' : 'out', smear: true, mark: i === 0 ? 'ACTIVE' : undefined })), false, [], FM * 0.8);
    // RECOVER: heavy settle through recovery keys, spring back to idle stance
    seq(`${id}_recover`, ak[ak.length - 1], [...rk.map((k, i): Seg => ({ to: k, ms: (Dr * 0.62) / rk.length, ease: 'out', mark: i === 0 ? 'RECOVERY' : undefined, hold: i === rk.length - 1 ? Dr * 0.1 : 0 })), { to: I, ms: Dr * 0.28, ease: 'back', mark: 'END' }]);
  }
  return out;
}
export function clipDuration(c: Clip) { return c.frames.reduce((a, f) => a + f.ms, 0); }
export function frameAt(c: Clip, ms: number) {
  const tot = clipDuration(c);
  let t = c.loop ? ((ms % tot) + tot) % tot : Math.min(ms, tot - 1);
  for (let i = 0; i < c.frames.length; i++) { if (t < c.frames[i].ms) return i; t -= c.frames[i].ms; }
  return c.frames.length - 1;
}
