import { ITEMS, STRUCTS, PA1_BUILD_PAGES, PA1_BASE_GEOMETRY } from '../game/catalog';
import { countItem, buildReason } from '../game/engine';
import type { GameState } from '../game/core';
import { Icon, iconUrl } from './common';

/** 15 non-inventory wooden geometry shapes, grouped by their actual job.
 * Devices never enter these pages: Craft → inventory → Place is separate.
 * The 2D engine does not certify LI curved / half-tile / multi-storey geometry.
 */
export const BUILD_PAGES = PA1_BUILD_PAGES;
export const BUILD_KIT = PA1_BASE_GEOMETRY;
export type BuildTool = typeof BUILD_KIT[number] | 'upgrade' | 'repair' | 'reclaim';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function BuildBar({ gs, tool, onPick, hoverX, hoverY }: {
  gs:GameState; tool:BuildTool; onPick:(t:BuildTool)=>void; hoverX:number; hoverY:number;
}) {
  const r=gs.run!, have=(key:string)=>countItem(r,'inv',key);
  const isPiece=(BUILD_KIT as readonly string[]).includes(tool);
  const d=isPiece?STRUCTS[tool]:null,reason=d?buildReason(gs,tool,hoverX,hoverY):null;
  const page=Object.entries(BUILD_PAGES).find(([,xs])=>(xs as readonly string[]).includes(tool))?.[0] ?? 'Foundation';
  const shown=BUILD_PAGES[page as keyof typeof BUILD_PAGES];
  return <div className="buildbar" data-testid="pa1-expanded-buildbar">
    <div className="buildbar__pages" role="group" aria-label="Building geometry categories">
      {Object.entries(BUILD_PAGES).map(([name,parts])=><button
        key={name} type="button" className={page===name?'on':''}
        title={name+' · '+parts.length+' build shapes'}
        onClick={()=>onPick(parts[0] as BuildTool)}
      >{name} <small>{parts.length}</small></button>)}
      <span className="buildbar__pages-hint">Wooden pieces only · upgrade at Cabinet</span>
    </div>
    {d && <div className={`buildbar__status ${reason?'no':'ok'}`}>
      <b>{d.name}</b>
      {d.cost.map(([i,n])=><span key={i} className={have(i)>=n?'ok':'no'} title={ITEMS[i].name}>
        <Icon k={i} size={10}/>{have(i)}/{n}
      </span>)}
      <i className="sep"/>
      <span className="buildbar__reason">{reason?reason.replace(/\.$/,''):'click to place · no inventory item'}</span>
    </div>}
    {!d && <div className="buildbar__status ok"><b>{tool==='upgrade'?'Upgrade':tool==='repair'?'Repair':'Dismantle'}</b>
      <span className="buildbar__reason">point at a placed structure · G layer · cabinet required for upgrades</span>
    </div>}
    <div className="plate buildbar__row">
      {shown.map((key,i)=>{
        const d=STRUCTS[key],affordable=d.cost.every(([item,n])=>have(item)>=n);
        return <button key={key} className={`bslot ${tool===key?'on':''} ${affordable?'':'no'}`}
          onClick={()=>onPick(key as BuildTool)}
          title={`${i+1}: ${d.name} — ${d.cost.map(([item,n])=>ITEMS[item].name+' ×'+n).join(', ')}`}>
          <span className="bslot__key">{KEYS[i]}</span><img className="px" src={iconUrl('st:'+key)} alt={d.name}/>
        </button>;
      })}
      <i className="buildbar__div"/>
      {([['upgrade','U','⬆'],['repair','V','⚒'],['reclaim','X','✂']] as const).map(([t,k,g])=>
        <button key={t} className={`bslot mode ${tool===t?'on':''}`} onClick={()=>onPick(t)}
          title={t}><span className="bslot__key">{k}</span><span className="bslot__glyph">{g}</span></button>
      )}
      <span className="buildbar__exit"><span className="key">B</span>exit</span>
    </div>
  </div>;
}
