import { useEffect, useRef, useState } from 'react';
import { EFFECTS } from './effects';
import { makeRenderer, renderFrame } from './engine/scene';
import { W, H } from './engine/renderer';
import { Presenter } from './engine/gl';
import type { School } from './engine/fx';

const SCHOOLS: { id: School; color: string; glyph: string }[] = [
  { id: 'PYRE', color: '#ff7a2a', glyph: '△' },
  { id: 'TIDE', color: '#4cc8ff', glyph: '◇' },
  { id: 'TEMPEST', color: '#9f8cff', glyph: 'ϟ' },
  { id: 'VERDANT', color: '#6ee36a', glyph: '✣' },
  { id: 'ASTRAL', color: '#ff5ad8', glyph: '✦' },
];
const SPEEDS = [0.1, 0.25, 0.5, 1];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showcase, setShowcase] = useState(false);
  const [time, setTime] = useState(0);
  const [hud, setHud] = useState(true);
  const st = useRef({ t: 0, idx: 0, playing: true, speed: 1, showcase: false, scrub: -1, state: null as any, reset: true, target: null as null | { x: number; y: number }, hold: 0 });

  useEffect(() => { st.current.playing = playing; }, [playing]);
  useEffect(() => { st.current.speed = speed; }, [speed]);
  useEffect(() => { st.current.showcase = showcase; }, [showcase]);
  useEffect(() => { st.current.idx = idx; st.current.reset = true; }, [idx]);

  useEffect(() => {
    const cv = canvasRef.current!;
    const r = makeRenderer();
    const rgba = new Uint8ClampedArray(W * H * 4);
    let pres: Presenter | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    let img: ImageData | null = null;
    const fit = () => {
      const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, (window.innerHeight - 8) / H)));
      const sf = Math.min(window.innerWidth / W, window.innerHeight / H) < 1.5 ? Math.min(window.innerWidth / W, window.innerHeight / H) : s;
      cv.width = W * Math.ceil(sf);
      cv.height = H * Math.ceil(sf);
      cv.style.width = `${W * sf}px`;
      cv.style.height = `${H * sf}px`;
    };
    fit();
    try { pres = new Presenter(cv); } catch {
      ctx2d = cv.getContext('2d');
      img = new ImageData(W, H);
    }
    window.addEventListener('resize', fit);
    let raf = 0, last = performance.now(), wall = 0, uiTick = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      wall += dt;
      const S = st.current;
      const fx = EFFECTS[S.idx];
      if (S.reset) {
        if (S.target) r.target = { ...S.target };
        else r.target = { x: 262, y: 104 };
        S.state = fx.setup(r);
        S.t = 0;
        S.reset = false;
        S.hold = 0;
      }
      if (S.scrub >= 0) { S.t = S.scrub; S.scrub = -1; }
      else if (S.playing) {
        S.t += dt * S.speed;
        if (S.t > fx.duration + 0.8) {
          if (S.showcase) {
            S.idx = (S.idx + 1) % EFFECTS.length;
            setIdx(S.idx);
            S.reset = true;
          } else S.t = fx.duration + 0.8;
        }
      }
      renderFrame(r, fx, S.state, S.t, wall, rgba);
      if (pres) pres.present(rgba);
      else if (ctx2d && img) {
        img.data.set(rgba);
        const off = new OffscreenCanvas(W, H);
        off.getContext('2d')!.putImageData(img, 0, 0);
        ctx2d.imageSmoothingEnabled = false;
        ctx2d.drawImage(off, 0, 0, cv.width, cv.height);
      }
      if (++uiTick % 4 === 0) setTime(S.t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, []);

  const fx = EFFECTS[idx];
  const school = SCHOOLS.find((s) => s.id === fx.school)!;
  const replay = () => { st.current.reset = true; setPlaying(true); };
  const pick = (i: number) => { setIdx(i); st.current.reset = true; setPlaying(true); };
  const scrub = (v: number) => { st.current.scrub = v; setPlaying(false); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.key !== ' ') return;
      const S = st.current;
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'r' || e.key === 'Enter') replay();
      else if (e.key === 'ArrowRight') pick((S.idx + 1) % EFFECTS.length);
      else if (e.key === 'ArrowLeft') pick((S.idx + EFFECTS.length - 1) % EFFECTS.length);
      else if (e.key === '.') { setPlaying(false); S.scrub = S.t + 1 / 60; }
      else if (e.key === ',') { setPlaying(false); S.scrub = Math.max(0, S.t - 1 / 60); }
      else if (e.key === 'c') { setPlaying(false); S.scrub = EFFECTS[S.idx].climax; }
      else if (e.key === 's') setShowcase((v) => !v);
      else if (e.key === 'h') setHud((v) => !v);
      else if (e.key >= '1' && e.key <= '4') setSpeed(SPEEDS[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W, y = ((e.clientY - rect.top) / rect.height) * H;
    st.current.target = { x, y };
    replay();
  };

  return (
    <div className="fixed inset-0 bg-[#05040a] text-[#cfc8e8] select-none overflow-hidden font-mono">
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas ref={canvasRef} onClick={onCanvasClick} className="cursor-crosshair" style={{ imageRendering: 'pixelated' }} />
      </div>

      {hud && (
        <>
          <div className="absolute top-3 left-4 pointer-events-none">
            <div className="text-[10px] tracking-[0.5em] text-[#6d6590]">ARCANA · PIXEL MAGIC LABORATORY</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-xs" style={{ color: school.color }}>{school.glyph} {fx.school} · {String(fx.id).padStart(2, '0')}</span>
              <span className="text-xl tracking-wide text-white drop-shadow">{fx.name}</span>
            </div>
            <div className="mt-1 max-w-md text-[11px] leading-snug text-[#9a92bb]">{fx.blurb}</div>
          </div>

          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent pt-8 pb-3 px-4">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setPlaying((p) => !p)} className="w-8 h-7 border border-white/15 hover:border-white/40 text-xs" title="Space">{playing ? '❚❚' : '▶'}</button>
              <button onClick={replay} className="px-2 h-7 border border-white/15 hover:border-white/40 text-xs" title="R">↻ cast</button>
              <button onClick={() => scrub(fx.climax)} className="px-2 h-7 border border-white/15 hover:border-white/40 text-xs" title="C">climax</button>
              <input type="range" min={0} max={fx.duration} step={0.001} value={Math.min(time, fx.duration)} onChange={(e) => scrub(Number(e.target.value))}
                className="flex-1 accent-[#b9a6ff] h-1" />
              <span className="text-[11px] tabular-nums w-24 text-right text-[#8f88ad]">{Math.min(time, fx.duration).toFixed(2)} / {fx.duration.toFixed(1)}s</span>
              <div className="flex">
                {SPEEDS.map((s, i) => (
                  <button key={s} onClick={() => setSpeed(s)} title={String(i + 1)} className={`px-1.5 h-7 text-[10px] border border-white/10 ${speed === s ? 'bg-white/15 text-white' : 'text-[#8f88ad]'}`}>{s}×</button>
                ))}
              </div>
              <button onClick={() => { setShowcase((v) => !v); if (!showcase) pick(0); }} className={`px-2 h-7 text-xs border ${showcase ? 'border-[#ff5ad8] text-[#ff9ae8]' : 'border-white/15'}`} title="S">✦ showcase</button>
            </div>
            <div className="flex gap-4 flex-wrap">
              {SCHOOLS.map((sc) => (
                <div key={sc.id} className="flex items-center gap-1">
                  <span className="text-[10px] w-16 tracking-widest" style={{ color: sc.color }}>{sc.glyph} {sc.id}</span>
                  {EFFECTS.map((e, i) => e.school !== sc.id ? null : (
                    <button key={e.id} onClick={() => pick(i)} title={e.name}
                      className="h-7 px-1.5 text-[10px] border transition-colors"
                      style={{ borderColor: i === idx ? sc.color : 'rgba(255,255,255,0.1)', color: i === idx ? '#fff' : '#9a92bb', background: i === idx ? sc.color + '33' : 'transparent' }}>
                      {String(e.id).padStart(2, '0')} <span className="hidden xl:inline">{e.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[9px] text-[#5d5680]">space pause · R cast · ←/→ spell · , . frame step · C climax · 1-4 speed · S showcase · H hide UI · click arena to retarget</div>
          </div>
        </>
      )}
      {!hud && <button onClick={() => setHud(true)} className="absolute bottom-2 right-3 text-[10px] text-[#5d5680]">H</button>}
    </div>
  );
}
