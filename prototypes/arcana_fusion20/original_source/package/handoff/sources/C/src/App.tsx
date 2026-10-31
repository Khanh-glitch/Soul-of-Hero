import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, DT } from './engine/stage';
import { SPELLS } from './spells';
import { SCHOOLS, type School } from './engine/palette';

declare global {
  interface Window { __arcana?: { stage: Stage; seek: (i: number, t: number) => void; count: number; list: { name: string; climax: number; dur: number; school: string }[] } }
}

const ORDER: School[] = ['PYRE', 'TIDE', 'TEMPEST', 'VERDANT', 'ASTRAL'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [, setTick] = useState(0);
  const [ui, setUi] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const scrubbing = useRef(false);

  useEffect(() => {
    const cv = canvasRef.current!;
    let stage: Stage;
    try { stage = new Stage(cv); } catch (e) { setErr(String(e)); return; }
    stageRef.current = stage;
    const params = new URLSearchParams(location.search);
    const capture = params.has('capture');
    if (params.has('spell')) stage.cast(Number(params.get('spell')) || 0);
    if (params.has('t')) { stage.seek(Number(params.get('t'))); stage.paused = true; }
    if (capture) setUi(false);
    window.__arcana = {
      stage, count: SPELLS.length,
      list: SPELLS.map((s) => ({ name: s.name, climax: s.climax, dur: s.dur, school: s.school })),
      seek: (i, t) => { stage.paused = true; stage.cast(i); stage.seek(t); stage.draw(); },
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(window.innerWidth * dpr); cv.height = Math.floor(window.innerHeight * dpr);
      stage.draw();
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (!scrubbing.current) stage.tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setTick((v) => v + 1), 90);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); window.removeEventListener('resize', resize); };
  }, []);

  const S = stageRef.current;
  const act = useCallback((fn: (s: Stage) => void) => { const s = stageRef.current; if (s) { fn(s); setTick((v) => v + 1); } }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stageRef.current; if (!s) return;
      if (e.key === ' ') { e.preventDefault(); s.paused = !s.paused; }
      else if (e.key === 'r' || e.key === 'R') { s.cast(s.idx); s.paused = false; }
      else if (e.key === 'ArrowRight') s.cast(s.idx + 1);
      else if (e.key === 'ArrowLeft') s.cast(s.idx - 1);
      else if (e.key === '.') { s.paused = true; s.step(); }
      else if (e.key === ',') { s.paused = true; s.seek(s.t - DT * 1.5); }
      else if (e.key === 'c' || e.key === 'C') { s.paused = true; s.seek(s.spell.climax); }
      else if (e.key === 'h' || e.key === 'H') setUi((v) => !v);
      else if (e.key === 's' || e.key === 'S') { s.showcase = !s.showcase; if (s.showcase) { s.paused = false; s.cast(s.idx); } }
      else if (e.key === '1') s.speed = 0.25;
      else if (e.key === '2') s.speed = 0.5;
      else if (e.key === '3') s.speed = 1;
      setTick((v) => v + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const spell = S ? S.spell : SPELLS[0];
  const sc = SCHOOLS[spell.school];
  const prog = S ? Math.min(1, S.t / spell.dur) : 0;

  const scrubTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    act((s) => { s.paused = true; s.seek(u * s.spell.dur); s.draw(); });
  };

  return (
    <div className="fixed inset-0 bg-[#030207] overflow-hidden select-none" style={{ fontFamily: "'Silkscreen', ui-monospace, monospace" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
      {err && <div className="absolute inset-0 flex items-center justify-center text-red-300 text-sm p-8">Renderer error: {err}</div>}
      {ui && S && (
        <>
          <div className="absolute top-3 left-4 pointer-events-none">
            <div className="text-[11px] tracking-[0.4em] text-white/35">ARCANA · PIXEL MAGIC LAB</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-2xl" style={{ color: sc.color, textShadow: `0 0 18px ${sc.color}66` }}>{pad(spell.id)}</span>
              <span className="text-xl text-white/90 tracking-wider">{spell.name.toUpperCase()}</span>
              <span className="text-[10px] tracking-[0.3em] px-1.5 py-0.5 border" style={{ color: sc.color, borderColor: sc.color + '55' }}>{sc.name.toUpperCase()}</span>
            </div>
            <div className="mt-1 max-w-[520px] text-[11px] leading-snug text-white/45 font-sans">{spell.blurb}</div>
          </div>
          {S.showcase && <div className="absolute top-4 right-4 text-[10px] tracking-[0.3em] text-amber-200/70 animate-pulse">● SHOWCASE {pad(S.idx + 1)}/20</div>}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(960px,96vw)] flex flex-col gap-2">
            <div className="flex gap-2 justify-center">
              {ORDER.map((sch) => (
                <div key={sch} className="flex flex-col items-center gap-1 px-1.5 py-1 bg-black/40 backdrop-blur-[2px] border border-white/5">
                  <div className="text-[8px] tracking-[0.35em]" style={{ color: SCHOOLS[sch].color + 'cc' }}>{SCHOOLS[sch].name.toUpperCase()}</div>
                  <div className="flex gap-1">
                    {SPELLS.map((sp, i) => sp.school !== sch ? null : (
                      <button key={i} title={sp.name} onClick={() => act((s) => { s.showcase = false; s.paused = false; s.cast(i); })}
                        className="w-9 h-7 text-[10px] border transition-colors"
                        style={{ color: S.idx === i ? '#000' : SCHOOLS[sch].color, background: S.idx === i ? SCHOOLS[sch].color : 'transparent', borderColor: SCHOOLS[sch].color + (S.idx === i ? 'ff' : '44') }}>
                        {pad(sp.id)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-black/45 backdrop-blur-[2px] border border-white/5 px-2 py-1.5 text-[10px] text-white/70">
              <Btn onClick={() => act((s) => s.cast(s.idx - 1))}>◀◀</Btn>
              <Btn onClick={() => act((s) => (s.paused = !s.paused))}>{S.paused ? '▶' : '❚❚'}</Btn>
              <Btn onClick={() => act((s) => { s.cast(s.idx); s.paused = false; })}>↻</Btn>
              <Btn onClick={() => act((s) => s.cast(s.idx + 1))}>▶▶</Btn>
              <Btn onClick={() => act((s) => { s.paused = true; s.step(); })}>+1F</Btn>
              <div className="relative flex-1 h-4 cursor-pointer group"
                onPointerDown={(e) => { scrubbing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e); }}
                onPointerMove={(e) => { if (scrubbing.current) scrubTo(e); }}
                onPointerUp={() => { scrubbing.current = false; }}>
                <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-[3px] bg-white/10" />
                <div className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px]" style={{ width: `${prog * 100}%`, background: sc.color }} />
                <div className="absolute top-0 bottom-0 w-[2px] bg-white/60" style={{ left: `${(spell.climax / spell.dur) * 100}%` }} title="climax" />
                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-3" style={{ left: `calc(${prog * 100}% - 4px)`, background: '#fff' }} />
              </div>
              <span className="w-20 text-right tabular-nums text-white/50">{S.t.toFixed(2)}s / {spell.dur.toFixed(1)}</span>
              <Btn onClick={() => act((s) => { s.paused = true; s.seek(s.spell.climax); s.draw(); })}>CLIMAX</Btn>
              {[0.25, 0.5, 1].map((v) => (
                <Btn key={v} active={S.speed === v} onClick={() => act((s) => (s.speed = v))}>{v === 1 ? '1×' : v === 0.5 ? '½×' : '¼×'}</Btn>
              ))}
              <Btn active={S.loop} onClick={() => act((s) => (s.loop = !s.loop))}>LOOP</Btn>
              <Btn active={S.showcase} onClick={() => act((s) => { s.showcase = !s.showcase; if (s.showcase) { s.paused = false; s.cast(s.showcase ? s.idx : s.idx); } })}>SHOWCASE</Btn>
              <Btn onClick={() => setUi(false)}>HIDE</Btn>
            </div>
            <div className="text-center text-[9px] tracking-widest text-white/25">SPACE pause · R replay · ←/→ spell · ,/. frame step · C climax · 1/2/3 speed · S showcase · H toggle ui</div>
          </div>
        </>
      )}
      {!ui && !err && !new URLSearchParams(location.search).has('capture') && (
        <button onClick={() => setUi(true)} className="absolute bottom-3 right-3 text-[9px] tracking-widest text-white/25 hover:text-white/60">SHOW UI (H)</button>
      )}
    </div>
  );
}

function Btn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`px-2 py-0.5 border transition-colors ${active ? 'border-white/60 text-white bg-white/10' : 'border-white/10 hover:border-white/40 hover:text-white'}`}>
      {children}
    </button>
  );
}
