import { ITEMS, STRUCTS } from '../game/catalog';
import { countItem, buildReason } from '../game/engine';
import type { GameState } from '../game/core';
import { Icon, iconUrl } from './common';

// ============================================================================
// BUILD MODE = the hotbar changes job. No panel, no menu-then-Esc dance.
// Only WOOD-tier architecture lives here, without inventory items. Upgrades
// require territory authority; deployables are crafted in Survivor first.
// ============================================================================
export const BUILD_KIT = ['floor_wood', 'wall_wood', 'door_wood', 'roof_thatch'] as const;
export type BuildTool = typeof BUILD_KIT[number] | 'upgrade' | 'repair' | 'reclaim';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function BuildBar({ gs, tool, onPick, hoverX, hoverY }: { gs: GameState; tool: BuildTool; onPick: (t: BuildTool) => void; hoverX: number; hoverY: number }) {
  const r = gs.run!;
  const have = (k: string) => countItem(r, 'inv', k);
  const isPiece = (BUILD_KIT as readonly string[]).includes(tool);
  const d = isPiece ? STRUCTS[tool] : null;
  const reason = isPiece ? buildReason(gs, tool, hoverX, hoverY) : null;
  return <div className="buildbar">
    {d && <div className={`buildbar__status ${reason ? 'no' : 'ok'}`}>
      <b>{d.name}</b>
      {d.cost.map(([i, n]) => <span key={i} className={have(i) >= n ? 'ok' : 'no'} title={ITEMS[i].name}><Icon k={i} size={10} />{have(i)}/{n}</span>)}
      <i className="sep" />
      <span className="buildbar__reason">{reason ? reason.replace(/\.$/, '') : 'click to place'}</span>
    </div>}
    {!d && <div className="buildbar__status ok"><b>{tool === 'upgrade' ? 'Upgrade' : tool === 'repair' ? 'Repair' : 'Dismantle'}</b><span className="buildbar__reason">point at a placed structure · click · G cycles layer · upgrades need Territory Cabinet{tool === 'repair' ? ' · ⇧ plate patch' : ''}</span></div>}
    <div className="plate buildbar__row">
      {BUILD_KIT.map((k, i) => { const s = STRUCTS[k]; const ok = s.cost.every(([c, n]) => have(c) >= n); return <button key={k} className={`bslot ${tool === k ? 'on' : ''} ${ok ? '' : 'no'}`} onClick={() => onPick(k)} title={`${s.name} · ${s.cost.map(([c, n]) => `${ITEMS[c].name} ${n}`).join(', ')}`}>
        <span className="bslot__key">{KEYS[i]}</span><img className="px" src={iconUrl(`st:${k}`)} alt="" />
      </button>; })}
      <i className="buildbar__div" />
      {([['upgrade', 'U', '⬆'], ['repair', 'V', '⚒'], ['reclaim', 'X', '✂']] as const).map(([t, k, g]) => <button key={t} className={`bslot mode ${tool === t ? 'on' : ''}`} onClick={() => onPick(t)} title={t}><span className="bslot__key">{k}</span><span className="bslot__glyph">{g}</span></button>)}
      <span className="buildbar__exit"><span className="key">B</span>exit</span>
    </div>
  </div>;
}
