/** VEYRA shared waterfront authoring primitives. Geometry only; no new Gameplay authority. */
import {Plan,type Rect,type RoofStyle,type Mat,type Level} from './plan';
export const WATERFRONT_IDS=['po_westbank','po_dpier','po_gullpier','po_strait','po_southfoot','po_mere'] as const;
export function waterYard(p:Plan,id:string,name:string,rects:Rect[],stone=false){p.structure(id,name,0,{mat:stone?'stone':'wood',roof:null,open:true});p.room(id,name,0,id,rects,{open:true});}
/** Requires a physical wood platform; unlike painted shore paths it can span water. */
export function pierDeck(p:Plan,id:string,name:string,rects:Rect[],level:0|1|2=0){p.structure(id,name,level,{mat:'wood',roof:null,open:true});p.room(id,name,level,id,rects,{open:true,carve:true});}
export function waterfrontHouse(p:Plan,id:string,name:string,rect:Rect,door:'N'|'S'|'E'|'W',roof:RoofStyle='wood',mat:Mat='wood') {
 const [x,y,w,h]=rect;p.structure(id,name,0,{mat,roof});p.room(id,name,0,id,[rect]);
 const dx=door==='E'?x+w-1:door==='W'?x:x+(w>>1),dy=door==='S'?y+h-1:door==='N'?y:y+(h>>1);
 p.door(dx,dy,0,id,`${name} entrance`,'main');
 let a:Rect=door==='E'?[x+w,dy-2,4,5]:door==='W'?[x-4,dy-2,4,5]:door==='S'?[dx-2,y+h,5,4]:[dx-2,y-4,5,4];
 waterYard(p,`${id}_apron`,`${name} entrance apron`,[a],true);return [dx,dy] as const;
}
export function waterUpper(p:Plan,id:string,name:string,level:1|2,rects:Rect[],roof:RoofStyle|null='wood',mat:Mat='wood') {
 p.structure(id,name,level,{mat,roof});p.room(id,name,level,id,rects);
}
export function piersideDetails(p:Plan,kind:string,pts:[number,number,Level][]) {for(const [x,y,lv] of pts)p.prop(x,y,lv,kind)}