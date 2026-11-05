import { useEffect, useRef, useState } from 'react';
import { ITEMS, RECIPES, permitsDirectedResearch, isRecipeKnown, STRUCTS, BUILD_ORDER, VENDOR_SECURED, VENDOR_SPARES, ACHIEVEMENTS, ELDERS, CORE_STUDY, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, CART_FREIGHT_UPGRADE, GENERATOR_CAPACITY_UPGRADE, INDUSTRIAL_MODULE, GARDEN_CROPS, GARDEN_FRAME_COST, FURNACE_LINING } from '../game/catalog';
import { BAL, TILE, WW, type Stack } from '../game/core';
import { C, countItem, invWeight, isRagnarok, runHours, cartWeight, cartLimit, carryLimit, spaceFor, phaseOf, tenderStatus, gardenEnvironment, weatherAt, isWet, isSheltered, wetOutlook, turretStatus, industrialStatus, powerAllocation } from '../game/engine';
import { getWorld, ZONES } from '../game/world';
import { getMapCanvas } from '../game/render';
import { setVolume } from '../game/audio';
import { Panel, Slot, Icon, Cost, type Api } from './common';

const have = (api: Api) => (k: string) => countItem(api.gs.run!, 'inv', k);
function slotClick(api: Api, c: string, i: number, e: React.MouseEvent, quickTo?: string) {
  const r = api.gs.run!; const s = C(r, c)?.slots[i];
  if (e.shiftKey && s) { const to = c === 'inv' ? quickTo : 'inv'; if (to) { api.act('move', { from: c, fs: i, to }); api.setSel(null); } return; }
  if (api.sel) { if (api.sel.c === c && api.sel.slot === i) { api.setSel(null); return; } api.act('move', { from: api.sel.c, fs: api.sel.slot, to: c, ts: i }); api.setSel(null); return; }
  if (s) { api.setSel({ c, slot: i }); api.sfx('ui'); }
}
function slotContext(api: Api, c: string, i: number, quickTo?: string) {
  const r = api.gs.run!; const s = C(r, c)?.slots[i]; if (!s) return;
  if (c === 'inv') { if (quickTo) api.act('move', { from: c, fs: i, to: quickTo }); else api.act('useItem', { slot: i }); }
  else api.act('move', { from: c, fs: i, to: 'inv' });
}
function Grid({ api, cid, cols = 8, quickTo, hotRow = false }: { api: Api; cid: string; cols?: number; quickTo?: string; hotRow?: boolean }) {
  const c = C(api.gs.run!, cid); if (!c) return null;
  return <div className={import.meta.env.VITE_FX_TEST === '1' && cid === 'inv' ? 'scroll' : undefined} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 20px)`, gap: 2, ...(import.meta.env.VITE_FX_TEST === '1' && cid === 'inv' ? {maxHeight: 110, overflowY:'auto'} : {}) }}>
    {c.slots.map((s, i) => <Slot key={i} s={s} sel={api.sel?.c === cid && api.sel.slot === i} active={hotRow && i === api.gs.run!.player.active} hotkey={hotRow && i < 8 ? String(i + 1) : undefined} onClick={e => slotClick(api, cid, i, e, quickTo)} onContext={() => slotContext(api, cid, i, quickTo)} />)}
  </div>;
}
function ItemInfo({ s, known }: { s: Stack | null; known: string[] }) {
  if (!s) return <div style={{ fontSize: 10, color: '#8a7a9a', minHeight: 34 }}>Click to pick up · click again to place/swap · right-click to use/equip · Shift-click to quick-transfer.</div>;
  const d = ITEMS[s.key];
  const stats: string[] = []; if (d.dmg) stats.push(`DMG ${d.dmg}`); if (d.reach) stats.push(`Reach ${d.reach}`); if (d.power) stats.push('Work: ' + Object.entries(d.power).map(([m, p]) => `${m} ${p}`).join(' ')); if (d.armor) stats.push(`Armor ${Math.round(d.armor * 100)}%`); if (d.cold) stats.push(`Warmth +${d.cold}`); if (d.carryBonus) stats.push(`Carry +${d.carryBonus}kg`); if (d.fuel) stats.push(`Fuel ${d.fuel}s`); if (d.food) stats.push(Object.entries(d.food).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(' ')); stats.push(`${d.w}kg`);
  return <div style={{ fontSize: 10, minHeight: 34 }}><div style={{ color: '#ffe0a0', fontSize: 12 }}>{d.name}{s.upgrade === 'freight' ? ' — reinforced freight' : ''}{s.meta ? `: ${ITEMS[RECIPES[s.meta]?.out]?.name || s.meta}` : ''}{s.charge !== undefined && d.charge ? ` — ${s.charge}/${d.charge} charges` : ''}{s.dur !== undefined && d.dur ? ` — ${s.dur}/${d.dur}${s.dur <= 0 && d.repair ? ' BROKEN' : ''}` : ''}</div><div style={{ color: '#cfc2dc' }}>{d.desc}</div><div style={{ color: '#9ad0a0' }}>{stats.join(' · ')}</div><KnownUses item={s.key} known={known} /></div>;
}

function KnownUses({ item, known }: { item: string; known: string[] }) {
  // The active run's known recipes only: no undiscovered POI or recipe spoilers.
  const uses = Object.keys(RECIPES).filter(k => isRecipeKnown(known,k) && RECIPES[k]?.ins.some(([key]) => key === item)).map(k => ITEMS[RECIPES[k].out].name);
  if (!uses.length) return null;
  return <details><summary style={{ cursor: 'pointer', color: '#ffd98a' }}>Known uses ({uses.length})</summary><div style={{ maxHeight: 36, overflowY: 'auto', color: '#cfc2dc' }}>{uses.join(' · ')}</div></details>;
}

export function InventoryPanel({ api, quickTo, x = 404, top = 54, onClose, backToContainer = false }: { api: Api; quickTo?: string; x?: number; top?: number; onClose?: () => void; backToContainer?: boolean }) {
  const r = api.gs.run!; const sel = api.sel ? C(r, api.sel.c)?.slots[api.sel.slot] ?? null : null; const w = invWeight(r); const limit = carryLimit(r);
  let armor = 0, warm = 0; for (const s of C(r, 'eq').slots) if (s) { armor += ITEMS[s.key].armor || 0; warm += ITEMS[s.key].cold || 0; }
  return <Panel title={backToContainer ? "Inventory · X returns" : "Inventory"} style={{ left: x, top, width: 196 }} onClose={onClose ?? (() => api.open(null))}>
    <div className="flex gap-2 items-center" style={{ marginBottom: 4 }}>
      {['head', 'body', 'back'].map((sl, i) => <div key={sl} className="flex flex-col items-center" style={{ fontSize: 8, color: '#8a7a9a' }}><Slot s={C(r, 'eq').slots[i]} sel={api.sel?.c === 'eq' && api.sel.slot === i} onClick={e => slotClick(api, 'eq', i, e)} onContext={() => slotContext(api, 'eq', i)} />{sl}</div>)}
      <div style={{ fontSize: 10, lineHeight: 1.1, marginLeft: 4 }}><div>Armor {Math.round(armor * 100)}% · Warmth +{warm}</div><div style={{ color: w > limit ? '#ff8a7a' : '#cfc2dc' }}>Load {w.toFixed(1)} / {limit} kg{w > limit ? ' (slowed)' : ''}</div><div style={{ color: '#ffe27a' }}>Carried cash {countItem(r, 'inv', 'rcash')} · Secured {api.gs.profile.securedCash}</div></div>
    </div>
    {import.meta.env.VITE_FX_TEST === '1' && <div style={{fontSize:10,color:'#ffd98a'}}>VFX TEST · 10 mỗi Core · cuộn túi để xem</div>}<Grid api={api} cid="inv" quickTo={quickTo} hotRow />
    <div style={{ borderTop: '1px solid #3a2e46', marginTop: 4, paddingTop: 3 }}><ItemInfo s={sel} known={r.knowledge.recipes} /></div>
    {sel && api.sel?.c === 'inv' && ITEMS[sel.key].repair && sel.dur !== undefined && sel.dur < ITEMS[sel.key].dur! && <div style={{ fontSize: 10, marginTop: 3 }}>Field repair (+{BAL.player.fieldRepairDurability} durability): <button className="btn" disabled={!C(r, 'inv').slots.some(s => s?.key === 'field_repair_kit')} onClick={() => { const kitSlot = C(r, 'inv').slots.findIndex(s => s?.key === 'field_repair_kit'); const kit = C(r, 'inv').slots[kitSlot]; if (kit && api.sel) api.act('fieldRepair', { slot: api.sel.slot, uid: sel.uid, kitSlot, kitUid: kit.uid }); }}>Use one kit</button></div>}
    <div className="flex gap-1" style={{ marginTop: 3 }}>
      <button className="btn" disabled={!sel} onClick={() => { if (api.sel) { api.act('useItem', { c: api.sel.c, slot: api.sel.slot }); api.setSel(null); } }}>Use</button>
      <button className="btn" disabled={!sel || sel.qty < 2} onClick={() => api.sel && api.act('split', { c: api.sel.c, slot: api.sel.slot })}>Split</button>
      <button className="btn" disabled={!sel} onClick={() => { if (api.sel) { api.act('drop', { c: api.sel.c, slot: api.sel.slot }); api.setSel(null); } }}>Drop</button>
      <button className="btn" onClick={() => api.act('sort', { c: 'inv' })}>Sort</button>
    </div>
  </Panel>;
}

export function ContainerPanel({ api, eid }: { api: Api; eid: string }) {
  const [inventoryOnly, setInventoryOnly] = useState(false); useEffect(()=>setInventoryOnly(false),[eid]);
  const r = api.gs.run!; const e = r.entities[eid]; if (!e) return null;
  const st = e.station; const kind = e.type ? STRUCTS[e.type]?.station : null;
  const title = e.kind === 'recycler' ? 'Foundry Recycler' : e.kind === 'bag' ? (e.label || 'Bag') : e.kind === 'loot' ? 'Crate' : e.kind === 'cash' ? 'Ragnarok Chest' : e.kind === 'cart' ? 'Cart Cargo' : STRUCTS[e.type!]?.name || 'Storage';
  const takeAll = (cid: string) => { const c = C(r, cid); for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) { const res = api.act('move', { from: cid, fs: i, to: 'inv' }); if (!res.ok) break; } };
  const quickTo = st ? (kind === 'research' || e.kind === 'recycler' ? undefined : st.fuelC) : e.c;
  const compact = !!e.farm || !!e.garden || !!e.basePower || !!e.turret;
  if (compact && inventoryOnly) return <InventoryPanel api={api} quickTo={quickTo} x={168} top={54} backToContainer onClose={()=>{api.setSel(null);setInventoryOnly(false);}} />;
  return <>
    <Panel title={title} style={{ left: 168, top: 54, width: 230, maxHeight: 286 }} onClose={() => api.open(null)} className="scroll">
      <div className="scroll" style={{ maxHeight: 250, overflowY: 'auto', overflowX: 'hidden' }}>
        {compact && <button className="btn" onClick={()=>{api.setSel(null);setInventoryOnly(true);}}>{e.farm || e.basePower ? 'Inventory / fill fuel' : e.turret ? 'Inventory / load arrows' : 'Inventory'}</button>}
        {e.kind === 'loot' && <div style={{fontSize:10,color:'#ffd98a',marginBottom:4}}>Withdraw only · remaining items stay here. Empty crates disappear.</div>}
        {e.c && <><Grid api={api} cid={e.c} cols={8} /><div className="flex gap-1" style={{ marginTop: 4 }}><button className="btn" onClick={() => takeAll(e.c!)}>Take all</button>{e.kind === 'cart' && <span style={{ fontSize: 10, color: '#cfc2dc' }}>Load {cartWeight(r, e.c).toFixed(0)}/{cartLimit(e)} kg · [F] pull</span>}{e.kind === 'cart' && <button className="btn ghost" onClick={() => api.act('reclaim', { eid })}>Pack up</button>}</div></>}
        {e.kind === 'cart' && <div style={{ fontSize: 10, marginTop: 6, borderTop: '1px solid #514155' }}>
          <b>{e.deployed?.upgrade === 'freight' ? 'Reinforced freight cart' : 'Hand cart'}</b> · {C(r, e.c!).slots.length} slots<br />
          {e.deployed?.upgrade !== 'freight' && <details><summary style={{ cursor: 'pointer', color: '#ffd98a' }}>Reinforce at level 2 workbench</summary>
            <div>32 slots, overload above {BAL.cart.freightMaxWeight} kg instead of {BAL.cart.maxWeight} kg. Weight and terrain still slow travel.</div>
            <div>{CART_FREIGHT_UPGRADE.cost.map(([k,q]) => `${ITEMS[k].name} ${countItem(r, 'inv', k)}/${q}`).join(' · ')}</div>
            {!e.deployed && <div>Legacy cart: unload, pack and redeploy first.</div>}
            <button className="btn" onClick={() => { const bench = Object.values(r.entities).find(b => b.kind === 'struct' && b.type === 'workbench' && b.station && (b.owner === undefined || b.owner === 'player') && (b.station.level ?? 1) >= 2 && Math.hypot(b.x-r.player.x,b.y-r.player.y) <= 3*TILE && Math.hypot(b.x-e.x,b.y-e.y) <= 3*TILE); api.act('upgradeCart', { eid, uid: e.deployed?.uid, benchId: bench?.id }); }}>Pay &amp; reinforce</button>
          </details>}
        </div>}
        {e.basePower && <div style={{fontSize:11,marginTop:5}}><b>Generator · {e.basePower.enabled ? (e.basePower.energy>0?'running':'no fuel') : 'off'}</b><div>Stored fuel: {(e.basePower.energy/1000).toFixed(1)} fuel-sec · capacity {e.basePower.capacity??1} load(s) · allocated {powerAllocation(r,e).length}. Each allocated load uses fuel; generator idles at one load. Burns while on, including away.</div><label>Priority <select aria-label="Power priority" value={e.basePower.priority??'defense'} onChange={ev=>api.act('powerPriority',{eid,value:ev.target.value})}><option value="defense">Defense</option><option value="production">Production</option></select></label><button className="btn gold" onClick={()=>api.act('basePower',{eid,enabled:!e.basePower!.enabled})}>{e.basePower.enabled?'Switch off':'Switch on'}</button>{!e.basePower.capacity && <details><summary>Reinforce with level 2 workbench</summary><div>{GENERATOR_CAPACITY_UPGRADE.cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(' · ')}</div><button className="btn" onClick={()=>{const bench=Object.values(r.entities).find(b=>b.type==='workbench' && b.station && (b.station.level??1)>=2 && (b.owner===undefined||b.owner==='player') && Math.hypot(b.x-r.player.x,b.y-r.player.y)<=3*TILE && Math.hypot(b.x-e.x,b.y-e.y)<=3*TILE);api.act('upgradeGenerator',{eid,benchId:bench?.id});}}>Pay &amp; reinforce</button></details>}</div>}
        {e.turret && <div style={{fontSize:11,marginTop:5}}><b>Turret · {turretStatus(r,e)}{e.turret.tracking?' · target in sight':''}</b><div>Arrows: {countItem(r,e.c!,'arrow')} · fog/storm reduce sight. No offline firing.</div><label>Generator (within 3 tiles): <select aria-label="Turret generator" value={e.turret.generatorId||''} onChange={ev=>api.act('turretConfigure',{eid,field:'generatorId',value:ev.target.value})} style={{background:'#2b1e30',color:'#fff',maxWidth:140}}><option value="">Not linked</option>{Object.values(r.entities).filter(g=>g.basePower&&(g.owner===undefined||g.owner==='player')&&Math.hypot(g.x-e.x,g.y-e.y)<=3*TILE).map(g=><option key={g.id} value={g.id}>Generator {g.tx},{g.ty}</option>)}</select></label><div><button className="btn gold" onClick={()=>api.act('turretConfigure',{eid,field:'enabled',value:!e.turret!.enabled})}>{e.turret.enabled?'Stop':'Start'}</button></div></div>}
        {e.farm && <div style={{fontSize:10,marginTop:5}}>
          <b style={{color:'#ffd98a'}}>Garden Tender · {tenderStatus(r,e)}</b>{e.farm.gardenId && r.entities[e.farm.gardenId]?.garden && (()=>{const g=r.entities[e.farm!.gardenId!], climate=gardenEnvironment(r,g,isWet(weatherAt(r,api.now())),(g.garden!.crop==='herb'?'herb':e.farm!.crop));return <div>Climate {climate.climate} · {climate.biome} soil · {Math.round(climate.rate*100)}% growth{climate.frame?' · framed':''}{climate.scorched?' · scorched':''}</div>;})()}{e.farm.gardenId && r.entities[e.farm.gardenId]?.garden && <div>Plot {Math.floor(r.entities[e.farm.gardenId].garden!.growth*100)}% · soil {r.entities[e.farm.gardenId].garden!.water.toFixed(1)}/3 · barrel {(r.entities[e.farm.barrelId||'']?.water||0).toFixed(1)}/12</div>}<div>Fuel: {(e.farm.energy/1000).toFixed(0)} s stored · links ≤3 tiles; walls block.</div>
          {(['gardenId','barrelId','chestId'] as const).map(field => <label key={field} style={{display:'block',marginTop:3}}>{field==='gardenId'?'Plot':field==='barrelId'?'Water barrel':'Input / output chest'}: <select aria-label={field} value={e.farm![field]||''} onChange={ev=>api.act('farmConfigure',{eid,field,value:ev.target.value})} style={{background:'#2b1e30',color:'#fff',maxWidth:130}}><option value="">Not linked</option>{Object.values(r.entities).filter(o=>o.kind==='struct'&&(o.owner===undefined||o.owner==='player')&&Math.hypot(o.x-e.x,o.y-e.y)<=BAL.garden.tenderLinkTiles*TILE&&(field==='gardenId'?o.type==='garden':field==='barrelId'?o.type==='barrel':['chest_small','chest_large'].includes(o.type||''))).map(o=><option value={o.id} key={o.id}>{STRUCTS[o.type!].name} {o.tx},{o.ty}</option>)}</select></label>)}
          {e.farm.barrelId && <button className="btn" onClick={()=>api.act('fillBarrel',{eid:e.farm!.barrelId})}>Pour 1 flask charge into barrel</button>}<div>Replant: <button className="btn" onClick={()=>api.act('farmConfigure',{eid,field:'crop',value:e.farm!.crop==='crop'?'herb':'crop'})}>{GARDEN_CROPS[e.farm.crop].name}</button> <button className="btn gold" onClick={()=>api.act('farmConfigure',{eid,field:'enabled',value:!e.farm!.enabled})}>{e.farm.enabled?'Stop':'Start'}</button></div>
          <div style={{color:'#b7a8bf'}}>Chest: seeds + produce (Bitterleaf also needs herb). Barrel: water. Plant / pump / harvest: 8 / 4 / 8 fuel-seconds.</div>
        </div>}
        {e.garden && <div style={{ fontSize: 10 }}>
          {(()=>{const climate=gardenEnvironment(r,e,isWet(weatherAt(r,api.now())));return <div style={{color:'#ffd98a'}}>Climate {climate.climate} · {climate.biome} soil · {Math.round(climate.rate*100)}% growth {climate.frame?'· framed':''}{climate.scorched?' · scorched':''}</div>;})()}
          {gardenEnvironment(r,e,isWet(weatherAt(r,api.now()))).scorched && <div style={{color:'#ffbb80'}}>Scorched soil slows growth. <button className="btn" onClick={()=>api.act('restoreGardenSoil',{eid})}>Restore: 2 fiber + 1 Bitterleaf</button></div>}
          <div style={{color:'#b7a8bf'}}>Local temperature and soil change growth; water is consumed in real time. {e.garden.coldFrame?'Frame blocks rain.':'Rain waters uncovered soil.'}</div>
          {e.garden.coldFrame ? <button className="btn" onClick={()=>api.act('gardenFrame',{eid,remove:true})}>Remove frame (recover 2 wood + 2 fiber)</button> : <div>Cold frame + raised soil: {GARDEN_FRAME_COST.map(([k,q])=>`${q} ${ITEMS[k].name}`).join(', ')}. Warms cold plots; blocks rain. <button className="btn" onClick={()=>api.act('gardenFrame',{eid})}>Install frame</button></div>}
          <div>Water {e.garden.water.toFixed(1)}/3 · {e.garden.crop ? `${e.garden.crop === 'herb' ? 'Bitterleaf' : 'Sunroot'} ${Math.floor(e.garden.growth * 100)}%` : 'Empty plot'}</div>
          {!e.garden.crop ? (['crop','herb'] as const).map(k => <div key={k} style={{ marginTop: 5 }}><b>{GARDEN_CROPS[k].name}</b> · {GARDEN_CROPS[k].seconds / 60} wet min at 100%<br />
            Plant: {GARDEN_CROPS[k].inputs.map(([id,q]) => `${q} ${ITEMS[id].name}`).join(' + ')}<br />Harvest: {GARDEN_CROPS[k].output.map(([id,q]) => `${q} ${ITEMS[id].name}`).join(' + ')}<br />
            <button className="btn" onClick={() => api.act('garden', { eid, crop: k })}>Plant {GARDEN_CROPS[k].name}</button></div>) : <button className="btn" onClick={() => api.act('garden', { eid })}>{e.garden.growth >= 1 ? 'Harvest' : 'Water with flask'}</button>}
          <div style={{ color: '#b7a8bf', marginTop: 4 }}>Rain waters uncovered plots. Growth needs funded water; both choices compete for the plot.</div>
        </div>}
        {e.legacyJobs && <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Legacy jobs were recovered without inventing missing inputs. Resume at a matching nearby station.
          <button className="btn" onClick={() => { const station = Object.values(r.entities).find(o => o.kind === 'struct' && o.type === e.legacyJobs!.stationType && o.station && Math.hypot(o.x - r.player.x, o.y - r.player.y) <= 3 * TILE); if (station) api.act('recoverLegacyJobs', { eid, stationId: station.id }); else api.toast('Stand near a matching station.'); }}>Resume jobs</button></div>}
        {e.kind === 'recycler' && st && <RecyclerBody api={api} eid={eid} />}
        {st && e.kind !== 'recycler' && kind !== 'research' && <StationBody api={api} eid={eid} />}
        {st && kind === 'research' && <ResearchBody api={api} eid={eid} />}
        {e.kind === 'struct' && <div style={{ marginTop: 6, fontSize: 10, color: '#8a7a9a' }}>HP {Math.round(e.hp!)}/{e.maxHp} <button className="btn ghost" style={{ marginLeft: 6 }} onClick={() => { api.act('reclaim', { eid }); api.open(null); }}>Reclaim</button></div>}
      </div>
    </Panel>
    {!compact && <InventoryPanel api={api} quickTo={quickTo} top={54} />}
  </>;
}
function RecyclerBody({api,eid}:{api:Api;eid:string}) {
 const r=api.gs.run!,e=r.entities[eid],st=e.station!,drives=C(r,'inv').slots.map((s,i)=>({s,i})).filter(v=>v.s?.key==='damaged_drive');
 return <div style={{fontSize:11}}><b style={{color:'#ffd98a'}}>1 Damaged Drive → 2 Spares</b><div>12 seconds · consumes the drive. Or take it to a workbench for Mechanical Parts. No base required here.</div>
 {st.queue.map(j=><div key={j.id}>Processing · {Math.ceil(j.left/1000)}s <button className="btn ghost" onClick={()=>api.act('cancelJob',{eid,jobId:j.id})}>Cancel &amp; return drive</button></div>)}
 {!st.queue.length && (drives.length ? <><div style={{fontSize:10,color:'#cfc2dc'}}>Choose a Drive by inventory row and slot (left to right):</div>{drives.map(({s,i})=><button className="btn gold" style={{marginRight:3,marginBottom:2}} key={s!.uid} onClick={()=>api.act('recycleDrive',{eid,slot:i,uid:s!.uid})}>Recycle row {Math.floor(i/8)+1}, slot {i%8+1}</button>)}</> : <div>Carry a Damaged Drive from a finite car wreck.</div>)}
 <div style={{marginTop:5,color:'#ffd98a'}}>Output · collect before it fills</div><Grid api={api} cid={st.outC} cols={4}/><button className="btn" onClick={()=>{for(let i=0;i<C(r,st.outC).slots.length;i++)if(C(r,st.outC).slots[i])api.act('move',{from:st.outC,fs:i,to:'inv'});}}>Take output</button></div>;
}
function StationBody({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const e = r.entities[eid]; const st = e.station!; const kind = STRUCTS[e.type!].station!;
  const recipes = Object.entries(RECIPES).filter(([, rc]) => rc.station === kind); const known = recipes.filter(([k]) => isRecipeKnown(r.knowledge.recipes, k));
  const fuelled = kind === 'campfire' || kind === 'furnace';
  const level = st.level ?? 1;
  const [confirmSalvage, setConfirmSalvage] = useState<string | null>(null);
  const maintenance = C(r, 'inv').slots.map((s, i) => [s, i] as const).filter(([s]) => s && (ITEMS[s.key].repair || ITEMS[s.key].salvage));
  return <div>
    {kind === 'workbench' && <details style={{ fontSize: 10, marginBottom: 5, borderBottom: '1px solid #514155', paddingBottom: 4 }}>
      <summary style={{ color: '#ffd98a', cursor: 'pointer' }}>Equipment maintenance &amp; upgrades</summary>
      <div style={{ color: '#ffd98a' }}>Workbench level {level} / 3</div>
      {level < 3 ? <><div>{level === 1 ? "Upgrade unlocks improved tools and reinforced spear production." : "Industrial upgrade enables an efficient Refined Energy batch."}</div><div>Cost: <Cost ins={level === 1 ? WORKBENCH_UPGRADE.cost : WORKBENCH_UPGRADE_III.cost} have={have(api)} /></div><button className="btn gold" onClick={() => api.act('upgradeStation', { eid })}>Upgrade workbench</button></> : <div>Industrial production unlocked.</div>}
      <div style={{ color: '#ffd98a', marginTop: 3 }}>Equipment maintenance · carried items</div>
      {maintenance.length === 0 && <div>Carry repairable equipment to use this bench.</div>}
      {maintenance.map(([s, i]) => { const d = ITEMS[s!.key]; return <div key={s!.uid} style={{ borderTop: '1px solid #3a2e46', paddingTop: 2, marginTop: 2 }}>
        <div><Icon k={s!.key} size={11} /> {d.name} {s!.dur !== undefined && d.dur ? `${s!.dur}/${d.dur}` : ''}</div>
        {d.repair && <div>Repair: <Cost ins={d.repair.cost} have={have(api)} /> <button className="btn" disabled={s!.dur === undefined || s!.dur >= (d.dur || 0)} onClick={() => api.act('maintainItem', { eid, slot: i, uid: s!.uid, mode: 'repair' })}>Repair</button></div>}
        {d.salvage && <div>Dismantle for {d.salvage.yields.map(([key, n]) => `${n} ${ITEMS[key].name}`).join(', ')} {confirmSalvage === s!.uid ? <><span>Destroy this item?</span> <button className="btn danger" onClick={() => { api.act('maintainItem', { eid, slot: i, uid: s!.uid, mode: 'salvage' }); setConfirmSalvage(null); }}>Confirm</button> <button className="btn ghost" onClick={() => setConfirmSalvage(null)}>Cancel</button></> : <button className="btn danger" onClick={() => setConfirmSalvage(s!.uid)}>Dismantle</button>}</div>}
      </div>; })}
    </details>}
    {kind === 'workbench' && <details open style={{fontSize:10,marginBottom:4}}><summary style={{color:'#ffd98a'}}>Optional industrial power</summary>
      {!e.industrial ? <><div>Level {INDUSTRIAL_MODULE.benchLevel} bench; manual crafting always remains available. Powered jobs run {BAL.industrialPower.workSpeedMultiplier}× faster.</div><div>Install: <Cost ins={INDUSTRIAL_MODULE.cost} have={have(api)} /></div><button className="btn" onClick={()=>api.act('installIndustrial',{eid})}>Install module</button></> : <><div>Status: {industrialStatus(r,e)} · {BAL.industrialPower.workSpeedMultiplier}× only when powered. Manual speed otherwise.</div><label>Generator within 3 tiles: <select aria-label="Workbench generator" value={e.industrial.generatorId||''} onChange={ev=>api.act('industrialConfigure',{eid,field:'generatorId',value:ev.target.value})}><option value="">Not linked</option>{Object.values(r.entities).filter(g=>g.basePower&&(g.owner===undefined||g.owner==='player')&&Math.hypot(g.x-e.x,g.y-e.y)<=3*TILE).map(g=><option key={g.id} value={g.id}>Generator {g.tx},{g.ty}</option>)}</select></label><button className="btn" onClick={()=>api.act('industrialConfigure',{eid,field:'enabled',value:!e.industrial!.enabled})}>{e.industrial.enabled?'Disable power':'Enable power'}</button></>}
    </details>}
    {kind === 'furnace' && <details style={{ fontSize: 10, marginBottom: 4 }}><summary style={{ color: '#ffd98a', cursor: 'pointer' }}>Furnace lining {st.upgrade === 'kiln_lining' ? '· installed' : '· improve fuel efficiency'}</summary>{st.upgrade === 'kiln_lining' ? <div>Future work uses {Math.round((1-BAL.fuel.linedFurnaceFuelMultiplier)*100)}% less fuel; work time is unchanged.</div> : <><div>{Math.round((1-BAL.fuel.linedFurnaceFuelMultiplier)*100)}% less fuel for future work. Requires a level 2 workbench close to you and this furnace.</div><div>{FURNACE_LINING.cost.map(([k,q]) => `${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(' · ')}</div><button className="btn" onClick={() => { const bench = Object.values(r.entities).find(b => b.kind === 'struct' && b.type === 'workbench' && b.station && (b.owner === undefined || b.owner === 'player') && (b.station.level ?? 1) >= 2 && Math.hypot(b.x-r.player.x,b.y-r.player.y) <= 3*TILE && Math.hypot(b.x-e.x,b.y-e.y) <= 3*TILE); api.act('upgradeFurnace', { eid, benchId: bench?.id }); }}>Pay &amp; line furnace</button></>}</details>}
    {fuelled && <div style={{ marginBottom: 4 }}><div style={{ fontSize: 10, color: '#ffd98a' }}>Fuel {st.burn > 0 ? <span style={{ color: '#ffb040' }}>· burning {Math.ceil(st.burn / 1000)}s</span> : <span style={{ color: '#8a7a9a' }}>· cold</span>}{kind === 'campfire' ? ' (burns continuously; warmth + light)' : ' (burns only while working)'}</div><Grid api={api} cid={st.fuelC} cols={3} /></div>}
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Queue</div>
    {st.queue.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>Idle.</div>}
    {st.queue.map((j, i) => { const out = j.recipe.startsWith('R:') ? 'blueprint' : RECIPES[j.recipe].out; return <div key={j.id} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={out} size={12} /><span style={{ width: 90 }}>{ITEMS[out].name}</span><div className="bar" style={{ width: 60 }}><i style={{ width: `${(1 - j.left / j.total) * 100}%`, background: i === 0 && (!fuelled || st.burn > 0) ? '#7aff6a' : '#a07a3a' }} /></div><span>{Math.ceil(j.left / 1000)}s</span><button className="btn ghost" style={{ padding: '0 3px' }} onClick={() => api.act('cancelJob', { eid, jobId: j.id })}>✕</button></div>; })}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Output</div><Grid api={api} cid={st.outC} cols={6} />
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Recipes</div>
    {kind === 'workbench' && <div style={{ fontSize: 10, color: '#cfc2dc' }}>Drive recovery: 1 Damaged Drive + 1 Scrap → 1 Mechanical Parts (12s).</div>}
    <div style={{fontSize: 9, color: '#cfc2dc'}}>Red cost = missing · queue holds up to 6.</div>
    {known.map(([k, rc]) => {
      const missing = rc.ins.some(([item, qty]) => countItem(r, 'inv', item) < qty);
      const reason = (rc.stationLevel ?? 1) > level ? `Requires bench ${rc.stationLevel}` : st.queue.length >= 6 ? 'Queue full' : missing ? 'Missing ingredients' : 'Queue this recipe';
      return <div key={k} className="flex items-center gap-1" style={{ fontSize: 10, marginBottom: 1 }}><Icon k={rc.out} size={12} /><span style={{ width: 82 }}>{k === 'recover_drive' ? 'Recover Drive → Parts' : ITEMS[rc.out].name + (rc.qty > 1 ? ` ×${rc.qty}` : '')}</span><Cost ins={rc.ins} have={have(api)} /><span style={{ color: '#8a7a9a' }}>{rc.secs}s{(rc.stationLevel ?? 1) > level ? ` · bench ${rc.stationLevel} required` : ''}</span><button className="btn" title={reason} disabled={reason !== 'Queue this recipe'} style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => api.act('craft', { recipe: k, eid })}>Queue</button></div>;
    })}
    {recipes.length > known.length && <div style={{ fontSize: 10, color: '#8a7a9a' }}>{recipes.length - known.length} more recipes undiscovered here (blueprints, research, specimens).</div>}
  </div>;
}
function ResearchBody({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const e = r.entities[eid]; const st = e.station!; const B = BAL.research;
  const [search, setSearch] = useState(''); const [confirmStudy, setConfirmStudy] = useState<string | null>(null);
  const unknown = Object.keys(RECIPES).filter(k => !isRecipeKnown(r.knowledge.recipes, k));
  const specimens = C(r, 'inv').slots.map((s, i) => [s, i] as const).filter(([s]) => s && (ITEMS[s.key].specimen || CORE_STUDY[s.key] || ITEMS[s.key].studyRecipe));
  return <div>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>Spares in pack: <b style={{ color: '#ffe27a' }}>{countItem(r, 'inv', 'spares')}</b> · Known recipes {Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).length}/{Object.keys(RECIPES).length}</div>
    <div className="flex gap-1 items-center" style={{ margin: '3px 0' }}><button className="btn gold" onClick={() => api.act('research', { mode: 'random', eid })}>Tinker ({B.randomSparesCost} Spares, {B.randomSeconds}s)</button><span style={{ fontSize: 9, color: '#8a7a9a' }}>random unknown recipe</span></div>
    <details style={{ marginBottom: 3 }}><summary style={{ fontSize: 10, color: '#ffd98a', cursor: 'pointer' }}>Directed study ({B.directedSparesCost} Spares, {B.directedSeconds}s)</summary>
    <label style={{ fontSize: 10 }}>Find <input aria-label="Find research recipe" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 120, color: '#fff', background: '#21182a', border: '1px solid #6c5770' }} /></label>
    <div className="scroll flex flex-wrap gap-1" style={{ maxHeight: 75, overflowY: 'auto' }}>{unknown.filter(k => permitsDirectedResearch(RECIPES[k]) && ITEMS[RECIPES[k].out].name.toLowerCase().includes(search.toLowerCase())).map(k => <button key={k} className="btn ghost" style={{ padding: '1px 3px', fontSize: 10 }} title={`${ITEMS[RECIPES[k].out].name} (${k})`} onClick={() => api.act('research', { mode: 'directed', recipe: k, eid })}><Icon k={RECIPES[k].out} size={10} /> {ITEMS[RECIPES[k].out].name}{Object.values(RECIPES).filter(rc => rc.out === RECIPES[k].out).length > 1 ? ` (${RECIPES[k].ins.map(([key, qty]) => `${qty} ${ITEMS[key].name}`).join(', ')})` : ''}</button>)}</div></details>
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Specimen / Core / equipment study ({B.specimenSeconds}s, consumes 1)</div>
    {specimens.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>Carry a creature specimen, Core or studyable equipment.</div>}
    {specimens.map(([s, i]) => <div key={i} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={s!.key} size={12} />{ITEMS[s!.key].name} → {ITEMS[RECIPES[ITEMS[s!.key].specimen || CORE_STUDY[s!.key] || ITEMS[s!.key].studyRecipe!].out].name}{confirmStudy === s!.uid ? <><span>Consumes item</span><button className="btn danger" onClick={() => { api.act('research', { mode: 'specimen', slot: i, uid: s!.uid, eid }); setConfirmStudy(null); }}>Confirm</button><button className="btn ghost" onClick={() => setConfirmStudy(null)}>Cancel</button></> : <button className="btn" style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => setConfirmStudy(s!.uid)}>Study</button>}</div>)}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>In progress</div>
    {st.queue.map(j => <div key={j.id} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k="blueprint" size={12} />{ITEMS[RECIPES[j.recipe.slice(2)].out].name}<div className="bar" style={{ width: 60 }}><i style={{ width: `${(1 - j.left / j.total) * 100}%`, background: '#9ad0ff' }} /></div>{Math.ceil(j.left / 1000)}s <button className="btn ghost" onClick={() => api.act('cancelJob', { eid, jobId: j.id })}>✕</button></div>)}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Blueprints ready (take, then use to learn)</div><Grid api={api} cid={st.outC} cols={4} />
  </div>;
}

function RecipeTree({ recipe, known, ancestors = [] }: { recipe: string; known: string[]; ancestors?: string[] }) {
  if (ancestors.includes(recipe)) return <span>Cycle</span>;
  const rc = RECIPES[recipe], seen = [...ancestors, recipe];
  return <div style={{ paddingLeft: 8 }}>{rc.ins.map(([key, qty]) => {
    const producers = Object.keys(RECIPES).filter(k => isRecipeKnown(known,k) && RECIPES[k]?.out === key && !seen.includes(k));
    return <div key={key}>{qty} × {ITEMS[key].name}{producers.length > 0 && <details><summary style={{ cursor: 'pointer', color: '#a9dca8' }}>Known ways to craft</summary>{producers.map(k => <div key={k}>{ITEMS[RECIPES[k].out].name} ×{RECIPES[k].qty} · {RECIPES[k].station ? STRUCTS[RECIPES[k].station!].name : 'hand'}{RECIPES[k].stationLevel ? ` level ${RECIPES[k].stationLevel}` : ''}<RecipeTree recipe={k} known={known} ancestors={seen} /></div>)}</details>}</div>;
  })}</div>;
}

export function CraftPanel({ api }: { api: Api }) {
  const [search, setSearch] = useState(''); const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('Hand'); const [inventory, setInventory] = useState(false);
  const r = api.gs.run!;
  const groups: [string, string | null][] = [['Hand', null], ['Campfire', 'campfire'], ['Furnace', 'furnace'], ['Workbench', 'workbench']];
  const nearSt = (k: string) => Object.values(r.entities).find(e => e.kind === 'struct' && e.station && (e.owner === undefined || e.owner === 'player') && STRUCTS[e.type!]?.station === k && Math.hypot(e.x-r.player.x,e.y-r.player.y) <= 3*TILE);
  if (inventory) return <InventoryPanel api={api} x={8} top={34} onClose={() => { api.setSel(null); setInventory(false); }} />;
  const rc = selectedRecipe ? RECIPES[selectedRecipe] : null; const st = rc?.station ? nearSt(rc.station) : null;
  const materials = !!rc && rc.ins.every(([k,q]) => countItem(r,'inv',k) >= q);
  const stationReady = !rc?.station || (!!st && (st.station!.level ?? 1) >= (rc.stationLevel ?? 1));
  const fuelNeeded = rc?.station === 'campfire' || rc?.station === 'furnace';
  const fuelReady = !fuelNeeded || !!st && (st.station!.burn > 0 || C(r, st.station!.fuelC).slots.some(s => s && ITEMS[s.key].fuel));
  const outputReady = !rc?.station || !st || spaceFor(r, st.station!.outC, rc.out) >= rc.qty;
  return <Panel title="Crafting" style={{ left: 8, top: 34, width: 302, height: 306 }} onClose={() => api.open(null)}>
    <div className="flex gap-1" style={{ marginBottom: 4 }}><button className="btn" onClick={() => setInventory(true)}>Inventory</button>{selectedRecipe && <button className="btn" onClick={() => setSelectedRecipe(null)}>Close details</button>}<span style={{ fontSize: 10, color: '#b7a8bf', alignSelf: 'center' }}>{Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).length} learned</span></div>
    {rc && selectedRecipe ? <div className="scroll" style={{ maxHeight: 245, overflowY: 'auto', fontSize: 11 }}>
      <div className="flex items-center gap-1"><Icon k={rc.out} size={20} /><b style={{ color: '#ffd98a' }}>{ITEMS[rc.out].name} ×{rc.qty}</b><span> · learned</span></div>
      <div style={{ color: '#cfc2dc', margin: '3px 0' }}>{ITEMS[rc.out].desc}</div>
      <b>Ingredients per batch</b>{rc.ins.map(([k,q]) => <div key={k} style={{ color: countItem(r,'inv',k) >= q ? '#bfe8a8' : '#ff9a8a' }}>{ITEMS[k].name}: {countItem(r,'inv',k)}/{q}</div>)}
      <div style={{ marginTop: 3 }}>{rc.station ? `${STRUCTS[rc.station].name}${rc.stationLevel ? ` level ${rc.stationLevel}` : ''}: ${stationReady ? 'in reach' : 'missing / insufficient level'}` : 'By hand'} · {rc.secs}s</div>
      {rc.station && st && <div>Queue {st.station!.queue.length}/6 · {fuelNeeded ? `Fuel ${fuelReady ? 'available' : 'missing (job pauses)'} · ` : ''}Output {outputReady ? 'space' : 'full (job waits)'}</div>}
      <button className="btn gold" style={{ marginTop: 4 }} disabled={!materials || !stationReady || !!st && st.station!.queue.length >= 6} onClick={() => api.act('craft', { recipe: selectedRecipe, eid: st?.id })}>{rc.station ? 'Reserve & queue' : 'Craft'}</button>
      <details style={{ marginTop: 5 }}><summary style={{ cursor: 'pointer', color: '#a9dca8' }}>Ingredients &amp; known sub-recipes</summary><RecipeTree recipe={selectedRecipe} known={r.knowledge.recipes} /></details>
    </div> : <>
      <label style={{ fontSize: 10 }}>Find known recipe <input aria-label="Find known recipe" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 135, color: '#fff', background: '#21182a', border: '1px solid #6c5770' }} /></label>
      <div className="flex gap-1" style={{ margin: '4px 0', flexWrap: 'wrap' }}>{groups.map(([label]) => <button key={label} className="btn" aria-pressed={category === label} onClick={() => { setCategory(label); setSearch(''); }} style={{ color: category === label ? '#ffd98a' : undefined }}>{label}</button>)}</div>
      <div className="scroll" style={{ maxHeight: 190, overflowY: 'auto', fontSize: 11 }}>
        {groups.filter(([label]) => search.trim() || category === label).map(([label, station]) => { const all = Object.entries(RECIPES).filter(([,v]) => v.station === station); const list = all.filter(([k,v]) => isRecipeKnown(r.knowledge.recipes, k) && ITEMS[v.out].name.toLowerCase().includes(search.trim().toLowerCase())); const hidden = all.filter(([k]) => !isRecipeKnown(r.knowledge.recipes, k)).length; return <div key={label}>
          {search.trim() && list.length > 0 && <div style={{ color: '#ffd98a' }}>{label}</div>}
          {list.map(([k,v]) => <button key={k} className="ghost flex items-center gap-1" onClick={() => setSelectedRecipe(k)} style={{ width: '100%', padding: '3px 0', textAlign: 'left', borderBottom: '1px solid #2a2034', cursor: 'pointer' }}><Icon k={v.out} size={15} /><span>{ITEMS[v.out].name}{v.qty > 1 ? ` ×${v.qty}` : ''}</span><span style={{ marginLeft: 'auto', color: v.ins.every(([id,q]) => countItem(r,'inv',id) >= q) ? '#a9dca8' : '#ff9a8a' }}>{v.ins.every(([id,q]) => countItem(r,'inv',id) >= q) ? 'materials ready' : 'missing materials'}</span></button>)}
          {!search.trim() && hidden > 0 && <div style={{ color: '#a093aa', fontSize: 10, marginTop: 4 }}>{hidden} undiscovered · explore, find blueprints or research</div>}
        </div>; })}
      </div>
    </>}
  </Panel>;
}

export function BuildPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const owned = Object.values(r.entities).some(e => e.type === 'claim');
  const [category,setCategory]=useState('Shell'); const [query,setQuery]=useState('');
  const groups: Record<string,string[]> = {
    Shell:['claim','floor_wood','floor_stone','wall_wood','wall_stone','wall_brick','door_wood','door_iron','roof_thatch','roof_tile'],
    Home:['bed_straw','chest_small','chest_large','escrow'],
    Work:['campfire','furnace','workbench','research','garden','barrel','farm_controller'],
    Defense:['base_generator','arrow_turret','spikes','barricade','torch_post'],
  };
  const keys=BUILD_ORDER.filter(k=>query.trim() ? STRUCTS[k].name.toLowerCase().includes(query.trim().toLowerCase()) : groups[category].includes(k));
  return <Panel title="Build · choose a structure" style={{ left: 20, top: 30, width: 390, maxHeight: 300 }} onClose={() => api.open(null)}>
    {!owned && <div style={{ fontSize: 11, color: '#ffd98a' }}>Claim a clear site first; keep roads and entrances open.</div>}
    <div className="flex gap-1" style={{marginBottom:4}}>{Object.keys(groups).map(k=><button key={k} className={`btn ${category===k&&!query?'gold':''}`} onClick={()=>{setCategory(k);setQuery('')}}>{k}</button>)}</div>
    <label style={{fontSize:11}}>Find <input aria-label="Find structure" value={query} onChange={e=>setQuery(e.target.value)} style={{width:135,color:'#fff',background:'#21182a',border:'1px solid #6c5770'}} /></label>
    <div className="scroll" style={{maxHeight:152,overflowY:'auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:3,marginTop:4}}>
      {keys.map(k => { const d=STRUCTS[k], ok=d.cost.every(([i,q])=>countItem(r,'inv',i)>=q); return <button key={k} className="btn ghost" style={{textAlign:'left',padding:4,opacity:ok?1:.75}} title={d.desc} onClick={()=>{api.setBuild(k);api.setReclaim(false);api.setRepairMode(false);api.setUpgradeMode(false);api.open(null)}}><div className="flex items-center gap-1"><img className="px" src={iconUrlSt(k)} style={{width:18,height:18,objectFit:'contain'}} alt=""/><b style={{fontSize:11}}>{d.name}</b></div><div style={{fontSize:10,lineHeight:1.1,color:ok?'#bfe8a8':'#ffad9d'}}>{d.cost.map(([id,q])=>`${ITEMS[id].name} ${countItem(r,'inv',id)}/${q}`).join(' · ')}</div></button>; })}
      {!keys.length && <div>No matching structures.</div>}
    </div>
    <div className="flex gap-1" style={{marginTop:5}}><button className="btn" onClick={()=>{api.setReclaim(true);api.setBuild(null);api.setRepairMode(false);api.setUpgradeMode(false);api.open(null)}}>Dismantle [X]</button><button className="btn" onClick={()=>{api.setRepairMode(true);api.setBuild(null);api.setReclaim(false);api.setUpgradeMode(false);api.open(null)}}>Repair [V]</button><button className="btn" onClick={()=>{api.setUpgradeMode(true);api.setBuild(null);api.setReclaim(false);api.setRepairMode(false);api.open(null)}}>Upgrade [U]</button></div>
    <div style={{fontSize:10,color:'#cfc2dc'}}>Click to place or edit · G cycles layers · RMB/Esc stops. Reclaim bags contents and refunds {Math.round(BAL.economy.reclaimRefund*100)}%.</div>
  </Panel>;
}
import { iconUrl } from './common';
const iconUrlSt = (k: string) => iconUrl('st:' + (k === 'escrow' ? 'escrow' : k));

export function MapPanel({ api, onTeleportSelect, teleportTarget }: { api: Api; onTeleportSelect?: (x:number,y:number)=>void; teleportTarget?: {x:number;y:number} | null }) {
  const ref = useRef<HTMLCanvasElement>(null); const r = api.gs.run!; const w = getWorld();
  useEffect(() => { const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(getMapCanvas(r), 0, 0);
    const disc = r.discovered; g.fillStyle = 'rgba(12,10,20,0.86)'; for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) if (!disc[y * 50 + x]) g.fillRect(x * 4, y * 4, 4, 4);
    const dot = (x: number, y: number, col: string, s = 3) => { g.fillStyle = '#000'; g.fillRect(x - 1 - (s >> 1), y - 1 - (s >> 1), s + 2, s + 2); g.fillStyle = col; g.fillRect(x - (s >> 1), y - (s >> 1), s, s); };
    for (const p of w.places) if (r.poiSeen.includes(p.id)) dot(p.tx, p.ty, p.kind === 'elder' ? '#ff4a3a' : p.kind === 'evac' ? '#5af0ff' : p.kind === 'start' ? '#a0e070' : '#ffd040');
    for (const e of Object.values(r.entities)) { if (e.type === 'claim') dot(e.tx!, e.ty!, '#ff9a3a', 4); if (e.kind === 'bag') dot(e.x / 16, e.y / 16, '#ffffff'); if (e.kind === 'cart') dot(e.x / 16, e.y / 16, '#c9935a'); }
    const p = r.player; dot(p.x / 16, p.y / 16, Math.floor(Date.now() / 300) % 2 ? '#ffffff' : '#ff4a8a', 3);if(teleportTarget)dot(teleportTarget.x/TILE,teleportTarget.y/TILE,'#d79cff',5);
  });
  const p = r.player; const h = runHours(r, api.now());
  return <Panel title={`${w.veyra ? 'Map · bounded view' : 'Map of the island'} — ${(w.zoneNames || ZONES)[w.zone[Math.floor(p.y / 16) * WW + Math.floor(p.x / 16)]]}`} style={{ left: 120, top: 26, width: 400 }} onClose={() => api.open(null)}>
    <div className="flex gap-2"><canvas ref={ref} width={200} height={200} style={{ width: 260, height: 260, border: '1px solid #3a2e46', cursor:onTeleportSelect?'crosshair':'default' }} onClick={onTeleportSelect ? e=>{const rect=e.currentTarget.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left)/rect.width*200),y=Math.floor((e.clientY-rect.top)/rect.height*200);onTeleportSelect(x*TILE+8,y*TILE+8);} : undefined} />
      <div style={{ fontSize: 10, lineHeight: 1.15, width: 125 }}>
        {onTeleportSelect && <div style={{color:'#e2bfff',fontSize:11,lineHeight:1.2,marginBottom:5}}>Lõi quỷ<br/>Click explored safe ground.<br/>Close map; hold and release E.<br/>Purple marks destination. Cart stays behind.</div>}<div style={{ color: '#ffd98a' }}>Discovered</div>{w.places.filter(pl => r.poiSeen.includes(pl.id)).map(pl => <div key={pl.id} style={{ color: pl.kind === 'elder' ? '#ff8a7a' : pl.kind === 'evac' ? '#5af0ff' : '#e0d0b0' }}>• {pl.name}</div>)}
        {r.poiSeen.length === 0 && <div style={{ color: '#8a7a9a' }}>Nothing yet — explore.</div>}
        <div style={{ color: '#ffd98a', marginTop: 4 }}>Legend</div><div><span style={{ color: '#ffd040' }}>■</span> landmark <span style={{ color: '#ff4a3a' }}>■</span> elder</div><div><span style={{ color: '#ff9a3a' }}>■</span> your claim <span style={{ color: '#fff' }}>■</span> bag</div><div><span style={{ color: '#5af0ff' }}>■</span> evacuation</div>
        <div style={{ color: '#8a7a9a', marginTop: 4 }}>Run hour {h.toFixed(1)} / {BAL.run.maxRunHours} · {phaseOf(r, api.now()).toUpperCase()}</div>
      </div></div></Panel>;
}

export function SkillsPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 3));
  const labels: Record<string, string> = { gather: 'Gathering', combat: 'Combat (+0.2% dmg/xp)', craft: 'Crafting', survival: 'Survival' };
  return <Panel title="Adventurer — skills, knowledge, stones" style={{ left: 120, top: 34, width: 400 }} onClose={() => api.open(null)}>
    <div className="flex gap-3" style={{ fontSize: 10 }}>
      <div style={{ width: 170 }}>{Object.entries(r.player.skills).map(([k, xp]) => <div key={k} style={{ marginBottom: 3 }}><div className="flex justify-between"><span>{labels[k]}</span><span style={{ color: '#ffd98a' }}>Lv {lvl(xp)}</span></div><div className="bar" style={{ width: 160 }}><i style={{ width: `${((Math.sqrt(xp / 3) % 1) * 100)}%`, background: '#9ad0ff' }} /></div></div>)}
        <div style={{ color: '#ffd98a', marginTop: 6 }}>Elder stones (optional)</div>
        <div className="flex gap-1" style={{ marginTop: 2 }}>{Object.values(ELDERS).map(e => <div key={e.stone} title={e.name} style={{ opacity: r.elderStones.includes(e.stone) ? 1 : 0.25 }}><Icon k={e.stone} /></div>)}</div>
        <div style={{ color: '#8a7a9a' }}>{r.elderStones.length}/6 — six stones + evacuation = exceptional ending.</div>
        <div style={{ color: '#ffd98a', marginTop: 6 }}>Run achievements · {r.score} local score</div>{r.achievements.map(a => <div key={a}>★ {ACHIEVEMENTS[a].name} <span style={{ color: '#8a7a9a' }}>+{ACHIEVEMENTS[a].score}</span></div>)}
        <div style={{ color: '#ff9a7a', fontSize: 9 }}>LOCAL/UNVERIFIED — never converts into cash.</div>
      </div>
      <div style={{ flex: 1 }}><div style={{ color: '#ffd98a' }}>Known recipes ({Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).length})</div>
        <div className="scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', maxHeight: 220, overflowY: 'auto' }}>{Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).map(k => <div key={k} className="flex items-center gap-1"><Icon k={RECIPES[k].out} size={10} />{ITEMS[RECIPES[k].out].name}</div>)}</div></div>
    </div></Panel>;
}

export function MenuPanel({ api, onQuit, onSave }: { api: Api; onQuit: () => void; onSave: () => Promise<boolean> }) {
  const [confirm, setConfirm] = useState(false); const pf = api.gs.profile; const r = api.gs.run!; const outlook = wetOutlook(r, api.now());
  return <Panel title="Menu — world time continues" style={{ left: 150, top: 40, width: 340 }} onClose={() => api.open(null)}>
    <div className="flex flex-wrap gap-1"><button className="btn gold" onClick={() => api.open(null)}>Resume</button><button className="btn" onClick={async () => { const ok = await onSave(); api.toast(ok ? 'Saved locally.' : 'Save failed. Your changes are not confirmed on disk.'); }}>Save now</button><button className="btn" onClick={onQuit}>Save & quit to title</button></div>
    <div style={{ fontSize: 10, marginTop: 5, color: '#e6d9bc', lineHeight: 1.2 }}>
      <b>Before you leave</b> · {isSheltered(r, r.player.x, r.player.y) ? 'Sheltered here' : 'Not sheltered here'} · Weather: {weatherAt(r, api.now())}.<br />
      Next {Math.round(outlook.hours)}h outlook: ~{Math.round(outlook.wetHours)}h wet (global schedule estimate). Footprints fade; rain washes them faster. Change route, clear nearby creatures, wait, or use doors and terrain. No home is required.<br />
      While away: weather, fire, production and exposure advance. Limited trace playback can damage reachable structures; other encounters remain unresolved.
    </div>
    <div style={{ fontSize: 10, marginTop: 6 }} className="flex items-center gap-2">Volume <input type="range" min={0} max={1} step={0.05} value={pf.settings.volume} onChange={e => { pf.settings.volume = +e.target.value; setVolume(pf.settings.volume, pf.settings.muted); api.rerender(); }} /><label><input type="checkbox" checked={pf.settings.muted} onChange={e => { pf.settings.muted = e.target.checked; setVolume(pf.settings.volume, pf.settings.muted); api.rerender(); }} /> mute</label></div>
    <div style={{ fontSize: 10, marginTop: 6, color: '#cfc2dc', lineHeight: 1.15 }}>WASD move · mouse aim · LMB attack/use · Space dodge-roll · E interact · V repair structure · F pull cart · 1–8 / wheel quickbar · I inventory · C craft · B build (X reclaim) · R research · M map · Tab skills · RMB cancel cast/build · Esc menu</div>
    <div className="panel" style={{ padding: 4, marginTop: 6, background: '#1a0e10' }}><div style={{ fontSize: 10, color: '#ff9a7a' }}>QA time acceleration — marks this run QA · LOCAL/UNVERIFIED (not real elapsed time)</div>
      <div className="flex flex-wrap gap-1" style={{ marginTop: 3 }}>{[1, 24].map(h => <button key={h} className="btn ghost" onClick={() => api.act('qaAdvance', { hours: h })}>+{h}h</button>)}
        <button className="btn ghost" onClick={() => api.act('qaAdvance', { hours: Math.max(0, 264.05 - runHours(r, api.now())) })}>→ Ragnarok (h264)</button>
        <button className="btn ghost" onClick={() => api.act('qaAdvance', { hours: Math.max(0, 312.05 - runHours(r, api.now())) })}>→ Day 14 (h312)</button></div></div>
    <div style={{ marginTop: 6 }}>{!confirm ? <button className="btn danger" onClick={() => setConfirm(true)}>Abandon run…</button> : <span className="flex gap-1 items-center" style={{ fontSize: 10 }}>Abandon wipes all run items, home and unsecured cash. <button className="btn danger" onClick={() => api.act('abandon')}>Confirm abandon</button><button className="btn ghost" onClick={() => setConfirm(false)}>No</button></span>}</div>
  </Panel>;
}

export function VendorPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash'); const pf = api.gs.profile;
  return <><Panel title="Mirela the Trader — Crossroads" style={{ left: 120, top: 40, width: 280 }} onClose={() => api.open(null)}>
    <div className="scroll" style={{maxHeight:260,overflowY:'auto',overflowX:'hidden'}}>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>"Only Ragnarok coin buys an escrow chest. No banks out here — carry it home yourself."</div>
    <div className="flex items-center gap-1" style={{ marginTop: 4, fontSize: 11 }}><Icon k="escrow_chest" /> Rương ký gửi <span style={{ color: '#ffe27a' }}>{BAL.economy.escrowChestPrice} physical cash</span> <span style={{ color: '#8a7a9a' }}>stock {r.vendorStock.escrow_chest}</span>
      <button className="btn gold" style={{ marginLeft: 'auto' }} disabled={cash < BAL.economy.escrowChestPrice || r.vendorStock.escrow_chest <= 0} onClick={() => api.act('buy', { eid, item: 'escrow_chest' })}>Buy</button></div>
    <div style={{ fontSize: 10, color: cash ? '#ffe27a' : '#8a7a9a' }}>You carry {cash} unsecured cash.{!isRagnarok(r, api.now()) && ' Cash only appears from sealed chests in the final 72 hours.'}</div>
    <div style={{fontSize:11,color:'#ffd98a',marginTop:6}}>Run-local Spares supplies · you carry {countItem(r,'inv','spares')}</div>
    {Object.entries(VENDOR_SPARES).map(([k,v])=><div key={k} className="flex items-center gap-1" style={{fontSize:10}}><Icon k={k} size={12}/>{ITEMS[k].name} ×{v.qty} · {v.price} Spares <span style={{color:'#8a7a9a'}}>stock {r.vendorStock[`spares:${k}`]||0}</span><button className="btn" style={{marginLeft:'auto',padding:'1px 5px'}} disabled={countItem(r,'inv','spares')<v.price || !(r.vendorStock[`spares:${k}`]>0)} onClick={()=>api.act('buySpares',{eid,item:k})}>Buy</button></div>)}
    <div style={{fontSize:9,color:'#8a7a9a'}}>Finite stock this run; no resale. Old saves retain their original stock.</div>
    <div style={{ fontSize: 11, color: '#ffd98a', marginTop: 6 }}>Profile-secured goods <span style={{ fontSize: 10, color: '#cfc2dc' }}>(you have {pf.securedCash} secured)</span></div>
    {Object.entries(VENDOR_SECURED).map(([k, v]) => <div key={k} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={k} size={12} />{ITEMS[k].name}<span style={{ color: '#ffe27a' }}>{v.price}</span><span style={{ color: '#8a7a9a' }}>×{r.vendorStock[k]}</span><button className="btn" style={{ marginLeft: 'auto', padding: '1px 5px' }} disabled={pf.securedCash < v.price || r.vendorStock[k] <= 0} onClick={() => api.act('buy', { eid, item: k })}>Buy</button></div>)}
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>Purchases become run-local items and are wiped when this run ends. Prices/stock: PROPOSED.</div>
    </div>
  </Panel><InventoryPanel api={api} /></>;
}
export function EscrowPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash');
  return <Panel title="Rương ký gửi — escrow chest" style={{ left: 180, top: 70, width: 280 }} onClose={() => api.open(null)}>
    <div style={{ fontSize: 11 }}>Carried physical cash: <b style={{ color: '#ffe27a' }}>{cash}</b> · Profile-secured: <b style={{ color: '#9ae0ff' }}>{api.gs.profile.securedCash}</b></div>
    <div style={{ fontSize: 10, color: '#cfc2dc', margin: '3px 0' }}>Depositing converts every coin you carry into profile-secured cash in one atomic step. You may deposit again any time; the run continues. Secured cash survives the end of the run — nothing else does.</div>
    <div className="flex gap-1"><button className="btn gold" disabled={!cash} onClick={() => { const res = api.act('deposit', { eid }); if (res.ok) api.sfx('coin'); }}>Deposit {cash}</button><button className="btn ghost" onClick={() => { api.act('reclaim', { eid }); api.open(null); }}>Pick up chest</button></div>
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>Run total deposited: {r.deposited}</div>
  </Panel>;
}
export function EvacPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash'); const [sure, setSure] = useState(false);
  return <Panel title="Evacuation Beacon" style={{ left: 170, top: 70, width: 300 }} onClose={() => api.open(null)}>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>Signal the boat and leave the island. Evacuation ends this run successfully. Everything run-local is wiped: items, Cores, recipes, buildings, cargo and any <b style={{ color: '#ff9a7a' }}>unsecured cash ({cash})</b>. Only profile-secured cash ({api.gs.profile.securedCash}), achievements and history remain.</div>
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 3 }}>Elder stones carried: {r.elderStones.length}/6{r.elderStones.length >= 6 ? ' — the Crown of Six awaits!' : ''}</div>
    <div className="flex gap-1" style={{ marginTop: 5 }}>{!sure ? <button className="btn gold" onClick={() => setSure(true)}>Light the beacon…</button> : <button className="btn danger" onClick={() => api.act('evacuate', { eid })}>Confirm evacuation</button>}<button className="btn ghost" onClick={() => api.open(null)}>Stay</button></div>
  </Panel>;
}
export function ReportPanel({ api, lines }: { api: Api; lines: string[] }) {
  return <Panel title="While you were away" style={{ left: 170, top: 80, width: 300 }} onClose={() => api.open(null)}>
    <div className="scroll" style={{ maxHeight: 150, overflowY: 'auto' }}>{lines.map((l, i) => <div key={i} style={{ fontSize: 11, color: i ? '#cfc2dc' : '#ffd98a' }}>• {l}</div>)}</div>
    <div style={{ fontSize: 10, color: '#b2a5bd', marginTop: 3 }}>Only evidenced tracks and physical impacts are resolved; other encounters remain unresolved. The world is live behind this report.</div>
    <button className="btn gold" style={{ marginTop: 4 }} onClick={() => api.open(null)}>Continue</button>
  </Panel>;
}
