/**
 * VEYRA R5 — ORIGINAL C03 UNAVAILABLE: AUTHOR-TRANSPARENT GOLD-FAITHFUL RECONSTRUCTION.
 * All three IDs/names/centres come from canonical 81 GOLD map, not a synthetic
 * "C03 Breakthrough" claim. Reconcile with original C03 as soon as recovered.
 * No ferry, trading, transport, loot or quest authority is invented.
 */
import {Plan, type ArchPlan, type Rect} from './plan';
function openY(p:Plan,id:string,name:string,r:Rect[],mat:'wood'|'stone'='wood',lv:0|1=0){p.structure(id,name,lv,{open:true,roof:null,mat});p.room(id,name,lv,id,r,{open:true,carve:lv>0});}
function pierHut(p:Plan,id:string,name:string,x:number,y:number,w:number,h:number,mat:'wood'|'stone'='wood'){
 p.structure(id,name,0,{mat,roof:mat==='stone'?'tile':'wood'});
 p.room(id,name,0,id,[[x,y,w,h]]);
 const dx=x+Math.floor(w/2),dy=y+h-1;
 p.door(dx,dy,0,id,name+' door','main');
 openY(p,id+'_entrance',name+' dry entrance',[[dx-2,dy,5,6]],mat);
}
export function straitLandingRecovery():ArchPlan{
 const x=2536,y=980,p=new Plan('po_strait','Strait Landing','C03 GOLD-faithful provisional: inland road -> tidal freight pier -> return', [x-37,y-31,78,66]);
 openY(p,'cart_approach','Landward cart approach',[[x-31,y-4,21,6],[x-14,y-13,6,20],[x-11,y+5,32,6]],'stone');
 openY(p,'freight_pier','Heavy freight transfer pier',[[x+13,y+6,8,23],[x+8,y+24,25,6],[x-9,y+18,25,6],[x+5,y+9,7,19]],'wood');
 openY(p,'low_jetties','Two tidal slips with working gaps',[[x-19,y+16,17,5],[x-14,y+20,5,12],[x+23,y+19,7,13]],'wood');
 pierHut(p,'dispatch','Strait Dispatch House',x-18,y-22,18,14,'stone');
 pierHut(p,'sailstore','Dry Rope and Sail Store',x+8,y-19,16,12,'wood');
 openY(p,'dry_store_approach','Freight store alley to road',[[x+12,y-12,6,21],[x-16,y-9,18,5]],'stone');
 openY(p,'signal_loft','Landing lookout above dispatch',[[x-15,y-20,12,9]],'wood',1);
 p.stair(x-10,y-17,0,1,x-10,y-17,'Dispatch watch ladder','ladder');
 for(const [px,py] of [[x+15,y+12],[x+21,y+23],[x-12,y+20]])p.prop(px,py,0,'rope_coil');
 p.prop(x-13,y-8,0,'lantern');p.prop(x+4,y+7,0,'barrel_stack');
 p.note(x-9,y+7,0,'C03 recovery: freight/cart and landing geometry only; do not claim the original C03 source or implement ferries.');
 return p.build();
}
export function hookMerePierRecovery():ArchPlan{
 const x=2500,y=736,p=new Plan('po_mere','Hook Mere Pier','C03 GOLD-faithful provisional: narrow inland boat landing, fishing hut and sheltered return', [x-32,y-28,66,64]);
 openY(p,'footpath','Forest-side descent to the mere',[[x-25,y-7,23,5],[x-7,y-17,5,18],[x-6,y+1,17,5]],'stone');
 openY(p,'small_pier','Long low mere landing',[[x+7,y+2,6,25],[x+1,y+20,23,6]],'wood');
 openY(p,'net_spur','Net-maintenance spur',[[x-8,y+12,17,5],[x-8,y+13,5,14]],'wood');
 pierHut(p,'keepers_hut','Hook Mere Keeper Hut',x+7,y-20,18,14,'wood');
 openY(p,'keeper_walk','Landward return to the dry keeper hut',[[x+13,y-8,7,14],[x+2,y-2,18,6]],'stone');
 openY(p,'watch_loft','Small sheltered pier roof',[[x+9,y-18,14,10]],'wood',1);
 p.stair(x+16,y-11,0,1,x+16,y-11,'Mere roof ladder and return','ladder');
 p.prop(x+9,y+10,0,'net_rack');p.prop(x-8,y+13,0,'rope_coil');p.prop(x+14,y-7,0,'lantern');
 p.note(x,y+5,0,'C03 recovery: a modest inland-boat POI; no invented ferry or boat control.');
 return p.build();
}
export function southfootLandingRecovery():ArchPlan{
 const x=2392,y=2140,p=new Plan('po_southfoot','Southfoot Landing','C03 GOLD-faithful provisional: coastal road, double-sided landing and cargo watch', [x-38,y-31,79,69]);
 openY(p,'salt_road','Southfoot coastal cart entrance',[[x-32,y-1,24,6],[x-11,y-11,7,22],[x-9,y+9,28,6]],'stone');
 openY(p,'main_dock','Southfoot main transfer wharf',[[x+12,y+10,8,27],[x+3,y+30,30,6]],'wood');
 openY(p,'low_jetty','Smaller tidal boat finger',[[x-11,y+13,22,5],[x-9,y+15,6,19]],'wood');
 pierHut(p,'storehouse','Southfoot Freight Store',x-23,y-26,19,15,'wood');
 pierHut(p,'watchhouse','Southfoot Watch and Signals',x+5,y-22,18,13,'stone');
 openY(p,'upper_warehouse_approach','Dry freight access off Southfoot road',[[x+10,y-11,8,22],[x-14,y-10,15,6]],'stone');
 openY(p,'beacon','High coastal watch platform',[[x+8,y-20,13,9]],'wood',1);
 p.stair(x+13,y-18,0,1,x+13,y-18,'Coastal signal ladder','ladder');
 p.prop(x+16,y+21,0,'rope_coil');p.prop(x-9,y+19,0,'barrel_stack');p.prop(x+11,y-7,0,'lantern');
 p.note(x-6,y+11,0,'C03 recovery only, sourced by GOLD POI identity/location; do not claim authentic Breakthrough art or transport.');
 return p.build();
}