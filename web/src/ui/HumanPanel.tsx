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
  const playerStacks = useMemo(() => r?.custody.inv.slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) ?? [], [r?.custody.inv.slots, r?.seq]);
  const humanStacks = h && r ? humanPack(r, h).slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) : [];
  if (!h || !r || !hw) return <Panel title="Survivor" onClose={onClose} style={{ right: 6, top: 42, width: 238 }}>They are no longer here.</Panel>;
  const act = (type: string) => api.act(type, { actorId });
  const isDown = h.state === 'DOWNED';
  return <Panel title={`${h.name} · ${h.occupation}`} onClose={onClose} className="scroll" style={{ right: 6, top: 42, width: 242, maxHeight: 276, overflowY: 'auto', fontSize: 11, lineHeight: 1.2 }} testId="human-panel">
    <div style={{ color: '#d9c99c', marginBottom: 4 }}>{h.community ? hw.communities[h.community]?.poi : 'Traveler'} · {h.state} · Trust {Math.round(h.trust ?? 50)}</div>
    <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
      <button className="btn sm" onClick={() => act('humanTalk')}>Talk</button>
      <button className="btn sm" onClick={() => act('humanThreaten')}>Threaten</button>
      <button className="btn sm" onClick={() => act('humanRecruit')}>{h.following ? 'Companion' : 'Recruit'}</button>
    </div>
    {isDown ? <button className="btn sm" style={{ width: '100%', marginBottom: 4 }} onClick={() => act('humanLoot')}>Recover carried items</button> : <>
      <div style={{ fontWeight: 700, margin: '3px 0' }}>Barter · swap one whole stack each</div>
      {playerStacks.length && humanStacks.length ? <>
        <select aria-label="Your offered stack" value={playerSlot} onChange={e => setPlayerSlot(Number(e.target.value))} style={{ width: '100%', marginBottom: 3 }}>
          {playerStacks.map(({s, i}) => <option key={s.uid} value={i}>You: {ITEMS[s.key]?.name ?? s.key} ×{s.qty}</option>)}
        </select>
        <select aria-label="Survivor offered stack" value={humanSlot} onChange={e => setHumanSlot(Number(e.target.value))} style={{ width: '100%', marginBottom: 3 }}>
          {humanStacks.map(({s, i}) => <option key={s.uid} value={i}>Them: {ITEMS[s.key]?.name ?? s.key} ×{s.qty}</option>)}
        </select>
        <button className="btn sm" onClick={() => api.act('humanExchange', { actorId, playerSlot, humanSlot })}>Exchange stacks</button>
      </> : <div style={{ opacity: .75, marginBottom: 4 }}>Both sides need a carried item to barter.</div>}
    </>}
    {h.following && <div style={{ color: '#a8d8a0', marginTop: 4 }}>They are traveling with you.</div>}
    {h.followOrder && <div style={{ opacity: .75, marginTop: 3 }}>{h.followOrder.result}: {h.followOrder.reason}</div>}
  </Panel>;
}
