// Physically supplied bed rest. Every number comes from engine.restForecast / restSupply and the real
// chest custody. Nothing here moves items except the explicit Add / Start / Wake intents.
import { useState } from 'react';
import { ITEMS, STRUCTS } from '../game/catalog';
import { BAL, TILE, WW } from '../game/core';
import { roofRoom, restEligible, restForecast, countItem, owned } from '../game/engine';
import { Panel } from './common';
import type { Api } from './common';

const HOUR = 3600000;
const HOUR_LABEL = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function stackLabel(s: { key: string; qty: number; charge?: number }) {
  const d = ITEMS[s.key];
  return d?.waterContainer ? `${d.name} · ${s.charge ?? 0}/${d.charge ?? 0} drinks` : `${s.qty} ${d?.name || s.key}`;
}

export function RestPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const bed = r.entities[eid];
  const [chestId, setChestId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [hours, setHours] = useState<number>(BAL.restV1.durationsHours[1]);
  if (!bed || bed.type !== 'bed_straw') return null;
  const p = r.player; const trig = BAL.restV1.triggerStat;
  const close = () => api.open(null);

  if (r.rest) {
    const rs = r.rest; const rc = r.custody[rs.reserveId];
    const left = Math.max(0, rs.targetAt - api.now());
    return <Panel title="Resting on straw bed" style={{ left: 150, top: 40, width: 330 }} onClose={close}>
      <div style={{ fontSize: 11 }}><span>Wakes at</span> <b style={{ color: '#ffe27a' }} data-notr>{HOUR_LABEL(rs.targetAt)}</b> <span>{`(${(left / HOUR).toFixed(1)} h left)`}</span> <span>or sooner if supplies run out, the roof or bed is lost, or you leave the bed.</span></div>
      <div style={{ fontSize: 10, color: '#cfc2dc', marginTop: 3 }}>{`Hunger ${Math.round(p.hunger)} · Thirst ${Math.round(p.thirst)} · supplies are used at ${trig}.`} {`Eaten ${Math.round(rs.eatenHunger)} hunger, drunk ${Math.round(rs.drunkThirst)} thirst so far.`}</div>
      <div style={{ fontSize: 10, marginTop: 4 }}><b>Reserved beside you (real items, locked):</b></div>
      {rc?.slots.filter(Boolean).map(s => <div key={s!.uid} style={{ fontSize: 10 }} title={s!.uid}>{stackLabel(s!)}</div>) || <div style={{ fontSize: 10, color: '#8a7a9a' }}>none</div>}
      <div className="flex gap-1" style={{ marginTop: 5 }}><button className="btn ghost" onClick={() => api.act('restCancel', {})}>Wake up now</button></div>
      <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>Waking returns leftovers to the chest. Sheltered does not stop thirst.</div>
    </Panel>;
  }

  const room = roofRoom(r, bed.x!, bed.y!);
  const chests = Object.values(r.entities).filter(e => e.kind === 'struct' && ['chest_small', 'chest_large'].includes(e.type!) && owned(e) && (e.hp ?? 0) > 0 && e.c && Math.hypot(e.x - bed.x!, e.y - bed.y!) <= BAL.restV1.bedChestRadiusTiles * TILE && room.cells.has(Math.floor(e.y / TILE) * WW + Math.floor(e.x / TILE)));
  const chest = chests.find(c => c.id === chestId) ?? chests[0] ?? null;
  const contents = chest?.c ? r.custody[chest.c]?.slots.filter(Boolean) ?? [] : [];
  const chosen = picked.map(uid => contents.find(s => s!.uid === uid)).filter(Boolean) as NonNullable<typeof contents[number]>[];
  const fc = restForecast(r, chosen, hours);
  const eligibleCount = contents.filter(s => restEligible(s)).length;
  const mayStart = !!chest && chosen.length > 0 && chosen.length <= BAL.restV1.reserveSlots;
  return <Panel title="Straw bed · rest" style={{ left: 150, top: 40, width: 330 }} onClose={close}>
    {!chests.length && <div style={{ fontSize: 10, color: '#ffae89' }}>{`Rest needs an owned Wood Chest or Iron-bound Chest in this same shelter, within ${BAL.restV1.bedChestRadiusTiles} tiles of the bed.`}</div>}
    {chests.length > 0 && <div style={{ fontSize: 10 }}><span>Chest:</span>{' '}{chests.map(c => <button key={c.id} className={`btn ${chest?.id === c.id ? 'gold' : 'ghost'}`} style={{ fontSize: 9, marginRight: 3 }} onClick={() => { setChestId(c.id); setPicked([]); }}>{`${STRUCTS[c.type!]?.name ?? c.type} ${c.tx},${c.ty}`}</button>)}</div>}
    <div style={{ fontSize: 10, marginTop: 4 }}>{`Chest food and charged water (${eligibleCount} eligible). Click to reserve, up to ${BAL.restV1.reserveSlots} stacks:`}</div>
    <div style={{ maxHeight: 96, overflowY: 'auto', border: '1px solid #3b2d48', padding: 2, marginTop: 2 }}>
      {contents.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>The chest is empty.</div>}
      {contents.map(s => {
        const ok = !!restEligible(s); const on = picked.includes(s!.uid);
        return <div key={s!.uid} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, opacity: ok ? 1 : 0.45 }}>
          <span style={{ flex: 1 }} title={s!.uid}>{stackLabel(s!)}</span>
          <button className={`btn ${on ? 'ghost' : 'gold'}`} disabled={!ok && !on} style={{ fontSize: 9 }} onClick={() => setPicked(on ? picked.filter(u => u !== s!.uid) : [...picked, s!.uid])}>{on ? 'Unreserve' : ok ? 'Reserve' : 'Not eligible'}</button>
        </div>;
      })}
    </div>
    <div style={{ fontSize: 10, marginTop: 4 }}><span>Rest length:</span>{' '}{BAL.restV1.durationsHours.map((h: number) => <button key={h} className={`btn ${hours === h ? 'gold' : 'ghost'}`} style={{ fontSize: 9, marginLeft: 3 }} onClick={() => setHours(h)}>{`${h} h`}</button>)}</div>
    <div style={{ fontSize: 10, marginTop: 4, color: fc.limitedBy === 'duration' ? '#9ae0a0' : '#ffae89' }}>
      {`Reserved: food ${Math.round(fc.hungerSupply)} · water ${Math.round(fc.thirstSupply)}.`} {`Forecast: about ${fc.coveredHours.toFixed(1)} h of ${hours} h.`}{fc.limitedBy !== 'duration' ? ' ' : ''}{fc.limitedBy === 'duration' ? '' : fc.limitedBy === 'food' ? 'You wake when the food runs out.' : 'You wake when the water runs out.'}
    </div>
    <div className="flex gap-1" style={{ marginTop: 4 }}>
      <button className="btn gold" disabled={!mayStart} onClick={() => { const res = api.act('restStart', { eid: bed.id, chestId: chest!.id, items: picked, hours }); if (res.ok) setPicked([]); }}>{`Lie down ${hours} h`}</button>
      <button className="btn ghost" onClick={close}>Cancel</button>
    </div>
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>{chest?.c ? `Water flasks in the chest: ${countItem(r, chest.c, 'water_flask')}. ` : ''}{`Hunger and thirst keep falling while you sleep; supplies are only used at ${trig}.`}</div>
  </Panel>;
}
