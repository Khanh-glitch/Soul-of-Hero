import { useState } from 'react';
import { BAL, TILE, VIEW_W, VIEW_H, type RunState } from '../game/core';
import { RECIPES, ALWAYS_KNOWN_RECIPES } from '../game/catalog';
import { countItem, runHours } from '../game/engine';
import { cam } from '../game/render';
import { JourneyWayfinder, WorldWayfinderMarker } from './JourneyWayfinder';
import type { WayfinderView, JourneyCategory } from '../game/gold-wayfinder-view';
import type { Api } from './common';

/**
 * Only the data binding is new. The JourneyWayfinder component, its interaction
 * structure and visual grammar come directly from Creator's Gold (3) ZIP.
 *
 * Gold's old Daily Pact money/rewards/season assumptions are NOT executable in
 * R12. The fieldcraft goals below only observe R12 states and issue NO receipts.
 */
interface FieldcraftGoal {
  id: string; title: string; summary: string; category: JourneyCategory;
  icon: string; current: number; target: number;
  next: string; blocker: string | null;
  action: WayfinderView['action']; meaning: string;
}
const cap = (n: number, max: number) => Math.max(0, Math.min(max, n));
const originalKinds = ['harvest','drink','drink.flask','consume','barrel.drink','craft.hand','build','job.done'];
const receiptsInclude = (r: RunState, prefix: string) =>
  r.receipts.some(rc => rc.kind === prefix || rc.kind.startsWith(prefix + '.'));
const built = (r: RunState, type: string) =>
  Object.values({...(r.veyraOffscreenEntities || {}),...r.entities})
    .some(e => e.kind === 'struct' && e.type === type && (!e.owner || e.owner === 'player'));

function knownNewRecipeCount(r: RunState): number {
  return r.knowledge.recipes.filter(k => !RECIPES[k]?.base && !ALWAYS_KNOWN_RECIPES.includes(k)).length;
}

export function actualR12Fieldcraft(r: RunState, now: number): FieldcraftGoal[] {
  const gathered = r.player.skills.gather > 0 || r.achievements.includes('first_harvest') || receiptsInclude(r,'harvest');
  const drank = receiptsInclude(r,'drink') || receiptsInclude(r,'consume');
  const hand = receiptsInclude(r,'craft.hand') || countItem(r,'inv','stone_pick') > 0;
  const campfire = built(r,'campfire');
  const cooked = receiptsInclude(r,'job.done');
  const sheltered = r.player.sheltered || r.achievements.includes('first_home');
  const hasWorkbench = built(r,'workbench');
  const hasFurnace = built(r,'furnace');
  const learned = knownNewRecipeCount(r) > 0;
  const known = r.poiSeen.length;
  const bosses = Object.keys(r.sideBossDefeated || {}).length;
  const stones = r.elderStones.length;
  return [
    {id:'landfall',title:'Shorefall & Sustenance',summary:'Find food, water and a first useful tool.',category:'survival',icon:'berries',
      current:Number(gathered)+Number(drank)+Number(hand),target:3,meaning:'Your first independent survival loop',
      next:!gathered?'Harvest timber, stone or forage in the world.':!drank?'Drink safe water or consume field provisions.':!hand?'Craft a stone tool from your real materials.':'Basic self-sufficiency established.',
      blocker:!gathered?'Use LMB on a nearby harvestable resource.':!drank&&r.player.thirst<15?'Hydration is critical. Find a safe source or use supplies.':null,
      action: {label:'Open Survivor',panel:'inv'}},
    {id:'hearth',title:'Hearth & Roofed Shelter',summary:'Make a camp that can survive harsh weather.',category:'shelter',icon:'st:campfire',
      current:Number(campfire)+Number(cooked)+Number(sheltered),target:3,meaning:'Protected home and warmth',
      next:!campfire?'Place a real Campfire with actual supplies.':!cooked?'Fuel and complete a legitimate cooking job.':!sheltered?'Complete a physical enclosure and shelter.':'A hearth and shelter are established.',
      blocker:!campfire&&countItem(r,'inv','wood')<3?'Collect more wood; structures cannot be placed without physical supplies.':null,
      action:{label:'Open Build',buildTool:'campfire'}},
    {id:'craftworks',title:'Ironworking & Research',summary:'Establish stations and study new recipes.',category:'craft',icon:'iron_ingot',
      current:Number(hasWorkbench)+Number(hasFurnace)+Number(learned),target:3,meaning:'Industrial crafting foothold',
      next:!hasWorkbench?'Place a Workbench.':!hasFurnace?'Build a Furnace near your work area.':!learned?'Study a new non-starter recipe.':'Craftworks are operational.',
      blocker:null,action:{label:'Open Work',panel:'craft'}},
    {id:'scout',title:'Expedition & Cartography',summary:'Discover the geography yourself.',category:'expedition',icon:'map',
      current:cap(known,5),target:5,meaning:'Known safe landmarks and return routes',
      next:'Explore new locations on foot. Only visited POIs count.',blocker:null,
      action:{label:'Open Map',panel:'map'}},
    {id:'guardian',title:'Regional Guardian',summary:'Optional non-Elder challenge.',category:'combat',icon:'relic',
      current:cap(bosses,1),target:1,meaning:'Proven ability to overcome a regional threat',
      next:'Choose a regional side boss when prepared; retreat is always valid.',blocker:null,
      action:{label:'Open Map',panel:'map'}},
    {id:'legacy',title:'Primordial Legacy',summary:'Collect up to six unique Elder Stones, if desired.',category:'expedition',icon:'gem',
      current:cap(stones,6),target:6,meaning:'Optional extraordinary evacuation path',
      next:'Elder Stones must be acquired through real boss combat and physical pickup.',blocker:null,
      action:{label:'Open Map',panel:'map'}}
  ];
}
const bearing = (dx: number, dy: number): string => {
  const d = Math.atan2(dy,dx), sectors=['E','SE','S','SW','W','NW','N','NE'];
  return sectors[Math.round((d + Math.PI*2)%(Math.PI*2)/(Math.PI/4))%8];
};

export function buildGold3Wayfinder(r: RunState, now: number, tracked: string): WayfinderView {
  const goals = actualR12Fieldcraft(r,now);
  const chosen = tracked === 'none' ? null :
    goals.find(g => g.id === tracked) ?? goals.find(g => g.current < g.target) ?? goals[0];
  const goal = chosen ?? goals[0];
  const worldX = r.player.x, worldY = r.player.y;
  // Show ONLY a physically owned cabinet already existing in currently loaded
  // world geometry. Never infer coordinates for unseen POIs or other floors.
  const anchor = (goal.id==='hearth'||goal.id==='craftworks')
    ? Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='claim'&&(!e.owner||e.owner==='player')&&Math.hypot(e.x-worldX,e.y-worldY)<12*TILE)
    : null;
  const dx=anchor?anchor.x-worldX:0,dy=anchor?anchor.y-worldY:0;
  const options = goals.map(g=>({id:g.id,kind:'fieldcraft' as const,title:g.title,
    progressText:g.current+'/'+g.target,category:g.category,icon:g.icon}));
  return {
    trackedId:goal.id,hidden:tracked==='none',kind:'fieldcraft',kindLabel:'FIELDCRAFT · OPTIONAL',
    category:goal.category,icon:goal.icon,title:goal.title,summary:goal.summary,
    current:goal.current,target:goal.target,pct:100*goal.current/goal.target,
    progressText:goal.current+'/'+goal.target,blocker:goal.blocker,
    nextStep:goal.next,meaning:goal.meaning,action:goal.action,
    worldHint:anchor?{
      x:anchor.x,y:anchor.y,tx:Math.floor(anchor.x/TILE),ty:Math.floor(anchor.y/TILE),
      label:'Your claimed cabinet',distanceTiles:Math.round(Math.hypot(dx,dy)/TILE),
      bearing:bearing(dx,dy),
      onScreen:Math.abs(anchor.x-cam.x)>0&&anchor.x>=cam.x&&anchor.x<=cam.x+VIEW_W&&anchor.y>=cam.y&&anchor.y<=cam.y+VIEW_H
    }:null,
    completedJustNow:false,options
  };
}
export function Gold3WayfinderHost({api,now,combatStealth,contextForceExpand}:{api:Api;now:number;combatStealth:boolean;contextForceExpand:boolean}) {
  const [tracked,setTracked]=useState('auto');
  const r=api.gs.run!;
  const view=buildGold3Wayfinder(r,now,tracked);
  const takeAction=(a:NonNullable<WayfinderView['action']>)=>{
    if(a.buildTool){api.setBuild(a.buildTool);api.setReclaim(false);api.setRepairMode(false);api.setUpgradeMode(false);api.open(null);return;}
    if(a.panel==='inv'||a.panel==='craft'||a.panel==='map')api.open({kind:a.panel,recipe:a.recipe});
    else api.open({kind:'skills'});
  };
  return <>
    <div className="gold-authored-wayfinder" style={{position:'absolute',right:6,top:68,zIndex:15,pointerEvents:'auto'}}>
      <JourneyWayfinder view={view} combatStealth={combatStealth} contextForceExpand={contextForceExpand}
        onSelectTarget={setTracked} onOpenAction={takeAction} onOpenCodex={()=>api.open({kind:'skills'})} />
    </div>
    <WorldWayfinderMarker hint={view.worldHint} camX={cam.x} camY={cam.y}
      hidden={combatStealth||!!api.panel||view.hidden} />
  </>;
}
