import {ITEMS,STRUCTS,upgradeTargets} from '../game/catalog';

/** Persistent choice stays visible when the pointer leaves a wall for these buttons.
 * Unsupported preferences fall back to that piece's normal upgrade; engine validates again. */
export function selectedStructureUpgrade(type:string,preferred:string|null):string|undefined {
  const options=upgradeTargets(type);
  return preferred && options.includes(preferred) ? preferred : options[0];
}
export function StructureUpgradeChoice({preferred,onChange}:{preferred:string|null;onChange:(target:string|null)=>void}){
  return <div className="panel absolute" style={{left:145,bottom:102,width:350,padding:4,fontSize:11,lineHeight:1.2}} onMouseDown={e=>e.stopPropagation()} role="group" aria-label="Wall upgrade choice">
    <div style={{display:'flex',gap:4}}>
      <button className="btn" style={{fontSize:11,padding:"3px 5px",borderColor:preferred===null?"var(--gold)":undefined}} type="button" aria-pressed={preferred===null} onClick={()=>onChange(null)}>Default upgrade</button>
      {upgradeTargets('wall_wood').slice(1).map(target=><button className="btn" style={{fontSize:11,padding:"3px 5px",borderColor:preferred===target?"var(--gold)":undefined}} key={target} type="button" aria-pressed={preferred===target} onClick={()=>onChange(target)}>
        {STRUCTS[target].name} · {STRUCTS[target].cost.map(([k,q])=>`${q} ${ITEMS[k].name}`).join(', ')}
      </button>)}
    </div>
    <span>Plank choice: wood walls only. Other pieces keep their default upgrade.</span>
  </div>;
}
