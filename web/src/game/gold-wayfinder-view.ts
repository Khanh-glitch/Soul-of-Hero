/**
 * Type-only contract extracted verbatim from Gold (3) JourneyWayfinder props.
 * The donor's daily-pact gameplay engine is deliberately NOT imported.
 * Actual goals/options are derived from R12/Veyra in GoldWayfinderAdapter.
 */
export type JourneyCategory = 'survival' | 'craft' | 'shelter' | 'combat' | 'expedition';
export interface WayfinderWorldHint {
  x:number; y:number; tx:number; ty:number; label:string;
  distanceTiles:number; bearing:string; onScreen:boolean;
}
export interface WayfinderOption {
  id:string; kind:'daily'|'fieldcraft'|'milestone'; title:string;
  progressText:string; category:JourneyCategory; icon:string;
}
export interface WayfinderView {
  trackedId:string; hidden:boolean;
  kind:'daily'|'fieldcraft'|'note'|'milestone';
  kindLabel:string; category:JourneyCategory; icon:string;
  title:string; summary:string; current:number; target:number;
  pct:number; progressText:string; blocker:string|null;
  nextStep:string; meaning:string;
  action:{label:string;panel?:'inv'|'craft'|'map'|'notes';recipe?:string;buildTool?:string}|null;
  worldHint:WayfinderWorldHint|null; completedJustNow:boolean;
  options:WayfinderOption[];
}
