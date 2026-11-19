import { ITEMS, RESEARCH_FAMILIES, familyMembers } from '../game/catalog';
import type { Api } from './common';

// ============================================================================
// THE TECHNOLOGY-FAMILY LEDGER — one implementation, two hosts.
//
// Why this is a component and not a block inside one panel: the console the router actually opens for a
// research station is `StationConsole` (ContainerPanel returns it for any non-compact station), while the
// older `ResearchBody` column in panels.tsx is only reached when that early return is bypassed (a
// compact station, or a test that renders the body directly). Before this file existed the ledger lived
// ONLY in ResearchBody, which is exactly why a green panel test coexisted with a shipped UI that never
// showed it: the router opened the console, and the console had no family list at all. Inside the
// console it is now a tab of its own (`Technology`), because the two-column Blueprints body is capped at
// 142 px and a ledger appended to that column is present in the DOM yet unreadable on screen — which is
// the second way this same claim died. The recovered paper's rule — a family with an authorized price states that price, a family whose enforcement is NOT
// approved says so without pretending there is a gate, a family with no authorized cost is open design and
// cannot be bought — is something the player has to be able to READ, so it may not live in whichever
// component happens to be wired up. Both hosts render this file, and `web/e2e/pa1-research-visible.mjs`
// asserts the words sit inside the painted viewport after a real E press and a real tab click, at
// 1280x720 and at the shipped minimum 640x360, so the duplication can never silently rot again.
// ============================================================================

export function ResearchFamilies({ api, eid, header = true }: { api: Api; eid: string; header?: boolean }) {
  const r = api.gs.run!; const st = r.entities[eid]?.station;
  if (!st) return null;
  const price = (fam: { price: readonly (readonly [string, number])[] | null }) =>
    (fam.price ?? []).map(([k, q]) => `${q} ${ITEMS[k].name}`).join(' + ');
  return <>
    {header && <div className="console-h" style={{ fontSize: 10, color: '#ffd98a', marginTop: 4 }}>Technology families</div>}
    <div style={{ fontSize: 9, color: '#8a7a9a', marginBottom: 2 }}>One paid study unlocks a family: its packed devices and the work that plant does. A family with no authorized cost is open design and cannot be bought.</div>
    {Object.values(RESEARCH_FAMILIES).map(fam => {
      const owned = (r.tech?.families ?? []).includes(fam.id);
      const queued = st.queue.some(j => j.recipe === 'F:' + fam.id);
      const members = familyMembers(fam.id);
      const withhold = fam.price !== null && fam.enforce;
      return <div key={fam.id} data-testid={`family-row-${fam.id}`} className="flex items-center gap-1" style={{ fontSize: 10, borderTop: '1px solid #514155', marginTop: 2 }}>
        <b style={{ color: owned ? '#8fd19b' : '#ffe27a', width: 94 }}>{fam.id}</b>
        {fam.price === null ? <span style={{ color: '#8a7a9a' }} title={fam.note}>open design · no authorized cost</span> :
          owned ? <span style={{ color: '#8fd19b' }} title={fam.note}>studied · {members.length} formula{members.length === 1 ? '' : 's'}</span> :
            withhold ? <span>pay {price(fam)} · unlocks {members.length} formula{members.length === 1 ? '' : 's'} <button className="btn ghost" disabled={queued} style={{ padding: '0 4px' }} title={fam.note} onClick={() => api.act('unlockFamily', { family: fam.id, eid })}>{queued ? 'In progress' : 'Commission study'}</button></span> :
              <span style={{ color: '#8a7a9a' }} title={fam.note}>cost recorded ({price(fam)}) · {members.length} formula{members.length === 1 ? '' : 's'} · nothing withheld in this build</span>}
      </div>;
    })}
  </>;
}
