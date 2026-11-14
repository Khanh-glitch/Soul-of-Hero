import { useState } from 'react';
import { BAL, type Entity } from '../game/core';
import { ITEMS, RECIPES, STRUCTS, isRecipeKnown, permitsDirectedResearch, CORE_STUDY, stationBurnable } from '../game/catalog';
import { C, countItem, recipeOutputs, spaceFor, oilAvailability, OIL_TEXT } from '../game/engine';
import { Panel, Slot, Icon, type Api } from './common';
import { Glyph } from './hud';
import { craftReadiness } from '../game/action-readiness';
import { recoveryFits } from '../game/recycler';
import { StationService } from './StationService';
import { ResearchFamilies } from './ResearchFamilies';

// ============================================================================
// STATION CONSOLE — one grammar for every production machine and for Research.
//
// The old body was a single scrolling column of recipe names where every row
// said only "missing materials". The operator could not see WHAT was missing,
// HOW MUCH, what the job would produce, whether the machine had fuel, or why a
// queued job was not moving. This console answers all five before the click.
//
// Authority: every button dispatches the SAME engine intents that already
// existed — `craft`, `research`, `cancelJob`, `move`. No costs, times, outputs,
// queue rules or reach checks are re-implemented here; they are read from
// RECIPES / BAL / the live station and confirmed by dispatch's Result.
// ============================================================================

const FUEL_KINDS = ['campfire', 'furnace', 'refinery', 'oil_pump'];

function useStation(api: Api, eid: string) {
  const r = api.gs.run!; const e = r.entities[eid];
  return { r, e, st: e?.station, kind: e?.type ? STRUCTS[e.type]?.station : undefined };
}

function StatusLamp({ tone, shape, label }: { tone: string; shape?: 'round' | 'diamond'; label: string }) {
  return <span className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: tone }}>
    <span className={`lamp ${shape ?? 'round'}`} style={{ color: tone }} />{label}
  </span>;
}

/** have/need chips per input — the single biggest readability fix in this panel */
function CostChips({ ins, have }: { ins: [string, number][]; have: (k: string) => number }) {
  return <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3 }}>
    {ins.filter(([, q]) => q > 0).map(([k, q]) => {
      const ok = have(k) >= q;
      return <span key={k} className="chip" style={{ color: ok ? 'var(--good)' : 'var(--bad)', display: 'inline-flex', alignItems: 'center', gap: 2 }} title={`${ITEMS[k].name}: have ${have(k)}, need ${q}`}>
        <Icon k={k} size={9} />{have(k)}/{q}
      </span>;
    })}
  </span>;
}

export function StationConsole({ api, eid, initialTab = 'make' }: { api: Api; eid: string; initialTab?: 'make' | 'study' | 'families' }) {
  const { r, e, st, kind } = useStation(api, eid);
  // 'families' is the recovered technology ledger: a first-class tab, not a strip below the blueprint
  // scroll area. Kept out of the default so a survivor opening the table to craft sees craft first.
  // `initialTab` exists so the family pane can be rendered in a static test without a click; the shipped
  // game always opens on Blueprints, so nothing about the player's default view changes.
  const [tab, setTab] = useState<'make' | 'study' | 'families'>(initialTab);
  const [view, setView] = useState<'work' | 'service'>('work');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  // Fuel custody may change without a React revision; read it on every UI refresh.
  const fuelItems = C(r, 'inv').slots.map((s, i) => ({ s, i })).filter(v => v.s && stationBurnable(v.s.key));
  if (!e || !st || !kind) return null;
  const research = kind === 'research';
  const hasService = kind === 'workbench' || kind === 'furnace';
  const fuelled = FUEL_KINDS.includes(kind);
  const have = (k: string) => countItem(r, 'inv', k);
  const out = C(r, st.outC);
  const outUsed = out.slots.filter(Boolean).length;
  const job = st.queue[0];
  const burning = (st.burn ?? 0) > 0;
  const fuelAvailable = burning || C(r, st.fuelC).slots.some(s => s && stationBurnable(s.key));
  const currentRecipe = job?.recipe.startsWith('R:') ? null : job ? RECIPES[job.recipe] : null;
  const outputBlocked = job ? currentRecipe
    ? currentRecipe.outs ? !recoveryFits(out, currentRecipe.outs) : spaceFor(r, st.outC, currentRecipe.out) < currentRecipe.qty
    : job.recipe.startsWith('R:') && spaceFor(r, st.outC, 'blueprint') < 1
    : false;
  const sourceDry = e.type === 'oil_pump' && (!e.tx || !e.ty || !(r.oilSources?.[`oil:${e.tx}:${e.ty}`]?.stock ?? 0));
  const running = !!job && !outputBlocked && !sourceDry && (!fuelled || fuelAvailable);
  const level = st.level ?? 1;

  const state = !job ? (burning ? 'WARM' : 'IDLE')
    : sourceDry ? 'SOURCE DRY' : outputBlocked ? 'OUTPUT FULL'
      : fuelled && !fuelAvailable ? 'NO FUEL' : 'WORKING';
  const stateTone = state === 'WORKING' ? 'var(--good)' : ['NO FUEL', 'SOURCE DRY'].includes(state) ? 'var(--bad)' : state === 'OUTPUT FULL' ? 'var(--warn)' : 'var(--muted)';

  const recipes = Object.entries(RECIPES).filter(([, rc]) => rc.station === kind);
  const known = recipes.filter(([k]) => isRecipeKnown(r.knowledge.recipes, k));
  const shown = known.filter(([k, rc]) => !q || ITEMS[rc.out].name.toLowerCase().includes(q.toLowerCase()) || k.toLowerCase().includes(q.toLowerCase()));
  const sel = picked && shown.some(([k]) => k === picked) ? picked : (shown[0]?.[0] ?? null);

  const transferFuel = (i: number) => {
    const c = C(r, st.fuelC); const ts = c.slots.findIndex(x => !x);
    api.act('move', { from: 'inv', fs: i, to: st.fuelC, ts: ts >= 0 ? ts : undefined });
  };
  const takeAll = () => { for (let i = 0; i < out.slots.length; i++) if (out.slots[i]) { const res = api.act('move', { from: st.outC, fs: i, to: 'inv' }); if (!res.ok) break; } };

  return <Panel
    title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon k={`st:${e.type}`} size={14} />{STRUCTS[e.type!]?.name || 'Station'}
      {kind !== 'campfire' && <span className="chip" style={{ color: 'var(--muted)' }}>LV {level}</span>}
    </span>}
    className={`station-console station-console--${kind}`}
    style={{ left: 330, top: 34, width: 304, maxHeight: 296, display: 'flex', flexDirection: 'column' }}
    onClose={() => api.open(null)}>

    {/* ---- machine truth strip ------------------------------------------ */}
    <div className="console-col" style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusLamp tone={stateTone} shape={state === 'NO FUEL' ? 'diamond' : 'round'} label={state} />
        {fuelled && <span className="lbl" style={{ fontSize: 8, color: burning ? 'var(--food)' : 'var(--muted)', display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          <Glyph k="wr" c={burning ? 'var(--food)' : '#4c5a63'} s={7} />{((st.burn ?? 0) / 1000).toFixed(0)}s burn
        </span>}
        <span className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginLeft: 'auto' }}>
          HP {Math.round(e.hp ?? 0)}/{e.maxHp}
        </span>
      </div>
      {state === 'NO FUEL' && <div className="station-action" role="status">Add burnable fuel below. The reserved job is paused.</div>}
      {state === 'OUTPUT FULL' && <div className="station-action" role="status">Take output to resume this job.</div>}
      {state === 'SOURCE DRY' && <div className="station-action" role="status">Source depleted. This pump cannot produce.</div>}
      {e.type === 'oil_pump' && (() => {
        const src = e.tx !== undefined && e.ty !== undefined ? r.oilSources?.[`oil:${e.tx}:${e.ty}`] : undefined;
        return <div className="lbl" style={{ fontSize: 8, marginTop: 2, color: src && src.stock > 0 ? 'var(--good)' : 'var(--bad)' }}>
          {src ? `Oil site: ${src.stock} crude left${src.stock <= 0 ? ' — dry, cycles blocked' : ''}` : oilAvailability(r) === 'NO_SITE_IN_WORLD' ? OIL_TEXT.noSiteWorld : OIL_TEXT.notOnSite}
        </div>;
      })()}
      {/* live job */}
      {job && <div className="job" style={{ marginTop: 3, padding: '2px 3px', boxShadow: 'inset 0 0 0 1px var(--edge)' }}>
        <div className="prog" style={{ width: `${(1 - job.left / job.total) * 100}%` }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon k={job.recipe.startsWith('R:') ? 'blueprint' : RECIPES[job.recipe]?.out || 'gear'} size={11} />
          <span className="lbl" style={{ fontSize: 9 }}>{job.recipe.startsWith('R:') ? `Study: ${ITEMS[RECIPES[job.recipe.slice(2)]?.out]?.name ?? '?'}` : ITEMS[RECIPES[job.recipe]?.out]?.name ?? job.recipe}</span>
          <span className="lbl" style={{ fontSize: 8, marginLeft: 'auto', color: running ? 'var(--info)' : 'var(--bad)' }}>{Math.ceil(job.left / 1000)}s{running ? '' : ' · held'}</span>
          <button className="btn ghost sm" onClick={() => api.act('cancelJob', { eid, jobId: job.id })} title="Cancel — reserved inputs are returned">✕</button>
        </div>
      </div>}
      {st.queue.length > 1 && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>+{st.queue.length - 1} more queued</div>}
    </div>

    {/* ---- tabs ---------------------------------------------------------- */}
    {research && <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' }}>
      <button className={`btn sm ${tab === 'make' ? 'gold' : ''}`} onClick={() => setTab('make')}>Blueprints</button>
      <button className={`btn sm ${tab === 'study' ? 'gold' : ''}`} onClick={() => setTab('study')}>Specimens &amp; Cores</button>
      <button className={`btn sm ${tab === 'families' ? 'gold' : ''}`} data-testid="research-tab-families" onClick={() => setTab('families')}>Technology</button>
    </div>}
    {hasService && <div className="station-service-tabs"><button className={`btn sm ${view === 'work' ? 'gold' : ''}`} onClick={() => setView('work')}>Production</button><button className={`btn sm ${view === 'service' ? 'gold' : ''}`} onClick={() => setView('service')}>Service · Upgrades</button></div>}
    {hasService && view === 'service' && <StationService api={api} e={e} />}

    {(!hasService || view === 'work') && <>
    {research && tab === 'families'
      // The family ledger gets the whole body, not the 142 px strip under a scroll area: eleven recovered
      // families with their state must be readable at the shipped minimum viewport, which is why this is a
      // tab of its own rather than another block appended below Blueprints.
      ? <div className="console-col scroll" data-testid="research-family-pane" style={{ minHeight: 0, maxHeight: 246, overflowY: 'auto' }}>
        <ResearchFamilies api={api} eid={eid} />
      </div>
      : <div style={{ display: 'flex', gap: 4, minHeight: 0, flex: 1 }}>
      {/* -------- left: what can I run -------- */}
      <div className="console-col scroll" style={{ flex: 1, maxHeight: 142, overflowY: 'auto' }}>
        {research && tab === 'make' ? <ResearchList api={api} eid={eid} e={e} q={q} setQ={setQ} />
          : research ? <SpecimenList api={api} eid={eid} />
            : <>
              <div className="console-h">Recipes · {known.length}/{recipes.length} known</div>
              <input type="text" placeholder="filter…" value={q} onChange={ev => setQ(ev.target.value)} style={{ width: '100%', marginBottom: 3 }} aria-label="Filter recipes" />
              {shown.length === 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>Nothing known here yet. Research a blueprint, then learn it.</div>}
              {shown.map(([k, rc]) => {
                const readiness = craftReadiness(r, k, api.now(), eid);
                return <div key={k} className={`recipe-row ${sel === k ? 'on' : ''} ${readiness.state === 'ready' ? '' : readiness.state === 'waiting' ? 'wait' : 'no'}`} onClick={() => setPicked(k)} role="button" tabIndex={0}
                  aria-label={`${ITEMS[rc.out].name}: ${readiness.short}. ${readiness.next}`} title={readiness.next}
                  onKeyDown={ev => { if (ev.key === 'Enter') setPicked(k); }}>
                  <Icon k={rc.out} size={12} />
                  <span className="lbl" style={{ fontSize: 9, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ITEMS[rc.out].name}{rc.qty > 1 ? ` ×${rc.qty}` : ''}</span>
                  <span className="station-readiness-mark" style={{ color: readiness.state === 'ready' ? 'var(--good)' : readiness.state === 'waiting' ? 'var(--warn)' : 'var(--bad)' }}>{readiness.state === 'ready' ? '◆' : readiness.state === 'waiting' ? '▤' : '×'}</span>
                </div>;
              })}
            </>}
      </div>

      {/* -------- right: input → output, then commit -------- */}
      <div className="scroll" style={{ width: 132, maxHeight: 158, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!research && sel && (() => {
          const rc = RECIPES[sel];
          const readiness = craftReadiness(r, sel, api.now(), eid);
          const outs = recipeOutputs(rc);
          return <div className="console-col">
            <div className="console-h">Batch</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
              <Icon k={rc.out} size={16} />
              <span className="flow-arrow">→</span>
              <span className="lbl" style={{ fontSize: 9, color: 'var(--brassLit)' }}>{outs.map(([k, qn]) => `${qn} ${ITEMS[k].name}`).join(' + ')}</span>
            </div>
            <CostChips ins={rc.ins} have={have} />
            <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{rc.secs}s at the station{rc.stationLevel ? ` · level ${rc.stationLevel}` : ''}</div>
            <button className="btn gold sm" style={{ width: '100%', marginTop: 4 }} disabled={!readiness.canSubmit}
              onClick={() => api.act('craft', { recipe: sel, eid })}>
              {readiness.state === 'waiting' ? 'Queue · will wait' : 'Queue job'}
            </button>
            <div className={`station-action ${readiness.state}`} role="status"><b>{readiness.short}</b><span>{readiness.next}</span></div>
          </div>;
        })()}

        {fuelled && <div className="console-col">
          <div className="console-h">Fuel hopper</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {C(r, st.fuelC).slots.map((s, i) => <Slot key={i} s={s} onClick={() => s && api.act('move', { from: st.fuelC, fs: i, to: 'inv' })} />)}
          </div>
          <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>From pack:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
            {fuelItems.length === 0 && <span className="lbl" style={{ fontSize: 8, color: 'var(--bad)' }}>none carried</span>}
            {fuelItems.slice(0, 6).map(({ s, i }) => <button key={i} className="btn sm" style={{ padding: 1 }} title={`${ITEMS[s!.key].name} — ${ITEMS[s!.key].fuel}s`} onClick={() => transferFuel(i)}><Icon k={s!.key} size={12} /></button>)}
          </div>
        </div>}

        <div className="console-col">
          <div className="console-h">{research ? 'Blueprints ready' : 'Output'} · {outUsed}/{out.slots.length}</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {out.slots.map((s, i) => <Slot key={i} s={s} onClick={() => s && api.act('move', { from: st.outC, fs: i, to: 'inv' })} />)}
          </div>
          <button className="btn sm" style={{ width: '100%', marginTop: 3 }} disabled={!outUsed} onClick={takeAll}>Take all</button>
          {research && outUsed > 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--brassLit)', marginTop: 2 }}>Take a blueprint, then use it in the pack to learn it.</div>}
        </div>
      </div>
    </div>}

    {/* ---- pack strip: physical transfer, no remote access ---- */}
    <div className="rule" style={{ margin: '4px 0 3px' }} />
    <div className="console-h">Pack · click an item to load it here</div>
    <div className="scroll" style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxHeight: 24, overflowY: 'auto' }}>
      {C(r, 'inv').slots.map((s, i) => <Slot key={i} s={s} hotkey={i < 8 ? String(i + 1) : undefined}
        onClick={() => { if (!s) return; if (fuelled && stationBurnable(s.key)) transferFuel(i); else api.act('useItem', { slot: i }); }} />)}
    </div>
    </>}
  </Panel>;
}

// ---------------------------------------------------------------------------
function ResearchList({ api, eid, e, q, setQ }: { api: Api; eid: string; e: Entity; q: string; setQ: (s: string) => void }) {
  const r = api.gs.run!; const st = e.station!; const B = BAL.research;
  const spares = countItem(r, 'inv', 'spares');
  const all = Object.keys(RECIPES);
  const knownN = all.filter(k => isRecipeKnown(r.knowledge.recipes, k)).length;
  const unknown = all.filter(k => !isRecipeKnown(r.knowledge.recipes, k) && permitsDirectedResearch(RECIPES[k]));
  const pending = new Set(st.queue.filter(j => j.recipe.startsWith('R:')).map(j => j.recipe.slice(2)));
  const shown = unknown.filter(k => !pending.has(k) && (!q || ITEMS[RECIPES[k].out].name.toLowerCase().includes(q.toLowerCase())));
  const full = st.queue.length >= 3;
  const randomAvailable = all.some(k => !isRecipeKnown(r.knowledge.recipes, k) && !pending.has(k));
  return <>
    <div className="console-h">Research table</div>
    <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 3 }}>
      Known <b style={{ color: 'var(--paper)' }}>{knownN}/{all.length}</b> · Parts carried <b style={{ color: spares ? 'var(--brassLit)' : 'var(--bad)' }}>{spares}</b>
    </div>
    <button className="btn gold sm" style={{ width: '100%' }} disabled={full || !randomAvailable || spares < B.randomSparesCost}
      onClick={() => api.act('research', { mode: 'random', eid })}>
      Tinker · {B.randomSparesCost} Parts · {B.randomSeconds}s
    </button>
    <div className="station-action" style={{ margin: '2px 0 4px' }} role="status">
      {full ? 'Queue full · wait or cancel a study.' : !randomAvailable ? 'Nothing left to discover.' : spares < B.randomSparesCost ? `Need ${B.randomSparesCost - spares} more Parts.` : 'Unknown blueprint will appear in output.'}
    </div>
    <div className="console-h">Directed study · {B.directedSparesCost} Parts · {B.directedSeconds}s</div>
    <input type="text" placeholder="find a blueprint…" value={q} onChange={ev => setQ(ev.target.value)} style={{ width: '100%', marginBottom: 3 }} aria-label="Find research recipe" />
    {shown.length === 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>No unknown directed target matches.</div>}
    {shown.slice(0, 40).map(k => {
      const rc = RECIPES[k]; const can = !full && spares >= B.directedSparesCost;
      return <div key={k} className={`recipe-row ${can ? '' : 'no'}`} style={{ cursor: 'default' }}>
        <Icon k={rc.out} size={12} />
        <span className="lbl" style={{ fontSize: 9, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ITEMS[rc.out].name}</span>
        <button className="btn sm" disabled={!can} title={full ? 'Queue full' : !can ? `Need ${B.directedSparesCost - spares} more Parts` : 'Reserve Parts for this research'} onClick={() => api.act('research', { mode: 'directed', recipe: k, eid })}>Study</button>
      </div>;
    })}
  </>;
}

function SpecimenList({ api, eid }: { api: Api; eid: string }) {
  const r = api.gs.run!; const B = BAL.research;
  const [confirm, setConfirm] = useState<string | null>(null);
  const busy = (r.entities[eid]?.station?.queue.length ?? 0) >= 3;
  const items = C(r, 'inv').slots.map((s, i) => ({ s, i })).filter(v => v.s && (ITEMS[v.s.key].specimen || CORE_STUDY[v.s.key] || ITEMS[v.s.key].studyRecipe));
  return <>
    <div className="console-h">Specimen / Core study · {B.specimenSeconds}s</div>
    <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 3 }}>Reserved now, consumed only on completion. Cancelling returns the item.</div>
    {items.length === 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>Carry a creature specimen, a Core, or studyable equipment.</div>}
    {items.map(({ s, i }) => {
      const key = ITEMS[s!.key].specimen || CORE_STUDY[s!.key] || ITEMS[s!.key].studyRecipe!;
      const target = RECIPES[key]?.out;
      return <div key={s!.uid} className="recipe-row" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon k={s!.key} size={12} />
          <span className="lbl" style={{ fontSize: 9, flex: 1 }}>{ITEMS[s!.key].name}</span>
          <span className="flow-arrow">→</span>
          {target && <Icon k={target} size={12} />}
        </div>
        {confirm === s!.uid
          ? <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
            <button className="btn danger sm" disabled={busy} onClick={() => { api.act('research', { mode: 'specimen', slot: i, uid: s!.uid, eid }); setConfirm(null); }}>Confirm — reserve 1</button>
            <button className="btn ghost sm" onClick={() => setConfirm(null)}>Back</button>
          </div>
          : <button className="btn sm" style={{ marginTop: 2 }} disabled={busy || isRecipeKnown(r.knowledge.recipes, key) || r.entities[eid]?.station?.queue.some(j => j.recipe === 'R:' + key)} title={busy ? 'Research queue full' : isRecipeKnown(r.knowledge.recipes, key) ? 'Already learned' : 'Reserve this physical specimen'} onClick={() => setConfirm(s!.uid)}>Study this</button>}
      </div>;
    })}
  </>;
}

export { stationBurnable };
