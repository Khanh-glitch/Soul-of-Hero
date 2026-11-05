import React, {useEffect,useRef,useState} from 'react';
import type {GameState} from '../game/core';
import * as pfx from '../game/pixelfx';
import {LAYERS, type SpiritLayer, type SpiritSettings, getSpiritSettings, setSpiritSettings, resetSpiritSettings, spiritEvents, clearSpiritEvents, tunedSpirit} from '../game/spirit-vfx-editor';
import './spirit-vfx-editor.css';

const keys=Object.keys(LAYERS) as SpiritLayer[];
function NumberField({label,value,min,max,step,onValue}:{label:string;value:number;min:number;max:number;step:number;onValue:(v:string)=>void}){const [draft,setDraft]=useState(String(value));useEffect(()=>setDraft(String(value)),[value]);return <input aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={e=>{const v=e.target.value;setDraft(v);if(v!==''&&Number(v)>=min&&Number(v)<=max)onValue(v);}} onBlur={()=>setDraft(String(value))}/>;}
const fields=[['dx','X lệch (px)',-500,500,1],['dy','Y lệch (px)',-500,500,1],['scale','Cỡ',0.05,3,0.01],['stretch','Kéo ngang',0.1,5,0.05],['angle','Góc thêm (độ)',-360,360,1],['delayMs','Trễ xuất hiện (ms)',0,5000,50],['durationMs','Thời gian tối đa (ms)',50,10000,50]] as const;
export default function SpiritVfxEditor({gs,top,right}:{gs:GameState;top:number;right:number}){
 const [open,setOpen]=useState(false),[key,setKey]=useState<SpiritLayer>('q.beam'),[settings,setSettings]=useState(getSpiritSettings),[status,setStatus]=useState(''),[tick,setTick]=useState(0),[playing,setPlaying]=useState(true),[rate,setRate]=useState(1);
 const preview=useRef<pfx.PfxInst|null>(null), anchor=useRef({x:0,y:0});const file=useRef<HTMLInputElement>(null);
 const layer=settings.layers[key], info=LAYERS[key];
 const stop=()=>{pfx.removePreview(preview.current);preview.current=null;};
 useEffect(()=>()=>stop(),[]);
 useEffect(()=>{const keydown=(event:KeyboardEvent)=>{if(event.code==='F8'&&!event.repeat){event.preventDefault();setOpen(value=>!value);}};window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);},[]);
 useEffect(()=>{if(!open)stop();},[open]);
 useEffect(()=>{const timer=setInterval(()=>setTick(t=>t+1),200);return()=>clearInterval(timer);},[]);
 const apply=(next:SpiritSettings)=>{if(setSpiritSettings(next)){setSettings(next);setStatus('Đã lưu riêng cho bản thử; áp dụng cho lần thi triển tiếp theo.');}else setStatus('Giá trị không hợp lệ.');};
 const change=(name:typeof fields[number][0],value:string)=>{const n=Number(value);if(!Number.isFinite(n))return;const spec=fields.find(f=>f[0]===name)!;if(n<spec[2]||n>spec[3])return;apply({...settings,layers:{...settings.layers,[key]:{...layer,[name]:n}}});};
 useEffect(()=>{const inst=preview.current;if(!inst)return;const opt=tunedSpirit(key,anchor.current.x,anchor.current.y,0,130);inst.x=opt.x;inst.y=opt.y;inst.scale=opt.scale;inst.stretch=opt.stretch;inst.angle=opt.angle;},[settings,key]);
 const start=()=>{stop();const p=gs.run?.player;if(!p){setStatus('Cần vào game trước.');return;}anchor.current={x:p.x+(key==='q.hit'?70:0),y:p.y};const opt=tunedSpirit(key,anchor.current.x,anchor.current.y,0,130);const inst=pfx.spawn(info.asset,{...opt,family:key==='q.beam'?'hover':'ground',loop:true,maxAgeMs:0});if(!inst){setStatus('Hiệu ứng chưa tải xong, thử lại.');return;}inst.previewRate=rate;preview.current=inst;setPlaying(true);setStatus('Đang xem mẫu tại nhân vật; mục tiêu Q giả ở bên phải 70 px.');};
 const togglePlay=()=>{if(!preview.current){start();return;}const next=!playing;preview.current.previewRate=next?rate:0;setPlaying(next);};
 const step=(amount:number)=>{const inst=preview.current;if(!inst)return;inst.previewRate=0;setPlaying(false);inst.t=Math.max(0,Math.min(inst.dur,inst.t+amount));setTick(t=>t+1);};
 const exportFile=()=>{const payload={schema:'soh-spirit-vfx-export-v1',exportedAt:new Date().toISOString(),settings:getSpiritSettings(),events:spiritEvents(),note:'Tọa độ trong thế giới game; thời gian sự kiện là đồng hồ thực. Xem mẫu không phải sự kiện chiến đấu.'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='spirit-vfx-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Đã xuất cấu hình, ghi chú và nhật ký sự kiện.');};
 const importFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>200000)throw Error();const data=JSON.parse(await f.text());const next=data.schema==='soh-spirit-vfx-export-v1'?data.settings:data;if(!setSpiritSettings(next))throw Error();setSettings(getSpiritSettings());stop();setStatus('Đã nhập cấu hình và ghi chú. Nhật ký cũ trong tệp không được phát lại.');}catch{setStatus('Không thể nhập: tệp sai định dạng hoặc giá trị ngoài giới hạn.');}};
 const inst=preview.current;const duration=inst?.dur||1200;void tick;
 return <div className="vfx-editor-root" style={{top,right}} onMouseDown={e=>e.stopPropagation()} onMouseUp={e=>e.stopPropagation()} onMouseMove={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.code==='F8'&&!e.repeat){e.preventDefault();setOpen(value=>!value);}}}>
  {!open?<button className="vfx-open" onClick={()=>setOpen(true)}>⚙ Chỉnh VFX Spirit Q/E (F8)</button>:<section className="vfx-panel" style={{maxHeight:`calc(100vh - ${top + 8}px)`}} aria-label="Trình chỉnh VFX Spirit">
   <header><strong>VFX Spirit · bản thử</strong><button onClick={()=>{stop();setOpen(false);}}>Thu gọn ✕</button></header>
   <p>Bản mẫu dùng hiệu ứng thật, không sửa chiến đấu. Chỉnh áp dụng cho lần dùng Q/E tiếp theo.</p>
   <label>Lớp <select aria-label="Chọn lớp" value={key} onChange={e=>{stop();setKey(e.target.value as SpiritLayer);}}>{keys.map(k=><option key={k} value={k}>{LAYERS[k].name}</option>)}</select></label>
   <div className="vfx-info"><b>{info.asset}</b><br/>Mốc: {info.anchor}.<br/>Xuất hiện: {info.trigger}.<br/>Biến mất: {info.end}.</div>
   <div className="vfx-fields">{fields.map(([name,label,min,max,stepSize])=><label key={name}>{label}<NumberField label={label} min={min} max={max} step={stepSize} value={layer[name]} onValue={v=>change(name,v)}/></label>)}</div>
   <p>Trễ/thời gian chỉ sửa hình ảnh. Tia Q không vượt quá thời gian chiêu thật; thời gian có thể dừng sớm khi ngắt chiêu. Hoạt ảnh một lần giữ khung cuối cho đến khi hết thời gian.</p>
   <label>Ghi chú lớp / hiệu ứng đồng thời <textarea aria-label="Ghi chú lớp" maxLength={4000} rows={3} value={layer.note} onChange={e=>apply({...settings,layers:{...settings.layers,[key]:{...layer,note:e.target.value}}})} placeholder="Ví dụ: cùng lúc có ánh sáng dưới chân; tắt dần sau khi đến nơi..."/></label>
   <div className="vfx-buttons"><button onClick={start}>Xem lại mẫu</button><button onClick={togglePlay}>{playing?'Dừng mẫu':'Chạy mẫu'}</button><button onClick={()=>step(-1000/30)}>◀ 1 khung</button><button onClick={()=>step(1000/30)}>1 khung ▶</button><button onClick={stop}>Xóa mẫu</button></div>
   <label>Tốc độ mẫu <select aria-label="Tốc độ mẫu" value={rate} onChange={e=>{const n=Number(e.target.value);setRate(n);if(preview.current&&playing)preview.current.previewRate=n;}}><option value="0.25">0,25×</option><option value="1">1×</option><option value="2">2×</option></select></label>
   <label>Khung mẫu ({inst?Math.round(Math.max(0,inst.t)):0} / {Math.round(duration)} ms)<input aria-label="Thời gian mẫu" type="range" min="0" max={duration} step={1000/30} value={inst?Math.max(0,Math.min(inst.t,duration)):0} onChange={e=>{if(preview.current){preview.current.t=Number(e.target.value);preview.current.previewRate=0;setPlaying(false);setTick(t=>t+1);}}}/></label>
   <p>Mẫu chỉ minh họa: tia hướng sang phải dài 130 px, mục tiêu giả cách 70 px; game vẫn chạy. Dừng/tua chỉ điều khiển mẫu, không dừng game. Mẫu giữ lại đến khi xóa hoặc thu gọn.</p>
   <div className="vfx-buttons"><button onClick={exportFile}>Xuất JSON</button><button onClick={()=>file.current?.click()}>Nhập JSON</button><input ref={file} aria-label="Tệp JSON" type="file" accept=".json,application/json" hidden onChange={importFile}/><button onClick={()=>{resetSpiritSettings();setSettings(getSpiritSettings());setStatus('Đã khôi phục mặc định.');}}>Mặc định</button></div>
   <div className="vfx-status" role="status">{status}</div>
   <details><summary>Nhật ký Q/E thật ({spiritEvents().length})</summary><p>Thời gian đồng hồ thực, tọa độ thế giới; không ghi mẫu. Các lớp khác và hiệu ứng hạt cũ không được tự động thống kê.</p><button onClick={()=>{clearSpiritEvents();setTick(t=>t+1);}}>Xóa nhật ký</button><ol>{spiritEvents().slice().reverse().map((ev,i)=><li key={i}>{new Date(ev.time).toLocaleTimeString()} · {ev.kind} · ({ev.x}, {ev.y}) {ev.detail}</li>)}</ol></details>
  </section>}
 </div>;
}
