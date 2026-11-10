// MEC-01 R11 P1: exit weather outlook must not reveal the realized future schedule (Bible K2 "dự báo chứ không toàn tri").
import {describe,it,expect} from 'vitest';
import {HOUR} from '../src/game/core';
import {newGame,dispatch,markDirty,wetOutlook} from '../src/game/engine';
import {phaseBoundaryAt} from '../src/game/calendar';

const T0=Date.UTC(2026,0,1);
function fresh(seed:number){const gs=newGame();expect(dispatch(gs,{id:'r11w-'+seed,type:'startRun',character:'female',seed},T0).ok).toBe(true);gs.run!.creatures=[];markDirty();return gs;}

describe('R11 exit weather outlook (K2 honesty)', () => {
  it('BEFORE/AFTER: the 24h outlook does not depend on the realized weather beyond the exact horizon', () => {
    // Two worlds with the same season and clock but different seeds realize different weather. The seasonal
    // (non-exact) part of the outlook must be identical, because it may only use the season distribution.
    const a=wetOutlook(fresh(310).run!,T0), b=wetOutlook(fresh(311).run!,T0);
    console.log('[R11 outlook] seed310 '+JSON.stringify(a)+' | seed311 '+JSON.stringify(b));
    expect(a.seasonalWetHours).toBeDefined();
    expect(a.seasonalWetHours).toBe(b.seasonalWetHours);
  });
  it('exact horizon is only the configured near-term slot(s); the rest is a seasonal probability', () => {
    const o=wetOutlook(fresh(310).run!,T0);
    expect(o.hours).toBe(24);
    expect(o.exactHours).toBeGreaterThan(0);
    expect(o.exactHours).toBeLessThan(0.2);                 // one 9-minute slot (forecastSlots = 1)
    expect(o.wetHours).toBeCloseTo(o.exactWetHours+o.seasonalWetHours,9);
    expect(o.wetHours).toBeGreaterThanOrEqual(0); expect(o.wetHours).toBeLessThanOrEqual(o.hours);
    expect(o.reliability).toBe('exact-near-term+seasonal-probability');
  });
  it('seasonal part equals the season weight share x remaining hours (spring 4/14, summer 4/16)', () => {
    const r=fresh(310).run!;
    const spring=wetOutlook(r,T0);
    expect(spring.seasonalWetHours).toBeCloseTo((4/14)*(spring.hours-spring.exactHours),6);
    const summerNow=phaseBoundaryAt(r,1)+1000;
    const summer=wetOutlook(r,summerNow);
    expect(summer.seasonalWetHours).toBeCloseTo((4/16)*(summer.hours-summer.exactHours),6);
  });
  it('bounded by the remaining run: zero after the run ends, clamped near the end', () => {
    const r=fresh(310).run!;
    expect(wetOutlook(r,T0+336*HOUR)).toEqual({hours:0,wetHours:0,exactHours:0,exactWetHours:0,seasonalWetHours:0,reliability:'exact-near-term+seasonal-probability'});
    const last=wetOutlook(r,T0+(336-2)*HOUR);
    expect(last.hours).toBe(2); expect(last.wetHours).toBeLessThanOrEqual(2);
  });
});
