import { useEffect, useRef, useState } from 'react';
import type { Api } from './common';
import { Icon, Panel } from './common';
import { drawNpcSprite } from '../game/npc-art';
import { ITEMS } from '../game/catalog';
import { demandableGoods, canPointOut, humanRepairOffers, humanContact, counterHumanBarter, quoteHumanBarter, humanPack, type BarterLine } from '../game/humanworld';
import { BAL, type Stack } from '../game/core';
import { CREATURES } from '../game/catalog';
import type { HumanRecord } from '../game/humanworld';

export function HumanPanel({ api, actorId, onClose }: { api: Api; actorId: string; onClose: () => void }) {
  const r = api.gs.run;
  const hw = r?.humanWorld;
  const h = hw?.people[actorId];
  if (!r || !h || !humanContact(r, h, api.now())) {
    return <Panel title="Survivor" onClose={onClose} style={{ right: 6, top: 42, width: 238 }}>Contact lost. Move closer to interact.</Panel>;
  }
  return <ContactPanel key={actorId} api={api} actorId={actorId} onClose={onClose} />;
}

function ContactPanel({ api, actorId, onClose }: { api: Api; actorId: string; onClose: () => void }) {
  const r = api.gs.run!, hw = r.humanWorld!, h = hw.people[actorId];
  const [playerSlot, setPlayerSlot] = useState(0);
  const [demandUid,setDemandUid]=useState('');
  const [demand, setDemand] = useState<'back_off' | 'disarm' | 'item' | 'stop_attack'>('back_off');
  const [section, setSection] = useState<'Talk'|'Help'|'Barter'|'Confront'|'Companion'>('Talk');
  const [reply, setReply] = useState('');
  const [cargoQty,setCargoQty]=useState('');
  const [orderTarget,setOrderTarget]=useState('');
  const [offer,setOffer] = useState<BarterLine[]>([]), [ask,setAsk] = useState<BarterLine[]>([]);
  const [review,setReview]=useState<string>();
  const [tradePending, setTradePending] = useState(false);
  const playerStacks = r?.custody.inv.slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) ?? [];
  const humanStacks = h && r ? humanPack(r, h).slots.map((s, i) => s ? { s, i } : null).filter((v): v is {s: Stack; i:number} => v !== null) : [];
  const act = (type: string, extra: Record<string, unknown> = {}) => api.act(type, { actorId, ...extra });
  const respond = (type: string, extra: Record<string, unknown> = {}) => { const result = act(type, extra); setReply(result.ok ? result.msg ?? 'No response.' : result.reason); };
  const selectedPlayer = playerStacks.find(v => v.i === playerSlot) ?? playerStacks[0];
  const personal=section==='Confront'||h.state==='FIGHTING'?demandableGoods(r,h):[];
  const choice=personal.find(g=>g.s.uid===demandUid);
  const evaluation = section==='Barter' ? quoteHumanBarter(r,h,offer,ask) : null;
  const commitTrade = () => {
    if (!evaluation?.ok || tradePending || !review || review!==evaluation.revision) return;
    setTradePending(true);
    try {
      const result=act('humanExchange',{offer,ask,revision:review});
      setReply(result.ok ? result.msg ?? 'Goods exchanged.' : result.reason);
      if(result.ok){setReview(undefined);setOffer([]);setAsk([]);}
    } finally {setTradePending(false);}
  };
  const isDown = h.state === 'DOWNED';
  const isUnavailable = isDown || h.state === 'DEAD' || h.state === 'EVACUATED' || h.state === 'ON_VESSEL';
  const sections = (['Talk','Help','Barter','Confront','Companion'] as const).filter(s => {
    if (isDown) return s === 'Help';
    if (isUnavailable) return false;
    if (h.state === 'FIGHTING') return s === 'Confront';
    return s !== 'Companion' || !!h.following;
  });
  // The actor can be downed, recruited or dismissed while this panel is open.
  const visible = sections.find(s => s === section) ?? sections[0];
  const cargoCount=(s:Stack)=>cargoQty===''?s.qty:Number(cargoQty);
  const cargoUnavailable=(s:Stack)=>!!h.intent?.delivery||!!s.production||!Number.isSafeInteger(cargoCount(s))||cargoCount(s)<1||cargoCount(s)>s.qty;
  const cargo=r.custody[h.inv.cartId];
  const targets = visible === 'Companion' ? [...r.creatures,...Object.values(hw.people)].filter(t=>canPointOut(r,h,t,api.now())).map(t=>
    'actorId' in t ? {id:t.actorId,name:t.name} : {id:t.id,name:CREATURES[t.type]?.name??'Creature'}) : [];
  const visibleTarget = targets.find(t=>t.id===orderTarget)?.id ?? '';
  return <Panel title={`${h.name} · ${h.occupation}`} onClose={onClose} className="scroll" style={{ right: 6, top: 42, width: 242, maxHeight: 276, overflowY: 'auto', fontSize: 11, lineHeight: 1.2 }} testId="human-panel">
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <HumanPortrait h={h} simSec={(r.clock.simMs ?? 0) / 1000} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#d9c99c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.community ? hw.communities[h.community]?.poi : 'Traveler'} · {h.state.toLowerCase()}</div>
        <div style={{ height: 4, background: '#352d2b', margin: '3px 0' }}><div style={{ width: `${Math.max(0, 100 * h.hp / h.maxHp)}%`, height: '100%', background: h.hp < h.maxHp * 0.35 ? '#ca5a4e' : '#72a66b' }} /></div>
        <div style={{ color: '#b8c6a8' }}>Trust {Math.round(h.trust ?? 50)} · {Math.round(h.hp)}/{h.maxHp} HP</div>
      </div>
    </div>
    {sections.length > 1 && <div role="group" aria-label="Survivor actions" style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:5}}>
      {sections.map(s=><button key={s} className="btn sm" aria-pressed={s===visible} style={s===visible?{borderColor:'#c59b4c',color:'#ffe4a2'}:undefined} onClick={()=>{setSection(s);setReview(undefined);setReply('');}}>{s}</button>)}
    </div>}
    {visible === 'Talk' && <>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
        {([['activity', 'Work?'], ['needs', 'Need?'], ['place', 'Place?'], ['goods', 'Goods?'], ['accompany', 'Join?']] as const).map(([topic, label]) => <button key={topic} className="btn sm" onClick={() => respond('humanTalk', { topic })}>{label}</button>)}
        <button className="btn sm" onClick={() => respond(h.following ? 'humanDismiss' : 'humanRecruit')}>{h.following ? 'Dismiss' : 'Recruit'}</button>
      </div>
    </>}
    {visible === 'Confront' && <>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }}>
        <select aria-label="Confrontation demand" value={demand} onChange={e => setDemand(e.target.value as typeof demand)} style={{ flex: 1, minWidth: 0 }}>
          <option value="back_off">Back away</option>
          {!!h.equip.weapon && <option value="disarm">Put away weapon</option>}
          {personal.length > 0 && <option value="item">Hand over personal item</option>}
          {h.state === 'FIGHTING' && <option value="stop_attack">Stop attacking</option>}
        </select>
        {demand==='item' && <select aria-label="Demanded item" value={choice?.s.uid??''} onChange={e=>setDemandUid(e.target.value)}><option value="">Choose item</option>{personal.map(({s,where})=><option key={s.uid} value={s.uid}>{ITEMS[s.key]?.name} ×{s.qty} · {where}</option>)}</select>}
        <button className="btn sm" disabled={demand==='item'&&!choice || demand==='disarm'&&!h.equip.weapon || demand==='stop_attack'&&h.state!=='FIGHTING'} onClick={() => respond('humanThreaten', { demand, stackUid: demand==='item'?choice?.s.uid:demand==='disarm'?h.equip.weapon?.uid:undefined })}>Confront</button>
      </div>
    </>}
    {reply && <div role="status" aria-live="polite" style={{ color: '#ffe4a2', borderLeft: '2px solid #bd8d47', padding: '3px 5px', margin: '3px 0 5px', lineHeight: 1.25 }}>{reply}</div>}
    {visible==='Help'&&<div style={{margin:'4px 0'}}>
      <div style={{fontWeight:700}}>Help · urgent needs</div>
      {playerStacks.filter(({s})=>!s.production && (['bandage','herb'].includes(s.key)&&(isDown||h.wounds.some(w=>!w.treated)) || ITEMS[s.key]?.food?.hunger&&h.hunger<35&&!isDown || ITEMS[s.key]?.waterContainer&&(s.charge??0)>0&&h.thirst<35&&!isDown)).map(({s})=><button key={s.uid} className="btn sm" disabled={!!hw.playerAid} onClick={()=>respond('humanAid',{stackUid:s.uid})}>Offer {ITEMS[s.key].name}</button>)}
      {humanRepairOffers(r,h,api.now()).map(({item,station,cost})=><button key={item.uid} className="btn sm" onClick={()=>respond('humanRepair',{stackUid:item.uid,eid:station.id})}>Repair {ITEMS[item.key].name} · spend {cost.map(([key,qty])=>`${qty} ${ITEMS[key].name}`).join(', ')}</button>)}
      {hw.playerAid?.actorId===actorId&&<div role="status">Helping · remain beside them…</div>}
      {!isDown&&h.hunger>=35&&h.thirst>=35&&!h.wounds.some(w=>!w.treated)&&<div style={{opacity:.7}}>No urgent food, water or medical need.</div>}
    </div>}
    {isDown ? <button className="btn sm" style={{ width: '100%', marginBottom: 4 }} onClick={() => respond('humanLoot')}>Recover carried items</button> : visible==='Barter' ? <>
      <div style={{ fontWeight: 700, margin: '3px 0' }}>Barter · personal packs only</div>
      {playerStacks.length && humanStacks.length ? <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <TradeSide title="Your offer" stacks={playerStacks} lines={offer} onChange={lines=>{setReview(undefined);setOffer(lines);}}/>
          <TradeSide title="Their goods" stacks={humanStacks} lines={ask} onChange={lines=>{setReview(undefined);setAsk(lines);}}/>
        </div>
        <div style={{marginTop:4,color:evaluation?.ok?'#a8d8a0':'#ffe4a2'}}>{evaluation?.reason}</div>
        {evaluation?.offeredValue!==undefined && <div>Value: offer {evaluation.offeredValue.toFixed(1)} · ask {evaluation.requestedValue?.toFixed(1)}</div>}
        {evaluation?.reason.startsWith('Counter-offer') && <button className="btn sm" onClick={()=>{
          const counter=counterHumanBarter(r,h,offer,ask);
          if(!counter){setReply('No workable alternative using these goods. Change your selection.');return;}
          setReview(undefined);setOffer(counter.offer);setAsk(counter.ask);setReply('Review the proposed quantities before accepting.');
        }}>Request counter-offer</button>}
        {review && review!==evaluation?.revision && <div role="status">The terms changed. Review the basket again.</div>}
        {review && review===evaluation?.revision ? <button className="btn sm" disabled={tradePending} onClick={commitTrade}>Accept &amp; exchange</button>
         : <button className="btn sm" disabled={!evaluation?.ok} onClick={()=>setReview(evaluation?.revision)}>Review exchange</button>}
        {(offer.length>0 || ask.length>0) && <button className="btn sm" onClick={()=>{setReview(undefined);setOffer([]);setAsk([]);}}>Clear basket</button>}
      </> : <div>Both people need a carried item. Community stores are not personal trade inventory.</div>}
    </> : null}
    {visible==='Companion' && <div style={{marginTop:5,borderTop:'1px solid #66543c',paddingTop:4}}>
      <div style={{color:'#a8d8a0'}}>Companion · {h.intent?.kind==='follow'?'Following':h.intent?.target==='home'?'Returning home':h.state.toLowerCase()}</div>
      <div style={{display:'flex',gap:3,flexWrap:'wrap',margin:'3px 0'}}>
        {(['follow','hold','retreat','home','carry'] as const).map(order=><button key={order} className="btn sm" onClick={()=>respond('humanOrder',{order})}>{({follow:'Follow',hold:'Hold',retreat:'Retreat',home:'Return home',carry:'Carry'})[order]}</button>)}
      </div>
      <select aria-label="Companion visible target" value={visibleTarget} onChange={e=>setOrderTarget(e.target.value)} style={{width:'100%'}}>
        <option value="">Choose a nearby target</option>
        {targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button className="btn sm" onClick={()=>respond('humanOrder',{order:'defend'})}>Guard me</button>{' '}
      <button className="btn sm" disabled={!visibleTarget} onClick={()=>respond('humanOrder',{order:'engage',target:visibleTarget})}>Engage</button>
      <div style={{marginTop:4}}>Cargo · {cargo.slots.filter(Boolean).length}/{cargo.slots.length} slots · {cargo.slots.reduce((n,s)=>n+(s?ITEMS[s.key].w*s.qty:0),0).toFixed(1)}/{BAL.cart.maxWeight} kg</div>
      <label>Quantity <input type="number" min="1" step="1" value={cargoQty} placeholder="All" style={{width:48}} onChange={e=>setCargoQty(e.target.value)} /></label>
      {selectedPlayer&&<select aria-label="Companion cargo item" value={selectedPlayer.i} onChange={e=>setPlayerSlot(Number(e.target.value))}>{playerStacks.map(({s,i})=><option key={s.uid} value={i}>{ITEMS[s.key]?.name} ×{s.qty}</option>)}</select>}
      {selectedPlayer&&<button className="btn sm" disabled={cargoUnavailable(selectedPlayer.s)} onClick={()=>respond('humanCargo',{direction:'give',stackUid:selectedPlayer.s.uid,qty:cargoCount(selectedPlayer.s)})}>Carry {ITEMS[selectedPlayer.s.key]?.name} ×{cargoCount(selectedPlayer.s)}</button>}
      {r.custody[h.inv.cartId]?.slots.filter((s):s is Stack=>!!s).map(s=><button key={s.uid} className="btn sm" disabled={cargoUnavailable(s)} onClick={()=>respond('humanCargo',{direction:'return',stackUid:s.uid,qty:cargoCount(s)})}>Take back {ITEMS[s.key]?.name} ×{cargoCount(s)}</button>)}
      {h.community && hw.communities[h.community]?.storeEntityId && <button className="btn sm" disabled={!!h.intent?.delivery || !r.custody[h.inv.cartId]?.slots.some(Boolean)} onClick={()=>respond('humanOrder',{order:'carry',target:hw.communities[h.community!].storeEntityId})}>Deliver load to home warehouse</button>}
      {h.intent?.delivery && <div>Delivering to the warehouse · Hold to cancel</div>}
      {h.intent?.blockReason&&<div style={{color:'#e69484'}}>{h.intent.blockReason}</div>}
    </div>}
    {visible==='Companion' && h.followOrder && <div style={{ opacity: .75, marginTop: 3 }}>{h.followOrder.result}: {h.followOrder.reason}</div>}
  </Panel>;
}

function TradeSide({title,stacks,lines,onChange}:{title:string;stacks:{s:Stack;i:number}[];lines:BarterLine[];onChange:(v:BarterLine[])=>void}) {
  function change(s:Stack,qty:number){ const rest=lines.filter(l=>l.uid!==s.uid);onChange(qty>0?[...rest,{uid:s.uid,qty}]:rest); }
  return <div style={{minWidth:0}}><strong>{title}</strong>
    {stacks.map(({s})=>{const qty=lines.find(l=>l.uid===s.uid)?.qty??0,name=ITEMS[s.key]?.name??s.key;
      return <div key={s.uid} style={{borderBottom:'1px solid #504c42',padding:'3px 0'}}>
        <div><Icon k={s.key} size={14}/> {name} ×{s.qty}</div>
        <div style={{display:'flex',gap:3,alignItems:'center'}}>
          <button className="btn sm" disabled={!qty} aria-label={`${title}: remove one ${name}`} onClick={()=>change(s,qty-1)}>−</button>
          <span>{qty}</span><button className="btn sm" disabled={qty>=s.qty||!!s.production} aria-label={`${title}: add one ${name}`} onClick={()=>change(s,qty+1)}>+</button>
          {s.dur!==undefined && <small>{s.dur} dur.</small>}{s.charge!==undefined && <small>{s.charge} charge</small>}
        </div></div>;})}
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
