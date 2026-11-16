import { useMemo, useState } from 'react';
import type { Api } from './common';
import { Panel } from './common';
import { ITEMS } from '../game/catalog';
import { humanPack } from '../game/humanworld';
import type { Stack } from '../game/core';

export function HumanPanel({ api, actorId, onClose }: { api: Api; actorId: string; onClose: () => void }) {
  const r = api.gs.run;
  const hw = r?.humanWorld;
  const h = hw?.people[actorId];
  const [playerSlot, setPlayerSlot] = useState(0);
  const [humanSlot, setHumanSlot] = useState(0);
  const [demand, setDemand] = useState<'back_off' | 'disarm' | 'item' | 'stop_attack'>('back_off');
  const [reply, setReply] = useState('');
  const playerStacks = useMemo(() => r?.custody.inv.slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) ?? [], [r?.custody.inv.slots, r?.seq]);
  const humanStacks = h && r ? humanPack(r, h).slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) : [];
  if (!h || !r || !hw) return <Panel title="Survivor" onClose={onClose} style={{ right: 6, top: 42, width: 238 }}>They are no longer here.</Panel>;
  const act = (type: string, extra: Record<string, unknown> = {}) => api.act(type, { actorId, ...extra });
  const respond = (type: string, extra: Record<string, unknown> = {}) => { const result = act(type, extra); setReply(result.ok ? result.msg ?? 'No response.' : result.reason); };
  const isDown = h.state === 'DOWNED';
  const isUnavailable = isDown || h.state === 'DEAD' || h.state === 'EVACUATED';
  return <Panel title={`${h.name} · ${h.occupation}`} onClose={onClose} className="scroll" style={{ right: 6, top: 42, width: 242, maxHeight: 276, overflowY: 'auto', fontSize: 11, lineHeight: 1.2 }} testId="human-panel">
    <div style={{ color: '#d9c99c', marginBottom: 4 }}>{h.community ? hw.communities[h.community]?.poi : 'Traveler'} · {h.state} · Trust {Math.round(h.trust ?? 50)}</div>
    {!isUnavailable && <>
      <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
        <button className="btn sm" onClick={() => respond('humanTalk')}>Ask what they know</button>
        <button className="btn sm" onClick={() => respond(h.following ? 'humanDismiss' : 'humanRecruit')}>{h.following ? 'Dismiss' : 'Recruit'}</button>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }}>
        <select aria-label="Confrontation demand" value={demand} onChange={e => setDemand(e.target.value as typeof demand)} style={{ flex: 1, minWidth: 0 }}>
          <option value="back_off">Back away</option>
          {!!h.equip.weapon && <option value="disarm">Put away weapon</option>}
          {humanStacks.length > 0 && <option value="item">Hand over carried item</option>}
          {h.state === 'FIGHTING' && <option value="stop_attack">Stop attacking</option>}
        </select>
        <button className="btn sm" onClick={() => respond('humanThreaten', { demand, stackUid: demand === 'item' ? humanStacks.find(v => v.i === humanSlot)?.s.uid : undefined })}>Confront</button>
      </div>
    </>}
    {reply && <div role="status" aria-live="polite" style={{ color: '#ffe4a2', borderLeft: '2px solid #bd8d47', padding: '3px 5px', margin: '3px 0 5px', lineHeight: 1.25 }}>{reply}</div>}
    {isDown ? <button className="btn sm" style={{ width: '100%', marginBottom: 4 }} onClick={() => respond('humanLoot')}>Recover carried items</button> : !isUnavailable ? <>
      <div style={{ fontWeight: 700, margin: '3px 0' }}>Barter · swap one whole stack each</div>
      {playerStacks.length && humanStacks.length ? <>
        <select aria-label="Your offered stack" value={playerSlot} onChange={e => setPlayerSlot(Number(e.target.value))} style={{ width: '100%', marginBottom: 3 }}>
          {playerStacks.map(({s, i}) => <option key={s.uid} value={i}>You: {ITEMS[s.key]?.name ?? s.key} ×{s.qty}</option>)}
        </select>
        <select aria-label="Survivor offered stack" value={humanSlot} onChange={e => setHumanSlot(Number(e.target.value))} style={{ width: '100%', marginBottom: 3 }}>
          {humanStacks.map(({s, i}) => <option key={s.uid} value={i}>Them: {ITEMS[s.key]?.name ?? s.key} ×{s.qty}</option>)}
        </select>
        <button className="btn sm" onClick={() => respond('humanExchange', { playerSlot, humanSlot })}>Offer barter</button>
      </> : <div style={{ opacity: .75, marginBottom: 4 }}>Both sides need a carried item to barter.</div>}
    </> : null}
    {h.following && <div style={{ color: '#a8d8a0', marginTop: 4 }}>They are traveling with you.</div>}
    {h.followOrder && <div style={{ opacity: .75, marginTop: 3 }}>{h.followOrder.result}: {h.followOrder.reason}</div>}
  </Panel>;
}
