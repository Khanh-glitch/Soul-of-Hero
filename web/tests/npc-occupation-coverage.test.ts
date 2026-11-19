/**
 * EIGHT OCCUPATIONS — natural coverage across real settlements.
 *
 * No forced intents, no injected stations, no injected items: the only inputs are the layout, the
 * seed and the hours. Each village runs the real world clock (`stepHumans` + `stepStations`) and the
 * ledger records which role produced or performed real, attributed work. Coverage is a UNION across
 * villages, which the requirement allows ("need not complete in one village").
 *
 * A cook needs a paid queue AND a meal in custody, a medic needs a real treatment:
 * neither role is certified by generic harvest receipts.
 */
import { describe, expect, it } from 'vitest';
import { newGame, startRun, stepStations, beginReceiptSink, endReceiptSink } from '../src/game/engine';
import { stepHumans } from '../src/game/humanworld';
import { setActiveLayout } from '../src/game/world';
import { T0 } from './helpers/g1b-kit';

const VILLAGES = ['veyra05-greywater', 'veyra05-saltwick', 'veyra05-cinder'];
const HOURS = 6;

describe('natural occupation coverage', () => {
  it('records which roles work on their own in three real settlements', () => {
    const union: Record<string, number> = {};
    let cookedInCustody=false;
    for (const layout of VILLAGES) {
      setActiveLayout(layout);
      const gs = newGame();
      expect(startRun(gs, 'female', T0, null, 7606, { tx: 100, ty: 100 }).ok).toBe(true);
      const r = gs.run!; const hw = r.humanWorld!;
      beginReceiptSink();
      for (let t = 0; t < HOURS * 60; t++) {
        const now = T0 + t * 60000;
        stepHumans(r, hw, now);
        stepStations(gs, 60000, now);
        if(!cookedInCustody) cookedInCustody=Object.values(hw.people).filter(h=>h.occupation==='cook').some(h=>r.custody[h.inv.packId].slots.some(s=>s?.production?.workerId===h.actorId && ['grilled_mushroom','dried_meat'].includes(s.key)));
      }
      const local: Record<string, number> = {};
      for (const q of endReceiptSink()) {
        if (!['human.harvest', 'human.harvest.output', 'human.harvest.complete', 'human.guard.duty', 'human.treat', 'human.work.start', 'human.production.pickup'].includes(q.kind)) continue;
        // Receipt grammars: `${actorId}:...` except harvest.complete `${jobId}:${actorId}:${dst}`.
        const actorId = q.kind === 'human.harvest.complete' ? q.detail.split(':')[1] : q.detail.match(/workerId"?:"?([^",]+)/)?.[1] ?? q.detail.split(':')[0];
        const who = hw.people[actorId];
        if (!who) continue;
        const k = `${who.occupation}:${q.kind}`;
        local[k] = (local[k] ?? 0) + 1; union[k] = (union[k] ?? 0) + 1;
      }
      // Preserve the original six-hour production sample. Continue the same
      // Cinder run to include the later natural accident, without injecting a patient.
      if(layout==='veyra05-cinder'){
        beginReceiptSink();
        for(let t=HOURS*60;t<12*60;t++){
          const now=T0+t*60000;stepHumans(r,hw,now);stepStations(gs,60000,now);
        }
        for(const q of endReceiptSink().filter(q=>q.kind==='human.treat')){
          const [worker,patient]=q.detail.split(':');
          if(hw.people[worker]?.occupation!=='medic'||!hw.people[patient]?.wounds.some(w=>w.treated))continue;
          const k='medic:human.treat';local[k]=(local[k]??0)+1;union[k]=(union[k]??0)+1;
        }
      }
      console.log('VILLAGE', layout, JSON.stringify(local));
    }
    const ROLES_SEEN = [...new Set(Object.keys(union).map(k => k.split(':')[0]))].sort();
    // Profession-specific evidence only: hauling (`harvest.complete`) is generic labour, not a trade.
    const SPECIFIC = new Set(['human.harvest', 'human.harvest.output', 'human.guard.duty', 'human.treat', 'human.work.start', 'human.production.pickup']);
    const proven = [...new Set(Object.keys(union).filter(k => SPECIFIC.has(k.split(':')[1]) && (!k.startsWith('medic:') || k==='medic:human.treat') && (!k.startsWith('cook:') || k==='cook:human.work.start')).map(k => k.split(':')[0]))].sort();
    console.log('ROLES IN LEDGER', ROLES_SEEN.join(','));
    console.log('PROVEN BY THEIR OWN TRADE', proven.join(','));
    const roles = proven;
    console.log('UNION ROLES', roles.join(','));
    // Roles proven to work on their own. cook and medic are named as the measured gap above.
    expect(union['medic:human.treat']).toBeGreaterThan(0);
    expect(union['cook:human.work.start']).toBeGreaterThan(0);
    expect(cookedInCustody).toBe(true);
    expect(roles).toEqual(expect.arrayContaining(['builder', 'engineer', 'gardener', 'guard', 'mechanic', 'salvager']));
  }, 600000);
});
