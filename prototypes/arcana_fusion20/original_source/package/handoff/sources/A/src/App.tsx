import { useEffect, useRef, useState, useCallback } from "react";
import { Lab, DT } from "./engine/lab";
import { VIEW_W, VIEW_H } from "./engine/arena";
import { SPELLS } from "./spells";
import { SCHOOL_META, School, SpellDef } from "./engine/types";

const SCHOOLS: School[] = ["PYRE", "TIDE", "TEMPEST", "VERDANT", "ASTRAL"];
const ROMAN = ["I", "II", "III", "IV", "V"];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labRef = useRef<Lab | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [showcase, setShowcase] = useState(false);
  const [ui, setUi] = useState(true);
  const [foes, setFoes] = useState(true);
  const [fps, setFps] = useState(60);
  const stateRef = useRef({ idx, playing, speed, showcase });
  stateRef.current = { idx, playing, speed, showcase };

  const def: SpellDef = SPELLS[idx];

  // --- boot
  useEffect(() => {
    const lab = new Lab();
    labRef.current = lab;
    lab.load(SPELLS[0]);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0;
    let last = performance.now();
    let acc = 0,
      frames = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc += dt;
      frames++;
      if (acc > 0.5) {
        setFps(Math.round(frames / acc));
        acc = 0;
        frames = 0;
      }
      const s = stateRef.current;
      if (s.playing) {
        const before = lab.t;
        lab.advance(dt);
        if (s.showcase && lab.t < before) {
          // wrapped: advance to the next spell in the showcase
          const next = (s.idx + 1) % SPELLS.length;
          setIdx(next);
          lab.load(SPELLS[next]);
        }
      }
      lab.render(ctx);
      setTime(lab.t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- spell switching
  useEffect(() => {
    labRef.current?.load(SPELLS[idx]);
  }, [idx]);

  useEffect(() => {
    if (labRef.current) labRef.current.speed = speed;
  }, [speed]);

  const replay = useCallback(() => {
    labRef.current?.reset();
    setPlaying(true);
  }, []);

  const scrub = (v: number) => {
    labRef.current?.seek(v);
    setTime(v);
  };

  // --- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "r" || e.key === "R") replay();
      else if (e.key === "ArrowRight") setIdx((i) => (i + 1) % SPELLS.length);
      else if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + SPELLS.length) % SPELLS.length);
      else if (e.key === "." ) { labRef.current?.stepFrame(1); setPlaying(false); }
      else if (e.key === ",") { labRef.current?.stepFrame(-1); setPlaying(false); }
      else if (e.key === "h" || e.key === "H") setUi((u) => !u);
      else if (e.key === "c" || e.key === "C") {
        const lab = labRef.current!;
        lab.seek(SPELLS[stateRef.current.idx].duration * SPELLS[stateRef.current.idx].climax);
        setPlaying(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay]);

  const meta = SCHOOL_META[def.school];

  return (
    <div className="w-screen h-screen bg-[#07070b] text-[#c9c7d6] font-mono overflow-hidden flex flex-col select-none">
      {/* stage */}
      <div className="flex-1 min-h-0 flex">
        {ui && (
          <aside className="w-[232px] shrink-0 border-r border-white/10 overflow-y-auto bg-[#0a0a10]">
            <div className="px-3 py-3 border-b border-white/10">
              <div className="text-[15px] tracking-[0.42em] text-white/90">ARCANA</div>
              <div className="text-[9px] tracking-[0.2em] text-white/35 mt-1">
                PIXEL MAGIC LABORATORY
              </div>
            </div>
            {SCHOOLS.map((s, si) => (
              <div key={s}>
                <div
                  className="px-3 pt-3 pb-1 text-[9px] tracking-[0.25em] flex items-baseline gap-2"
                  style={{ color: SCHOOL_META[s].color }}
                >
                  <span className="opacity-60">{ROMAN[si]}</span>
                  <span>{s}</span>
                </div>
                <div className="px-3 pb-1 text-[8px] text-white/25 leading-tight">
                  {SCHOOL_META[s].blurb}
                </div>
                {SPELLS.filter((p) => p.school === s).map((p) => {
                  const active = p.id === def.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setIdx(SPELLS.indexOf(p));
                        setPlaying(true);
                      }}
                      className={`w-full text-left px-3 py-[5px] text-[11px] flex gap-2 items-center transition-colors ${
                        active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className="w-[3px] h-[13px] shrink-0"
                        style={{
                          background: active ? SCHOOL_META[s].color : "transparent",
                        }}
                      />
                      <span className="tabular-nums opacity-45 text-[9px]">
                        {String(p.id).padStart(2, "0")}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="px-3 py-4 text-[8px] leading-relaxed text-white/25 border-t border-white/10 mt-3">
              SPACE play/pause · R replay · ←/→ spell · , . frame step (incl. hit-stop) · C climax · H hide UI
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 flex items-center justify-center bg-[#050507] relative">
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            className="max-w-full max-h-full"
            style={{
              imageRendering: "pixelated",
              width: "min(100%, calc((100vh - 150px) * 1.7777))",
              aspectRatio: `${VIEW_W} / ${VIEW_H}`,
              boxShadow: "0 0 70px rgba(0,0,0,0.9)",
            }}
          />
          {ui && (
            <div className="absolute top-3 left-4 pointer-events-none">
              <div className="text-[10px] tracking-[0.3em]" style={{ color: meta.color }}>
                {def.school} · {String(def.id).padStart(2, "0")}
              </div>
              <div className="text-[19px] text-white/90 tracking-wide -mt-0.5">{def.name}</div>
              <div className="text-[10px] text-white/40 max-w-[460px] leading-snug mt-1">
                {def.tagline}
              </div>
            </div>
          )}
          {ui && (
            <div className="absolute top-3 right-4 text-[9px] text-white/25 text-right pointer-events-none">
              <div>{fps} FPS</div>
              <div>
                {VIEW_W}×{VIEW_H} · 22-STEP DITHER
              </div>
              <div>{showcase ? "SHOWCASE RUNNING" : ""}</div>
            </div>
          )}
        </main>
      </div>

      {/* transport */}
      {ui && (
        <div className="h-[68px] shrink-0 border-t border-white/10 bg-[#0a0a10] px-4 flex items-center gap-4">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="w-[70px] text-[11px] py-1.5 border border-white/20 hover:bg-white/10"
          >
            {playing ? "❚❚ PAUSE" : "▶ PLAY"}
          </button>
          <button
            onClick={replay}
            className="text-[11px] py-1.5 px-3 border border-white/20 hover:bg-white/10"
          >
            ↺ REPLAY
          </button>
          <button
            onClick={() => {
              const lab = labRef.current!;
              lab.seek(def.duration * def.climax);
              setPlaying(false);
            }}
            className="text-[11px] py-1.5 px-3 border border-white/20 hover:bg-white/10"
          >
            ✦ CLIMAX
          </button>
          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={def.duration}
              step={DT}
              value={time}
              onChange={(e) => {
                setPlaying(false);
                scrub(parseFloat(e.target.value));
              }}
              className="w-full accent-white/70"
            />
            <div className="text-[10px] tabular-nums text-white/45 w-[86px] text-right">
              {time.toFixed(2)} / {def.duration.toFixed(2)}s
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[0.25, 0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-[10px] px-2 py-1 border ${
                  speed === s ? "border-white/60 text-white" : "border-white/15 text-white/40"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const v = !foes;
              setFoes(v);
              if (labRef.current) labRef.current.showEnemies = v;
            }}
            className={`text-[11px] py-1.5 px-3 border ${
              foes ? "border-white/60 text-white" : "border-white/20 text-white/50"
            } hover:bg-white/10`}
          >
            ☗ ENEMIES
          </button>
          <button
            onClick={() => {
              setShowcase((v) => !v);
              setPlaying(true);
            }}
            className={`text-[11px] py-1.5 px-3 border ${
              showcase ? "border-white/60 text-white" : "border-white/20 text-white/50"
            } hover:bg-white/10`}
          >
            ⛶ SHOWCASE
          </button>
        </div>
      )}
    </div>
  );
}
