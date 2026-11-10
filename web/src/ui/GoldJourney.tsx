import type { RunState, Receipt } from '../game/core';
import { PRIMORDIAL_ELDERS, ALWAYS_KNOWN_RECIPES, RECIPES } from '../game/catalog';
import { Icon } from './common';
import { runHours } from '../game/engine';
import './gold-ui.css';

/**
 * Gold UI bridge for SOH's real R12/Veyra save. Deliberately read-only:
 * no parallel economy, fake rewards, forced quests, or localStorage authority.
 * Source inspiration: PR #52 Waymark and Expedition Ledger.
 */
export interface FieldGoal {
  id: string; title: string; category: string; detail: string; icon: string;
  progress: number; target: number; why: string;
}
const bounded = (n: number, max: number) => Math.min(Math.max(0, n), max);
const eventCount = (receipts: readonly Receipt[], prefix: string) =>
  receipts.filter(x => x.kind === prefix || x.kind.startsWith(prefix + '.')).length;

export function goldGoals(r: RunState, now: number): FieldGoal[] {
  const receipts = r.receipts;
  const allEntities = { ...(r.veyraOffscreenEntities || {}), ...r.entities };
  const structures = Object.values(allEntities).filter(e => e.kind === 'struct');
  const slainBosses = Object.keys(r.sideBossDefeated || {}).length;
  const seen = r.poiSeen.length;
  return [
    { id: 'explore', title: 'Chart the unknown', category: 'EXPLORE',
      detail: 'Discover landmarks during your own expeditions.', why: 'Knowledge of Veyra must be earned on foot, not revealed by this tracker.',
      icon: 'map', progress: bounded(seen, 5), target: 5 },
    { id: 'shelter', title: 'Establish a refuge', category: 'SURVIVE',
      detail: 'Place a territory cabinet or create a home.', why: 'A shelter becomes a base for your own plans; it is not a required quest.',
      icon: 'st:claim', progress: structures.some(e => e.type === 'claim') ? 1 : 0, target: 1 },
    { id: 'craft', title: 'Expand your craft', category: 'CRAFT',
      detail: 'Acquire five recipes beyond those known from the start.', why: 'Crafting changes what you can make and how far you can travel.',
      icon: 'blueprint', progress: bounded(r.knowledge.recipes.filter(key => !RECIPES[key]?.base && !ALWAYS_KNOWN_RECIPES.includes(key)).length, 5), target: 5 },
    { id: 'endure', title: 'Survive the first day', category: 'ENDURE',
      detail: 'Remain alive until twenty-four real hours have elapsed.', why: 'The world clock continues even while you are away.',
      icon: 'wood', progress: bounded(Math.floor(runHours(r, now)), 24), target: 24 },
    { id: 'hunt', title: 'Face the wilderness', category: 'HUNT',
      detail: 'Observe creature defeat receipts from your recent journey.', why: 'Only recorded defeats count; this does not create loot.',
      icon: 'leather', progress: bounded(eventCount(receipts, 'creature.kill'), 3), target: 3 },
    { id: 'guardians', title: 'Challenge an optional guardian', category: 'BOSS',
      detail: 'Defeat a regional side boss, if you choose.', why: 'These encounters are optional and do not replace non-boss survival.',
      icon: 'relic', progress: bounded(slainBosses, 1), target: 1 },
    { id: 'stones', title: 'Remember the Primordials', category: 'LEGACY',
      detail: 'Claim stones from the six Elders, if you pursue them.', why: 'An optional path toward the exceptional evacuation ending.',
      icon: 'gem', progress: bounded(r.elderStones.length, 6), target: 6 },
  ];
}

export function GoldWaymark({ goals, selected, onSelect, onLedger, danger }: {
  goals: FieldGoal[]; selected: string; onSelect: (id: string) => void; onLedger: () => void; danger: boolean;
}) {
  const goal = goals.find(x => x.id === selected) ?? goals.find(x => x.progress < x.target) ?? goals[0];
  if (!goal) return null;
  const pct = Math.round(100 * goal.progress / Math.max(1, goal.target));
  return <aside className={'gold-waymark ' + (danger ? 'gold-waymark--danger' : '')} aria-label="Optional journey waypoint" onMouseDown={e => e.stopPropagation()}>
    <button type="button" className="gold-waymark__mark" title="Open Expedition Ledger [J]" onClick={onLedger}>
      <span className="gold-waymark__ring" style={{ background: 'conic-gradient(#e7be71 ' + pct + '%, #35283b 0)' }} />
      <Icon k={goal.icon} size={15} />
    </button>
    {!danger && <div className="gold-waymark__body">
      <div className="gold-waymark__eyebrow">{goal.category} · OPTIONAL</div>
      <div className="gold-waymark__title">{goal.title}</div>
      <div className="gold-waymark__progress"><i style={{ width: pct + '%' }} /></div>
    </div>}
    {!danger && <div className="gold-waymark__controls">
      <select aria-label="Choose optional waypoint" value={selected === 'auto' ? 'auto' : goal.id} onChange={e => onSelect(e.target.value)} title="Track a different goal">
        <option value="auto">Auto</option>
        {goals.map(g => <option key={g.id} value={g.id}>{g.category}: {g.title}</option>)}
      </select>
      <button type="button" onClick={onLedger} title="Expedition Ledger [J]">❖</button>
    </div>}
  </aside>;
}

export function GoldLedger({ r, now, goals, selected, onSelect, onClose }: {
  r: RunState; now: number; goals: FieldGoal[]; selected: string;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const recent = r.receipts.slice(-24).reverse();
  const stoneKeys = Object.values(PRIMORDIAL_ELDERS).map(e => e.stone);
  const [primary, ...secondary] = [goals.find(g => g.id === selected) ?? goals.find(g => g.progress < g.target) ?? goals[0], ...goals.filter(g => g.id !== selected)].filter(Boolean) as FieldGoal[];
  return <section className="panel absolute gold-ledger" role="dialog" aria-label="Expedition Ledger" onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
    <div className="gold-ledger__head"><span>✦ EXPEDITION LEDGER <small>· Veyra field record · LOCAL / UNVERIFIED</small></span><button className="btn ghost" type="button" onClick={onClose}>✕ [J]</button></div>
    <div className="gold-ledger__pages">
      <div className="gold-ledger__page">
        <div className="gold-ledger__kicker">WAYMARK · YOUR OWN COURSE</div>
        <p className="gold-ledger__intro">Choose what to track. None of these objectives is mandatory, and the Ledger grants no material rewards.</p>
        <div className="gold-ledger__goals">
          {[primary, ...secondary].map(g => <button className={'gold-ledger__goal ' + ((selected === g.id || (selected === 'auto' && primary.id === g.id)) ? 'gold-ledger__goal--on' : '')} key={g.id} type="button" onClick={() => onSelect(g.id)}>
            <Icon k={g.icon} size={15} /><span><strong>{g.title}</strong><small>{g.category} · {g.progress}/{g.target}</small></span>
            <span>{g.progress >= g.target ? '✓' : '›'}</span>
          </button>)}
        </div>
      </div>
      <div className="gold-ledger__page gold-ledger__page--right">
        <div className="gold-ledger__kicker">FIELD NOTES · WHAT THE WORLD KNOWS</div>
        <div className="gold-ledger__stones" title="Undiscovered stones stay unknown">{stoneKeys.map((stone,i) => <span key={stone} className={r.elderStones.includes(stone) ? 'gold-ledger__stone got' : 'gold-ledger__stone'}>{r.elderStones.includes(stone) ? <Icon k={stone} size={16} /> : '✧'}<small>{i + 1}</small></span>)}</div>
        <div className="gold-ledger__facts"><span>Places discovered <b>{r.poiSeen.length}</b></span><span>Known recipes <b>{r.knowledge.recipes.length}</b></span><span>Lifetime of this run <b>{Math.floor(runHours(r, now))}h</b></span></div>
        <div className="gold-ledger__kicker" style={{ marginTop: 8 }}>CHRONICLE · COMMITTED EVENTS (RECENT)</div>
        <div className="gold-ledger__chronicle" aria-label="Recent committed game receipts">
          {recent.length ? recent.map(e => <div key={e.id} className="gold-ledger__event"><span>#{e.seq} · {e.kind}</span><small>{e.detail}</small></div>) : <div className="gold-ledger__empty">Your journey has only just begun.</div>}
        </div>
      </div>
    </div>
    <div className="gold-ledger__foot">Observed gameplay data only · This page never mints rewards or reveals undiscovered map locations.</div>
  </section>;
}
