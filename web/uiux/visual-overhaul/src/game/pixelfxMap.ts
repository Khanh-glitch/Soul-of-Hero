// ============================================================================
// Gameplay event -> PixelFX id mappings (VISUAL ONLY).
// Reads events/state, spawns presentation instances. No charges, damage,
// items, terrain, saves or combat rules are touched — authority stays in sim.
//   Ember 'fire'  -> fire/fireball on the real projectile + explosion on boom
//   Quake 'earth' -> nature/quake per spike hazard (render.ts syncHazards)
//   Storm 'storm' -> lightning/chain-lightning per bolt segment
//   Rime  'frost' -> ice/frost-nova on the nova hazard (render.ts syncHazards)
// ============================================================================
import { spawn } from './pixelfx';
import { tunedSpirit,recordSpiritEvent } from './spirit-vfx-editor';

export function pfxFromSimEvent(e: any): boolean {
  switch (e.type) {
    case 'spiritDepart': case 'spiritArrive':
      if (e.x !== undefined) { const departure=e.type==='spiritDepart';recordSpiritEvent(departure?'E · rời đi':'E · đến nơi',e.x,e.y);spawn(departure?'arcane/blink-out':'arcane/blink-in', {...(import.meta.env.VITE_FX_TEST==='1'?tunedSpirit(departure?'e.depart':'e.arrive',e.x,e.y):{x:e.x,y:e.y,scale:0.65}),family:'ground',loop:import.meta.env.VITE_FX_TEST==='1'}); }
      return true;
    case 'lightning':
      if(e.x!==undefined)spawn('lightning/lightning-strike',{x:e.x,y:e.y,family:'ground',scale:0.4,loop:false});
      return true;
    case 'spiritHit':
      if(e.x!==undefined){recordSpiritEvent('Q · quái trúng',e.x,e.y);spawn('arcane/mana-burst',{...(import.meta.env.VITE_FX_TEST==='1'?tunedSpirit('q.hit',e.x,e.y):{x:e.x,y:e.y,scale:0.22}),family:'ground',loop:import.meta.env.VITE_FX_TEST==='1'});}
      return true;
    case 'windup':
      if (e.x !== undefined && e.core && e.core !== 'spirit') spawn('arcane/spell-charge', { x: e.x, y: e.y, family: 'hover', loop: true, maxAgeMs: 560 });
      return true;
    case 'cast':
      if (e.core === 'fire' && e.x !== undefined) spawn('fire/fireball', { x: e.x, y: e.y, family: 'hover', angle: e.a ?? 0, loop: false, scale: 0.55 });
      else if(e.core === 'frost' && e.x !== undefined) spawn('ice/snowflake-burst',{x:e.x,y:e.y,family:'ground',scale:0.34,loop:false});
      else if (e.core === 'storm' && e.x !== undefined) spawn('lightning/chain-lightning', { x: e.x, y: e.y, family: 'hover', angle: (e.a ?? 0) + Math.PI / 2, loop: false, scale: 0.45 });
      return true;
    case 'bolt': {
      if (e.x0 === undefined) return false;
      const dx = e.x1 - e.x0, dy = e.y1 - e.y0;
      const len = Math.hypot(dx, dy);
      if (len < 4) return true;
      spawn('lightning/chain-lightning', { x: e.x0, y: e.y0, family: 'hover', lift: 0, angle: Math.atan2(dy, dx), stretch: Math.max(0.25, len / 248), loop: false, scale: 0.55 });
      return true;
    }
    case 'boom':
      if (e.x !== undefined) spawn('explosions/small-explosion', { x: e.x, y: e.y, family: 'ground', scale: e.small ? 0.34 : 0.5 });
      return true;
    default:
      return false;
  }
}
