import {it,expect} from 'vitest';
import {reachable,reachableUnion,compileEconomy} from '../src/game/world-economy';
import {fixture} from './fixtures/isthmus';
import {hash2} from '../src/game/core';
it('multi-source walkability is exactly the old union, including separated islands, blocked/duplicate/edge starts',()=>{
 for(let seed=0;seed<24;seed++){
  const m=fixture(),walk=new Uint8Array(m.width*m.height);
  for(let i=0;i<walk.length;i++)walk[i]=+(hash2(i%m.width,Math.floor(i/m.width),seed)>.32);
  // Disconnected components and a fully blocked column are deliberate.
  for(let y=0;y<m.height;y++)walk[y*m.width+Math.floor(m.width/2)]=0;
  m.walkable=walk;m.starts=Array.from({length:32},(_,n)=>({id:`seed-${n}`,x:1+(n*13+seed)%(m.width-2),y:1+(n*7+seed)%(m.height-2)}));
  m.starts.push({...m.starts[0],id:'duplicate'}, {id:'edge',x:0,y:0},{id:'outside',x:-1,y:0});
  const expected=new Uint8Array(walk.length);
  for(const s of m.starts){const d=reachable(m,s.x,s.y);for(let i=0;i<d.length;i++)if(d[i]>=0)expected[i]=1;}
  expect(reachableUnion(m)).toEqual(expected);
 }
});
it('a blocked authored start still reports its exact error instead of obtaining a free reachable source',()=>{
 const m=fixture(),s=m.starts[0];(m.walkable as Uint8Array)[s.y*m.width+s.x]=0;
 expect(compileEconomy(m).errors).toContain(`start ${s.id} is not walkable`);
});
