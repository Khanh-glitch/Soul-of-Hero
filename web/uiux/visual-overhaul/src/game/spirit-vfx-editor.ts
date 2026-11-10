/** Test-build-only VFX calibration. Never changes combat, timings or saves. */
export type SpiritLayer = 'q.beam' | 'q.hit' | 'e.depart' | 'e.arrive';
export type LayerSettings = {dx:number;dy:number;scale:number;stretch:number;angle:number;delayMs:number;durationMs:number;note:string};
export type SpiritSettings = {schema:'soh-spirit-vfx-v1';layers:Record<SpiritLayer,LayerSettings>};
export const LAYERS: Record<SpiritLayer,{name:string;asset:string;anchor:string;trigger:string;end:string}> = {
 'q.beam':{name:'Q — tia duy trì',asset:'arcane/arcane-beam',anchor:'Nhân vật khi chiêu bắt đầu',trigger:'Q được thi triển thành công',end:'Kết thúc kênh hoặc bị ngắt'},
 'q.hit':{name:'Q — va chạm',asset:'arcane/mana-burst',anchor:'Vị trí quái bị trúng',trigger:'Mỗi lần tia gây sát thương',end:'Hết hoạt ảnh / thời lượng'},
 'e.depart':{name:'E — rời đi',asset:'arcane/blink-out',anchor:'Vị trí xuất phát',trigger:'E hợp lệ và bắt đầu dịch chuyển',end:'Hết hoạt ảnh / thời lượng'},
 'e.arrive':{name:'E — đến nơi',asset:'arcane/blink-in',anchor:'Vị trí đến hợp lệ',trigger:'Đến nơi thành công',end:'Hết hoạt ảnh / thời lượng'},
};
export const DEFAULT_SPIRIT:SpiritSettings={schema:'soh-spirit-vfx-v1',layers:{
 'q.beam':{dx:0,dy:20,scale:0.55,stretch:1,angle:0,delayMs:0,durationMs:10000,note:''},
 'q.hit':{dx:0,dy:0,scale:0.22,stretch:1,angle:0,delayMs:0,durationMs:1800,note:''},
 'e.depart':{dx:0,dy:0,scale:0.65,stretch:1,angle:0,delayMs:0,durationMs:1600,note:''},
 'e.arrive':{dx:0,dy:0,scale:0.65,stretch:1,angle:0,delayMs:0,durationMs:1400,note:''},
}};
const enabled=import.meta.env.VITE_FX_TEST==='1';const STORAGE='soh.spirit-vfx-editor.v1';
function fresh():SpiritSettings{return JSON.parse(JSON.stringify(DEFAULT_SPIRIT));}
export function validateSpirit(value:unknown):SpiritSettings|null {try {const o=value as SpiritSettings;if(!o||o.schema!=='soh-spirit-vfx-v1'||!o.layers)return null;const result=fresh();for(const key of Object.keys(LAYERS) as SpiritLayer[]){const v=o.layers[key];if(!v||typeof v.note!=='string'||v.note.length>4000)return null;for(const k of ['dx','dy','scale','stretch','angle','delayMs','durationMs'] as const)if(typeof v[k]!=='number'||!Number.isFinite(v[k]))return null;if(Math.abs(v.dx)>500||Math.abs(v.dy)>500||v.scale<0.05||v.scale>3||v.stretch<0.1||v.stretch>5||Math.abs(v.angle)>360||v.delayMs<0||v.delayMs>5000||v.durationMs<50||v.durationMs>10000)return null;result.layers[key]={...v};}return result;}catch{return null;}}
function load():SpiritSettings {if(!enabled||typeof localStorage==='undefined')return fresh();try{return validateSpirit(JSON.parse(localStorage.getItem(STORAGE)||'null'))||fresh();}catch{return fresh();}}
let config=load();
export function getSpiritSettings():SpiritSettings{return JSON.parse(JSON.stringify(config));}
export function setSpiritSettings(value:unknown):boolean {const v=validateSpirit(value);if(!enabled||!v)return false;config=v;try{localStorage.setItem(STORAGE,JSON.stringify(v));}catch{}return true;}
export function resetSpiritSettings(){return setSpiritSettings(fresh());}
export function layerSettings(key:SpiritLayer):LayerSettings{return enabled?config.layers[key]:DEFAULT_SPIRIT.layers[key];}
export function tunedSpirit(key:SpiritLayer, x:number,y:number,baseAngle=0,len=130) {const v=layerSettings(key);return {x:x+v.dx,y:y+v.dy,scale:v.scale,stretch:key==='q.beam'?Math.max(0.1,len/(238*v.scale))*v.stretch:v.stretch,angle:baseAngle+v.angle*Math.PI/180,delayMs:v.delayMs,maxAgeMs:v.delayMs+v.durationMs};}
export type EventEntry={time:number;kind:string;x:number;y:number;detail:string};
const events:EventEntry[]=[];
export function recordSpiritEvent(kind:string,x:number,y:number,detail=''){if(!enabled)return;events.push({time:Date.now(),kind,x:Math.round(x),y:Math.round(y),detail});if(events.length>100)events.shift();}
export function spiritEvents(){return events.slice();}
export function clearSpiritEvents(){events.length=0;}
