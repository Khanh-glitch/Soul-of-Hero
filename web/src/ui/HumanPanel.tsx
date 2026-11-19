import { useEffect, useMemo, useRef, useState } from 'react';
import type { Api } from './common';
import { Icon, Panel } from './common';
import { drawNpcSprite } from '../game/npc-art';
import { ITEMS } from '../game/catalog';
import { evaluateHumanExchange, humanPack } from '../game/humanworld';
import type { Stack } from '../game/core';
import { TILE } from '../game/core';
import { CREATURES } from '../game/catalog';
import type { HumanRecord } from '../game/humanworld';

export function HumanPanel({ api, actorId, onClose }: { api: Api; actorId: string; onClose: () => void }) {
  const r = api.gs.run;
  const hw = r?.humanWorld;
  const h = hw?.people[actorId];
  const [playerSlot, setPlayerSlot] = useState(0);
  const [humanSlot, setHumanSlot] = useState(0);
  const [demand, setDemand] = useState<'back_off' | 'disarm' | 'item' | 'stop_attack'>('back_off');
  const [reply, setReply] = useState('');
  const [orderTarget,setOrderTarget]=useState('');
  const tradedPairs = useRef(new Set<string>());
  const [tradePending, setTradePending] = useState(false);
  const playerStacks = useMemo(() => r?.custody.inv.slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) ?? [], [r?.custody.inv.slots, r?.seq]);
  const humanStacks = h && r ? humanPack(r, h).slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) : [];
  if (!h || !r || !hw) return <Panel title="Survivor" onClose={onClose} style={{ right: 6, top: 42, width: 238 }}>They are no longer here.</Panel>;
  const act = (type: string, extra: Record<string, unknown> = {}) => api.act(type, { actorId, ...extra });
  const respond = (type: string, extra: Record<string, unknown> = {}) => { const result = act(type, extra); setReply(result.ok ? result.msg ?? 'No response.' : result.reason); };
  const selectedPlayer = playerStacks.find(v => v.i === playerSlot) ?? playerStacks[0];
  const selectedHuman = humanStacks.find(v => v.i === humanSlot) ?? humanStacks[0];
  const evaluation = selectedPlayer && selectedHuman ? evaluateHumanExchange(r, h, selectedPlayer.i, selectedHuman.i) : null;
  const pairKey = selectedPlayer && selectedHuman ? [selectedPlayer.s.uid, selectedHuman.s.uid].sort().join('|') : '';
  const commitTrade = () => {
    if (!evaluation?.ok || !selectedPlayer || !selectedHuman || tradePending) return;
    if (tradedPairs.current.has(pairKey)) { setReply('Those same two stacks have already been exchanged. Choose a different offer.'); return; }
    setTradePending(true); tradedPairs.current.add(pairKey);
    const result = act('humanExchange', { playerSlot: selectedPlayer.i, humanSlot: selectedHuman.i });
    setReply(result.ok ? result.msg ?? evaluation.reason : result.reason);
    if (!result.ok) tradedPairs.current.delete(pairKey);
    setTradePending(false);
  };
  const isDown = h.state === 'DOWNED';
  const isUnavailable = isDown || h.state === 'DEAD' || h.state === 'EVACUATED';
  return <Panel title={`${h.name} · ${h.occupation}`} onClose={onClose} className="scroll" style={{ right: 6, top: 42, width: 242, maxHeight: 276, overflowY: 'auto', fontSize: 11, lineHeight: 1.2 }} testId="human-panel">
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <HumanPortrait h={h} simSec={(r.clock.simMs ?? 0) / 1000} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#d9c99c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.community ? hw.communities[h.community]?.poi : 'Traveler'} · {h.state.toLowerCase()}</div>
        <div style={{ height: 4, background: '#352d2b', margin: '3px 0' }}><div style={{ width: `${Math.max(0, 100 * h.hp / h.maxHp)}%`, height: '100%', background: h.hp < h.maxHp * 0.35 ? '#ca5a4e' : '#72a66b' }} /></div>
        <div style={{ color: '#b8c6a8' }}>Trust {Math.round(h.trust ?? 50)} · {Math.round(h.hp)}/{h.maxHp} HP</div>
      </div>
    </div>
    {!isUnavailable && <>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
        {([['activity', 'Work?'], ['needs', 'Need?'], ['place', 'Place?'], ['goods', 'Goods?'], ['accompany', 'Join?']] as const).map(([topic, label]) => <button key={topic} className="btn sm" onClick={() => respond('humanTalk', { topic })}>{label}</button>)}
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
    {!['DEAD','EVACUATED','FIGHTING'].includes(h.state)&&<div style={{margin:'4px 0'}}>
      <div style={{fontWeight:700}}>Help · urgent needs</div>
      {playerStacks.filter(({s})=>['bandage','herb'].includes(s.key)&&(isDown||h.wounds.some(w=>!w.treated)) || ITEMS[s.key]?.food?.hunger&&h.hunger<35&&!isDown || ITEMS[s.key]?.waterContainer&&(s.charge??0)>0&&h.thirst<35&&!isDown).map(({s})=><button key={s.uid} className="btn sm" disabled={!!hw.playerAid} onClick={()=>respond('humanAid',{stackUid:s.uid})}>Offer {ITEMS[s.key].name}</button>)}
      {hw.playerAid?.actorId===actorId&&<div role="status">Helping · remain beside them…</div>}
      {!isDown&&h.hunger>=35&&h.thirst>=35&&!h.wounds.some(w=>!w.treated)&&<div style={{opacity:.7}}>No urgent need. Talk to learn about their work.</div>}
    </div>}
    {isDown ? <button className="btn sm" style={{ width: '100%', marginBottom: 4 }} onClick={() => respond('humanLoot')}>Recover carried items</button> : !isUnavailable ? <>
      <div style={{ fontWeight: 700, margin: '3px 0' }}>Barter · personal packs only</div>
      {playerStacks.length && humanStacks.length ? <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <TradeSide title="YOUR OFFER" stacks={playerStacks} selected={selectedPlayer?.i ?? -1} onSelect={setPlayerSlot} />
          <TradeSide title="THEIR ASK" stacks={humanStacks} selected={selectedHuman?.i ?? -1} onSelect={setHumanSlot} />
        </div>
        {selectedPlayer && selectedHuman && <div style={{ marginTop: 4, padding: '4px 5px', background: '#191d21', border: '1px solid #4e493e' }}>
          <div style={{ color: '#e1cf9b', fontSize: 9 }}>{ITEMS[selectedPlayer.s.key]?.name ?? selectedPlayer.s.key} ×{selectedPlayer.s.qty} <span style={{ color: '#8a9a9e' }}>↔</span> {ITEMS[selectedHuman.s.key]?.name ?? selectedHuman.s.key} ×{selectedHuman.s.qty}</div>
          <div style={{ color: evaluation?.ok ? '#a8d8a0' : '#e69484', marginTop: 2 }}>{evaluation?.reason ?? 'Select one carried stack from each person.'}</div>
          {evaluation && <div style={{ color: '#96a5aa', fontSize: 8, marginTop: 2 }}>Their needs-adjusted value: you {evaluation.offeredValue?.toFixed(1) ?? '—'} · them {evaluation.requestedValue?.toFixed(1) ?? '—'}</div>}
          <button className="btn sm" disabled={!evaluation?.ok || tradedPairs.current.has(pairKey) || tradePending} onClick={commitTrade} style={{ marginTop: 3 }}>
            {tradedPairs.current.has(pairKey) ? 'Already exchanged' : tradePending ? 'Committing…' : 'Accept & exchange'}
          </button>
        </div>}
      </> : <div style={{ opacity: .75, marginBottom: 4 }}>Both people need a carried item. Community stores are not personal trade inventory.</div>}
    </> : null}
    {h.following && !isUnavailable && <div style={{marginTop:5,borderTop:'1px solid #66543c',paddingTop:4}}>
      <div style={{color:'#a8d8a0'}}>Companion · {h.intent?.kind==='follow'?'Following':h.intent?.target==='home'?'Returning home':h.state.toLowerCase()}</div>
      <div style={{display:'flex',gap:3,flexWrap:'wrap',margin:'3px 0'}}>
        {(['follow','hold','retreat','home','carry'] as const).map(order=><button key={order} className="btn sm" onClick={()=>respond('humanOrder',{order})}>{({follow:'Follow',hold:'Hold',retreat:'Retreat',home:'Return home',carry:'Carry'})[order]}</button>)}
      </div>
      <select aria-label="Companion visible target" value={orderTarget} onChange={e=>setOrderTarget(e.target.value)} style={{width:'100%'}}>
        <option value="">Choose a nearby target</option>
        {r.creatures.filter(m=>m.state!=='dead'&&(m.floor??0)===h.floor&&Math.hypot(m.x-r.player.x,m.y-r.player.y)<TILE*10).map(m=><option key={m.id} value={m.id}>{CREATURES[m.type]?.name??'Creature'}</option>)}
        {Object.values(hw.people).filter(p=>p!==h&&p.floor===h.floor&&!['DEAD','EVACUATED'].includes(p.state)&&Math.hypot(p.gx-h.gx,p.gy-h.gy)<10).map(p=><option key={p.actorId} value={p.actorId}>{p.name}</option>)}
      </select>
      <button className="btn sm" disabled={!orderTarget} onClick={()=>respond('humanOrder',{order:'defend',target:orderTarget})}>Defend against</button>{' '}
      <button className="btn sm" disabled={!orderTarget} onClick={()=>respond('humanOrder',{order:'engage',target:orderTarget})}>Engage</button>
      <div style={{marginTop:4}}>Cargo · {r.custody[h.inv.cartId]?.slots.filter(Boolean).length??0}/6 slots</div>
      {selectedPlayer&&<button className="btn sm" onClick={()=>respond('humanCargo',{direction:'give',stackUid:selectedPlayer.s.uid})}>Carry {ITEMS[selectedPlayer.s.key]?.name} ×{selectedPlayer.s.qty}</button>}
      {r.custody[h.inv.cartId]?.slots.filter((s):s is Stack=>!!s).map(s=><button key={s.uid} className="btn sm" onClick={()=>respond('humanCargo',{direction:'return',stackUid:s.uid})}>Take back {ITEMS[s.key]?.name} ×{s.qty}</button>)}
      {h.intent?.blockReason&&<div style={{color:'#e69484'}}>{h.intent.blockReason}</div>}
    </div>}
    {h.followOrder && <div style={{ opacity: .75, marginTop: 3 }}>{h.followOrder.result}: {h.followOrder.reason}</div>}
  </Panel>;
}

function TradeSide({ title, stacks, selected, onSelect }: { title: string; stacks: {s: Stack; i:number}[]; selected: number; onSelect: (slot: number) => void }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: '#a8b0a6', fontSize: 8, marginBottom: 2 }}>{title}</div>
    <div style={{ maxHeight: 82, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {stacks.map(({s, i}) => {
        const def = ITEMS[s.key];
        const condition = s.dur !== undefined ? ` · ${Math.round(100 * s.dur / (def?.dur ?? 100))}%` : s.charge !== undefined ? ` · ${s.charge} charge` : '';
        return <button key={s.uid} aria-label={`${title === 'YOUR OFFER' ? 'Offer' : 'Request'} ${def?.name ?? s.key} ×${s.qty}${condition}`} aria-pressed={selected === i} onClick={() => onSelect(i)} style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, width: '100%', padding: 2, textAlign: 'left', background: selected === i ? '#55452c' : '#202326', border: `1px solid ${selected === i ? '#c59b4c' : '#47433b'}`, color: '#eadfbd', cursor: 'pointer' }}>
          <Icon k={s.key} size={18} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 8 }}>{def?.name ?? s.key} ×{s.qty}{condition}</span>
        </button>;
      })}
    </div>
  </div>;
}

function HumanPortrait({ h, simSec }: { h: HumanRecord; simSec: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, g = canvas?.getContext('2d'); if (!canvas || !g) return;
    g.imageSmoothingEnabled = false; g.fillStyle = '#171b20'; g.fillRect(0, 0, canvas.width, canvas.height);
    drawNpcSprite(g, h, 16, 58, simSec, h.state === 'MOVING');
  }, [h, simSec]);
  return <canvas ref={ref} width={32} height={64} aria-label={`${h.name} portrait`} style={{ width: 32, height: 64, imageRendering: 'pixelated', border: '1px solid #66543c' }} />;
}
