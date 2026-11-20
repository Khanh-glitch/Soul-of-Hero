import {BAL, type Proj} from './core';
import {ITEMS} from './catalog';

/** The two basic straight-flight spells share one launch geometry for every caster. */
export function basicCoreRay(key:string){
  switch(ITEMS[key]?.creatorCore){
    case 'elsa': {const b=BAL.creatorCoreElsa;return {kind:'elsa_shard',speed:b.shardSpeed,life:b.shardLife,dmg:b.shardDamage};}
    case 'demon': {const b=BAL.creatorCoreDemon;return {kind:'spirit_ray',speed:b.raySpeed,life:b.rayLife,dmg:b.rayDamage};}
  }
}
export function coreRayProjectile(spec:NonNullable<ReturnType<typeof basicCoreRay>>,x:number,y:number,a:number,source:Pick<Proj,'from'|'owner'|'victim'>,coreUid:string):Proj {
  return {...source,coreUid,x,y,vx:Math.cos(a)*spec.speed,vy:Math.sin(a)*spec.speed,life:spec.life,dmg:spec.dmg,r:3,kind:spec.kind};
}
