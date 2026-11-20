// Dev-only isolated component harness, not a natural encounter or a shipped game entry.
import React from 'react';import {createRoot} from 'react-dom/client';import '../../../src/index.css';
import {HumanPanel} from '../../../src/ui/HumanPanel';import type {Api} from '../../../src/ui/common';
import {newGame,startRun,addItem,dispatch} from '../../../src/game/engine';import {setActiveLayout} from '../../../src/game/world';import {layoutIdAt} from '../../../src/veyra05/scenes';import {auToTile,windowAround} from '../../../src/veyra05/frame';import {WW,TILE} from '../../../src/game/core';
const [gx,gy]=auToTile(921,259), w=windowAround(gx,gy);setActiveLayout(layoutIdAt(w.originTx,w.originTy));
const gs=newGame(),now=Date.now();startRun(gs,'female',now,null,7606,{tx:gx-w.originTx,ty:gy-w.originTy});
const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.floor===0&&h.gx>=w.originTx&&h.gx<w.originTx+WW&&h.gy>=w.originTy&&h.gy<w.originTy+WW)!;
r.player.x=(h.gx-w.originTx+.5)*TILE;r.player.y=(h.gy-w.originTy+.5)*TILE;const a=r.custody.inv,b=r.custody[h.inv.packId];a.slots.fill(null);b.slots.fill(null);addItem(r,a.id,'wood',10);addItem(r,a.id,'stone',2);addItem(r,b.id,'berries',4);
const snapshot=()=>({player:a.slots,pack:b.slots,actor:h.actorId,receipts:r.receipts.filter(e=>e.kind==='human.exchange')});Object.assign(window,{barterSnapshot:snapshot});
let seq=0;const root=createRoot(document.querySelector('#root')!);function render(){const api={gs,act:(type:string,payload={})=>{const result=dispatch(gs,{type,...payload,id:`ui-fixture-${++seq}`},now+seq);render();return result;}} as Api;root.render(<HumanPanel api={api} actorId={h.actorId} onClose={()=>root.unmount()}/>);}render();
