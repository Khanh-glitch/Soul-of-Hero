import { recoveryPlan, recoveryFits } from '../game/recycler';
import { LOOT_CLASSES, LOOT_B04_ROLES, lootClass } from '../game/loot-ecology';
import { useEffect, useRef, useState } from 'react';
import type { RunState } from '../game/core';
import { anyAuthorizedOilSource, owned, clearInteraction } from '../game/engine';
import { stationBurnable, ITEMS, RECIPES, permitsDirectedResearch, isRecipeKnown, STRUCTS, BUILD_ORDER, VENDOR_SECURED, VENDOR_SPARES, ACHIEVEMENTS, ELDERS, PRIMORDIAL_ELDERS, CORE_STUDY, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, CART_FREIGHT_UPGRADE, GENERATOR_CAPACITY_UPGRADE, INDUSTRIAL_MODULE, GARDEN_CROPS, GARDEN_FRAME_COST, FURNACE_LINING } from '../game/catalog';
import { isVeyra05Layout } from '../veyra05/scenes';
import { BAL, TILE, WW, type Stack, type Entity } from '../game/core';
import type { OfflineReturnV1, StoredReturnEntry } from '../game/return-report';
import { ReturnChronicle } from './ReturnChronicle';
import { CabinetReadout } from './HomeStatus';
import { StationConsole } from './StationConsole';
import { C, countItem, invWeight, isRagnarok, runHours, cartWeight, cartLimit, carryLimit, spaceFor, phaseOf, tenderStatus, gardenEnvironment, weatherAt, isWet, isSheltered, wetOutlook, turretStatus, industrialStatus, powerAllocation, connectedPower, offlineSurvivalEstimate, territoryForecast, claimAt, structureRepairCost } from '../game/engine';
import { getWorld, ZONES } from '../game/world';
import { recipeOutputs } from '../game/engine';
/** Every product a recipe commits together, e.g. "2 Fuel Canister + 1 Machine Lubricant". */
const bundleLabel = (rc: { out: string; qty: number; outs?: [string, number][] }) => recipeOutputs(rc).map(([k, q]) => `${q} ${ITEMS[k].name}`).join(' + ');
import { getMapCanvas } from '../game/render';
import { setVolume } from '../game/audio';
import { Panel, Slot, Icon, Cost, iconUrl, type Api } from './common';
import { Glyph } from './hud';
import { getArt } from '../game/art';
import { ExpeditionMap } from './ExpeditionMap';
import { VehicleConsole } from './VehicleConsole';
import { DGrid, DSlot, DragGhost } from './dragSlots';

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
  return <DGrid api={api} cid={cid} cols={cols} quickTo={quickTo} hotRow={hotRow} size={22} />;
}
function LegacyGrid({ api, cid, cols = 8, quickTo, hotRow = false }: { api: Api; cid: string; cols?: number; quickTo?: string; hotRow?: boolean }) {
  const c = C(api.gs.run!, cid); if (!c) return null;
  return <div className={import.meta.env.VITE_FX_TEST === '1' && cid === 'inv' ? 'scroll' : undefined} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 20px)`, gap: 2, ...(import.meta.env.VITE_FX_TEST === '1' && cid === 'inv' ? {maxHeight: 110, overflowY:'auto'} : {}) }}>
    {c.slots.map((s, i) => <Slot key={i} s={s} sel={api.sel?.c === cid && api.sel.slot === i} active={hotRow && i === api.gs.run!.player.active} hotkey={hotRow && i < 8 ? String(i + 1) : undefined} onClick={e => slotClick(api, cid, i, e, quickTo)} onContext={() => slotContext(api, cid, i, quickTo)} />)}
  </div>;
}
/** Stat chip: glyph + value. Replaces the old sentence of stats. */
function StatChip({ g, v, c, title }: { g: string; v: string; c?: string; title?: string }) {
  return <span className="stat" title={title} style={c ? { color: c } : undefined}><Glyph k={g} c={c || 'var(--brassLit)'} s={7} />{v}</span>;
}
const CAT_LABEL: Record<string, string> = { res: 'MATERIAL', food: 'FOOD', tool: 'TOOL', weapon: 'WEAPON', armor: 'ARMOR', core: 'CORE', kit: 'KIT', bp: 'BLUEPRINT', cash: 'CASH', stone: 'ELDER STONE', misc: 'ITEM' };
export function ItemInfo({ s, known }: { s: Stack | null; known: string[] }) {
  if (!s) return <div className="iteminfo iteminfo--empty"><span className="key">LMB</span> pick · place<span className="key">RMB</span> use<span className="key">⇧</span> quick move</div>;
  const d = ITEMS[s.key];
  const isCore = !!(d.core || d.creatorCore);
  const dur = s.dur !== undefined && d.dur ? s.dur / d.dur : null;
  return <div className={`iteminfo ${isCore ? 'iteminfo--core' : ''}`}>
    <div className="iteminfo__ico"><Icon k={s.key} size={24} /></div>
    <div className="iteminfo__body">
      <div className="iteminfo__name">{d.name}{s.meta ? ` · ${ITEMS[RECIPES[s.meta]?.out]?.name || s.meta}` : ''}</div>
      <div className="iteminfo__row">
        <span className="chip" style={{ color: isCore ? 'var(--brassLit)' : 'var(--muted)' }}>{CAT_LABEL[d.cat] || d.cat.toUpperCase()}</span>
        {d.dmg ? <StatChip g="spark" v={`${d.dmg}`} title="Damage" /> : null}
        {d.reach ? <StatChip g="eye" v={`${d.reach}`} c="var(--paper)" title="Reach" /> : null}
        {d.armor ? <StatChip g="hp" v={`-${Math.round(d.armor * 100)}%`} c="var(--good)" title="Damage taken" /> : null}
        {d.cold ? <StatChip g="wr" v={`+${d.cold}`} c="var(--warm)" title="Warmth" /> : null}
        {d.carryBonus ? <StatChip g="weight" v={`+${d.carryBonus}`} c="var(--good)" title="Carry bonus (kg)" /> : null}
        {d.fuel ? <StatChip g="fuel" v={`${d.fuel}s`} c="var(--food)" title="Burn time" /> : null}
        {d.food?.hunger ? <StatChip g="fd" v={`+${d.food.hunger}`} c="var(--food)" title="Hunger" /> : null}
        {d.food?.thirst ? <StatChip g="h2o" v={`+${d.food.thirst}`} c="var(--water)" title="Thirst" /> : null}
        {d.food?.hp ? <StatChip g="hp" v={`${d.food.hp > 0 ? '+' : ''}${d.food.hp}`} c={d.food.hp > 0 ? 'var(--good)' : 'var(--bad)'} title="Health" /> : null}
        {d.food?.rad ? <StatChip g="rad" v={`${d.food.rad > 0 ? '+' : ''}${d.food.rad}`} c={d.food.rad > 0 ? 'var(--bad)' : 'var(--good)'} title="Radiation" /> : null}
        {d.power ? Object.entries(d.power).map(([m, p]) => <span key={m} className="chip" style={{ color: 'var(--paper)' }} title={`Work power on ${m}`}>{m} {p}</span>) : null}
        {s.charge !== undefined && d.charge ? <span className="chip" style={{ color: s.charge ? 'var(--info)' : 'var(--bad)' }}>{s.charge}/{d.charge}⚡</span> : null}
        {s.reserves ? <><span className="chip" style={{ color: 'var(--paper)' }}>B {s.reserves.basic}</span><span className="chip" style={{ color: 'var(--info)' }}>Q {s.reserves.refined}</span><span className="chip" style={{ color: 'var(--brassLit)' }}>E {s.reserves.signature}</span></> : null}
        <StatChip g="weight" v={`${(d.w * s.qty).toFixed(1)}kg`} c="var(--muted)" title="Weight carried" />
      </div>
      {dur !== null && <div className="durbar" title={`Durability ${s.dur}/${d.dur}`}><i style={{ width: `${dur * 100}%`, background: dur < 0.25 ? 'var(--bad)' : dur < 0.5 ? 'var(--warn)' : 'var(--good)' }} />{dur <= 0 && <b>BROKEN</b>}</div>}
      <KnownUses item={s.key} known={known} />
    </div>
  </div>;
}

function KnownUses({ item, known }: { item: string; known: string[] }) {
  // The active run's known recipes only: no undiscovered POI or recipe spoilers. Icons, not a sentence.
  const uses = Object.keys(RECIPES).filter(k => isRecipeKnown(known, k) && RECIPES[k]?.ins.some(([key]) => key === item)).slice(0, 8);
  if (!uses.length) return null;
  return <div className="uses" title="Known recipes that use this"><span className="lbl">→</span>{uses.map(k => <span key={k} title={ITEMS[RECIPES[k].out].name}><Icon k={RECIPES[k].out} size={11} /></span>)}</div>;
}

/** Live Adventurer preview inside the inventory: the same sprite + equipment rendering the world uses. */
function HeroDoll({ r }: { r: RunState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; let raf = 0;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); g.clearRect(0, 0, 32, 48); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(8, 44, 16, 3); g.drawImage(getArt().hero[r.character]['idle0'][Math.floor(t / 700) % 2], 0, 0, 16, 24, 0, 0, 32, 48); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [r.character]);
  return <canvas ref={ref} width={32} height={48} className="doll" />;
}

export function InventoryPanel({ api, quickTo, x = 404, top = 54, onClose, backToContainer = false }: { api: Api; quickTo?: string; x?: number; top?: number; onClose?: () => void; backToContainer?: boolean }) {
  const r = api.gs.run!; const sel = api.sel ? C(r, api.sel.c)?.slots[api.sel.slot] ?? null : null; const w = invWeight(r); const limit = carryLimit(r);
  let armor = 0, warm = 0; for (const s of C(r, 'eq').slots) if (s) { armor += ITEMS[s.key].armor || 0; warm += ITEMS[s.key].cold || 0; }
  const used = C(r, 'inv').slots.filter(Boolean).length, total = C(r, 'inv').slots.length;
  const load = Math.min(1, w / limit);
  const cash = countItem(r, 'inv', 'rcash');
  const SLOT_G = ['scrap_helm', 'leather_armor', 'fur_cloak'];
  const panelMaxH = Math.max(210, 354 - top);
  return <Panel title={backToContainer ? 'Pack · X returns' : 'Pack'} className="inv" style={{ left: x, top, width: 228, maxHeight: panelMaxH }} onClose={onClose ?? (() => api.open(null))}>
    <div className="scroll" style={{ maxHeight: panelMaxH - 28, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* paper doll: equipment slots flank the live character; numbers are chips, not sentences */}
      <div className="doll-row">
        <div className="doll-slots">
          {['head', 'body', 'back'].map((sl, i) => <div key={sl} className={`eqslot ${C(r, 'eq').slots[i] ? '' : 'empty'}`} title={sl}>
            <DSlot api={api} cid="eq" slot={i} s={C(r, 'eq').slots[i]} size={22} />
            {!C(r, 'eq').slots[i] && <img className="px ghost-ico" src={iconUrl(SLOT_G[i])} alt="" />}
          </div>)}
        </div>
        <HeroDoll r={r} />
        <div className="doll-stats">
          <span className="stat" title="Damage reduction from armour"><Glyph k="hp" c="var(--good)" s={7} />-{Math.round(armor * 100)}%</span>
          <span className="stat" title="Warmth from clothing"><Glyph k="wr" c="var(--warm)" s={7} />+{warm}</span>
          <span className="stat" title="Unsecured coins carried / profile-secured"><Icon k="rcash" size={8} />{cash}<i className="sep" />{api.gs.profile.securedCash}</span>
          <div className="loadbar" title={`Load ${w.toFixed(1)} / ${limit} kg`}>
            <Glyph k="weight" c={w > limit ? 'var(--bad)' : 'var(--muted)'} s={7} />
            <div className="track"><i style={{ width: `${load * 100}%`, background: w > limit ? 'var(--bad)' : load > 0.8 ? 'var(--warn)' : 'var(--good)' }} /></div>
            <span className={w > limit ? 'over' : ''}>{Math.round(w)}<small>/{limit}</small></span>
          </div>
          <span className="lbl slots-count">{used}<small>/{total} slots</small></span>
        </div>
      </div>
      <Grid api={api} cid="inv" quickTo={quickTo} hotRow />
      <ItemInfo s={sel} known={r.knowledge.recipes} />
      <div className="actions">
        <button className="btn" disabled={!sel} onClick={() => { if (api.sel) { api.act('useItem', { c: api.sel.c, slot: api.sel.slot }); api.setSel(null); } }}>Use</button>
        <button className="btn" disabled={!sel || sel.qty < 2} onClick={() => api.sel && api.act('split', { c: api.sel.c, slot: api.sel.slot })}>Split</button>
        <button className="btn" disabled={!sel} onClick={() => { if (api.sel) { api.act('drop', { c: api.sel.c, slot: api.sel.slot }); api.setSel(null); } }}>Drop</button>
        {sel && api.sel?.c === 'inv' && ITEMS[sel.key].repair && sel.dur !== undefined && sel.dur < ITEMS[sel.key].dur! && <button className="btn gold" title={`Field repair +${BAL.player.fieldRepairDurability} (uses one kit)`} disabled={!C(r, 'inv').slots.some(s => s?.key === 'field_repair_kit')} onClick={() => { const kitSlot = C(r, 'inv').slots.findIndex(s => s?.key === 'field_repair_kit'); const kit = C(r, 'inv').slots[kitSlot]; if (kit && api.sel) api.act('fieldRepair', { slot: api.sel.slot, uid: sel.uid, kitSlot, kitUid: kit.uid }); }}><Icon k="field_repair_kit" size={10} /> Repair</button>}
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => api.act('sort', { c: 'inv' })}>Sort</button>
      </div>
    </div>
  </Panel>;
}

/** B05-R freight: inspect a paid parcel. Every action is the EXISTING engine `move` between real containers, gated by the player's own reach. No remote teleport, no second cargo authority. */
export function ParcelPanel({ api, eid }: { api: Api; eid: string }) {
  const [note, setNote] = useState<string | null>(null);
  const r = api.gs.run!; const e = r.entities[eid]; if (!e || !e.parcel) return null;
  const s = C(r, e.c!).slots[0] ?? null; const p = r.player;
  const reach = (x: Entity) => Math.hypot(x.x - p.x, x.y - p.y) <= 2.8 * TILE;
  const carts = Object.values(r.entities).filter(x => x.kind === 'cart' && owned(x) && reach(x));
  const freeSlot = (cid: string) => C(r, cid).slots.findIndex(x => !x);
  const run = (type: string, payload: Record<string, any>) => { const res = api.act(type, payload); setNote(res.ok ? null : res.reason); if (res.ok) api.open(null); };
  const parcelClear = clearInteraction(r, e);
  return <Panel title={`Paid parcel · ${ITEMS[e.parcel.item].name}`} style={{ left: 180, top: 70, width: 300 }} onClose={() => api.open(null)}>
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>Already paid for at Mirela. Purchase <span style={{ color: '#8a7a9a' }}>{e.parcel.purchaseId}</span>. The good stays in this parcel until you load it into a cart or take it into your pack.</div>
    {s && <div className="flex items-center gap-1" style={{ marginTop: 4, fontSize: 11 }}><Icon k={s.key} size={14} />{ITEMS[s.key].name} ×{s.qty} <span style={{ color: '#8a7a9a', fontSize: 9 }}>uid {s.uid}</span></div>}
    {!parcelClear && <div style={{ fontSize: 10, color: '#ff9a7a', marginTop: 3 }}>Obstructed: no clear line to this parcel.</div>}
    <div style={{ fontSize: 11, color: '#ffd98a', marginTop: 6 }}>Load into a nearby cart</div>
    {carts.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>No deployed cart in reach. Stand within 2.8 tiles of the parcel and of a cart.</div>}
    {carts.map(cart => {
      const free = freeSlot(cart.c!); const w = cartWeight(r, cart.c!); const lim = cartLimit(cart);
      const clear = clearInteraction(r, cart); const itemW = s ? ITEMS[s.key].w * s.qty : 0;
      const blocked = !s || !parcelClear || !clear || free < 0;
      return <div key={cart.id} style={{ marginTop: 3, fontSize: 10 }}>
        <div className="flex items-center gap-1">Cart {cart.id} · {C(r, cart.c!).slots.filter(Boolean).length}/{C(r, cart.c!).slots.length} slots · weight {w.toFixed(1)}/{lim}
          <button className="btn gold" style={{ marginLeft: 'auto', padding: '1px 5px' }} disabled={blocked} onClick={() => run('move', { from: e.c, fs: 0, to: cart.c, ts: free })}>Load into this cart</button></div>
        {!clear && <div style={{ color: '#ff9a7a' }}>Obstructed: no clear line to this cart.</div>}
        {clear && free < 0 && <div style={{ color: '#ff9a7a' }}>Cart full: no free slot.</div>}
        {clear && free >= 0 && w + itemW > lim && <div style={{ color: '#ffd98a' }}>Overloaded: the cart will crawl (existing soft limit).</div>}
      </div>;
    })}
    <div className="flex gap-1" style={{ marginTop: 6 }}>
      <button className="btn" disabled={!s || !parcelClear} onClick={() => run('move', { from: e.c, fs: 0, to: 'inv' })}>Take into pack</button>
      <button className="btn ghost" onClick={() => api.open(null)}>Leave it</button>
    </div>
    {note && <div style={{ fontSize: 10, color: '#ff9a7a', marginTop: 4 }}>{note}</div>}
    <div style={{ fontSize: 9, color: '#8a7a9a', marginTop: 3 }}>A failed load leaves the goods in the parcel. The parcel disappears only when it is empty.</div>
  </Panel>;
}

export function ContainerPanel({ api, eid }: { api: Api; eid: string }) {
  const [inventoryOnly, setInventoryOnly] = useState(false); useEffect(()=>setInventoryOnly(false),[eid]);
  const r = api.gs.run!; const e = r.entities[eid]; if (!e) return null;
  if (e.parcel) return <ParcelPanel api={api} eid={eid} />;
  const st = e.station; const kind = e.type ? STRUCTS[e.type]?.station : null;
  const lootSite=e.kind==='loot' && r.lootEcology ? getWorld(r.layoutId||'shipping').statics.find(s=>s.kind==='loot' && s.tx===e.tx && s.ty===e.ty) : undefined;
  const lootKind=lootSite ? lootClass(lootSite) : null;
  const poiId=e.poi==='factory_vault'?'factory':e.poi==='light_top'?'light':e.poi;
  const lootPlace=e.label || (lootSite && getWorld(r.layoutId||'shipping').places.find(p=>p.id===poiId)?.name) || e.poi || 'authored site';
  const title = e.kind === 'airdrop' ? 'Airdrop · take only' : e.kind === 'recycler' ? 'Foundry Recycler' : e.kind === 'bag' ? (e.label || 'Bag') : e.kind === 'loot' ? (lootKind ? LOOT_CLASSES[lootKind].name : 'Crate') : e.kind === 'cash' ? 'Ragnarok Chest' : e.kind === 'vehicle' ? 'Utility Motorbike' : e.kind === 'cart' ? 'Cart Cargo' : STRUCTS[e.type!]?.name || 'Storage';
  const takeAll = (cid: string) => { const c = C(r, cid); for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) { const res = api.act('move', { from: cid, fs: i, to: 'inv' }); if (!res.ok) break; } };
  const quickTo = st ? (kind === 'research' || e.kind === 'recycler' ? undefined : st.fuelC) : e.c;
  const compact = !!e.farm || !!e.garden || !!e.basePower || !!e.turret || e.type==='claim';
  // VISUAL ARENA: production machines and the research table use the new console.
  // Same entity, same station state, same intents — only the presentation changes.
  if (st && !compact && kind) return <StationConsole api={api} eid={eid} />;
  if (compact && inventoryOnly) return <InventoryPanel api={api} quickTo={quickTo} x={168} top={54} backToContainer onClose={()=>{api.setSel(null);setInventoryOnly(false);}} />;
  return <>
    <Panel title={title} style={{ left: 168, top: 54, width: 230, maxHeight: 286 }} onClose={() => api.open(null)} className={`scroll container-panel container-panel--${e.kind === 'struct' ? e.type : e.kind}`}>
      <div className="scroll" style={{ maxHeight: 250, overflowY: 'auto', overflowX: 'hidden' }}>
        {e.kind === 'vehicle' && e.vehicle && <VehicleConsole api={api} e={e} />}
        {compact && <button className="btn" onClick={()=>{api.setSel(null);setInventoryOnly(true);}}>{e.type==='claim' ? 'Inventory / fill cabinet' : e.farm || e.basePower ? 'Inventory / fill fuel' : e.turret ? 'Inventory / load arrows' : 'Inventory'}</button>}
        {e.kind === 'airdrop' && <div style={{fontSize:10,color:'#ffd98a'}}>Withdraw only · partial stock remains until expiry; no replenishment.</div>}
        {e.kind === 'loot' && <div style={{fontSize:10,color:'#ffd98a',marginBottom:4}}>
          {lootKind && <div>{LOOT_CLASSES[lootKind].description} · {lootPlace} ({e.tx},{e.ty})</div>}
          {lootKind && <div style={{color:'#cfc2dc'}}>Family: {LOOT_CLASSES[lootKind].name} · grade {LOOT_B04_ROLES[lootKind].grade} · role {({food:'food',medical:'medical',metal:'metal',medical_high:'high-grade medical'} as const)[LOOT_B04_ROLES[lootKind].role]}</div>}
          Withdraw only · {C(r,e.c!).slots.filter(Boolean).length} stacks remain. Partial stock stays. {lootKind ? `After empty: ordinary stock returns in ${LOOT_CLASSES[lootKind].hours}h; rare finds do not.` : 'Empty crates disappear.'}
        </div>}
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
      {e.type === 'claim' && <div style={{fontSize:10}}><b>Territory Cabinet · {territoryForecast(r,e).funded?'funded':'UNFUNDED'}</b><div><button className="btn" onClick={()=>api.act('cabinetRepair',{eid})}>Repair eligible structures</button></div><CabinetReadout r={r} eid={eid} /><svg viewBox="-27 -27 54 54" width="92" height="92" role="img" aria-label="Cabinet coverage map, 25 tiles" style={{float:'right',background:'#21182a',border:'1px solid #6c5770'}}><circle r="25" fill="rgba(225,180,60,.08)" stroke="#e5bd59" strokeWidth=".5"/><circle r="1.4" fill="#ffb64a"/>{Object.values(r.entities).filter(o=>o.kind==='struct'&&o.tx!==undefined&&o.ty!==undefined&&o.id!==e.id&&Math.hypot(o.tx!-e.tx!,o.ty!-e.ty!)<=25).map(o=><circle key={o.id} cx={o.tx!-e.tx!} cy={o.ty!-e.ty!} r=".75" fill={claimAt(r,o.tx!,o.ty!)?.id===e.id?'#7fe78b':'#ff7676'}/>)}</svg></div>}
        {e.basePower && <div style={{fontSize:11,marginTop:5}}><b>Generator · {!e.basePower.enabled ? 'off' : e.basePower.energy > 0 ? 'powered' : e.c && C(r,e.c).slots.some(s => s && ITEMS[s.key]?.fuel) ? 'fuel waiting' : 'no fuel'}</b><div>Stored fuel: {(e.basePower.energy/1000).toFixed(1)} fuel-sec · capacity {e.basePower.capacity??1} load(s) · allocated {powerAllocation(r,e).length}. An enabled generator still burns idle fuel while away; switch it off to stop fuel use. {e.basePower.network==='wire-v1' ? 'Physical cable mode.' : 'Legacy direct proximity mode.'}</div>{!e.basePower.network && <button className="btn" onClick={()=>{if(window.confirm('Switch this generator to physical wiring? Existing links remain but need a paid wire route. This cannot be undone.'))api.act('wireGenerator',{eid});}}>Convert to physical wiring</button>}<label>Priority <select aria-label="Power priority" value={e.basePower.priority??'defense'} onChange={ev=>api.act('powerPriority',{eid,value:ev.target.value})}><option value="defense">Defense</option><option value="production">Production</option></select></label><button className="btn gold" onClick={()=>api.act('basePower',{eid,enabled:!e.basePower!.enabled})}>{e.basePower.enabled?'Switch off':e.basePower.energy > 0 || (e.c && C(r,e.c).slots.some(s => s && ITEMS[s.key]?.fuel))?'Switch on':'Enable (needs fuel)'}</button>{!e.basePower.capacity && <details><summary>Reinforce with level 2 workbench</summary><div>{GENERATOR_CAPACITY_UPGRADE.cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(' · ')}</div><button className="btn" onClick={()=>{const bench=Object.values(r.entities).find(b=>b.type==='workbench' && b.station && (b.station.level??1)>=2 && (b.owner===undefined||b.owner==='player') && Math.hypot(b.x-r.player.x,b.y-r.player.y)<=3*TILE && Math.hypot(b.x-e.x,b.y-e.y)<=3*TILE);api.act('upgradeGenerator',{eid,benchId:bench?.id});}}>Pay &amp; reinforce</button></details>}</div>}
        {e.turret && <div style={{fontSize:11,marginTop:5}}><b>Turret · {turretStatus(r,e)}{e.turret.tracking?' · target in sight':''}</b><div>Arrows: {countItem(r,e.c!,'arrow')} · fog/storm reduce sight. No firing while away. An armed, wired, supplied turret still reserves generator capacity; switch it off to free capacity.</div><label>Connected generator: <select aria-label="Turret generator" value={e.turret.generatorId||''} onChange={ev=>api.act('turretConfigure',{eid,field:'generatorId',value:ev.target.value})} style={{background:'#2b1e30',color:'#fff',maxWidth:140}}><option value="">Not linked</option>{Object.values(r.entities).filter(g=>g.basePower&&(g.owner===undefined||g.owner==='player')&&(connectedPower(r,g,e)||g.id===e.turret?.generatorId||g.id===e.industrial?.generatorId)).map(g=><option key={g.id} value={g.id}>Generator {g.tx},{g.ty}</option>)}</select></label><div><button className="btn gold" onClick={()=>api.act('turretConfigure',{eid,field:'enabled',value:!e.turret!.enabled})}>{e.turret.enabled?'Stop':'Start'}</button></div></div>}
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
 const r=api.gs.run!,e=r.entities[eid],st=e.station!,[selected,setSelected]=useState(''),[confirm,setConfirm]=useState(false);
 const entries=C(r,'inv').slots.map((s,i)=>({s,i})).filter((v):v is {s:NonNullable<typeof v.s>;i:number}=>!!v.s);
 const choice=entries.find(v=>v.s.uid===selected),plan=choice?recoveryPlan(choice.s):null, output=C(r,st.outC),fits=!!plan&&recoveryFits(output,plan.outputs);
 const list=(p:NonNullable<typeof plan>)=>p.outputs.map(([k,q])=>`${q} ${ITEMS[k].name}`).join(' + ');
 return <div style={{fontSize:10}}>
  <div>Destroy one carried item for physical materials. Keep, repair or study it instead. Cores, cards, cash and unlisted items cannot be recycled.</div>
  {st.queue.map(j=><div key={j.id} style={{marginTop:4,color:'#ffd98a'}}>{j.left>0?`Processing · ${Math.ceil(j.left/1000)}s`:'Complete · output blocked'} <button className="btn ghost" onClick={()=>api.act('cancelJob',{eid,jobId:j.id})}>Cancel / return input</button></div>)}
  {!st.queue.length && <><label>Carried item <select aria-label="Recycler item" value={selected} style={{maxWidth:180,background:'#2b1e30',color:'white'}} onChange={ev=>{setSelected(ev.target.value);setConfirm(false);}}><option value="">Select item</option>{entries.map(({s,i})=><option key={s.uid} value={s.uid}>{ITEMS[s.key].name} · {s.uid} · {recoveryPlan(s)?'eligible':'not eligible'} (slot {i+1})</option>)}</select></label>
  {choice && (plan ? <div>UID {choice.s.uid} · {plan.condition===null?'fixed drive':`condition ${Math.round(plan.condition*100)}%`}<br/>Returns: {list(plan)} · {plan.total/1000}s<br/>Output: {fits?'all results fit':'not enough space for all results'}<br/>{confirm ? <><span style={{color:'#ffb8a0'}}>Permanently destroy this item?</span> <button className="btn danger" disabled={!fits} onClick={()=>{api.act('recycleItem',{eid,slot:choice.i,uid:choice.s.uid});setConfirm(false);setSelected('');}}>Confirm recycle</button> <button className="btn ghost" onClick={()=>setConfirm(false)}>Back</button></> : <button className="btn gold" disabled={!fits} onClick={()=>setConfirm(true)}>Recycle item…</button>}</div> : <div style={{color:'#ffb8a0'}}>Not eligible: protected, unlisted, stacked or missing valid condition.</div>)}
  </>}
  <div style={{marginTop:4,color:'#ffd98a'}}>Output · {output.slots.filter(Boolean).length}/{output.slots.length} slots occupied</div><Grid api={api} cid={st.outC} cols={4}/><button className="btn" onClick={()=>{for(let i=0;i<output.slots.length;i++)if(output.slots[i])api.act('move',{from:st.outC,fs:i,to:'inv'});}}>Take output</button>
 </div>;
}
export function StationBody({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const e = r.entities[eid]; const st = e.station!; const kind = STRUCTS[e.type!].station!;
  const recipes = Object.entries(RECIPES).filter(([, rc]) => rc.station === kind); const known = recipes.filter(([k]) => isRecipeKnown(r.knowledge.recipes, k));
  const fuelled = kind === 'campfire' || kind === 'furnace' || kind === 'refinery' || kind === 'oil_pump';
  // B05-R: the pump's source is a real stock on the run; show it so the operator sees what the cycle will draw.
  const oilSrc = e.type === 'oil_pump' && e.tx !== undefined && e.ty !== undefined ? r.oilSources?.[`oil:${e.tx}:${e.ty}`] : undefined;
  const level = st.level ?? 1;
  const [confirmSalvage, setConfirmSalvage] = useState<string | null>(null);
  const maintenance = C(r, 'inv').slots.map((s, i) => [s, i] as const).filter(([s]) => s && (ITEMS[s.key].repair || ITEMS[s.key].salvage));
  return <div>
    {e.type === 'oil_pump' && (oilSrc ? <div data-testid="oil-source-stock" style={{fontSize:10,color:oilSrc.stock>0?'#d6ffc0':'#ffb8a0'}}>Authorized source (test fixture): {oilSrc.stock} Crude Petroleum left{oilSrc.stock<=0?' — dry, cycles blocked':''}</div> : <div style={{fontSize:10,color:'#ffb8a0'}}>No authorized oil source here. Pump cannot run.</div>)}
    {kind === 'refinery' && <div style={{fontSize:10,marginBottom:4,color:'#8fd19b'}}><b>Industrial batch:</b> 6 Salvaged Oil + 1 Glass → 2 Fuel Canister + 1 Machine Lubricant, {BAL.oilRefineryV1.recipes.industrial.secs}s, one job. Needs fuel to run; both products wait in Output until there is room for the whole batch. Lubricant halves motorbike wear for {Math.round(BAL.oilRefineryV1.lubricantDistancePx/TILE)} tiles.</div>}
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
      {!e.industrial ? <><div>Level {INDUSTRIAL_MODULE.benchLevel} bench; manual crafting always remains available. Powered jobs run {BAL.industrialPower.workSpeedMultiplier}× faster.</div><div>Install: <Cost ins={INDUSTRIAL_MODULE.cost} have={have(api)} /></div><button className="btn" onClick={()=>api.act('installIndustrial',{eid})}>Install module</button></> : <><div>Status: {industrialStatus(r,e)} · {BAL.industrialPower.workSpeedMultiplier}× only when powered. Manual speed otherwise.</div><label>Connected generator: <select aria-label="Workbench generator" value={e.industrial.generatorId||''} onChange={ev=>api.act('industrialConfigure',{eid,field:'generatorId',value:ev.target.value})}><option value="">Not linked</option>{Object.values(r.entities).filter(g=>g.basePower&&(g.owner===undefined||g.owner==='player')&&(connectedPower(r,g,e)||g.id===e.turret?.generatorId||g.id===e.industrial?.generatorId)).map(g=><option key={g.id} value={g.id}>Generator {g.tx},{g.ty}</option>)}</select></label><button className="btn" onClick={()=>api.act('industrialConfigure',{eid,field:'enabled',value:!e.industrial!.enabled})}>{e.industrial.enabled?'Disable power':'Enable power'}</button></>}
    </details>}
    {kind === 'furnace' && <details style={{ fontSize: 10, marginBottom: 4 }}><summary style={{ color: '#ffd98a', cursor: 'pointer' }}>Furnace lining {st.upgrade === 'kiln_lining' ? '· installed' : '· improve fuel efficiency'}</summary>{st.upgrade === 'kiln_lining' ? <div>Future work uses {Math.round((1-BAL.fuel.linedFurnaceFuelMultiplier)*100)}% less fuel; work time is unchanged.</div> : <><div>{Math.round((1-BAL.fuel.linedFurnaceFuelMultiplier)*100)}% less fuel for future work. Requires a level 2 workbench close to you and this furnace.</div><div>{FURNACE_LINING.cost.map(([k,q]) => `${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(' · ')}</div><button className="btn" onClick={() => { const bench = Object.values(r.entities).find(b => b.kind === 'struct' && b.type === 'workbench' && b.station && (b.owner === undefined || b.owner === 'player') && (b.station.level ?? 1) >= 2 && Math.hypot(b.x-r.player.x,b.y-r.player.y) <= 3*TILE && Math.hypot(b.x-e.x,b.y-e.y) <= 3*TILE); api.act('upgradeFurnace', { eid, benchId: bench?.id }); }}>Pay &amp; line furnace</button></>}</details>}
    {fuelled && <div style={{ marginBottom: 4 }}>{(() => { const held = C(r, st.fuelC).slots.filter(sl => sl?.key === 'fuel_can').reduce((a, sl) => a + (sl?.qty ?? 0), 0); return <div data-testid="station-fuel-policy" style={{ fontSize: 10, color: '#cfc2dc' }}>Burns: wood, charcoal, coal, briquette. Fuel Canisters are never burned here.{held > 0 && <span style={{ color: '#ffb8a0' }}> Held here, not usable by this station: {held} Fuel Canister{held === 1 ? '' : 's'} (take out to a generator or motorbike).</span>}</div>; })()}
      <div style={{ fontSize: 10, color: '#ffd98a' }}>Fuel {st.burn > 0 ? <span style={{ color: '#ffb040' }}>· burning {Math.ceil(st.burn / 1000)}s</span> : <span style={{ color: '#8a7a9a' }}>· cold</span>}{kind === 'campfire' ? ' (burns continuously; warmth + light)' : ' (burns only while working)'}</div><Grid api={api} cid={st.fuelC} cols={3} /></div>}
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Queue</div>
    {st.queue.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>Idle.</div>}
    {st.queue.map((j, i) => { const rcj = j.recipe.startsWith('R:') ? null : RECIPES[j.recipe]; const out = rcj ? rcj.out : 'blueprint'; const label = rcj ? bundleLabel(rcj) : ITEMS[out].name; const pause = i === 0 && rcj?.station === 'refinery' ? (j.left <= 0 ? (rcj.outs && !recoveryFits(C(r, st.outC), recipeOutputs(rcj)) ? 'paused: output storage full' : '') : (st.burn <= 0 && !C(r, st.fuelC).slots.some(s => s && ITEMS[s.key].fuel) ? 'paused: no fuel' : '')) : ''; return <div key={j.id} className="flex items-center gap-1" style={{ fontSize: 10, flexWrap: 'wrap' }}><Icon k={out} size={12} /><span style={{ width: 150 }}>{label}</span>{pause && <span style={{ color: '#ffb040', width: '100%' }}>{pause}</span>}<div className="bar" style={{ width: 60 }}><i style={{ width: `${(1 - j.left / j.total) * 100}%`, background: i === 0 && (!fuelled || st.burn > 0) ? '#7aff6a' : '#a07a3a' }} /></div><span>{Math.ceil(j.left / 1000)}s</span><button className="btn ghost" style={{ padding: '0 3px' }} onClick={() => api.act('cancelJob', { eid, jobId: j.id })}>✕</button></div>; })}
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Output</div><Grid api={api} cid={st.outC} cols={6} />
    <div style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Recipes</div>
    {kind === 'workbench' && <div style={{ fontSize: 10, color: '#cfc2dc' }}>Drive recovery: 1 Damaged Drive + 1 Scrap → 1 Mechanical Parts (12s).</div>}
    <div style={{fontSize: 9, color: '#cfc2dc'}}>Red cost = missing · queue holds up to 6.</div>
    {known.map(([k, rc]) => {
      const missing = rc.ins.some(([item, qty]) => countItem(r, 'inv', item) < qty);
      const reason = (rc.stationLevel ?? 1) > level ? `Requires bench ${rc.stationLevel}` : st.queue.length >= 6 ? 'Queue full' : missing ? 'Missing ingredients' : 'Queue this recipe';
      return <div key={k} className="flex items-center gap-1" style={{ fontSize: 10, marginBottom: 1 }}><Icon k={rc.out} size={12} /><span style={{ width: 150 }}>{k === 'recover_drive' ? 'Recover Drive → Parts' : rc.outs ? bundleLabel(rc) : ITEMS[rc.out].name + (rc.qty > 1 ? ` ×${rc.qty}` : '')}</span><Cost ins={rc.ins} have={have(api)} /><span style={{ color: '#8a7a9a' }}>{rc.secs}s{(rc.stationLevel ?? 1) > level ? ` · bench ${rc.stationLevel} required` : ''}</span><button className="btn" title={reason} disabled={reason !== 'Queue this recipe'} style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => api.act('craft', { recipe: k, eid })}>Queue</button></div>;
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
    <div style={{ fontSize: 10, color: '#cfc2dc' }}>Spares compete with trader purchases and machinery. Spares in pack: <b style={{ color: '#ffe27a' }}>{countItem(r, 'inv', 'spares')}</b> · Known recipes {Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).length}/{Object.keys(RECIPES).length}</div>
    <div className="flex gap-1 items-center" style={{ margin: '3px 0' }}><button className="btn gold" onClick={() => api.act('research', { mode: 'random', eid })}>Tinker ({B.randomSparesCost} Spares, {B.randomSeconds}s)</button><span style={{ fontSize: 9, color: '#8a7a9a' }}>random unknown blueprint; take and use to learn</span></div>
    <details style={{ marginBottom: 3 }}><summary style={{ fontSize: 10, color: '#ffd98a', cursor: 'pointer' }}>Directed study ({B.directedSparesCost} Spares, {B.directedSeconds}s)</summary>
    <label style={{ fontSize: 10 }}>Find <input aria-label="Find research recipe" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 120, color: '#fff', background: '#21182a', border: '1px solid #6c5770' }} /></label>
    <div className="scroll" style={{ maxHeight: 105, overflowY: 'auto' }}>{unknown.filter(k => permitsDirectedResearch(RECIPES[k]) && ITEMS[RECIPES[k].out].name.toLowerCase().includes(search.toLowerCase())).map(k => { const rc=RECIPES[k], pending=st.queue.some(j=>j.recipe==='R:'+k); return <div key={k} style={{borderTop:'1px solid #514155',fontSize:10,marginTop:3}}><b><Icon k={rc.out} size={10} /> {ITEMS[rc.out].name}</b> · blueprint → {rc.qty} output<br />{rc.station} {rc.station==='workbench'?`level ${rc.stationLevel||1}`:''} · {rc.secs}s · craft: {rc.ins.map(([key,qty])=>`${qty} ${ITEMS[key].name}`).join(' + ')}<br /><button className="btn ghost" disabled={pending} onClick={()=>api.act('research',{mode:'directed',recipe:k,eid})}>{pending?'Already in progress':`Study: ${B.directedSparesCost} Spares / ${B.directedSeconds}s`}</button></div>;})}</div></details>
    <div style={{ fontSize: 10, color: '#ffd98a' }}>Specimen / Core / equipment study ({B.specimenSeconds}s, consumes 1)</div>
    {specimens.length === 0 && <div style={{ fontSize: 10, color: '#8a7a9a' }}>Carry a creature specimen, Core or studyable equipment.</div>}
    {specimens.map(([s, i]) => <div key={i} className="flex items-center gap-1" style={{ fontSize: 10 }}><Icon k={s!.key} size={12} />{ITEMS[s!.key].name} → {ITEMS[RECIPES[ITEMS[s!.key].specimen || CORE_STUDY[s!.key] || ITEMS[s!.key].studyRecipe!].out].name}{confirmStudy === s!.uid ? <><span>Reserves item; completion consumes it, cancellation returns it</span><button className="btn danger" onClick={() => { api.act('research', { mode: 'specimen', slot: i, uid: s!.uid, eid }); setConfirmStudy(null); }}>Confirm</button><button className="btn ghost" onClick={() => setConfirmStudy(null)}>Cancel</button></> : <button className="btn" style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => setConfirmStudy(s!.uid)}>Study</button>}</div>)}
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

const CRAFT_GROUPS: { id: string; station: string | null; icon: string }[] = [
  { id: 'Hand', station: null, icon: 'fists' }, { id: 'Campfire', station: 'campfire', icon: 'st:campfire' },
  { id: 'Furnace', station: 'furnace', icon: 'st:furnace' }, { id: 'Refinery', station: 'refinery', icon: 'st:refinery' },
  { id: 'Workbench', station: 'workbench', icon: 'st:workbench' },
];
export function CraftPanel({ api, focusRecipe }: { api: Api; focusRecipe?: string }) {
  const [search, setSearch] = useState(''); const [selectedRecipe, setSelectedRecipe] = useState<string | null>(focusRecipe ?? null);
  const [category, setCategory] = useState<string>(() => {
    const st = focusRecipe && RECIPES[focusRecipe]?.station;
    return CRAFT_GROUPS.find(g => g.station === st)?.id || 'Hand';
  });
  const r = api.gs.run!;
  const nearSt = (k: string) => Object.values(r.entities).find(e => e.kind === 'struct' && e.station && (e.owner === undefined || e.owner === 'player') && STRUCTS[e.type!]?.station === k && Math.hypot(e.x - r.player.x, e.y - r.player.y) <= 3 * TILE);
  const q = search.trim().toLowerCase();
  const group = CRAFT_GROUPS.find(g => g.id === category) || CRAFT_GROUPS[0];
  const visible = Object.entries(RECIPES).filter(([k, v]) => isRecipeKnown(r.knowledge.recipes, k) && (q ? (v.alias ?? ITEMS[v.out].name).toLowerCase().includes(q) : v.station === group.station));
  const hidden = q ? 0 : Object.entries(RECIPES).filter(([k, v]) => v.station === group.station && !isRecipeKnown(r.knowledge.recipes, k)).length;
  const sel = selectedRecipe && RECIPES[selectedRecipe] && visible.some(([k]) => k === selectedRecipe) ? selectedRecipe : (visible[0]?.[0] ?? null);
  const rc = sel ? RECIPES[sel] : null; const st = rc?.station ? nearSt(rc.station) : null;
  const have = (k: string) => countItem(r, 'inv', k);
  const materials = !!rc && rc.ins.every(([k, qq]) => have(k) >= qq);
  const stationReady = !rc?.station || (!!st && (st.station!.level ?? 1) >= (rc.stationLevel ?? 1));
  const fuelNeeded = rc?.station === 'campfire' || rc?.station === 'furnace' || rc?.station === 'refinery';
  const fuelReady = !fuelNeeded || !!st && (st.station!.burn > 0 || C(r, st.station!.fuelC).slots.some(s => s && stationBurnable(s.key)));
  const outputReady = !rc?.station || !st || (rc.outs ? recoveryFits(C(r, st.station!.outC), rc.outs) : spaceFor(r, st.station!.outC, rc.out) >= rc.qty);
  const queueFull = !!st && st.station!.queue.length >= 6;
  const can = !!rc && materials && stationReady && !queueFull;
  const why = !rc ? '' : !materials ? 'missing materials' : !stationReady ? (st ? `needs level ${rc.stationLevel}` : `no ${STRUCTS[rc.station!].name} in reach`) : queueFull ? 'queue full' : !fuelReady ? 'no fuel · job will wait' : !outputReady ? 'output full · job will wait' : '';
  return <Panel title="Craft" className="craft" style={{ left: 8, top: 34, width: 318, maxHeight: 300 }} onClose={() => api.open(null)}>
    <div className="craft-body">
      {/* station rail: icons, lamp = a usable station is in reach */}
      <div className="rail">
        {CRAFT_GROUPS.map(g => { const near = g.station ? !!nearSt(g.station) : true; return <button key={g.id} className={`railbtn ${category === g.id && !q ? 'on' : ''}`} title={g.id} onClick={() => { setCategory(g.id); setSearch(''); setSelectedRecipe(null); }}>
          <img className="px" src={iconUrl(g.icon)} alt={g.id} /><i className="lamp round" style={{ color: near ? 'var(--good)' : 'var(--edge)' }} />
        </button>; })}
      </div>
      <div className="craft-main">
        <div className="craft-top">
          <span className="panel-h" style={{ fontSize: 9 }}>{q ? 'Search' : group.id}</span>
          <input aria-label="Find known recipe" placeholder="find…" value={search} onChange={e => setSearch(e.target.value)} />
          <span className="chip" style={{ color: 'var(--muted)' }}>{visible.length}{hidden ? ` · ${hidden} ?` : ''}</span>
        </div>
        <div className="tiles scroll">
          {visible.map(([k, v]) => { const ok = v.ins.every(([id, qq]) => have(id) >= qq); const stOk = !v.station || !!nearSt(v.station); return <button key={k} className={`tile ${sel === k ? 'on' : ''} ${ok ? 'ok' : 'no'} ${stOk ? '' : 'far'}`} title={`${v.alias ?? ITEMS[v.out].name}${v.qty > 1 ? ` ×${v.qty}` : ''}`} onClick={() => setSelectedRecipe(k)}>
            <Icon k={v.out} size={16} />{v.qty > 1 && <b>{v.qty}</b>}<i className="dot" />
          </button>; })}
          {!visible.length && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', padding: 4 }}>{hidden ? `${hidden} recipes still undiscovered` : 'nothing here'}</div>}
        </div>
        {rc && sel && <div className="recipe">
          <div className="recipe-head"><Icon k={rc.out} size={18} /><b>{rc.alias ?? ITEMS[rc.out].name}</b>{rc.outs && <span className="chip" style={{ color: 'var(--brassLit)' }}>batch</span>}</div>
          <div className="diagram">
            <div className="ins">{rc.ins.map(([k, qq]) => { const h = have(k); return <span key={k} className={`need ${h >= qq ? 'ok' : 'no'}`} title={ITEMS[k].name}><Icon k={k} size={14} /><b>{h}</b><small>/{qq}</small></span>; })}</div>
            <span className="arrow">▶</span>
            <div className="outs">{recipeOutputs(rc).map(([k, qq]) => <span key={k} className="out" title={ITEMS[k].name}><Icon k={k} size={16} /><b>×{qq}</b></span>)}</div>
          </div>
          <div className="recipe-meta">
            {rc.station ? <span className="chip" style={{ color: stationReady ? 'var(--good)' : 'var(--bad)' }}><img className="px" src={iconUrlSt(rc.station)} alt="" />{STRUCTS[rc.station].name}{rc.stationLevel ? ` L${rc.stationLevel}` : ''}</span> : <span className="chip" style={{ color: 'var(--paper)' }}>by hand</span>}
            <span className="chip" style={{ color: 'var(--paper)' }}>⏱ {rc.secs}s</span>
            {fuelNeeded && <span className="chip" style={{ color: fuelReady ? 'var(--good)' : 'var(--warn)' }}><Glyph k="fuel" c="currentColor" s={7} />{fuelReady ? 'fuel' : 'no fuel'}</span>}
            {st && <span className="chip" style={{ color: queueFull ? 'var(--bad)' : 'var(--muted)' }}>queue {st.station!.queue.length}/6</span>}
            <button className="btn gold" disabled={!can} onClick={() => api.act('craft', { recipe: sel, eid: st?.id })}>{rc.station ? 'Queue' : 'Craft'}</button>
          </div>
          {why && <div className="why" style={{ color: can ? 'var(--warn)' : 'var(--bad)' }}>{why}</div>}
        </div>}
      </div>
    </div>
  </Panel>;
}

export const BUILD_GROUPS: Record<string,string[]> = {
  Shell:['claim','floor_wood','floor_stone','wall_wood','wall_plank','wall_stone','wall_brick','door_wood','door_iron','roof_thatch','roof_tile'],
  Home:['bed_straw','chest_small','chest_large','escrow'],
  Work:['campfire','furnace','refinery','oil_pump','workbench','research','garden','barrel','feed_trough','farm_controller'],
  Defense:['base_generator','power_cable','power_switch','pressure_switch','ir_sensor','bear_trap','door_powered','arrow_turret','spikes','barricade','torch_post'],
};
/** Oil Pump is locked until the run holds an authorized source with stock; the reason is shown on the entry. */
export const buildLocked = (r: RunState, k: string) => k === 'oil_pump' && !anyAuthorizedOilSource(r);
const BUILD_TAB_ICON: Record<string, string> = { Shell: 'st:wall_stone', Home: 'st:bed_straw', Work: 'st:workbench', Defense: 'st:arrow_turret' };
export function BuildPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const owned = Object.values(r.entities).some(e => e.type === 'claim');
  const [category, setCategory] = useState('Shell'); const [query, setQuery] = useState(''); const [hover, setHover] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const keys = BUILD_ORDER.filter(k => q ? STRUCTS[k].name.toLowerCase().includes(q) : BUILD_GROUPS[category].includes(k));
  const have = (k: string) => countItem(r, 'inv', k);
  const focus = hover && keys.includes(hover) ? hover : keys[0];
  const fd = focus ? STRUCTS[focus] : null;
  const place = (k: string) => { api.setBuild(k); api.setReclaim(false); api.setRepairMode(false); api.setUpgradeMode(false); api.open(null); };
  return <Panel title="Build" className="build" style={{ left: 20, top: 30, width: 392, height: 302 }} onClose={() => api.open(null)}>
    <div className="build-top">
      {Object.keys(BUILD_GROUPS).map(k => <button key={k} className={`tab ${category === k && !q ? 'on' : ''}`} onClick={() => { setCategory(k); setQuery(''); }}><img className="px" src={iconUrl(BUILD_TAB_ICON[k])} alt="" />{k}</button>)}
      <input aria-label="Find structure" placeholder="find…" value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <div className="build-body">
      <div className="btiles scroll">
        {keys.map(k => { const d = STRUCTS[k]; const ok = d.cost.every(([i, qq]) => have(i) >= qq); const locked = buildLocked(r, k); return <button key={k} className={`btile ${ok && !locked ? 'ok' : 'no'} ${focus === k ? 'on' : ''}`} disabled={locked} data-testid={k === 'oil_pump' ? 'build-oil-pump' : undefined} onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} onClick={() => place(k)} title={d.name}>
          <span className="ground" /><img className="px" src={iconUrlSt(k)} alt="" />
          {locked && <span className="lock">🔒</span>}
          <span className="nm">{d.name}</span>
          <span className="cost">{d.cost.map(([i, qq]) => <span key={i} className={have(i) >= qq ? 'ok' : 'no'} title={`${ITEMS[i].name} ${have(i)}/${qq}`}><Icon k={i} size={8} />{qq}</span>)}</span>
        </button>; })}
        {!keys.length && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', padding: 6 }}>nothing matches</div>}
      </div>
      {focus && fd && <div className="bdetail">
        <div className="bdetail-head"><img className="px" src={iconUrlSt(focus)} alt="" /><div><b>{fd.name}</b><div className="lbl meta">{fd.layer.toUpperCase()}{fd.shelter ? ' · SHELTER' : ''}{fd.station ? ' · STATION' : ''}{fd.slots ? ` · ${fd.slots} SLOTS` : ''}{fd.light ? ' · LIGHT' : ''}</div></div></div>
        <div className="lbl desc">{fd.desc}</div>
        <div className="bcost">{fd.cost.map(([i, qq]) => { const h = have(i); return <span key={i} className={`need ${h >= qq ? 'ok' : 'no'}`} title={ITEMS[i].name}><Icon k={i} size={14} /><b>{h}</b><small>/{qq}</small></span>; })}<span className="chip" style={{ color: 'var(--muted)', marginLeft: 'auto' }}><Glyph k="hp" c="currentColor" s={7} />{fd.hp}</span></div>
        {buildLocked(r, focus) ? <div className="why" style={{ color: 'var(--bad)' }}>needs an authorized oil source</div> : <button className="btn gold" style={{ width: '100%' }} disabled={!fd.cost.every(([i, qq]) => have(i) >= qq)} onClick={() => place(focus)}>Place · LMB</button>}
        {!owned && <div className="why" style={{ color: 'var(--warn)' }}>no Cabinet yet · unprotected builds decay</div>}
      </div>}
    </div>
    <div className="build-modes">
      <button className="btn" onClick={() => { api.setReclaim(true); api.setBuild(null); api.setRepairMode(false); api.setUpgradeMode(false); api.open(null); }}><span className="key">X</span>Dismantle</button>
      <button className="btn" onClick={() => { api.setRepairMode(true); api.setBuild(null); api.setReclaim(false); api.setUpgradeMode(false); api.open(null); }}><span className="key">V</span>Repair</button>
      <button className="btn" onClick={() => { api.setUpgradeMode(true); api.setBuild(null); api.setReclaim(false); api.setRepairMode(false); api.open(null); }}><span className="key">U</span>Upgrade</button>
      <span className="lbl hint" title={`Dismantle refunds ${Math.round(BAL.economy.reclaimRefund * 100)}% and bags contents`}><span className="key">G</span>layer <span className="key">RMB</span>stop</span>
    </div>
  </Panel>;
}
const iconUrlSt = (k: string) => iconUrl('st:' + (k === 'escrow' ? 'escrow' : k));

export function MapPanel({ api, onTeleportSelect, teleportTarget, qaSession = false }: { api: Api; onTeleportSelect?: (x:number,y:number)=>void; teleportTarget?: {x:number;y:number} | null; qaSession?: boolean }) {
  return <ExpeditionMap api={api} onTeleportSelect={onTeleportSelect} teleportTarget={teleportTarget} qaSession={qaSession} />;
}

export function SkillsPanel({ api }: { api: Api }) {
  const r = api.gs.run!; const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 3));
  const isVeyra = !!r.layoutId && isVeyra05Layout(r.layoutId);
  const elderDefs = isVeyra ? Object.values(PRIMORDIAL_ELDERS) : Object.values(ELDERS);
  const labels: Record<string, string> = { gather: 'Gathering', combat: 'Combat (+0.2% dmg/xp)', craft: 'Crafting', survival: 'Survival' };
  return <Panel title="Adventurer — skills, knowledge, stones" style={{ left: 120, top: 34, width: 400 }} onClose={() => api.open(null)}>
    <div className="flex gap-3" style={{ fontSize: 10 }}>
      <div style={{ width: 170 }}>{Object.entries(r.player.skills).map(([k, xp]) => <div key={k} style={{ marginBottom: 3 }}><div className="flex justify-between"><span>{labels[k]}</span><span style={{ color: '#ffd98a' }}>Lv {lvl(xp)}</span></div><div className="bar" style={{ width: 160 }}><i style={{ width: `${((Math.sqrt(xp / 3) % 1) * 100)}%`, background: '#9ad0ff' }} /></div></div>)}
        <div style={{ color: '#ffd98a', marginTop: 6 }}>{isVeyra ? 'Primordial stones (optional)' : 'Elder stones (optional)'}</div>
        <div className="flex gap-1" style={{ marginTop: 2 }}>{elderDefs.map(e => <div key={e.stone} title={e.name} style={{ opacity: r.elderStones.includes(e.stone) ? 1 : 0.25 }}><Icon k={e.stone} /></div>)}</div>
        <div style={{ color: '#8a7a9a' }}>{r.elderStones.length}/6 — six stones + evacuation = exceptional ending.</div>
        <div style={{ color: '#ffd98a', marginTop: 6 }}>Run achievements · {r.score} local score</div>{r.achievements.map(a => <div key={a}>★ {ACHIEVEMENTS[a].name} <span style={{ color: '#8a7a9a' }}>+{ACHIEVEMENTS[a].score}</span></div>)}
        <div style={{ color: '#ff9a7a', fontSize: 9 }}>LOCAL/UNVERIFIED — never converts into cash.</div>
      </div>
      <div style={{ flex: 1 }}><div style={{ color: '#ffd98a' }}>Known recipes ({Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).length})</div>
        <div className="scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', maxHeight: 220, overflowY: 'auto' }}>{Object.keys(RECIPES).filter(k => isRecipeKnown(r.knowledge.recipes,k)).map(k => <div key={k} className="flex items-center gap-1"><Icon k={RECIPES[k].out} size={10} />{ITEMS[RECIPES[k].out].name}</div>)}</div></div>
    </div></Panel>;
}

export function MenuPanel({ api, onQuit, onSave, qaMode = false, returnHistory = [] }: { api: Api; onQuit: () => void; onSave: () => Promise<boolean>; qaMode?: boolean; returnHistory?: StoredReturnEntry[] }) {
  const [confirm, setConfirm] = useState(false); const pf = api.gs.profile; const r = api.gs.run!; const outlook = wetOutlook(r, api.now()); const survival = offlineSurvivalEstimate(r); const cabinets=Object.values(r.entities).filter(e=>e.type==='claim'&&(e.owner===undefined||e.owner==='player'));
  // VISUAL ARENA: shifted right so the Presentation console docks beside it at 640x360 without overlap.
  return <Panel title="Menu — world time continues" style={{ left: 210, top: 34, width: 424, maxHeight: 300, overflowY: 'auto' }} onClose={() => api.open(null)} className="scroll">
    <div className="flex flex-wrap gap-1">
      <button className="btn gold" onClick={() => api.open(null)}>Resume</button>
      {!qaMode && <button className="btn" onClick={async () => { const ok = await onSave(); api.toast(ok ? 'Saved locally.' : 'Save failed. Your changes are not confirmed on disk.'); }}>Save now</button>}
      <button className="btn" onClick={() => api.open({ kind: 'notes' })}>Field Notes [N]</button>
      {returnHistory.length > 0 && <button className="btn" onClick={() => api.open({ kind: 'report', lines: [], report: returnHistory[0].report })}>Return Log ({returnHistory.length})</button>}
      <button className="btn" onClick={onQuit}>{qaMode ? 'Leave QA to title' : 'Save & quit to title'}</button>
    </div>
    {qaMode && <div className="console-col" style={{ marginTop: 4, color: 'var(--warn)', fontSize: 9 }}>ISOLATED QA SESSION · autosave, manual save and browser-exit writes are disabled. Your production save is untouched.</div>}
    <div style={{ fontSize: 10, marginTop: 5, color: '#e6d9bc', lineHeight: 1.2 }}>
      <b>Before you leave</b> · {isSheltered(r, r.player.x, r.player.y) ? 'Sheltered here' : 'Not sheltered here'} · Weather: {weatherAt(r, api.now())}.<br />
      Hunger {Math.round(r.player.hunger)} / thirst {Math.round(r.player.thirst)} / HP {Math.round(r.player.hp)}. Without new hazards: hunger empty ~{survival.hungerHours.toFixed(1)}h; thirst empty ~{survival.thirstHours.toFixed(1)}h; estimated survival ~{survival.survivalHours.toFixed(1)}h. This is not a guarantee: cold, radiation, fire, monsters, changing shelter or run expiry can end it sooner. Shelter prevents hunger-only death, not thirst or other hazards.<br />
      Next {Math.round(outlook.hours)}h outlook: ~{Math.round(outlook.wetHours)}h wet (global schedule estimate). Footprints fade; rain washes them faster. Change route, clear nearby creatures, wait, or use doors and terrain. No home is required.<br />
      {cabinets.length>0 && <>{cabinets.map(c=>{const f=territoryForecast(r,c);return <span key={c.id}>Cabinet {c.tx},{c.ty}: {f.funded ? `${f.hours.toFixed(1)}h upkeep` : 'UNFUNDED — structures decay'}. </span>})}<br /></>}
      While away: weather, fire, production and exposure advance. Limited trace playback can damage reachable structures; other encounters remain unresolved.
    </div>
    <div style={{ fontSize: 10, marginTop: 6 }} className="flex items-center gap-2">Volume <input type="range" min={0} max={1} step={0.05} value={pf.settings.volume} onChange={e => { pf.settings.volume = +e.target.value; setVolume(pf.settings.volume, pf.settings.muted); api.rerender(); }} /><label><input type="checkbox" checked={pf.settings.muted} onChange={e => { pf.settings.muted = e.target.checked; setVolume(pf.settings.volume, pf.settings.muted); api.rerender(); }} /> mute</label></div>
    <div style={{ fontSize: 10, marginTop: 6, color: '#cfc2dc', lineHeight: 1.15 }}>WASD move · mouse aim · LMB attack/use · Space dodge-roll · E interact · V repair structure · F pull cart · 1–8 / wheel quickbar · I inventory · C craft · B build (X reclaim) · R research · M map · Tab skills · RMB cancel cast/build · Esc menu</div>
    {qaMode && <div className="panel" style={{ padding: 4, marginTop: 6, background: '#1a0e10' }}><div style={{ fontSize: 10, color: '#ff9a7a' }}>QA time acceleration — marks this run QA · LOCAL/UNVERIFIED (not real elapsed time)</div>
      <div className="flex flex-wrap gap-1" style={{ marginTop: 3 }}>{[1, 24].map(h => <button key={h} className="btn ghost" onClick={() => api.act('qaAdvance', { hours: h })}>+{h}h</button>)}
        <button className="btn ghost" onClick={() => api.act('qaAdvance', { hours: Math.max(0, 264.05 - runHours(r, api.now())) })}>→ Ragnarok (h264)</button>
        <button className="btn ghost" onClick={() => api.act('qaAdvance', { hours: Math.max(0, 312.05 - runHours(r, api.now())) })}>→ Day 14 (h312)</button></div></div>}
    <div style={{ marginTop: 6 }}>{!confirm ? <button className="btn danger" onClick={() => setConfirm(true)}>Abandon run…</button> : <span className="flex gap-1 items-center" style={{ fontSize: 10 }}>Abandon wipes all run items, home and unsecured cash. <button className="btn danger" onClick={() => api.act('abandon')}>Confirm abandon</button><button className="btn ghost" onClick={() => setConfirm(false)}>No</button></span>}</div>
  </Panel>;
}

export function VendorPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash'); const pf = api.gs.profile;
  const parcels = Object.values(r.entities).filter(x => x.parcel).length;
  return <><Panel title="Mirela the Trader — Crossroads" style={{ left: 96, top: 34, width: 302, maxHeight: 294 }} onClose={() => api.open(null)}>
    <div className="scroll" style={{ maxHeight: 256, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>"Only Ragnarok coin buys an escrow chest. No banks out here — carry it home yourself."</div>

      <div className="console-col" style={{ borderLeft: '2px solid var(--brass)' }}>
        <div className="console-h" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Ragnarok Coin Exchange</span>
          <span style={{ color: cash ? 'var(--brassLit)' : 'var(--muted)' }}>Carried: {cash}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon k="escrow_chest" size={16} />
          <div style={{ flex: 1, lineHeight: 1.1 }}>
            <div className="lbl" style={{ fontSize: 9, color: 'var(--paper)' }}>Rương ký gửi <span style={{ color: 'var(--muted)' }}>({r.vendorStock.escrow_chest} left)</span></div>
            <div className="lbl" style={{ fontSize: 8, color: 'var(--brassLit)' }}>{BAL.economy.escrowChestPrice} physical cash · place on owned land</div>
          </div>
          <button className="btn gold sm" disabled={cash < BAL.economy.escrowChestPrice || r.vendorStock.escrow_chest <= 0} onClick={() => api.act('buy', { eid, item: 'escrow_chest' })}>Buy</button>
        </div>
        {!isRagnarok(r, api.now()) && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>Physical coins appear in sealed POI vaults during the final 72h Ragnarok.</div>}
      </div>

      <div className="console-col">
        <div className="console-h" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Spares Barter (Run-Local)</span>
          <span style={{ color: 'var(--paper)' }}>Spares: {countItem(r, 'inv', 'spares')}</span>
        </div>
        {Object.entries(VENDOR_SPARES).map(([k, v]) => (
          <div key={k} className="recipe-row" style={{ cursor: 'default', padding: '2px 0' }}>
            <Icon k={k} size={13} />
            <span className="lbl" style={{ fontSize: 9, flex: 1 }}>{ITEMS[k].name} ×{v.qty} <span style={{ color: 'var(--muted)' }}>({r.vendorStock[`spares:${k}`] || 0})</span></span>
            <span className="chip" style={{ color: countItem(r, 'inv', 'spares') >= v.price ? 'var(--good)' : 'var(--muted)' }}>{v.price} spares</span>
            <button className="btn sm" disabled={countItem(r, 'inv', 'spares') < v.price || !(r.vendorStock[`spares:${k}`] > 0)} onClick={() => api.act('buySpares', { eid, item: k })}>Buy</button>
          </div>
        ))}
      </div>

      <div className="console-col">
        <div className="console-h" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Profile-Secured Outfitting</span>
          <span style={{ color: 'var(--info)' }}>Secured: {pf.securedCash}</span>
        </div>
        <div className="lbl" style={{ fontSize: 9, color: 'var(--muted)' }}>Pack needs a free slot. Parcel stays physical beside Mirela if your pack is full.</div>
        {Object.entries(VENDOR_SECURED).map(([k, v]) => (
          <div key={k} className="recipe-row" style={{ cursor: 'default', padding: '2px 0' }}>
            <Icon k={k} size={13} />
            <span className="lbl" style={{ fontSize: 9, flex: 1 }}>{ITEMS[k].name} <span style={{ color: 'var(--muted)' }}>({r.vendorStock[k]})</span></span>
            <span className="chip" style={{ color: pf.securedCash >= v.price ? 'var(--brassLit)' : 'var(--muted)' }}>{v.price}</span>
            <button className="btn sm" disabled={pf.securedCash < v.price || r.vendorStock[k] <= 0 || spaceFor(r, 'inv', k) < 1} title={spaceFor(r, 'inv', k) < 1 ? 'No space in pack; choose Parcel instead' : pf.securedCash < v.price ? 'Not enough secured cash' : 'Put in pack'} onClick={() => api.act('buy', { eid, item: k })}>Pack</button>
            <button className="btn sm" title="Spawn a physical bulk-safe Parcel beside Mirela to load into a cart" disabled={pf.securedCash < v.price || r.vendorStock[k] <= 0} onClick={() => api.act('buy', { eid, item: k, id: `parcel-${api.now()}-${k}`, freight: true })}>Parcel</button>
          </div>
        ))}
        <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>
          Waiting parcels: <b style={{ color: 'var(--brassLit)' }}>{parcels}</b> · Purchases become run-local items wiped at run end.
        </div>
      </div>
    </div>
  </Panel><InventoryPanel api={api} top={34} /></>;
}

export function EscrowPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash');
  return <Panel title={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon k="escrow_chest" size={14} />Rương ký gửi — Escrow Vault</span>} style={{ left: 170, top: 64, width: 300 }} onClose={() => api.open(null)}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center', margin: '4px 0' }}>
      <div className="console-col" style={{ textAlign: 'center' }}>
        <div className="console-h" style={{ color: cash ? 'var(--warn)' : 'var(--muted)' }}>Carried (At Risk)</div>
        <div className="title-font" style={{ fontSize: 16, color: cash ? 'var(--brassLit)' : 'var(--muted)' }}>{cash}</div>
      </div>
      <span className="flow-arrow" style={{ fontSize: 16 }}>→</span>
      <div className="console-col" style={{ textAlign: 'center' }}>
        <div className="console-h" style={{ color: 'var(--info)' }}>Profile-Secured</div>
        <div className="title-font" style={{ fontSize: 16, color: 'var(--info)' }}>{api.gs.profile.securedCash}</div>
      </div>
    </div>
    <div className="lbl" style={{ fontSize: 8, color: 'var(--paper)', lineHeight: 1.25 }}>
      Depositing transfers all carried Ragnarok Cash into your permanent Profile balance in one atomic step. The run continues; only secured cash survives when the run ends.
    </div>
    <div className="flex gap-1" style={{ marginTop: 6 }}>
      <button className="btn gold" style={{ flex: 1 }} disabled={!cash} onClick={() => { const res = api.act('deposit', { eid }); if (res.ok) api.sfx('coin'); }}>
        {cash ? `Deposit ${cash} Coins into Profile` : 'No Coins Carried'}
      </button>
      <button className="btn ghost" onClick={() => { api.act('reclaim', { eid }); api.open(null); }}>Pick up chest</button>
    </div>
    <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>Total secured this run: {r.deposited}</div>
  </Panel>;
}

export function EvacPanel({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const cash = countItem(r, 'inv', 'rcash'); const [sure, setSure] = useState(false);
  return <Panel title="Evacuation Beacon — End Run" style={{ left: 160, top: 60, width: 320 }} onClose={() => api.open(null)}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
      <div className="console-col">
        <div className="console-h" style={{ color: 'var(--info)' }}>Preserved on Profile</div>
        <div className="lbl" style={{ fontSize: 9, color: 'var(--info)' }}>Secured Cash: <b>{api.gs.profile.securedCash}</b></div>
        <div className="lbl" style={{ fontSize: 8, color: 'var(--brassLit)', marginTop: 2 }}>
          Elder Stones: <b>{r.elderStones.length}/6</b>{r.elderStones.length >= 6 ? ' ★ Crown of Six!' : ''}
        </div>
      </div>
      <div className="console-col">
        <div className="console-h" style={{ color: 'var(--bad)' }}>Wiped on Departure</div>
        <div className="lbl" style={{ fontSize: 9, color: cash ? 'var(--bad)' : 'var(--muted)' }}>
          Unsecured Cash: <b>{cash}</b>{cash > 0 ? ' (LOST!)' : ''}
        </div>
        <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>
          All gear, Cores, recipes, structures &amp; cargo.
        </div>
      </div>
    </div>
    {cash > 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--warn)', marginBottom: 4 }}>
      Warning: You are carrying {cash} unsecured coin{cash === 1 ? '' : 's'}. Deposit them in your Rương ký gửi first if you want to keep them!
    </div>}
    <div className="flex gap-1">
      {!sure
        ? <button className="btn gold" style={{ flex: 1 }} onClick={() => setSure(true)}>Signal Evacuation Boat…</button>
        : <button className="btn danger" style={{ flex: 1 }} onClick={() => api.act('evacuate', { eid })}>Confirm Departure &amp; End Run</button>}
      <button className="btn ghost" onClick={() => api.open(null)}>Stay on Island</button>
    </div>
  </Panel>;
}

/** Grouped 640x360 Offline Return Chronicle (typed OfflineReturnV1). */
export function ReportPanel({ api, lines, report, history = [] }: { api: Api; lines: string[]; report?: OfflineReturnV1 | null; history?: StoredReturnEntry[] }) {
  return <ReturnChronicle api={api} lines={lines} report={report} history={history} />;
}
