// ============================================================================
// Gameplay event -> PixelFX id mappings (VISUAL ONLY).
// Every function here only READS the event/state and spawns presentation
// instances via the pixelfx adapter. No charges, damage, items, terrain,
// saves or combat rules are touched — combat authority stays in sim.ts.
//
// Core mappings (verified against the pinned Foundry catalog):
//   Ember  (core 'fire')   -> fire/fireball (projectile) + explosions/small-explosion (impact)
//   Quake  (core 'earth')  -> nature/quake (per spike hazard)
//   Storm  (core 'storm')  -> lightning/chain-lightning (per bolt segment)
//   Rime   (core 'frost')  -> ice/frost-nova (nova hazard ring)
// ============================================================================
import { spawn } from './pixelfx';

/** Handle one sim FX event (from consumeFX). Returns true if it was mapped. */
export function pfxFromSimEvent(e: any): boolean {
  switch (e.type) {
    case 'windup': // Core cast windup: charge glow at the caster (visual only)
      if (e.x !== undefined && e.core) {
        spawn('arcane/spell-charge', { x: e.x, y: e.y, anchor: 'hover', loop: true, maxAgeMs: 560, scale: 0.6 });
      }
      return true;
    case 'cast': // Core released (charge already debited by sim at this point)
      if (e.core === 'fire' && e.x !== undefined) {
        // muzzle flash at the hand; the projectile itself carries fire/fireball
        spawn('fire/fireball', { x: e.x, y: e.y, anchor: 'hover', angle: e.a ?? 0, loop: false, scale: 0.5 });
      } else if (e.core === 'storm' && e.x !== undefined) {
        spawn('lightning/chain-lightning', { x: e.x, y: e.y, anchor: 'hover', angle: (e.a ?? 0) + Math.PI / 2, loop: false, scale: 0.4 });
      }
      return true;
    case 'bolt': { // Storm chain segment
      if (e.x0 === undefined) return false;
      const dx = e.x1 - e.x0, dy = e.y1 - e.y0;
      const len = Math.hypot(dx, dy);
      if (len < 4) return true;
      spawn('lightning/chain-lightning', {
        x: e.x0, y: e.y0, anchor: 'hover', lift: 0, angle: Math.atan2(dy, dx),
        stretch: Math.max(0.25, len / 248), loop: false, scale: 0.55,
      });
      return true;
    }
    case 'boom': // fireball / mine impact
      if (e.x !== undefined) {
        spawn('explosions/small-explosion', { x: e.x, y: e.y, anchor: 'ground', scale: e.small ? 0.34 : 0.5 });
      }
      return true;
    default:
      return false;
  }
}
