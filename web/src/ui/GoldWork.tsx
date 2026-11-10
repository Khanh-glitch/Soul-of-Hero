import { useMemo, useState } from 'react';
import { ITEMS, RECIPES, STRUCTS, isRecipeKnown, stationBurnable } from '../game/catalog';
import { TILE, type RunState } from '../game/core';
import { C, countItem, spaceFor } from '../game/engine';
import { recoveryFits } from '../game/recycler';
import { Icon, type Api } from './common';

/** Source adaptation: PR #52's tabbed Survivor / Work, but all craft decisions and
 * material custody belong to production R12/Veyra dispatch. Unknown recipes stay hidden.
 */
export type WorkCategory = 'All' | 'Tools' | 'Gear' | 'Food & Med' | 'Materials' | 'Cores' | 'Stations' | 'Devices';
export const GOLD_WORK_CATEGORIES: WorkCategory[] = ['All', 'Tools', 'Gear', 'Food & Med', 'Materials', 'Cores', 'Stations', 'Devices'];
type RecipeKey = string;
const text = (s: string) => s.toLowerCase().replace(/[\s_]+/g,' ');
export function workCategory(recipeKey: RecipeKey): WorkCategory {
  const rc = RECIPES[recipeKey], item = rc && ITEMS[rc.out];
  if (!rc || !item) return 'Materials';
  const k = text(rc.out + ' ' + recipeKey), desc = text(item.name + ' ' + (item.desc || ''));
  if (/core|essence|arcane|spirit|element/.test(k) && (/core/.test(k) || /essence/.test(k))) return 'Cores';
  if (/chest|barrel|trough|bed|generator|machine|sensor|turret|station|workbench|refinery|furnace|structure/.test(k)) return 'Stations';
  if (/armor|helmet|vest|backpack|coat|glove|boots|mask|suit/.test(k+' '+desc)) return 'Gear';
  if (/bandage|medkit|ration|food|berry|cooked|egg|water|potion|meat|stew|flask/.test(k+' '+desc)) return 'Food & Med';
  if (/knife|pick|axe|sword|spear|arrow|bow|hammer|saw|hatchet|tool/.test(k+' '+desc)) return 'Tools';
  if (/battery|fuse|circuit|sensor|motor|vehicle|engine|gearbox|drive|electric/.test(k+' '+desc)) return 'Devices';
  return 'Materials';
}
export function knownGoldRecipes(known: readonly string[], category: WorkCategory = 'All', query = ''): RecipeKey[] {
  const q = text(query.trim());
  return Object.keys(RECIPES).filter(key => {
    if (!isRecipeKnown(known as string[],key)) return false;
    const rc = RECIPES[key], out = ITEMS[rc.out];
    if (!out || (category !== 'All' && workCategory(key) !== category)) return false;
    return !q || text(out.name + ' ' + (rc.alias || '') + ' ' + key).includes(q);
  });
}
function nearestStation(r: RunState, station: string) {
  return Object.values(r.entities).find(e =>
    e.kind === 'struct' && e.station && (e.owner === undefined || e.owner === 'player') &&
    STRUCTS[e.type!]?.station === station &&
    Math.hypot(e.x - r.player.x, e.y - r.player.y) <= 3 * TILE
  );
}
export function GoldWork({ api }: { api: Api }) {
  const [category,setCategory] = useState<WorkCategory>('All');
  const [search,setSearch] = useState('');
  const [selection,setSelection] = useState<RecipeKey | null>(null);
  const [message,setMessage] = useState('');
  const r = api.gs.run!;
  const visible = useMemo(() => knownGoldRecipes(r.knowledge.recipes,category,search),[r.knowledge.recipes,category,search]);
  const selected = selection && visible.includes(selection) ? selection : (visible[0] ?? null);
  const rc = selected ? RECIPES[selected] : null;
  const item = rc && ITEMS[rc.out];
  const station = rc?.station ? nearestStation(r,rc.station) : undefined;
  const stationReady = !rc?.station || !!station && (station.station!.level ?? 1) >= (rc.stationLevel ?? 1);
  const hasMaterials = !!rc && rc.ins.every(([k,n]) => countItem(r,'inv',k) >= n);
  const needFuel = rc?.station === 'campfire' || rc?.station === 'furnace' || rc?.station === 'refinery';
  const hasFuel = !needFuel || !!station && (station.station!.burn > 0 || C(r,station.station!.fuelC).slots.some(s => !!s && stationBurnable(s.key)));
  const hasSpace = !rc?.station || !station || (rc?.outs ? recoveryFits(C(r,station.station!.outC), rc.outs) : spaceFor(r,station.station!.outC, rc.out) >= rc.qty);
  const queueFree = !station || station.station!.queue.length < 6;
  const craftable = !!rc && hasMaterials && stationReady && queueFree;
  const doCraft = () => {
    if (!selected || !rc || !craftable) return;
    const outcome = api.act('craft',{ recipe:selected,eid:station?.id });
    setMessage(outcome.ok ? (rc.station ? 'Reserved in the station queue.' : 'Craft receipt committed.') : outcome.reason);
  };
  return <div className="gold-work" data-testid="gold-work" role="region" aria-label="Real R12 Work recipes and stations">
    <div className="gold-work__head">
      <strong>WORK · KNOWN RECIPES</strong>
      <span>{visible.length} shown / {knownGoldRecipes(r.knowledge.recipes).length} known</span>
      <input aria-label="Search known recipes" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find" />
    </div>
    <div className="gold-work__categories" role="group" aria-label="Work categories">
      {GOLD_WORK_CATEGORIES.map(cat=><button key={cat} type="button" className={category===cat?'on':''} aria-pressed={category===cat} onClick={()=>{setCategory(cat);setSelection(null)}}>{cat}</button>)}
    </div>
    <div className="gold-work__body">
      <div className="gold-work__grid" role="list" aria-label="Known craft recipes">
        {visible.map(key=>{
          const recipe=RECIPES[key], output=ITEMS[recipe.out];
          const ready=recipe.ins.every(([k,n])=>countItem(r,'inv',k)>=n);
          return <button key={key} type="button" role="listitem" className={'gold-work__recipe ' +(key===selected?'selected':'')} title={output.name+' · '+(recipe.station ? STRUCTS[recipe.station]?.name : 'By hand')+(ready?' · Material ready':' · Missing materials')} onClick={()=>{setSelection(key);setMessage('')}}><Icon k={recipe.out} size={24}/><span>{recipe.qty>1?'×'+recipe.qty:''}</span>{!ready&&<i>!</i>}</button>;
        })}
        {!visible.length && <p className="gold-work__empty">{search?'No learned recipes match this search.':'No known recipes in this category yet. Explore, study and discover recipes first.'}</p>}
      </div>
      <div className="gold-work__detail">
        {rc&&item ? <>
          <div className="gold-work__selected"><Icon k={rc.out} size={28}/><div><strong>{rc.alias||item.name}</strong><small>{rc.qty} output · {rc.station ? (STRUCTS[rc.station]?.name||rc.station) : 'By hand'} · {rc.secs}s</small></div></div>
          <div className="gold-work__desc">{item.desc}</div>
          <div className="gold-work__costs">{rc.ins.map(([key,qty])=>{
            const have=countItem(r,'inv',key);return <span key={key} className={have>=qty?'ready':'missing'} title={ITEMS[key]?.name || key}><Icon k={key} size={13}/>{have}/{qty}</span>;
          })}</div>
          <div className="gold-work__status">{rc.station&&!stationReady?'Station too far or insufficient level.':!hasMaterials?'Materials missing.':!queueFree?'Station queue full (6/6).':!hasFuel?'Queue can reserve; needs fuel to progress.':!hasSpace?'Output storage full: job will wait.':rc.station?'Ready to reserve materials into station.':'Ready to craft by hand.'}</div>
          <div className="gold-work__buttons"><button className="btn gold" type="button" disabled={!craftable} onClick={doCraft}>{rc.station?'Reserve & queue':'Craft'}</button>{station&&<button className="btn" type="button" onClick={()=>api.open({kind:'container',eid:station.id})}>Inspect station</button>}</div>
        </> : <p>Select a known recipe to inspect its real requirements.</p>}
        {message&&<div className="gold-work__feedback" role="status">{message}</div>}
      </div>
    </div>
    <div className="gold-work__foot">Production crafting · every material, job and output is checked by SOH engine. No UI-created rewards.</div>
  </div>;
}
