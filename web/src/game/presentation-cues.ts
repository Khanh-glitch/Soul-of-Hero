// B06 presentation cue contract. Derives typed cues ONLY from receipts the engine already committed
// (engine.ts receipt()). It does not add state, does not decide outcomes, and emits nothing for kinds it does
// not map. Each cue carries its cause receipt id, so presentation can trace a cue to a committed event.
export interface Receipt { id: string; seq: number; at: number; kind: string; detail: string }
export type CueKind =
  | 'station_job_done' | 'station_state_changed' | 'power_fuel_consumed' | 'core_committed' | 'structure_destroyed'
  | 'territory_collapsed' | 'poi_door_closed' | 'poi_power_expired' | 'loot_depleted' | 'loot_respawned' | 'tool_broke'
  | 'heat_out' | 'offline_settled' | 'elder_defeated' | 'airdrop_landed' | 'airdrop_opened' | 'recycle_finished' | 'oil_extracted' | 'turret_fired'
  | 'hand_craft' | 'recipe_learned' | 'research_started' | 'structure_built' | 'garden_harvested' | 'achievement'
  | 'cash_secured' | 'supply_requisition' | 'freight_paid' | 'vehicle_mounted' | 'vehicle_exited' | 'vehicle_refueled' | 'vehicle_repaired' | 'cash_unsealed' | 'harvested' | 'station_upgraded' | 'structure_upgraded' | 'item_repaired' | 'job_queued';
export interface Cue { kind: CueKind; cause: string; receiptId: string; at: number; subject: string; detail: string }

// receipt kind → cue, with the subject taken from the first detail segment (the committed entity/id) only.
const MAP: Record<string, { cue: CueKind; subject: (d: string) => string }> = {
  'job.done': { cue: 'station_job_done', subject: d => d.split(':')[0] },
  'job.queue': { cue: 'job_queued', subject: d => d.split('@')[1] ?? '' },
  'craft.hand': { cue: 'hand_craft', subject: d => d },
  'learn.blueprint': { cue: 'recipe_learned', subject: d => d },
  'research.specimen': { cue: 'research_started', subject: d => d },
  'build': { cue: 'structure_built', subject: d => d.split('@')[0] },
  'garden.harvest': { cue: 'garden_harvested', subject: d => d },
  'harvest': { cue: 'harvested', subject: d => d.split('@')[0] },
  'station.upgrade': { cue: 'station_upgraded', subject: d => d.split(':')[0] },
  'furnace.upgrade': { cue: 'station_upgraded', subject: d => d },
  'power.upgrade': { cue: 'station_upgraded', subject: d => d },
  'cart.upgrade': { cue: 'station_upgraded', subject: d => d },
  'industrial.install': { cue: 'station_upgraded', subject: d => d },
  'structure.upgrade': { cue: 'structure_upgraded', subject: d => d.split(':')[0] },
  'item.repair': { cue: 'item_repaired', subject: d => d.split(':')[0] },
  'achievement': { cue: 'achievement', subject: d => d },
  'escrow.deposit': { cue: 'cash_secured', subject: d => d },
  'journey.requisition': { cue: 'supply_requisition', subject: d => d.split(':')[1] ?? d.split(':')[0] },
  'vendor.parcel': { cue: 'freight_paid', subject: d => d.split(' ')[0] },
  'vehicle.mount': { cue: 'vehicle_mounted', subject: d => d },
  'vehicle.exit': { cue: 'vehicle_exited', subject: d => d.split('@')[0] },
  'vehicle.refuel': { cue: 'vehicle_refueled', subject: d => d },
  'vehicle.repair': { cue: 'vehicle_repaired', subject: d => d },
  'airdrop.open': { cue: 'airdrop_opened', subject: d => d },
  'cash.mint': { cue: 'cash_unsealed', subject: d => d.split(':')[0] },
  'station.state': { cue: 'station_state_changed', subject: d => d.split(':')[0] },
  'power.fuel': { cue: 'power_fuel_consumed', subject: d => d.split(':')[0] },
  'core.commit': { cue: 'core_committed', subject: d => d.split(' ')[0].split(':')[0] },
  'struct.destroyed': { cue: 'structure_destroyed', subject: d => d.split(':')[0] },
  'territory.collapse': { cue: 'territory_collapsed', subject: d => d.split(':')[0] },
  'poi.door.close': { cue: 'poi_door_closed', subject: d => d },
  'poi.power.expire': { cue: 'poi_power_expired', subject: d => d },
  'loot.depleted': { cue: 'loot_depleted', subject: d => d.split(':').slice(1).join(':') },
  'loot.respawn': { cue: 'loot_respawned', subject: d => d.split(':').slice(1).join(':') },
  'tool.break': { cue: 'tool_broke', subject: d => d.split(':')[1] ?? d },
  'heat.out': { cue: 'heat_out', subject: d => d.split(':')[0] },
  'offline.settle': { cue: 'offline_settled', subject: () => 'run' },
  'elder.defeat': { cue: 'elder_defeated', subject: d => d },
  'airdrop.landed': { cue: 'airdrop_landed', subject: d => d },
  'recycle.finish': { cue: 'recycle_finished', subject: d => d.split(':')[0] },
  'pump.extract': { cue: 'oil_extracted', subject: d => d.split(':')[0] },
  'turret.fire': { cue: 'turret_fired', subject: d => d.split(':')[0] },
};
export const MAPPED_RECEIPT_KINDS = Object.keys(MAP);

/** Pure: receipts in commit order → cues. Unmapped kinds are dropped (not turned into invented cues). */
export function deriveCues(receipts: readonly Receipt[], afterSeq = 0): Cue[] {
  const out: Cue[] = [];
  for (const r of receipts) {
    if (r.seq <= afterSeq) continue;
    const m = MAP[r.kind]; if (!m) continue;
    out.push({ kind: m.cue, cause: r.kind, receiptId: r.id, at: r.at, subject: m.subject(r.detail), detail: r.detail });
  }
  return out;
}
