import {describe,it,expect} from 'vitest';
import {getWorld,setActiveLayout} from '../game/world';
import {newGame,startRun} from '../game/engine';
import {validate,serializeSnapshot} from '../game/persist';
import {U05_WORLD_LAYOUT_ID,layoutIdAt} from './scenes';
import {windowAround} from './frame';
import {getWindowWorld} from './window';
import {authoredPlan,applyFloor} from './floors';
import {shiftVeyraWindowBy} from './continuity';

describe('single canonical VEYRA runtime save, traversal and floors',()=>{
  it('new run stays save-valid before/after a real world window shift',()=>{
    setActiveLayout(U05_WORLD_LAYOUT_ID);
    const gs=newGame();
    const res=startRun(gs,'female',Date.now(),null,20261109);
    expect(res.ok).toBe(true);
    expect(gs.run?.layoutId).toBe(U05_WORLD_LAYOUT_ID);
    expect(validate(gs)).not.toBeNull();
    const shifted=shiftVeyraWindowBy(gs,64,0,()=>{});
    expect(shifted).toBe(true);
    expect(gs.run?.layoutId).toMatch(/^veyra05-at-/);
    expect(validate(gs)).not.toBeNull();
    expect(serializeSnapshot(gs)).toMatch(/soh-snapshot-v1/);
  });
  it('actual six-Elder floor switching remains save valid through a real stair',()=>{
    const p=authoredPlan('po_elderwood')!.plan;
    const st=p.stairs.find(s=>s.from===0&&s.to===-1)!;
    const win=windowAround(st.x,st.y);
    const layout=layoutIdAt(win.originTx,win.originTy);
    setActiveLayout(layout);
    const ww=getWindowWorld(layout);
    const gs=newGame();
    const r=startRun(gs,'female',Date.now(),null,20261110,{tx:st.x-win.originTx,ty:st.y-win.originTy});
    expect(r.ok).toBe(true);
    expect(validate(gs)).not.toBeNull();
    expect(applyFloor(gs,ww,ww.floors,-1,[st.tx-win.originTx,st.ty-win.originTy],()=>{})).toBe(true);
    expect(validate(gs)).not.toBeNull();
    expect(serializeSnapshot(gs)).toMatch(/soh-snapshot-v1/);
    expect(applyFloor(gs,ww,ww.floors,0,[st.x-win.originTx,st.y-win.originTy],()=>{})).toBe(true);
    expect(validate(gs)).not.toBeNull();
  });
});
