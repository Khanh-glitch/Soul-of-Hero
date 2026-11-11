import React, { useEffect, useState } from 'react';
import { BAL, TILE, WW, type Entity, type GameState, type RunState, type Creature } from '../game/core';
import { ITEMS, ELDERS, lookupElderDef, CREATURES, STRUCTS } from '../game/catalog';
import { C, countItem, runHours, phaseOf, isRagnarok } from '../game/engine';
import { activeStack } from '../game/sim';
import { airdropView } from '../game/airdrop';
import { getArt } from '../game/art';
import { Icon, Panel, type Api } from './common';
import { Glyph } from './hud';
import { QA_PRESETS, type QaPresetId } from '../game/qa-sandbox';
import { deathBagView } from '../game/death-view';

// ============================================================================
// 1. ELDER BOSS ENCOUNTER HUD — bespoke telemetry & readable attack telegraphs
// ============================================================================
const ELDER_META: Record<string, { domain: string; emblem: string; trait: string }> = {
  frost: { domain: 'GLACIAL CROWN', emblem: '❄', trait: 'Freezing rings & ice pillar cages' },
  magma: { domain: 'CALDERA CORE', emblem: '♨', trait: 'Triple magma fissures & meteor bombardment' },
  bog: { domain: 'DROWNED MIRE', emblem: '☣', trait: 'Toxic pools, brood summons & subterranean dive' },
  grove: { domain: 'FIRST WOOD', emblem: '♣', trait: 'Root cages & heals by draining living trees' },
  tide: { domain: 'BREAKING SHORE', emblem: '≈', trait: 'Tidal waves, whirlpools & high-speed surges' },
  rust: { domain: 'DEAD FOUNDRY', emblem: '⚙', trait: 'Sweeping foundry beams & overheating vents' },
  surtur: { domain: 'MUSPELHEIM RIFT', emblem: '♨', trait: 'Primordial magma fissures & meteorstorms' },
  typhon: { domain: 'ABYSSAL GULF', emblem: '≈', trait: 'Primordial maelstroms & pressure surges' },
  elderwood: { domain: 'HEART OF THE WILD', emblem: '♣', trait: 'Primordial root cages & timber siphon' },
  gate: { domain: 'FROST CITADEL', emblem: '❄', trait: 'Primordial shard storms & ice pillars' },
  hall_eyes: { domain: 'SUNKEN MIRE', emblem: '☣', trait: 'Primordial acid pools & brood swarms' },
  necropolis: { domain: 'IRON NECROPOLIS', emblem: '⚙', trait: 'Primordial foundry beams & vents' },
};

const PATTERN_HINT: Record<string, string> = {
  shardFan: 'ICE SHARD FAN — sidestep between needles',
  shardSpiral: 'GLACIAL SPIRAL — circle wide',
  frostRing: 'EXPANDING FROST RING — roll through the edge',
  icePillars: 'ICE PILLAR RING — step out before freeze',
  fissure: 'MAGMA FISSURE — clear the line',
  fissureTriple: 'TRIPLE FISSURE — move perpendicular',
  slam: 'SEISMIC SLAM — back out of melee radius',
  meteors: 'METEOR RAIN — keep moving',
  spitPools: 'ACID MIRE POOLS — avoid toxic ground',
  brood: 'SUMMONING MIRE BROOD',
  submerge: 'SUBMERGING — watch the ripples',
  dive: 'DEEP DIVE — watch for emergence',
  tongueSweep: 'SWEEPING LASH — roll inside or out',
  rootLine: 'CREEPING ROOTS — sidestep the line',
  seedBombs: 'SPORE BOMBS — clear the blast circles',
  rootCage: 'ROOT CAGE — find the open gap!',
  drainTrees: 'DRAINING TREES — fell nearby timber to deny heal!',
  spit: 'PRESSURE JET — strafe',
  wave: 'TIDAL WAVE — roll across the crest',
  whirl: 'WHIRLPOOL PULL — sprint against the current',
  beam: 'FOUNDRY BEAM — break line of sight',
  beamSweep: 'SWEEPING BEAM — stay ahead of the arc',
  mines: 'PROXIMITY MINES — keep distance',
  overload: 'VENTING HEAT — STRIKE NOW (2× DMG)!',
};

export function ElderBossHUD({ m }: { m: Creature }) {
  const e = m.elder;
  const elderDef = e ? lookupElderDef(e.key) : undefined;
  const creDef = CREATURES[m.type];
  if (!elderDef && !creDef) return null;
  const color = elderDef?.color || (creDef as any)?.color || '#f0a060';
  const name = elderDef?.name || creDef?.name || m.type;
  const subtitle = elderDef ? `${elderDef.title} · ${elderDef.region}` : 'Regional Side Boss · Veyra';
  const meta = (e && ELDER_META[e.key]) || { domain: e ? 'PRIMORDIAL' : 'SIDE BOSS', emblem: e ? '★' : '⚔', trait: e ? 'Ancient guardian awakened' : 'Signature combat telegraphs — watch the windup' };
  const pct = Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
  const vuln = (m.atk?.vuln ?? 0) > 0;
  const telling = m.state === 'tell' && m.atk?.pat;
  const cue = vuln
    ? 'OVERHEATED · EXPOSED CORE (2× DAMAGE)'
    : telling
      ? (PATTERN_HINT[m.atk!.pat] || m.atk!.pat.toUpperCase())
      : meta.trait;

  return (
    <div className="plate fadein" style={{ width: 296, padding: '4px 7px', borderColor: vuln ? 'var(--brassLit)' : color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 11, color, textShadow: '0 0 6px currentColor' }}>{meta.emblem}</span>
        <div style={{ lineHeight: 1.05 }}>
          <div className="lbl" style={{ fontSize: 10, color, fontWeight: 700 }}>{name}</div>
          <div className="lbl" style={{ fontSize: 7, color: 'var(--muted)' }}>{subtitle}</div>
        </div>
        <span className="chip" style={{ marginLeft: 'auto', color: (!e || e.awake) ? 'var(--bad)' : 'var(--brassLit)' }}>
          {!e ? 'GUARDIAN' : e.awake ? 'AWAKENED' : 'LATENT'}
        </span>
      </div>
      <div className="track" style={{ height: 7, marginTop: 3, background: '#05070a', position: 'relative', boxShadow: 'inset 0 0 0 1px #000, 0 0 0 1px var(--edge)' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: vuln ? 'linear-gradient(90deg, #ffe27a, #ff9a3a)' : `linear-gradient(90deg, ${color}, #7a1c14)`, transition: 'width 160ms linear' }} />
        <div className="seg" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0 23px, rgba(0,0,0,.65) 23px 24px)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <span className="lbl" style={{ fontSize: 8, color: vuln ? 'var(--brassLit)' : telling ? 'var(--warn)' : 'var(--muted)', fontWeight: vuln || telling ? 700 : 400 }}>
          {cue}
        </span>
        <span className="lbl" style={{ fontSize: 8, color: 'var(--paper)', marginLeft: 4, flex: 'none' }}>
          {Math.ceil(m.hp)}/{m.maxHp}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 2. RAGNAROK TACTICAL STRIP — urgency, clock & custody clarity (final 72h)
// ============================================================================
export function RagnarokStrip({ r, now, secured }: { r: RunState; now: number; secured: number }) {
  if (!isRagnarok(r, now)) return null;
  const hrs = runHours(r, now);
  const ph = phaseOf(r, now);
  const rem = Math.max(0, BAL.run.maxRunHours - hrs);
  const toAwake = Math.max(0, 312 - hrs);
  const held = countItem(r, 'inv', 'rcash');
  return (
    <div className="plate fadein" style={{ padding: '3px 6px', width: 178, borderColor: 'var(--bad)' }}>
      <div className="lbl" style={{ fontSize: 9, color: 'var(--bad)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="lamp diamond pulse" style={{ color: 'var(--bad)' }} />
        <b>{ph === 'awakening' ? 'DAY 14 · ELDERS AWAKE' : 'RAGNAROK · FINAL 72H'}</b>
      </div>
      <div className="lbl" style={{ fontSize: 8, color: 'var(--paper)', marginTop: 1 }}>
        {rem.toFixed(1)}h until collapse{toAwake > 0 ? ` · ${toAwake.toFixed(1)}h to Dawn 14` : ''}
      </div>
      <div className="lbl" style={{ fontSize: 8, marginTop: 1, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: held > 0 ? 'var(--warn)' : 'var(--muted)' }}>At risk: <b>{held}</b></span>
        <span style={{ color: 'var(--info)' }}>Secured: <b>{secured}</b></span>
        <span style={{ color: 'var(--brassLit)' }}>Stones {r.elderStones.length}/6</span>
      </div>
    </div>
  );
}

// ============================================================================
// 3. CREATOR CORE DISCOVERY CARD & LIVE RESERVE BAR
// ============================================================================
const CORE_MODES: Record<string, { tier: string; essence: string; col: string; b: string; q: string; e: string }> = {
  core_blast: { tier: 'COMMON CORE', essence: 'FIRE', col: '#ff8a3a', b: 'Igniting bolt', q: 'Timed blast bomb', e: 'Heavy explosion' },
  core_meteor: { tier: 'RARE CORE', essence: 'FIRE', col: '#ff6a2a', b: 'Fireball', q: 'Targeted meteor', e: 'Ten-meteor storm' },
  core_dragon: { tier: 'MYTHIC CORE', essence: 'FIRE', col: '#ffb84a', b: 'Dragon flame', q: 'Vortex fire tornado', e: 'Sky dragon dive' },
  core_elsa: { tier: 'RARE CORE', essence: 'WATER', col: '#7fd8ff', b: 'Glacial lance', q: '1s self-ice ward', e: 'Freeze all in view' },
  core_earthmother: { tier: 'COMMON CORE', essence: 'NATURE', col: '#8fd45a', b: 'Shatter rock', q: 'Raise living grove', e: 'Binding root snare' },
  core_mjolnir: { tier: 'RARE CORE', essence: 'STORM', col: '#9fc4e0', b: 'Chain thunder', q: 'Five sky bolts', e: 'Magnetic storm pull' },
  core_demon: { tier: 'RARE CORE', essence: 'SPIRIT', col: '#d89aff', b: 'Void ray', q: 'Stationary spirit beam', e: 'Map-anchored blink' },
};

export function CoreDiscoveryCard({ coreKey, onClose }: { coreKey: string; onClose: () => void }) {
  const d = ITEMS[coreKey];
  const m = CORE_MODES[coreKey];
  if (!d || !m) return null;
  return (
    <div className="plate fadein" onClick={onClose} style={{ width: 256, padding: '6px 8px', borderColor: m.col, boxShadow: `0 0 18px ${m.col}44, 0 3px 0 #04060a`, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 32, height: 32, background: '#090c10', border: `1px solid ${m.col}`, display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon k={coreKey} size={24} />
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div className="lbl" style={{ fontSize: 8, color: m.col, letterSpacing: 0.7 }}>{m.tier} · {m.essence} ESSENCE</div>
          <div className="title-font" style={{ fontSize: 13, color: 'var(--brassLit)' }}>{d.name}</div>
          <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>Usable immediately · reload with R / Shift+R / Alt+R</div>
        </div>
      </div>
      <div className="rule" style={{ margin: '4px 0' }} />
      <div className="lbl" style={{ fontSize: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        <div><span style={{ color: 'var(--paper)' }}>[LMB]</span> <span style={{ color: 'var(--muted)' }}>{m.b}</span></div>
        <div><span style={{ color: 'var(--info)' }}>[Q]</span> <span style={{ color: 'var(--muted)' }}>{m.q}</span></div>
        <div><span style={{ color: 'var(--brassLit)' }}>[E]</span> <span style={{ color: 'var(--muted)' }}>{m.e}</span></div>
      </div>
    </div>
  );
}

/** Compact reserve bar shown right above the hotbar whenever a Creator Core is held. */
export function CoreReserveStrip({ r }: { r: RunState }) {
  const s = activeStack(r);
  if (!s || !ITEMS[s.key]?.creatorCore || !s.reserves) return null;
  const m = CORE_MODES[s.key];
  const { basic, refined, signature } = s.reserves;
  return (
    <div className="plate" style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 8, borderColor: m?.col || 'var(--brass)' }}>
      <Icon k={s.key} size={12} />
      <span className="lbl" style={{ fontSize: 8, color: 'var(--paper)' }}>[LMB] {m?.b ?? 'Basic'} <b>{basic}/40</b></span>
      <span className="lbl" style={{ fontSize: 8, color: 'var(--info)' }}>[Q] {m?.q ?? 'Refined'} <b>{refined}/12</b></span>
      <span className="lbl" style={{ fontSize: 8, color: 'var(--brassLit)' }}>[E] {m?.e ?? 'Signature'} <b>{signature}/4</b></span>
      <span className="lbl" style={{ fontSize: 7, color: 'var(--muted)' }}>R reload</span>
    </div>
  );
}

// ============================================================================
// 4. AIRDROP BEACON CARD — phase, sector, lock countdown & remaining stacks
// ============================================================================
export function AirdropCard({ e, now, stacks = 3 }: { e: Entity; now: number; stacks?: number }) {
  if (!e.airdrop || e.tx === undefined || e.ty === undefined) return null;
  const v = airdropView(e.airdrop, e.tx, e.ty, now, stacks);
  const col = v.key === 'locked' ? 'var(--warn)' : v.takeable ? 'var(--good)' : 'var(--brassLit)';
  const secs = v.key === 'incoming' || v.key === 'descending' ? Math.max(0, Math.ceil((e.airdrop.landAt - now) / 1000)) : v.lockedRemainS ?? v.expiresInS;
  const word = v.key === 'incoming' ? 'INCOMING' : v.key === 'descending' ? 'DESCENDING' : v.key === 'locked' ? 'LOCKED' : v.key === 'emptied' ? 'EMPTY' : v.key === 'expiring' ? 'EXPIRING' : 'OPEN';
  return (
    <div className="plate fadein" data-testid="airdrop-banner" data-phase={v.key} title={v.detail} style={{ padding: '2px 7px', borderColor: col, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon k={v.key === 'locked' || v.key === 'incoming' || v.key === 'descending' ? 'airdrop_locked' : 'airdrop_open'} size={12} />
      <span className="lbl" style={{ fontSize: 9, color: col, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="lamp round pulse" style={{ color: col }} />AIRDROP · {word}</span>
      <span className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>{v.zone.replace(' sector', '')}</span>
      {secs !== null && secs !== undefined && <span className="chip" style={{ color: 'var(--paper)' }}>{secs}s</span>}
      {v.takeable && <span className="chip" style={{ color: 'var(--good)' }}>×{v.stacks}</span>}
    </div>
  );
}

// ============================================================================
// 5. FALLEN ADVENTURER / DEATH & BAG RECOVERY OVERLAY
// ============================================================================
export function DeathRecoveryOverlay({ gs, onRespawn }: { gs: GameState; onRespawn: () => void }) {
  const r = gs.run!;
  const p = r.player;
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  const event = deathBagView(r);
  const bag = event.status === 'present' ? event.bag : null;
  const bagStacks = event.stacks;
  const bagCash = bagStacks.filter(s => s.key === 'rcash').reduce((n, s) => n + s.qty, 0);
  const hasBed = Object.values(r.entities).some(e => e.type === 'bed_straw' && (e.hp ?? 0) > 0);
  const ready = p.deadT >= 1200;

  return (
    <div className="absolute inset-0 flex items-center justify-center fadein" style={{ background: 'radial-gradient(circle, rgba(38,10,12,0.78), rgba(4,5,8,0.92))' }} onMouseDown={e => e.stopPropagation()}>
      <div className="panel" style={{ width: 380, padding: '10px 12px', borderColor: 'var(--bad)' }}>
        <div className="lbl" style={{ fontSize: 8, color: 'var(--bad)', letterSpacing: 1 }}>FALLEN ON THE ISLAND · SECTOR ({ptx}, {pty})</div>
        <div className="title-font" style={{ fontSize: 22, color: '#ff9a80', marginTop: 1 }}>You have fallen</div>
        <div style={{ fontSize: 11, color: 'var(--paper)', lineHeight: 1.25, marginTop: 3 }}>
          Death does not end this run. {event.cause && <span>Cause: {event.cause}. </span>}
          {bag ? 'Your belongings remain in the bag recorded by this death.' : 'No recoverable bag is currently confirmed for this death.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 7 }}>
          <div className="console-col">
            <div className="console-h" style={{ color: 'var(--warn)' }}>Dropped in Ground Bag</div>
            {event.status === 'present' && bag ? <>
              <div className="lbl" style={{ fontSize: 9, color: 'var(--brassLit)' }}>
                Location: ({Math.floor(bag.x / TILE)}, {Math.floor(bag.y / TILE)})
              </div>
              <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 1 }}>
                {bagStacks.length} stack{bagStacks.length === 1 ? '' : 's'} present now{bagCash > 0 ? ` · ${bagCash} unsecured cash` : ''}
              </div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 3 }}>
                {bagStacks.slice(0, 6).map((s, i) => <Icon key={i} k={s!.key} size={13} />)}
              </div>
            </> : <div className="lbl" style={{ fontSize: 9, color: 'var(--warn)' }}>
              {event.status === 'none' ? 'No bag was created for this death.' : event.status === 'missing' ? 'This death bag is no longer in the world.' : 'Bag identity unavailable in the receipt history. No inventory promised.'}
            </div>}
          </div>

          <div className="console-col">
            <div className="console-h" style={{ color: 'var(--info)' }}>Safe &amp; Next Step</div>
            <div className="lbl" style={{ fontSize: 9, color: 'var(--info)' }}>
              Profile-Secured Cash: <b>{gs.profile.securedCash}</b>
            </div>
            <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>
              Preferred wake: <b style={{ color: 'var(--paper)' }}>{hasBed ? 'Your Straw Bed (if safe)' : 'Safe Landing Site'}</b>
            </div>
            <div className="lbl" style={{ fontSize: 8, color: 'var(--good)', marginTop: 2 }}>
              {bag ? 'Prepare, then find this recorded bag on Map [M].' : 'Prepare before heading out. Other bags are not assumed to be yours.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
          <span className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>
            {ready ? 'Ready to wake' : 'Recovering breath…'}
          </span>
          <button className="btn gold" style={{ fontSize: 12, padding: '5px 14px' }} disabled={!ready} onClick={onRespawn}>
            Rise &amp; Recover Gear
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. VISUAL EXPERIENCE QA LAB [F9] — Presets, Events, Anim & Asset Inspector
// ============================================================================
export function QaSandboxDrawer({
  gs,
  activePreset,
  onSelectPreset,
  onTriggerEvent,
  onCycleBike,
  onRunBikeDemo,
  onSimulateOffline,
  bikeDemoState,
  onClose,
}: {
  gs: GameState;
  activePreset: QaPresetId;
  onSelectPreset: (id: QaPresetId) => void;
  onTriggerEvent: (ev: 'ragnarok' | 'awaken_elder' | 'overheat_elder' | 'defeat_elder' | 'discover_core' | 'spawn_airdrop' | 'unlock_airdrop' | 'fall_down' | 'bike_states', elderKey?: string) => void;
  onCycleBike: () => void;
  onRunBikeDemo: () => void;
  onSimulateOffline: () => void;
  bikeDemoState: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'presets' | 'events' | 'anim' | 'assets'>('presets');
  const [elderKey, setElderKey] = useState<string>('rust');
  const [zoom, setZoom] = useState<number>(2);
  const r = gs.run!;
  const bike = Object.values(r.entities).find(e => e.kind === 'vehicle' && e.vehicle);

  return (
    <Panel
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Glyph k="spark" c="var(--brassLit)" s={8} />VISUAL QA SANDBOX [F9]
        <span className="chip" style={{ color: 'var(--warn)' }}>ISOLATED QA</span>
      </span>}
      style={{ left: 6, top: 34, width: 314, maxHeight: 296, display: 'flex', flexDirection: 'column', zIndex: 40 }}
      onClose={onClose}
    >
      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
        {([['presets', 'Presets'], ['events', 'Events'], ['anim', 'Anim & Bike'], ['assets', '1× Assets']] as const).map(([k, lbl]) => (
          <button key={k} className={`btn sm ${tab === k ? 'gold' : ''}`} style={{ flex: 1 }} onClick={() => setTab(k)}>{lbl}</button>
        ))}
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {tab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>
              One-click full-gear scenarios using real engine entities. Production saves are untouched.
            </div>
            {QA_PRESETS.map(p => (
              <div key={p.id} className={`dirbtn ${activePreset === p.id ? 'on' : ''}`} onClick={() => onSelectPreset(p.id)} role="button" tabIndex={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="lbl" style={{ fontSize: 9, color: activePreset === p.id ? 'var(--brassLit)' : 'var(--paper)', fontWeight: 700 }}>{p.title}</span>
                  <span className="chip" style={{ marginLeft: 'auto', color: 'var(--info)' }}>{p.tag}</span>
                </div>
                <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="qa-provenance"><b>SHOWCASE PROVENANCE</b> · Offline settlement and player actions use engine paths. Summons, reward placement, airdrop setup and instant defeat are <strong>staged visual previews</strong>; they do not certify natural triggers.</div>
            <div className="console-col">
              <div className="console-h">Ragnarok &amp; World Events</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button className="btn sm danger" onClick={() => onTriggerEvent('ragnarok')}>QA clock → Ragnarok</button>
                <button className="btn sm gold" onClick={() => onTriggerEvent('discover_core')}>Stage Core pickup</button>
                <button className="btn sm" onClick={() => onTriggerEvent('spawn_airdrop')}>Stage airdrop descent</button>
                <button className="btn sm" onClick={() => onTriggerEvent('unlock_airdrop')}>Preview unlocked crate</button>
                <button className="btn sm" onClick={onSimulateOffline}>Run real 6.5h engine settle</button>
                <button className="btn sm danger" onClick={() => onTriggerEvent('fall_down')}>Stage death overlay</button>
              </div>
            </div>

            <div className="console-col">
              <div className="console-h">Six Elder Bosses</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                <select value={elderKey} onChange={e => setElderKey(e.target.value)} style={{ flex: 1 }}>
                  {Object.entries(ELDERS).map(([k, d]) => <option key={k} value={k}>{d.name} ({d.region})</option>)}
                </select>
                <button className="btn sm gold" onClick={() => onTriggerEvent('awaken_elder', elderKey)}>Stage Elder; fight live</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn sm" onClick={() => onTriggerEvent('overheat_elder')}>Stage vulnerability cue</button>
                <button className="btn sm" onClick={() => onTriggerEvent('defeat_elder', elderKey)}>Preview defeat &amp; reward</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'anim' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="console-col">
              <div className="console-h">Motorbike Choreography &amp; States</div>
              <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 4 }}>
                {bike ? `Bike deployed · HP ${Math.ceil(bike.hp || 0)} · Fuel ${bike.vehicle?.fuel.toFixed(0)} · ${r.player.vehicle ? 'MOUNTED' : 'DISMOUNTED'}` : 'Switch to Vehicle preset or deploy a bike below.'}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button className="btn sm gold" onClick={onRunBikeDemo} disabled={!!bikeDemoState || !bike || (bike.hp ?? 0) <= 0 || (bike.vehicle?.fuel ?? 0) <= 0}>
                  {bikeDemoState ? `Running: ${bikeDemoState}` : 'Approach → Mount → Drive → Steer → Dismount'}
                </button>
                <button className="btn sm" onClick={onCycleBike}>Cycle READY / DRY / BROKEN</button>
              </div>
            </div>
            <div className="console-col">
              <div className="console-h">Character Action Checklist</div>
              <div className="lbl" style={{ fontSize: 8, color: 'var(--paper)', lineHeight: 1.3 }}>
                • <b>WASD</b>: 6-frame distance-synced contact/down/pass gait<br />
                • <b>LMB</b>: 4-phase anticipation → strike → follow-through → recover<br />
                • <b>Space</b>: 6-frame tucked dodge roll<br />
                • <b>Q / E</b> (with Core): dedicated two-hand cast pose + sigil<br />
                • <b>F</b> (near Cart): leaning harness pull pose<br />
                • <b>E</b> (on Bike): 220ms saddle vault mount/dismount
              </div>
            </div>
          </div>
        )}

        {tab === 'assets' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span className="console-h" style={{ margin: 0 }}>Pixel Art Inspector</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                {[1, 2, 3].map(z => <button key={z} className={`btn sm ${zoom === z ? 'gold' : ''}`} onClick={() => setZoom(z)}>{z}×</button>)}
              </div>
            </div>
            <div className="console-h">7 Creator Cores &amp; 4 Elemental Cores</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
              {['core_dragon', 'core_meteor', 'core_elsa', 'core_mjolnir', 'core_demon', 'core_blast', 'core_earthmother', 'core_fire', 'core_frost', 'core_storm', 'core_earth', 'escrow_chest'].map(k => (
                <div key={k} className="console-col" style={{ padding: 2, textAlign: 'center' }} title={ITEMS[k]?.name}>
                  <Icon k={k} size={16 * zoom} />
                </div>
              ))}
            </div>
            <div className="console-h">Motorbike Views &amp; States (Side / Front / Back)</div>
            <SpriteGallery zoom={zoom} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function SpriteGallery({ zoom }: { zoom: number }) {
  const A = getArt();
  const keys = [
    'vehicle_side_ok', 'vehicle_side_empty', 'vehicle_side_broken',
    'vehicle_front_ok', 'vehicle_back_ok',
    'refinery', 'refinery_lit', 'oil_pump_run_0', 'oil_pump_dry',
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {keys.map(k => {
        const sp = A.st[k];
        if (!sp) return null;
        return (
          <div key={k} className="console-col" style={{ padding: 2 }} title={k}>
            <img className="px" src={sp.toDataURL()} width={sp.width * zoom} height={sp.height * zoom} style={{ width: sp.width * zoom, height: sp.height * zoom }} alt={k} />
          </div>
        );
      })}
      {(['male', 'female'] as const).map(sex => {
        const sp = A.hero[sex][`ride2`][0];
        return <div key={`adventurer-${sex}`} className="console-col" style={{ padding: 2 }} title={`Live ${sex} Adventurer riding pose`}>
          <img className="px" src={sp.toDataURL()} width={sp.width * zoom} height={sp.height * zoom} style={{ width: sp.width * zoom, height: sp.height * zoom }} alt={`${sex} Adventurer riding pose`} />
          <div className="lbl" style={{ fontSize: 7, color: 'var(--paper)' }}>{sex} Adventurer · live pose</div>
        </div>;
      })}
    </div>
  );
}
void STRUCTS;
