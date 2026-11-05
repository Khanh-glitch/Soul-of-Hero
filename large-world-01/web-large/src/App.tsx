/**
 * LW-01 App root. Keeps the original SOH 640×360 stage and GameRoot controls,
 * but uses the new dimension-agnostic large-world runtime. The untouched
 * 200×200 app lives in ../web-legacy and is served separately.
 */
import { useEffect, useRef, useState } from 'react';
import { getArt } from './game/art';
import { resetRenderCaches, cam } from './game/render';
import { setCellCap } from './game/world-economy';
import { LargeWorldRuntime, PROFILE_IDS, type LwRun } from './game/large/runtime';
import { profileById, PROFILES, SCENES, SOURCE } from './game/large/profile';
import { inspectLegacySaves, validateLwSave } from './game/large/state';
import Title from './ui/Title';
import GameLarge from './ui/GameLarge';

export interface LaunchOpts { profile: string; scene: string; seed: number; hours: number; autostart: boolean; hud: boolean; cam: [number, number] | null; saved: any | null }
function parseLaunch(): LaunchOpts {
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed')) || 20261105;
  const hours = Math.max(0, Math.min(24, Number(q.get('hours')) || 0));
  const c = q.get('cam');
  return {
    profile: q.get('profile') || 'veyra-u1',
    scene: q.get('scene') || 'beacon',
    seed, hours,
    autostart: q.get('autostart') === '1',
    hud: q.get('hud') === '1',
    cam: c ? (c.split(',').map(Number) as [number, number]) : null,
    saved: q.get('fresh') === '1' ? null : LargeWorldRuntime.readSave(),
  };
}

export default function App() {
  const optsRef = useRef<LaunchOpts>(parseLaunch());
  const [screen, setScreen] = useState<'title' | 'game'>(optsRef.current.autostart ? 'game' : 'title');
  const [runtime, setRuntime] = useState<LargeWorldRuntime | null>(null);
  const [sel, setSel] = useState({ profile: optsRef.current.profile, scene: optsRef.current.scene, seed: optsRef.current.seed, hours: optsRef.current.hours });
  const [note, setNote] = useState<string | null>(null);

  const make = (o: { profile: string; scene: string; seed: number; hours: number; cam?: [number, number] | null; saved?: any | null }) => {
    getArt();
    const p = profileById(o.profile);
    setCellCap(p.w, p.h);
    resetRenderCaches(); cam.init = false;
    const rt = new LargeWorldRuntime(o.profile, o.scene, o.seed, o.hours, o.saved ?? null);
    if (o.cam) {
      rt.run.player.x = o.cam[0] * 16 + 8; rt.run.player.y = o.cam[1] * 16 + 8;
      rt.chunks.updateWindow(o.cam[0], o.cam[1]);
    }
    rt.devHud = optsRef.current.hud;
    setRuntime(rt);
    (window as any).__lw = {
      runtime: rt, gs: rt.gs, run: rt.run, cam,
      inspect: () => rt.inspect(),
      metrics: () => ({ ...rt.metrics }),
      save: () => rt.writeSave(),
      readSave: () => LargeWorldRuntime.readSave(),
      validateSave: () => rt.validateSave(),
      harvest: (tx: number, ty: number) => rt.harvestAt(tx, ty),
      place: (tx: number, ty: number, id: string) => rt.placeAt(tx, ty, id),
      nearestSource: () => rt.nearestSource(),
      setHours: (h: number) => rt.setHours(h),
      setHud: (v: boolean) => { rt.devHud = v; },
      profile: () => ({ id: p.id, w: p.w, h: p.h, U: p.U, cells: p.w * p.h, kind: p.kind }),
      source: SOURCE,
      profiles: PROFILES.map(x => ({ id: x.id, w: x.w, h: x.h, U: x.U, kind: x.kind })),
      scenes: SCENES.map(x => ({ id: x.id, atAu: x.atAu, label: x.label })),
      legacy: () => inspectLegacySaves(),
      offline: () => rt.offlineCatchUp,
      catchUp: (advanceMs: number) => rt.sim.catchUp(rt.durable.simMs + advanceMs),
      scheduleRegrow: (id: string, x: number, y: number, delayMs: number) => rt.sim.scheduleRegrow(id, { x, y }, delayMs),
      saveErrors: () => { const s = LargeWorldRuntime.readSave(); return s ? validateLwSave(s, p) : ['NO_SAVE']; },
    };
    return rt;
  };

  useEffect(() => {
    if (screen === 'game' && !runtime) make({ ...optsRef.current, cam: optsRef.current.cam, saved: optsRef.current.saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  if (screen === 'title' || !runtime) {
    return <Title opts={optsRef.current} sel={sel} setSel={setSel} note={note}
      hasSave={!!optsRef.current.saved}
      onStart={(o) => { optsRef.current = { ...optsRef.current, ...o, autostart: true }; make({ ...o, saved: null }); setScreen('game'); }}
      onContinue={() => { const s = LargeWorldRuntime.readSave(); if (!s) { setNote('No LW-01 save found.'); return; }
        optsRef.current = { ...optsRef.current, profile: s.profileId, seed: s.seed, autostart: true };
        make({ profile: s.profileId, scene: sel.scene, seed: s.seed, hours: 0, saved: s }); setScreen('game'); }}
    />;
  }
  return <GameLarge runtime={runtime} onExit={() => { setRuntime(null); setScreen('title'); }} />;
}
