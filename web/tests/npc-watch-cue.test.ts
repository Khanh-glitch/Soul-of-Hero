import {expect,it} from 'vitest';
import {startRun,newGame,mkCreature,markDirty} from '../src/game/engine';
import {watchCue} from '../src/game/watch-cue';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
it('names only a visible alarm target, anchors the marker to the post and never exposes a remote guard',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,c=hw.communities['com:po_vend_gulf'],post=r.entities[c.storeEntityId!],h=c.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='guard')!;
 const tx=post.tx!,ty=post.ty!+1,[ax,ay]=r.sourceMap!.veyra!.originAu;h.gx=ax*2+tx;h.gy=ay*2+ty;h.floor=0;h.state='WORKING';
 const body={x:(tx+.5)*16,y:(ty+.5)*16};Object.assign(r.player,body);h.intent={kind:'work',work:{kind:'guard',phase:'travel',duration:8000,inputs:[],entityId:post.id},intentId:'watch',actorId:h.actorId,preconditions:[],reserved:[],startAt:T0,dueAt:T0+8000};
 const cue=()=>watchCue(r,h,body,T0);expect(cue()?.label).toBe('Guard: Store watch');
 const m=mkCreature(r,'wolf',body.x+4*16,body.y,30);r.creatures.push(m);h.state='FIGHTING';h.intent={...h.intent,kind:'fight',target:m.id,work:undefined,watchResponse:{postId:post.id,enemyId:m.id,alertAt:T0}};
 expect(cue()?.target).toBe(m);expect(cue()?.label).toBe('Guard: Greyfang Wolf!');
 r.entities.shutter={id:'shutter',kind:'door',open:false,tx:tx+2,ty,x:body.x+32,y:body.y};markDirty();expect(cue()?.label).toBe('Guard: Trouble!');expect(cue()?.target).toBeUndefined();
 h.intent.kind='work';h.state='MOVING';expect(cue()?.label).toBe('Guard: Back to store');expect(cue()?.post).toBe(post);
 h.floor=1;expect(cue()).toBeUndefined();h.floor=0;r.player.x=body.x+10*16;expect(cue()).toBeUndefined();r.player.x=body.x;post.owner='player';expect(cue()).toBeUndefined();
});
