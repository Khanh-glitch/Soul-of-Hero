import {BAL, rngNext, type RunState, type Proj} from './core';
import {ITEMS} from './catalog';

/** Basic projectile spells: use the same geometry, damage and spread for either caster. */
interface RaySpec {kind:string;speed:number;life:number;dmg:number;r:number;spread?:number}
export function basicCoreRay(key:string):RaySpec|undefined {
  switch(ITEMS[key]?.creatorCore){
    case 'elsa': {const b=BAL.creatorCoreElsa;return {kind:'elsa_shard',speed:b.shardSpeed,life:b.shardLife,dmg:b.shardDamage,r:3};}
    case 'demon': {const b=BAL.creatorCoreDemon;return {kind:'spirit_ray',speed:b.raySpeed,life:b.rayLife,dmg:b.rayDamage,r:3};}
    case 'earthmother': {const b=BAL.creatorCoreEarthmother;return {kind:'nature_rock',speed:b.rockSpeed,life:b.rockLife,dmg:b.rockDamage,r:4};}
    case 'meteor': return {kind:'fireball',speed:190,life:.95,dmg:BAL.creatorCoreMeteor.fireballDamage,r:5};
    case 'blast': {const b=BAL.creatorCoreBlast;return {kind:'blast_round',speed:b.basicSpeed,life:b.basicLife,dmg:b.basicDamage,r:2,spread:b.spreadRadians};}
  }
}
export function coreRayProjectile(run:RunState,spec:RaySpec,x:number,y:number,a:number,source:Pick<Proj,'from'|'owner'|'victim'>,coreUid:string):Proj {
  if(spec.spread)a+=(rngNext(run)*2-1)*spec.spread;
  return {...source,coreUid,x,y,vx:Math.cos(a)*spec.speed,vy:Math.sin(a)*spec.speed,life:spec.life,dmg:spec.dmg,r:spec.r,kind:spec.kind};
}

export interface CoreEffectCast {viewX?:number;viewY?:number;mode?:'basic'|'refined'|'signature';distance?:number;key:string;uid:string;x:number;y:number;angle:number;owner:string;victim?:string}
export function basicCoreReach(key:string){
  const ray=basicCoreRay(key);if(ray)return ray.speed*ray.life;
  switch(ITEMS[key]?.creatorCore){case 'mjolnir':return BAL.creatorCoreMjolnir.punchRange;case 'dragon':return BAL.creatorCoreDragon.flameLength;default:return 0;}
}
