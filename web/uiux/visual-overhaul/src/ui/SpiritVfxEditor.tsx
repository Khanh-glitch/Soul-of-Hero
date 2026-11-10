import React, {useEffect, useRef, useState} from 'react';
import type {GameState} from '../game/core';
import {cam} from '../game/render';
import * as pfx from '../game/pixelfx';
import {LAYERS, type SpiritLayer, type SpiritSettings, getSpiritSettings, setSpiritSettings, resetSpiritSettings, spiritEvents, clearSpiritEvents, tunedSpirit} from '../game/spirit-vfx-editor';
import './spirit-vfx-editor.css';

const keys = Object.keys(LAYERS) as SpiritLayer[];
const fields = [
  ['dx','X lệch (px)',-500,500,1], ['dy','Y lệch (px)',-500,500,1],
  ['scale','Cỡ',0.05,3,0.01], ['stretch','Kéo ngang',0.1,5,0.05],
  ['angle','Góc thêm (độ)',-360,360,1], ['delayMs','Trễ xuất hiện (ms)',0,5000,50],
  ['durationMs','Thời gian tối đa (ms)',50,10000,50],
] as const;
type Field = typeof fields[number][0];
type Viewport = {left:number;top:number;scale:number;width:number;height:number};
type Drag = {kind:'move'|'scale'|'rotate'; x:number;y:number;dx:number;dy:number;scale:number;angle:number;px:number;py:number;distance:number;pointerAngle:number};
const clamp = (v:number, min:number, max:number) => Math.max(min,Math.min(max,v));
function NumberField({label,value,min,max,step,onValue}:{label:string;value:number;min:number;max:number;step:number;onValue:(v:string)=>void}) {
  const [draft,setDraft] = useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  return <input aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={e=>{const v=e.target.value;setDraft(v);if(v!==''&&Number(v)>=min&&Number(v)<=max)onValue(v);}} onBlur={()=>setDraft(String(value))}/>;
}

export default function SpiritVfxEditor({gs,top,right,viewport}:{gs:GameState;top:number;right:number;viewport:Viewport}) {
  const [open,setOpen] = useState(false), [key,setKey] = useState<SpiritLayer>('q.beam');
  const [settings,setSettings] = useState(getSpiritSettings), [status,setStatus] = useState('');
  const [tick,setTick] = useState(0), [playing,setPlaying] = useState(true), [rate,setRate] = useState(1), [leftDock,setLeftDock] = useState(false);
  const preview=useRef<pfx.PfxInst|null>(null), anchor=useRef({x:0,y:0}), file=useRef<HTMLInputElement>(null), drag=useRef<Drag|null>(null);
  const settingsRef=useRef(settings), dockInitialized=useRef(false); settingsRef.current=settings;
  const layer=settings.layers[key], info=LAYERS[key];
  const stop=()=>{pfx.removePreview(preview.current);preview.current=null;drag.current=null;setTick(t=>t+1);};
  useEffect(()=>()=>{pfx.removePreview(preview.current);preview.current=null;},[]);
  useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.code==='F8'&&!e.repeat){e.preventDefault();setOpen(v=>!v);}};window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down);},[]);
  useEffect(()=>{const timer=setInterval(()=>{if(open||preview.current)setTick(t=>t+1);},50);return()=>clearInterval(timer);},[open]);
  const apply=(next:SpiritSettings, message=true)=>{
    if(setSpiritSettings(next)){settingsRef.current=next;setSettings(next);if(message)setStatus('Đã lưu cho bản thử và các lần dùng Q/E tiếp theo.');}
    else setStatus('Giá trị không hợp lệ.');
  };
  const patch=(values:Partial<SpiritSettings['layers'][SpiritLayer]>,message=true)=>{
    const current=settingsRef.current;
    apply({...current,layers:{...current.layers,[key]:{...current.layers[key],...values}}},message);
  };
  const change=(name:Field,value:string)=>{
    const n=Number(value), spec=fields.find(f=>f[0]===name)!;
    if(Number.isFinite(n)&&n>=spec[2]&&n<=spec[3])patch({[name]:n});
  };
  useEffect(()=>{
    const inst=preview.current;if(!inst)return;
    const opt=tunedSpirit(key,anchor.current.x,anchor.current.y,0,130);
    inst.x=opt.x;inst.y=opt.y;inst.scale=opt.scale;inst.stretch=opt.stretch;inst.angle=opt.angle;
  },[settings,key]);
  const start=()=>{
    stop();const p=gs.run?.player;if(!p){setStatus('Cần vào game trước.');return;}
    anchor.current={x:p.x+(key==='q.hit'?70:0),y:p.y};
    const opt=tunedSpirit(key,anchor.current.x,anchor.current.y,0,130);
    const inst=pfx.spawn(info.asset,{...opt,delayMs:0,family:key==='q.beam'?'hover':'ground',loop:true,maxAgeMs:0});
    if(!inst){setStatus('Hiệu ứng chưa tải xong, bấm Xem lại mẫu.');return;}
    inst.previewRate=rate;inst.previewCycle=true;inst.t=Math.min(400,inst.dur/2);
    preview.current=inst;setPlaying(true);setStatus('Kéo dấu ✥ trên màn hình để di chuyển mẫu.');setTick(t=>t+1);
  };
  // Opening or selecting a layer creates a preview without changing the real simulation.
  useEffect(()=>{if(open&&!dockInitialized.current){setLeftDock(viewport.width*viewport.scale<=900);dockInitialized.current=true;}if(open&&!preview.current)start();},[open,key]);
  const togglePlay=()=>{if(!preview.current){start();return;}const next=!playing;preview.current.previewRate=next?rate:0;setPlaying(next);};
  const step=(amount:number)=>{const inst=preview.current;if(!inst)return;inst.previewRate=0;setPlaying(false);inst.t=clamp(inst.t+amount,0,inst.dur);setTick(t=>t+1);};
  const exportFile=()=>{
    const payload={schema:'soh-spirit-vfx-export-v1',exportedAt:new Date().toISOString(),settings:getSpiritSettings(),events:spiritEvents(),note:'Tọa độ trong thế giới game; thời gian sự kiện là đồng hồ thực. Xem mẫu không phải sự kiện chiến đấu.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='spirit-vfx-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Đã xuất cấu hình, ghi chú và nhật ký sự kiện.');
  };
  const importFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];e.target.value='';if(!f)return;
    try{if(f.size>200000)throw Error();const data=JSON.parse(await f.text());const next=data.schema==='soh-spirit-vfx-export-v1'?data.settings:data;if(!setSpiritSettings(next))throw Error();const loaded=getSpiritSettings();settingsRef.current=loaded;setSettings(loaded);setStatus('Đã nhập cấu hình và ghi chú. Nhật ký cũ trong tệp không được phát lại.');}
    catch{setStatus('Không thể nhập: tệp sai định dạng hoặc giá trị ngoài giới hạn.');}
  };
  const inst=preview.current, duration=inst?.dur||1200;void tick;
  const rect=inst?pfx.destRect(inst):null;
  // Place the move handle on visible artwork, not the often-offset atlas pivot.
  const pivot=(()=>{if(!inst||!rect)return null;const [x0,y0,x1,y1]=inst.entry.export.coreBounds;
    const x=rect.dx+(x0+(x1-x0)*(key==='q.beam'?0.12:0.5))*inst.scale*inst.stretch;
    const y=rect.dy+(y0+y1)/2*inst.scale;
    const dx=x-rect.rotX,dy=y-rect.rotY,c=Math.cos(inst.angle),s=Math.sin(inst.angle);
    return {x:viewport.left+(rect.rotX+dx*c-dy*s-Math.round(cam.x))*viewport.scale,y:viewport.top+(rect.rotY+dx*s+dy*c-Math.round(cam.y))*viewport.scale};
  })();
  const radius=clamp(55*viewport.scale,45,100), angle=inst?.angle||0;
  const scalePoint=pivot?{x:pivot.x+Math.cos(angle)*radius,y:pivot.y+Math.sin(angle)*radius}:null;
  const rotatePoint=pivot?{x:pivot.x+Math.cos(angle-Math.PI/2)*radius,y:pivot.y+Math.sin(angle-Math.PI/2)*radius}:null;
  const beginDrag=(kind:Drag['kind'])=>(e:React.PointerEvent<HTMLButtonElement>)=>{
    if(!pivot||!preview.current)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
    const l=settingsRef.current.layers[key], x=e.clientX-pivot.x,y=e.clientY-pivot.y;
    drag.current={kind,x:e.clientX,y:e.clientY,dx:l.dx,dy:l.dy,scale:l.scale,angle:l.angle,px:pivot.x,py:pivot.y,distance:Math.max(1,Math.hypot(x,y)),pointerAngle:Math.atan2(y,x)};
  };
  const moveDrag=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const d=drag.current;if(!d)return;e.preventDefault();e.stopPropagation();
    if(d.kind==='move')patch({dx:clamp(Math.round(d.dx+(e.clientX-d.x)/viewport.scale),-500,500),dy:clamp(Math.round(d.dy+(e.clientY-d.y)/viewport.scale),-500,500)},false);
    else if(d.kind==='scale')patch({scale:Math.round(clamp(d.scale*Math.hypot(e.clientX-d.px,e.clientY-d.py)/d.distance,0.05,3)*100)/100},false);
    else {let delta=(Math.atan2(e.clientY-d.py,e.clientX-d.px)-d.pointerAngle)*180/Math.PI;delta=((delta+540)%360)-180;patch({angle:clamp(Math.round(d.angle+delta),-360,360)},false);}
  };
  const endDrag=(e:React.PointerEvent<HTMLButtonElement>)=>{if(!drag.current)return;e.preventDefault();e.stopPropagation();drag.current=null;setStatus('Đã lưu vị trí/cỡ/góc; dùng Q/E thật để kiểm tra.');};
  const inside=(p:{x:number;y:number})=>p.x>=viewport.left&&p.x<=viewport.left+viewport.width*viewport.scale&&p.y>=viewport.top&&p.y<=viewport.top+viewport.height*viewport.scale;
  const handle=(p:{x:number;y:number},kind:Drag['kind'],label:string,symbol:string)=>inside(p)?<button key={kind} type="button" className={`vfx-handle vfx-handle-${kind}`} aria-label={label} title={label} style={{left:p.x,top:p.y}} onPointerDown={beginDrag(kind)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onMouseDown={e=>e.stopPropagation()} onMouseMove={e=>e.stopPropagation()} onMouseUp={e=>e.stopPropagation()}>{symbol}</button>:null;
  const panelTop=leftDock&&open?Math.max(top,viewport.top+Math.round(90*viewport.scale)+4):top;
  const panelHeight=Math.max(80,Math.min(window.innerHeight,viewport.top+viewport.height*viewport.scale)-panelTop-8);
  const field=(name:Field)=>{const [,label,min,max,stepSize]=fields.find(f=>f[0]===name)!;return <label key={name}>{label}<NumberField label={label} min={min} max={max} step={stepSize} value={layer[name]} onValue={v=>change(name,v)}/></label>;};
  return <>
    {pivot&&scalePoint&&rotatePoint&&<div className="vfx-handle-layer" aria-label="Tay nắm chỉnh mẫu">
      <svg className="vfx-handle-lines"><line x1={pivot.x} y1={pivot.y} x2={scalePoint.x} y2={scalePoint.y}/><line x1={pivot.x} y1={pivot.y} x2={rotatePoint.x} y2={rotatePoint.y}/></svg>
      {handle(pivot,'move','Kéo di chuyển hiệu ứng','✥')}{handle(scalePoint,'scale','Kéo thay đổi cỡ','⤢')}{handle(rotatePoint,'rotate','Kéo xoay hiệu ứng','↻')}
    </div>}
    <div className="vfx-editor-root" style={leftDock&&open?{top:panelTop,left:viewport.left+8,right:'auto'}:{top,right}} onMouseDown={e=>e.stopPropagation()} onMouseUp={e=>e.stopPropagation()} onMouseMove={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.code==='F8'&&!e.repeat){e.preventDefault();setOpen(v=>!v);}}}>
      {!open?<div className="vfx-closed"><button className="vfx-open" onClick={()=>setOpen(true)}>⚙ Chỉnh VFX Spirit Q/E (F8)</button>{inst&&<button onClick={stop}>Tắt mẫu ✕</button>}</div>:
      <section className="vfx-panel" style={{maxHeight:panelHeight}} aria-label="Trình chỉnh VFX Spirit">
        <header><strong>Spirit Q/E · chỉnh tay</strong><button onClick={()=>setOpen(false)}>Ẩn bảng</button></header>
        <div className="vfx-buttons"><button onClick={()=>setLeftDock(v=>!v)}>Đổi bên bảng</button><button onClick={start}>Xem lại mẫu</button></div>
        <label>Lớp <select aria-label="Chọn lớp" value={key} onChange={e=>{stop();setKey(e.target.value as SpiritLayer);}}>{keys.map(k=><option key={k} value={k}>{LAYERS[k].name}</option>)}</select></label>
        <p className="vfx-hint">Kéo <b>✥</b> di chuyển · <b>⤢</b> đổi cỡ · <b>↻</b> xoay. Ẩn bảng để nhìn toàn màn hình; mẫu vẫn còn.</p>
        <div className="vfx-buttons"><button onClick={togglePlay}>{playing?'Dừng mẫu':'Chạy mẫu'}</button><button onClick={()=>step(-1000/30)}>◀ 1 khung</button><button onClick={()=>step(1000/30)}>1 khung ▶</button><button onClick={stop}>Xóa mẫu</button></div>
        <label>Khung mẫu ({inst?Math.round(Math.max(0,inst.t)):0}/{Math.round(duration)} ms)<input aria-label="Thời gian mẫu" type="range" min="0" max={duration} step={1000/30} value={inst?clamp(inst.t,0,duration):0} onChange={e=>{if(preview.current){preview.current.t=Number(e.target.value);preview.current.previewRate=0;setPlaying(false);setTick(t=>t+1);}}}/></label>
        <div className="vfx-fields">{(['dx','dy','scale','angle'] as Field[]).map(field)}</div>
        <details><summary>Thời gian, kéo ngang và thông tin lớp</summary>
          <div className="vfx-info"><b>{info.asset}</b><br/>Mốc: {info.anchor}.<br/>Xuất hiện: {info.trigger}.<br/>Biến mất: {info.end}.</div>
          <div className="vfx-fields">{(['stretch','delayMs','durationMs'] as Field[]).map(field)}</div>
          <label>Tốc độ mẫu <select aria-label="Tốc độ mẫu" value={rate} onChange={e=>{const n=Number(e.target.value);setRate(n);if(preview.current&&playing)preview.current.previewRate=n;}}><option value="0.25">0,25×</option><option value="1">1×</option><option value="2">2×</option></select></label>
          <p>Mẫu lặp để dễ chỉnh, không phải chiêu thật. Tia thật kết thúc khi kênh kết thúc/ngắt; game vẫn chạy khi dừng mẫu.</p>
        </details>
        <label>Ghi chú lớp / hiệu ứng đồng thời <textarea aria-label="Ghi chú lớp" maxLength={4000} rows={2} value={layer.note} onChange={e=>patch({note:e.target.value})} placeholder="Xuất hiện cùng lúc, vị trí, cách biến mất..."/></label>
        <div className="vfx-buttons"><button onClick={exportFile}>Xuất JSON</button><button onClick={()=>file.current?.click()}>Nhập JSON</button><input ref={file} aria-label="Tệp JSON" type="file" accept=".json,application/json" hidden onChange={importFile}/><button onClick={()=>{resetSpiritSettings();const next=getSpiritSettings();settingsRef.current=next;setSettings(next);setStatus('Đã khôi phục mặc định.');}}>Mặc định</button></div>
        <div className="vfx-status" role="status">{status}</div>
        <details><summary>Nhật ký Q/E thật ({spiritEvents().length})</summary><p>Thời gian đồng hồ thực, tọa độ thế giới; không ghi mẫu hoặc các lớp hạt khác.</p><button onClick={()=>{clearSpiritEvents();setTick(t=>t+1);}}>Xóa nhật ký</button><ol>{spiritEvents().slice().reverse().map((ev,i)=><li key={i}>{new Date(ev.time).toLocaleTimeString()} · {ev.kind} · ({ev.x}, {ev.y}) {ev.detail}</li>)}</ol></details>
      </section>}
    </div>
  </>;
}
