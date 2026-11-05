import { useEffect, useState } from 'react';
import { VIEW_W, VIEW_H } from '../game/core';
import { getArt } from '../game/art';
import { PROFILES, SCENES, SOURCE } from '../game/large/profile';
import { profileById } from '../game/large/profile';

function useScale() {
  const [s, setS] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => {
    const fit = () => { const W = innerWidth, H = innerHeight; let k = Math.floor(Math.min(W / VIEW_W, H / VIEW_H)); if (k < 1) k = Math.min(W / VIEW_W, H / VIEW_H); setS({ k, x: Math.floor((W - VIEW_W * k) / 2), y: Math.floor((H - VIEW_H * k) / 2) }); };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);
  return s;
}
function Backdrop() {
  const [r, setR] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => { if (!r) return; const g = r.getContext('2d')!; g.imageSmoothingEnabled = false;
    const A = getArt(); let raf = 0;
    const loop = (t: number) => { raf = requestAnimationFrame(loop);
      g.fillStyle = '#0a0f1e'; g.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 26; i++) { const x = (i * 97 + t / 90) % VIEW_W, y = (i * 53 + Math.sin(t / 3000 + i) * 20 + 120) % VIEW_H;
        g.fillStyle = i % 3 === 0 ? 'rgba(30,90,160,.55)' : 'rgba(60,60,90,.35)'; g.fillRect(x | 0, y | 0, 40, 1); }
      g.drawImage(A.hero.male.idle0[0], 290, 150, 24, 36);
      const gr = g.createLinearGradient(0, 0, 0, VIEW_H); gr.addColorStop(0, 'rgba(10,8,24,.8)'); gr.addColorStop(.5, 'rgba(20,10,30,.25)'); gr.addColorStop(1, 'rgba(40,10,10,.85)');
      g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 40; i++) { const y = (VIEW_H - (t / 22 + i * 23) % VIEW_H) | 0; g.fillStyle = i % 2 ? '#ffd070' : '#ff6a2a'; g.fillRect((i * 41 + Math.sin(t / 900 + i) * 4) | 0, y, 1, 1); }
    }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [r]);
  return <canvas ref={setR} width={VIEW_W} height={VIEW_H} className="absolute inset-0" />;
}
export interface Sel { profile: string; scene: string; seed: number; hours: number }
export default function Title({ opts, sel, setSel, note, hasSave, onStart, onContinue }: {
  opts: any; sel: Sel; setSel: (s: Sel) => void; note: string | null; hasSave: boolean;
  onStart: (o: Sel) => void; onContinue: () => void;
}) {
  const s = useScale(); const p = profileById(sel.profile);
  const launch = (over: Partial<Sel> = {}) => {
    const o = { ...sel, ...over };
    onStart(o);
  };
  return <div style={{ position: 'fixed', inset: 0, background: '#05040a' }}>
    <div className="stage" style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${s.k})` }}>
      <Backdrop />
      <div className="absolute" style={{ left: 0, right: 0, top: 10, textAlign: 'center' }}>
        <div className="title-font" style={{ fontSize: 32, color: '#ffe8b0', textShadow: '0 3px 0 #6a2a0a' }}>SOUL OF HERO</div>
        <div style={{ fontSize: 11, color: '#e0c8a8', marginTop: -4 }}>LW-01 · large-world / streaming visual pilot · WMP-04R1</div>
      </div>
      <div className="panel absolute" style={{ left: 16, top: 62, width: 300, padding: 8, fontSize: 11 }}>
        <div className="panel-h">WORLD PROFILE · explicit dimensions</div>
        {PROFILES.map(x => <button key={x.id} id={`lw-profile-${x.id}`} className="btn" style={{ display: 'block', width: '100%', marginTop: 3, textAlign: 'left', fontSize: 10, opacity: sel.profile === x.id ? 1 : .72 }}
          onClick={() => setSel({ ...sel, profile: x.id })}>{sel.profile === x.id ? '▶ ' : '   '}{x.id} · {x.w}×{x.h} · U={x.U}</button>)}
        <div style={{ color: '#9ae0ff', marginTop: 5, lineHeight: 1.15 }}>{p.note}</div>
        <div style={{ color: '#ffb08a', marginTop: 3 }}>10× linear = 100× cells: 2,000×2,000 = 4,000,000 vs 40,000. Authored U=1 Veyra = 2,000×1,400 = 2,800,000 cells (NOT square, no padded rows).</div>
      </div>
      <div className="panel absolute" style={{ right: 16, top: 62, width: 286, padding: 8, fontSize: 11 }}>
        <div className="panel-h">SCENE · GOLD authoring coordinates</div>
        {SCENES.map((x, i) => <button key={x.id} id={`lw-scene-${i + 1}`} className="btn" style={{ display: 'block', width: '100%', marginTop: 3, textAlign: 'left', fontSize: 10, opacity: sel.scene === x.id ? 1 : .72 }}
          onClick={() => setSel({ ...sel, scene: x.id })}>{sel.scene === x.id ? '▶ ' : '   '}{i + 1}. {x.label.slice(0, 40)}</button>)}
        <div style={{ marginTop: 5, color: '#cfc2dc' }}>seed <input aria-label="seed" type="number" value={sel.seed} onChange={e => setSel({ ...sel, seed: Number(e.target.value) || 1 })} style={{ width: 90, background: '#0e0b14', color: '#fff', border: '1px solid #5a4a6a' }} /> · hours <input aria-label="hours" type="number" step="0.05" value={sel.hours} onChange={e => setSel({ ...sel, hours: Number(e.target.value) || 0 })} style={{ width: 54, background: '#0e0b14', color: '#fff', border: '1px solid #5a4a6a' }} /></div>
      </div>
      <div className="absolute flex flex-col gap-1 items-center" style={{ left: 0, right: 0, bottom: 44 }}>
        <button id="lw-start" className="btn gold" style={{ width: 220, fontSize: 14 }} onClick={() => launch()}>ENTER THE LARGE WORLD</button>
        {hasSave && <button id="lw-continue" className="btn" style={{ width: 220, fontSize: 12 }} onClick={onContinue}>Continue saved global position</button>}
        <div style={{ fontSize: 9, color: '#7a6a8a', textAlign: 'center', maxWidth: 560 }}>
          WASD / arrows move · F3 developer HUD (off by default) · F9 save · Esc menu · native 640×360, TILE=16, original player speed<br />
          Map {SOURCE.mapHead.slice(0, 12)} · Gameplay {SOURCE.gameplayHead.slice(0, 12)} · {SOURCE.activeRevision} · NOT production merge, NOT visual acceptance
        </div>
        {note && <div style={{ color: '#ffb08a', fontSize: 10 }}>{note}</div>}
      </div>
    </div>
  </div>;
}
