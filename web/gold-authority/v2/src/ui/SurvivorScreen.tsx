import { useEffect, useRef, useState } from 'react';
import { BAL, TILE, type RunState } from '../game/core';
import { ITEMS, RECIPES, STRUCTS, isRecipeKnown } from '../game/catalog';
import { C, countItem, invWeight, carryLimit, recipeOutputs } from '../game/engine';
import { craftReadiness, structurePreparation, type CraftReadiness } from '../game/action-readiness';
import { getArt } from '../game/art';
import { drawAdventurer } from '../game/avatar-presentation';
import { Icon, iconUrl, type Api } from './common';
import { Glyph } from './hud';
import { DSlot, DGrid, KeyboardMoveBanner } from './dragSlots';
import { ItemInfo } from './panels';

// ============================================================================
// SURVIVOR SCREEN — pack and crafting on one full-screen surface.
// Left: the body (equipment + pack + hotbar row). Right: what those materials
// can become. Crafting is grouped by PURPOSE; the station is a property shown
// on the recipe, not a tab the player has to guess. Workstations and devices
// are "crafted" here and then placed in the world with the same `build`
// intent and cost as before — only the doorway into that action moved.
// ============================================================================
type Cat = 'all' | 'tools' | 'gear' | 'food' | 'mats' | 'cores' | 'stations' | 'devices';
const CATS: { id: Cat; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'gear' }, { id: 'tools', label: 'Tools', icon: 'stone_axe' },
  { id: 'gear', label: 'Gear', icon: 'leather_armor' }, { id: 'food', label: 'Food & Med', icon: 'stew' },
  { id: 'mats', label: 'Materials', icon: 'iron_ingot' }, { id: 'cores', label: 'Cores', icon: 'core_blast' },
  { id: 'stations', label: 'Stations', icon: 'st:workbench' }, { id: 'devices', label: 'Devices', icon: 'st:base_generator' },
];
export const STATION_STRUCTS = ['campfire', 'workbench', 'furnace', 'research', 'refinery', 'oil_pump', 'garden', 'barrel', 'farm_controller'];
export const DEVICE_STRUCTS = ['base_generator', 'power_cable', 'power_switch', 'pressure_switch', 'ir_sensor', 'door_powered', 'arrow_turret', 'bear_trap', 'spikes'];
const catOf = (out: string): Cat => {
  const c = ITEMS[out]?.cat;
  return c === 'tool' || c === 'weapon' ? 'tools' : c === 'armor' ? 'gear' : c === 'food' ? 'food' : c === 'core' ? 'cores' : 'mats';
};

function Doll({ r }: { r: RunState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dir, setDir] = useState<number>(r.player.dir);
  useEffect(() => {
    const c = ref.current!; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
    const scratch = document.createElement('canvas'); scratch.width = 16; scratch.height = 24;
    const px = scratch.getContext('2d')!; px.imageSmoothingEnabled = false;
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); g.clearRect(0, 0, 48, 72); px.clearRect(0, 0, 16, 24);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(12, 66, 24, 4);
      drawAdventurer(px, r, 8, 19, dir, r.player.vehicle ? 'ride' : 'idle', Math.floor(t / 700) % 2);
      const held = C(r, 'inv').slots[r.player.active]; const d = held && ITEMS[held.key];
      if (!r.player.vehicle && held && d && (d.dmg || d.creatorCore || d.core)) {
        const icon = getArt().icon[held.key];
        if (icon) px.drawImage(icon, dir === 1 ? 1 : 11, dir === 3 ? 11 : 9, 5, 5);
      }
      g.drawImage(scratch, 0, 0, 48, 72);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [r, dir]);
  const name = ['South', 'West', 'East', 'North'][dir];
  return <div className="sv-portrait" aria-label={`${r.character} Adventurer, ${name}, ${r.player.vehicle ? 'riding' : 'standing'}, wearing ${C(r, 'eq').slots.filter(Boolean).map(s => ITEMS[s!.key].name).join(', ') || 'no equipment'}`}>
    <canvas ref={ref} width={48} height={72} className="sv-doll" aria-hidden="true" />
    <div className="sv-portrait-turn"><button aria-label="Turn character left" title="Turn character left" onClick={() => setDir(d => [2, 0, 3, 1][d])}>◀</button><span>{name}</span><button aria-label="Turn character right" title="Turn character right" onClick={() => setDir(d => [1, 3, 0, 2][d])}>▶</button></div>
  </div>;
}

export function SurvivorScreen({ api, initial = 'all', focusRecipe }: { api: Api; initial?: Cat; focusRecipe?: string }) {
  const r = api.gs.run!;
  const [cat, setCat] = useState<Cat>(initial);
  const [pick, setPick] = useState<string | null>(focusRecipe && RECIPES[focusRecipe] ? focusRecipe : null);
  // A 640x360 game viewport cannot present pack and crafting side-by-side legibly.
  // Both panes stay mounted; compact presentation exposes one at a time.
  // Wider screens retain both panes and original gameplay/custody behavior.
  const [compactView, setCompactView] = useState<'pack' | 'work'>(focusRecipe ? 'work' : 'pack');
  const [onlyReady, setOnlyReady] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => { if (focusRecipe && RECIPES[focusRecipe]) { setCat('all'); setQ(''); setOnlyReady(false); setPick(focusRecipe); setCompactView('work'); } }, [focusRecipe]);
  const have = (k: string) => countItem(r, 'inv', k);
  const isStructCat = cat === 'stations' || cat === 'devices';

  // Recompute against the live world on each HUD refresh: fuel, queue and reach
  // can change during simulation without any React/GameState revision.
  const query = q.trim().toLowerCase();
  const entries = isStructCat
    ? (cat === 'stations' ? STATION_STRUCTS : DEVICE_STRUCTS)
      .filter(k => STRUCTS[k] && (!query || STRUCTS[k].name.toLowerCase().includes(query)))
      .map(k => { const prep = structurePreparation(r, k); return { id: `S:${k}`, out: `st:${k}`, name: STRUCTS[k].name, status: prep.materials && !prep.sourceBlocked ? 'prepared' : 'blocked', short: prep.next, info: null as CraftReadiness | null }; })
    : Object.entries(RECIPES)
      .filter(([k, rc]) => isRecipeKnown(r.knowledge.recipes, k) && (cat === 'all' || catOf(rc.out) === cat) && (!query || (rc.alias ?? ITEMS[rc.out].name).toLowerCase().includes(query)))
      .map(([k, rc]) => { const info = craftReadiness(r, k, api.now()); return { id: k, out: rc.out, name: rc.alias ?? ITEMS[rc.out].name, status: info.state, short: info.next, info }; })
      .sort((a, b) => ({ ready: 3, waiting: 2, blocked: 1 }[b.status] ?? 0) - ({ ready: 3, waiting: 2, blocked: 1 }[a.status] ?? 0));
  const shown = onlyReady && !isStructCat ? entries.filter(e => e.status === 'ready') : entries;
  const sel = pick && shown.some(e => e.id === pick) ? pick : shown[0]?.id ?? null;
  const hidden = isStructCat ? 0 : Object.keys(RECIPES).filter(k => !isRecipeKnown(r.knowledge.recipes, k) && (cat === 'all' || catOf(RECIPES[k].out) === cat)).length;

  const w = invWeight(r), lim = carryLimit(r), load = Math.min(1, w / lim);
  let armor = 0, warm = 0; for (const s of C(r, 'eq').slots) if (s) { armor += ITEMS[s.key].armor || 0; warm += ITEMS[s.key].cold || 0; }
  const selStack = api.sel ? C(r, api.sel.c)?.slots[api.sel.slot] ?? null : null;
  const EQ_GHOST = ['scrap_helm', 'leather_armor', 'fur_cloak'];

  return <div className="sv" data-compact-view={compactView} onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
    <div className="sv-top">
      <div className="sv-title">SURVIVOR</div>
      <span className="sv-hint"><span className="key">drag</span>move <span className="key">Enter</span>pick/place <span className="key">Esc</span>cancel <span className="key">1-8</span>hotbar</span>
      <button className="btn ghost sm sv-x" onClick={() => api.open(null)}>✕ <span className="key" style={{ marginLeft: 3 }}>Esc</span></button>
    </div>
    <div className="sv-compact-nav" role="group" aria-label="Survivor view">
      <button type="button" className={compactView === 'pack' ? 'active' : ''} aria-pressed={compactView === 'pack'} onClick={() => setCompactView('pack')}>
        PACK <span>Gear · inventory</span>
      </button>
      <button type="button" className={compactView === 'work' ? 'active' : ''} aria-pressed={compactView === 'work'} onClick={() => setCompactView('work')}>
        WORK <span>Recipes · stations</span>
      </button>
    </div>
    <div className="sv-body">
      {/* ================= LEFT: body + pack ================= */}
      <section className="sv-left">
        <div className="sv-char">
          <div className="sv-eq">
            {[0, 1, 2].map(i => <div key={i} className="sv-eqcell">
              <DSlot api={api} cid="eq" slot={i} s={C(r, 'eq').slots[i]} size={26} />
              {!C(r, 'eq').slots[i] && <img className="px sv-ghost" src={iconUrl(EQ_GHOST[i])} alt="" />}
            </div>)}
          </div>
          <Doll r={r} />
          <div className="sv-stats">
            <span className="stat" title="Damage reduction"><Glyph k="hp" c="var(--good)" s={7} />-{Math.round(armor * 100)}%</span>
            <span className="stat" title="Warmth from clothing"><Glyph k="wr" c="var(--warm)" s={7} />+{warm}</span>
            <span className="stat" title="Unsecured coins / profile-secured"><Icon k="rcash" size={8} />{have('rcash')}<i className="sep" />{api.gs.profile.securedCash}</span>
            <div className="sv-load" title={`Load ${w.toFixed(1)} / ${lim} kg`}>
              <Glyph k="weight" c={w > lim ? 'var(--bad)' : 'var(--muted)'} s={7} />
              <div className="track"><i style={{ width: `${load * 100}%`, background: w > lim ? 'var(--bad)' : load > 0.8 ? 'var(--warn)' : 'var(--good)' }} /></div>
              <b className={w > lim ? 'over' : ''}>{Math.round(w)}</b><small>/{lim}</small>
            </div>
          </div>
        </div>
        <div className="sv-packlabel"><span>INVENTORY</span><small>{C(r, 'inv').slots.filter(Boolean).length}/{C(r, 'inv').slots.length}</small><button className="btn ghost sm" title="Sort Backpack slots 9–24 while keeping Quickbar 1–8 protected" onClick={() => api.act('sort', { c: 'inv' })}>Sort Pack</button></div>
        <KeyboardMoveBanner />
        <DGrid api={api} cid="inv" cols={8} hotRow size={28} />
        <ItemInfo s={selStack} known={r.knowledge.recipes} />
        {selStack && api.sel && <div className="sv-itemacts">
          {api.sel.c === 'eq'
            ? <button className="btn sm" onClick={() => { api.act('move', { from: 'eq', fs: api.sel!.slot, to: 'inv' }); api.setSel(null); }}>Unequip</button>
            : <button className="btn sm" onClick={() => { api.act('useItem', { c: api.sel!.c, slot: api.sel!.slot }); }}>{ITEMS[selStack.key]?.slot ? 'Equip' : 'Use'}</button>}
          <button className="btn sm" disabled={selStack.qty < 2} onClick={() => api.act('split', { c: api.sel!.c, slot: api.sel!.slot })}>Split</button>
          <button className="btn sm" onClick={() => { api.act('drop', { c: api.sel!.c, slot: api.sel!.slot }); api.setSel(null); }}>Drop</button>
          {api.sel.c === 'inv' && ITEMS[selStack.key].repair && selStack.dur !== undefined && selStack.dur < (ITEMS[selStack.key].dur || 0) && <button className="btn sm gold" disabled={!C(r, 'inv').slots.some(s => s?.key === 'field_repair_kit')} onClick={() => { const kitSlot = C(r, 'inv').slots.findIndex(s => s?.key === 'field_repair_kit'); const kit = C(r, 'inv').slots[kitSlot]; if (kit) api.act('fieldRepair', { slot: api.sel!.slot, uid: selStack.uid, kitSlot, kitUid: kit.uid }); }}><Icon k="field_repair_kit" size={9} /> Repair +{BAL.player.fieldRepairDurability}</button>}
          {api.sel.c === 'inv' && api.sel.slot >= 8 && <span className="sv-itemacts__hint">Hover + <span className="key">1-8</span> quickbar</span>}
        </div>}
      </section>

      {/* ================= RIGHT: craft ================= */}
      <section className="sv-right">
        <div className="sv-cats">
          {CATS.map(c => <button key={c.id} className={`sv-cat ${cat === c.id ? 'on' : ''}`} onClick={() => { setCat(c.id); setPick(null); }} title={c.label}>
            <img className="px" src={iconUrl(c.icon)} alt="" /><span>{c.label}</span>
          </button>)}
        </div>
        <div className="sv-filter">
          <input placeholder="find…" value={q} onChange={e => setQ(e.target.value)} aria-label="Find recipe" />
          {!isStructCat && <button className={`btn sm ${onlyReady ? 'gold' : 'ghost'}`} onClick={() => setOnlyReady(v => !v)} title="Show recipes that can start working now. Queueable-but-paused recipes remain in All."><i className="lamp round" style={{ color: 'var(--good)' }} /> work now</button>}
          <span className="chip" style={{ color: 'var(--muted)' }}>{shown.length}{hidden ? ` · ${hidden} undiscovered` : ''}</span>
        </div>
        <div className="sv-tiles scroll">
          {shown.map(e => <button key={e.id} className={`sv-tile ${sel === e.id ? 'on' : ''} ${e.status === 'ready' ? 'ok' : e.status === 'waiting' || e.status === 'prepared' ? 'wait' : 'no'}`} data-recipe={e.id} data-state={e.status} onClick={() => setPick(e.id)} title={`${e.name} · ${e.short}`} aria-label={`${e.name}: ${e.status === 'ready' ? 'Work now' : e.status === 'waiting' ? 'Can queue; will wait' : e.status === 'prepared' ? 'Materials prepared; select legal site' : 'Blocked'}; ${e.short}`}>
            {e.out.startsWith('st:') ? <img className="px" src={iconUrl(e.out)} alt="" /> : <Icon k={e.out} size={20} />}
            {!e.out.startsWith('st:') && RECIPES[e.id]?.qty > 1 && <b>{RECIPES[e.id].qty}</b>}
            <i className="dot" aria-hidden="true" />
          </button>)}
          {!shown.length && <div className="sv-empty">{onlyReady ? 'Nothing can begin working now. Turn off the filter to see why.' : hidden ? 'Explore, loot blueprints or research to learn more.' : 'Nothing here.'}</div>}
        </div>
        <div className="sv-state-key" aria-hidden="true"><span className="now">◆ Work now</span><span className="later">▤ Can queue · waits</span><span className="needs">× Missing requirement</span></div>
        {sel && (sel.startsWith('S:') ? <StructDetail api={api} k={sel.slice(2)} /> : <RecipeDetail api={api} k={sel} readiness={craftReadiness(r, sel, api.now())} />)}
      </section>
    </div>
  </div>;
}

function RecipeDetail({ api, k, readiness }: { api: Api; k: string; readiness: CraftReadiness }) {
  const r = api.gs.run!; const rc = RECIPES[k]; const have = (i: string) => countItem(r, 'inv', i);
  const max = rc.station ? 1 : rc.ins.length ? Math.max(0, Math.min(...rc.ins.map(([i, n]) => Math.floor(have(i) / n)))) : 0;
  return <div className="sv-detail">
    <div className="sv-dhead"><div className="sv-dico"><Icon k={rc.out} size={24} /></div><div><b>{rc.alias ?? ITEMS[rc.out].name}</b><div className="sv-ddesc">{ITEMS[rc.out].desc}</div></div></div>
    <div className="sv-diagram">
      <div className="ins">{rc.ins.map(([i, n]) => <span key={i} className={`need ${have(i) >= n ? 'ok' : 'no'}`} title={ITEMS[i].name}><Icon k={i} size={16} /><b>{have(i)}</b><small>/{n}</small></span>)}</div>
      <span className="arrow">▶</span>
      <div className="outs">{recipeOutputs(rc).map(([i, n]) => <span key={i} className="out" title={ITEMS[i].name}><Icon k={i} size={18} /><b>×{n}</b></span>)}</div>
    </div>
    <div className="sv-dfoot">
      {rc.station ? <span className="chip" style={{ color: readiness.station ? readiness.level >= (rc.stationLevel ?? 1) ? 'var(--good)' : 'var(--bad)' : 'var(--warn)' }} title={readiness.station ? `Station at ${readiness.station.tx},${readiness.station.ty}, level ${readiness.level}` : 'No reachable station'}><img className="px" src={iconUrl(`st:${rc.station}`)} alt="" />{STRUCTS[rc.station].name}{rc.stationLevel ? ` L${rc.stationLevel}` : ''}</span> : <span className="chip" style={{ color: 'var(--paper)' }}>By hand</span>}
      <span className="chip" style={{ color: 'var(--paper)' }}>⏱ {rc.secs}s</span>
      {readiness.fuel !== 'not-needed' && readiness.station && <span className="chip" style={{ color: readiness.fuel !== 'empty' ? 'var(--good)' : 'var(--warn)' }}><Glyph k="fuel" c="currentColor" s={7} />{readiness.fuel === 'empty' ? 'No fuel' : readiness.fuel === 'burning' ? 'Burning' : 'Fuel stored'}</span>}
      {readiness.station && <span className="chip" style={{ color: readiness.queue >= 6 ? 'var(--bad)' : 'var(--muted)' }}>Queue {readiness.queue}/6</span>}
      {readiness.station && readiness.output === 'full' && <span className="chip" style={{ color: 'var(--warn)' }}>Output full</span>}
      {!rc.station && max > 1 && <span className="chip" style={{ color: 'var(--muted)' }}>can make {max}</span>}
      <button className="btn gold sv-go" disabled={!readiness.canSubmit} onClick={() => api.act('craft', { recipe: k, eid: readiness.station?.id })}>{rc.station ? readiness.state === 'waiting' ? 'Queue · waits' : 'Queue' : 'Craft'}</button>
    </div>
    <div className={`sv-readiness sv-readiness--${readiness.state}`} role="status"><b>{readiness.state === 'ready' ? '◆' : readiness.state === 'waiting' ? '▤' : '×'} {readiness.short}</b><span>{readiness.next}</span></div>
  </div>;
}

function StructDetail({ api, k }: { api: Api; k: string }) {
  const r = api.gs.run!; const d = STRUCTS[k]; const have = (i: string) => countItem(r, 'inv', i);
  const prep = structurePreparation(r, k);
  const ok = prep.materials && !prep.sourceBlocked;
  return <div className="sv-detail">
    <div className="sv-dhead"><div className="sv-dico"><img className="px" src={iconUrl(`st:${k}`)} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} /></div><div><b>{d.name}</b><div className="sv-ddesc">{d.desc}</div></div></div>
    <div className="sv-diagram">
      <div className="ins">{d.cost.map(([i, n]) => <span key={i} className={`need ${have(i) >= n ? 'ok' : 'no'}`} title={ITEMS[i].name}><Icon k={i} size={16} /><b>{have(i)}</b><small>/{n}</small></span>)}</div>
      <span className="arrow">▶</span>
      <div className="outs"><span className="out"><img className="px" src={iconUrl(`st:${k}`)} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} /><b>place</b></span></div>
    </div>
    <div className="sv-dfoot">
      <span className="chip" style={{ color: 'var(--muted)' }}><Glyph k="hp" c="currentColor" s={7} />{d.hp}</span>
      {d.station && <span className="chip" style={{ color: 'var(--info)' }}>workstation</span>}
      <button className="btn gold sv-go" disabled={!ok} onClick={() => { api.setBuild(k); api.setReclaim(false); api.setRepairMode(false); api.setUpgradeMode(false); api.open(null); }}>Choose site</button>
    </div>
    <div className={`sv-readiness sv-readiness--${ok ? 'waiting' : 'blocked'}`} role="status"><b>{ok ? '▤ Materials prepared' : '× Not prepared'}</b><span>{prep.next}. Placement is checked on the ground.</span></div>
  </div>;
}
