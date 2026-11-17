import type { Entity, StationHardware } from './core';

/** Shared live-placement/save grammar. This is hardware only: no energy, queue,
 * output, remote generator ID or enabled production setting can ride in a pack. */
export function validStationHardware(key: string, value: unknown): value is StationHardware {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const h = value as StationHardware;
  if (h.version !== 'station-hardware-v1') return false;
  if (key === 'deploy_workbench') return Object.keys(h).every(k => ['version','level','industrial'].includes(k)) &&
    (h.level === 2 || h.level === 3) && (h.industrial === undefined || h.industrial === true);
  if (key === 'deploy_furnace') return Object.keys(h).every(k => ['version','lining'].includes(k)) && h.lining === true;
  return false;
}

export function packedStationHardware(e: Entity): StationHardware | undefined {
  if (e.type === 'workbench' && (e.station?.level === 2 || e.station?.level === 3))
    return { version:'station-hardware-v1', level:e.station.level, ...(e.industrial ? {industrial:true as const} : {}) };
  if (e.type === 'furnace' && e.station?.upgrade === 'kiln_lining')
    return { version:'station-hardware-v1', lining:true };
  return undefined;
}

export function restoreStationHardware(e: Entity) {
  const h=e.deployed?.stationHardware;
  if (!h || !e.station || !validStationHardware(e.deployed!.key,h)) return;
  if (e.type === 'workbench') {
    e.station.level=h.level;
    if (h.industrial) e.industrial={enabled:false}; // a new site must be explicitly rewired
  } else if (e.type === 'furnace' && h.lining) e.station.upgrade='kiln_lining';
}
