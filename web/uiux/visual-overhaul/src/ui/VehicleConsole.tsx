import { BAL, TILE, type Entity } from '../game/core';
import { C, cartWeight, countItem } from '../game/engine';
import { vehicleVisualKey } from '../game/industrial-art';
import { Icon, iconUrl, type Api } from './common';

/** Physical vehicle readout: engine decides every action, UI explains what's possible now. */
export function VehicleConsole({ api, e }: { api: Api; e: Entity }) {
  const r = api.gs.run!;
  if (!e.vehicle || !e.c) return null;
  const v = e.vehicle;
  const state = vehicleVisualKey(v.fuel, e.hp ?? 0);
  const mounted = r.player.vehicle === e.id;
  const otherBike = !!r.player.vehicle && !mounted;
  const fuelCount = countItem(r, 'inv', 'fuel_can');
  const partCount = countItem(r, 'inv', 'mechanical_parts');
  const fastenerCount = countItem(r, 'inv', 'fasteners');
  const lubeCount = countItem(r, 'inv', 'lubricant');
  const canRefuel = fuelCount > 0 && v.fuel + BAL.motorbike.canFuel <= BAL.motorbike.tank;
  const canRepair = !r.player.vehicle && (e.hp ?? 0) < BAL.motorbike.maxHp && partCount > 0 && fastenerCount > 0;
  const canLubricate = !r.player.vehicle && lubeCount > 0 && (v.lube ?? 0) < BAL.oilRefineryV1.lubricantDistancePx;
  const cargo = C(r, e.c).slots.filter(Boolean).length;
  const weight = cartWeight(r, e.c);
  const stranded = state !== 'ok';
  return <div className={`vehicle-console vehicle-console--${state}`}>
    <div className="vehicle-console__top">
      <img className="px" src={iconUrl(`st:vehicle_side_${state}`)} width={48} height={32} alt="" />
      <div><b>{state === 'broken' ? 'BROKEN' : state === 'empty' ? 'OUT OF FUEL' : 'READY'}</b><span>{e.deployed?.uid ? `Bike ${e.deployed.uid}` : 'Utility motorbike'}</span></div>
      <i className={`lamp ${state === 'broken' ? 'diamond' : 'round'}`} style={{ color: state === 'ok' ? 'var(--good)' : 'var(--bad)' }} />
    </div>
    <div className="vehicle-console__meters">
      <div><Icon k="fuel_can" size={12} /><span>FUEL</span><i><em style={{ width: `${Math.max(0, Math.min(100, v.fuel / BAL.motorbike.tank * 100))}%`, background: v.fuel > 0 ? 'var(--good)' : 'var(--bad)' }} /></i><b>{Math.floor(v.fuel)}/{BAL.motorbike.tank}</b></div>
      <div><Icon k="mechanical_parts" size={12} /><span>FRAME</span><i><em style={{ width: `${Math.max(0, Math.min(100, (e.hp ?? 0) / BAL.motorbike.maxHp * 100))}%`, background: (e.hp ?? 0) > 30 ? 'var(--info)' : 'var(--bad)' }} /></i><b>{Math.ceil(e.hp ?? 0)}/{BAL.motorbike.maxHp}</b></div>
      <div><Icon k="cart_kit" size={12} /><span>CARGO</span><i><em style={{ width: `${Math.max(0, Math.min(100, weight / BAL.motorbike.maxWeight * 100))}%`, background: 'var(--brassLit)' }} /></i><b>{weight.toFixed(0)}/{BAL.motorbike.maxWeight}</b></div>
    </div>
    <div className="vehicle-console__status">{cargo}/{BAL.motorbike.slots} slots · Lubrication: {v.lube ? `${Math.ceil(v.lube / TILE)} tiles protected` : 'none'}</div>
    <div className="vehicle-console__actions">
      <button className="btn gold" disabled={otherBike} onClick={() => { const res = api.act(mounted ? 'vehicleExit' : 'vehicleMount', { eid: e.id }); if (res.ok) api.open(null); }}>
        {mounted ? 'Dismount [F]' : state === 'ok' ? 'Mount & drive' : 'Mount · cannot move'}
      </button>
      <button className="btn" disabled={!canRefuel} title={fuelCount <= 0 ? 'Carry one Fuel Canister' : 'A full canister needs 100 tank space'} onClick={() => api.act('vehicleRefuel', { eid: e.id })}><Icon k="fuel_can" size={10} /> Refuel {fuelCount}/1</button>
      <button className="btn" disabled={!canRepair} title={mounted ? 'Dismount first' : (e.hp ?? 0) >= BAL.motorbike.maxHp ? 'Already sound' : `Parts ${partCount}/1 · Fasteners ${fastenerCount}/1`} onClick={() => api.act('vehicleRepair', { eid: e.id })}><Icon k="mechanical_parts" size={10} /> Repair {partCount}/1 + {fastenerCount}/1</button>
      <button className="btn" disabled={!canLubricate} title={mounted ? 'Dismount first' : lubeCount < 1 ? 'Carry one Machine Lubricant' : 'Lubrication is already full'} onClick={() => api.act('vehicleLubricate', { eid: e.id })}><Icon k="lubricant" size={10} /> Service {lubeCount}/1</button>
      {stranded && cargo > 0 && <button className="btn" disabled={mounted} onClick={() => api.act('vehicleUnloadBag', { eid: e.id })}>Unload {cargo} stacks → ground bag</button>}
    </div>
    {stranded && <div className="vehicle-console__next" role="status">{state === 'broken' ? 'Dismount; spend 1 Part + 1 Fastener to repair.' : 'Use 1 physical Fuel Canister. Cargo stays in the bike.'}</div>}
  </div>;
}