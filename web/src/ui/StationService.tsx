import { useState } from 'react';
import { TILE, type Entity } from '../game/core';
import { C, connectedPower, countItem, industrialStatus } from '../game/engine';
import { FURNACE_LINING, INDUSTRIAL_MODULE, ITEMS, STRUCTS, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III } from '../game/catalog';
import { reachableStations } from '../game/action-readiness';
import { Icon, type Api } from './common';

function Inputs({ api, list }: { api: Api; list: [string, number][] }) {
  const r = api.gs.run!;
  return <div className="service-cost">{list.map(([key, qty]) => {
    const have = countItem(r, 'inv', key);
    return <span key={key} className={have >= qty ? 'ok' : 'no'} title={`${ITEMS[key].name} ${have}/${qty}`}><Icon k={key} size={13} /><b>{have}</b><small>/{qty}</small></span>;
  })}</div>;
}

/** Operations hidden when the old StationBody was replaced: exact engine intents, no new mechanics. */
export function StationService({ api, e }: { api: Api; e: Entity }) {
  const r = api.gs.run!; const st = e.station!;
  const [salvageUid, setSalvageUid] = useState<string | null>(null);
  const affordable = (ins: [string, number][]) => ins.every(([k, q]) => countItem(r, 'inv', k) >= q);
  const bench = e.type === 'workbench';
  const furnace = e.type === 'furnace';
  const level = st.level ?? 1;
  const upgrade = level === 1 ? WORKBENCH_UPGRADE : WORKBENCH_UPGRADE_III;
  const liningBench = furnace ? reachableStations(r, 'workbench').find(b => (b.station?.level ?? 1) >= FURNACE_LINING.benchLevel && Math.hypot(b.x - e.x, b.y - e.y) <= 3 * TILE) : null;
  const gear = C(r, 'inv').slots.map((s, slot) => ({ s, slot })).filter(({ s }) => s && s.qty === 1 && (ITEMS[s.key].repair || ITEMS[s.key].salvage));
  const gens = bench ? Object.values(r.entities).filter(g => g.basePower && (g.owner === undefined || g.owner === 'player') && connectedPower(r, g, e)) : [];

  return <div className={`station-service station-service--${e.type} scroll`}>
    {bench && <>
      <div className="service-line">
        <div className="service-heading"><Icon k="st:workbench" size={14} /><b>Workbench · L{level}/3</b></div>
        {level < 3 ? <><Inputs api={api} list={upgrade.cost} />
          <button className="btn gold sm" disabled={!affordable(upgrade.cost)} title={!affordable(upgrade.cost) ? 'Bring the materials shown in red' : `Upgrade to level ${upgrade.toLevel}`} onClick={() => api.act('upgradeStation', { eid: e.id })}>Upgrade to L{upgrade.toLevel}</button>
          {!affordable(upgrade.cost) && <span className="service-hint">Missing materials · collect the red amounts.</span>}
        </> : <span className="service-hint good">Maximum station level reached.</span>}
      </div>

      <div className="service-line">
        <div className="service-heading"><Icon k="st:base_generator" size={13} /><b>Industrial module</b></div>
        {!e.industrial ? <><Inputs api={api} list={INDUSTRIAL_MODULE.cost} />
          <button className="btn sm" disabled={level < INDUSTRIAL_MODULE.benchLevel || !affordable(INDUSTRIAL_MODULE.cost)} onClick={() => api.act('installIndustrial', { eid: e.id })}>Install module</button>
          <span className="service-hint">{level < 2 ? 'Needs L2 bench.' : !affordable(INDUSTRIAL_MODULE.cost) ? 'Bring materials shown in red.' : 'Manual work remains available.'}</span>
        </> : <><span className="service-hint">{industrialStatus(r, e)} · manual work remains available.</span>
          <label className="service-input">Power route <select aria-label="Workbench generator" value={e.industrial.generatorId || ''} onChange={ev => api.act('industrialConfigure', { eid: e.id, field: 'generatorId', value: ev.target.value })}>
            <option value="">Unlinked</option>{gens.map(g => <option key={g.id} value={g.id}>Generator {g.tx},{g.ty}</option>)}
          </select></label>
          <button className="btn sm" onClick={() => api.act('industrialConfigure', { eid: e.id, field: 'enabled', value: !e.industrial!.enabled })}>{e.industrial.enabled ? 'Disable' : 'Enable'} module</button>
        </>}
      </div>

      <div className="service-line">
        <div className="service-heading"><Icon k="field_repair_kit" size={13} /><b>Equipment on your person</b><span>{gear.length}</span></div>
        {!gear.length && <span className="service-hint">Carry damaged tools, salvageable equipment or a worn packed device to service them here.</span>}
        {gear.map(({ s, slot }) => { const item = s!; const d = ITEMS[item.key]; const busy = r.player.action?.slot === slot;
          // A repair rule names the ONE station that accepts it (`maintainItem` compares e.type), so the
          // control must not be offered at the wrong bench — a packed Workbench re-forges at a Furnace.
          // A greyed button that could never be pressed is worse than a sentence saying where to go.
          const atThisStation = !!d.repair && d.repair.station === e.type;
          const repairable = !!d.repair && atThisStation && item.dur !== undefined && item.dur < (d.dur ?? 0);
          const canRepair = repairable && !busy && affordable(d.repair!.cost);
          return <div key={item.uid} className="service-gear">
            <div className="service-gear__name"><Icon k={item.key} size={15} /><span>{d.name}</span>{item.dur !== undefined && d.dur && <b style={{ color: item.dur / d.dur < .25 ? 'var(--bad)' : 'var(--good)' }}>{item.dur}/{d.dur}</b>}</div>
            {repairable && <div className="service-gear__actions"><Inputs api={api} list={d.repair!.cost} /><button className="btn sm" disabled={!canRepair} title={busy ? 'Finish the current action' : !affordable(d.repair!.cost) ? 'Bring materials shown in red' : 'Repair this exact item UID'} onClick={() => api.act('maintainItem', { eid: e.id, slot, uid: item.uid, mode: 'repair' })}>Repair</button></div>}
            {!!d.repair && !atThisStation && (item.dur ?? 0) < (d.dur ?? 0) && <span className="service-hint">Re-forges at the {STRUCTS[d.repair!.station]?.name ?? d.repair!.station}.</span>}
            {d.salvage && <div className="service-gear__actions">
              <span className="service-yield">→ {d.salvage.yields.map(([k, q]) => <span key={k} title={ITEMS[k].name}><Icon k={k} size={11} />{q}</span>)}</span>
              {salvageUid === item.uid ? <><button className="btn danger sm" disabled={busy} onClick={() => { api.act('maintainItem', { eid: e.id, slot, uid: item.uid, mode: 'salvage' }); setSalvageUid(null); }}>Destroy item?</button><button className="btn ghost sm" onClick={() => setSalvageUid(null)}>Cancel</button></> : <button className="btn ghost sm" disabled={busy} onClick={() => setSalvageUid(item.uid)}>Dismantle</button>}
            </div>}
          </div>;
        })}
      </div>
    </>}

    {furnace && <div className="service-line">
      <div className="service-heading"><Icon k="st:furnace" size={16} /><b>Furnace lining</b></div>
      {st.upgrade ? <span className="service-hint good">Installed · future jobs use less paid fuel.</span> : <>
        <Inputs api={api} list={FURNACE_LINING.cost} />
        <button className="btn gold sm" disabled={!liningBench || !affordable(FURNACE_LINING.cost)} title={!liningBench ? 'A level 2 Workbench must be within reach of you and this Furnace' : 'Spend materials to line this Furnace'} onClick={() => api.act('upgradeFurnace', { eid: e.id, benchId: liningBench?.id })}>Line furnace</button>
        <span className="service-hint">{!liningBench ? 'Reach a nearby L2 Workbench.' : !affordable(FURNACE_LINING.cost) ? 'Bring materials shown in red.' : 'Paid once · reduces burn for future jobs.'}</span>
      </>}
    </div>}
  </div>;
}