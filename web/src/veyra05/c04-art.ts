/**
 * C04 SMALL WATERFRONT LANDINGS PIXEL ART (Westbank, Drowned Pier, Tern Hut Pier).
 * 17 crisp 2.5D maritime & coastal props + unified `fish_drying_rack` & `rope_coil`.
 */
import { type Sprite, mk } from '../game/art';
import { hash2 } from '../game/core';
import {
  RAMPS,
  craftSprite,
  drawWheel,
} from './pixel-craft';
import { drawDeckTileCanvas } from './surface-art';

export function makeWaterfrontSprites(_factory: typeof mk): Record<string, Sprite> {
  // 1. Harbor Timber Wayfinding Signboard (26x30)
  const c04_quay_sign = craftSprite(
    26,
    30,
    b => {
      b.rect(11, 15, 4, 12, RAMPS.wood[1]);
      b.vline(11, 15, 12, RAMPS.wood[3]);
      // Framed oak board + peaked shingle cap + anchor glyph
      b.rect(3, 5, 20, 12, RAMPS.wood[2]);
      b.rect(4, 6, 18, 10, RAMPS.timber[3]);
      b.hline(2, 4, 22, RAMPS.wood[4]);
      b.hline(6, 9, 14, RAMPS.wood[1]);
      b.rect(9, 11, 8, 2, RAMPS.copper[2]);
    },
    { cx: 13, cy: 27, rx: 6, ry: 2 },
  );

  // 2. Timber Wharf Rope-Hoist Davit Gallows (36x44)
  const c04_rope_pulley = craftSprite(
    36,
    44,
    b => {
      b.rect(6, 36, 12, 4, RAMPS.wood[0]);
      b.rect(8, 8, 4, 30, RAMPS.wood[2]);
      b.vline(8, 8, 30, RAMPS.wood[4]);
      b.rect(8, 7, 22, 4, RAMPS.timber[2]);
      b.hline(8, 7, 22, RAMPS.timber[4]);
      b.line(12, 18, 20, 11, RAMPS.wood[3], 2);
      // Grooved pulley block + taut hemp rope lifting fish crate
      drawWheel(b, 27, 13, 3, 3, 4, RAMPS.iron, RAMPS.brass);
      b.vline(27, 16, 13, RAMPS.cream[3]);
      b.rect(22, 29, 10, 8, RAMPS.timber[2]);
      b.hline(22, 29, 10, RAMPS.timber[4]);
      b.hline(22, 33, 10, RAMPS.wood[1]);
    },
    { cx: 18, cy: 40, rx: 14, ry: 2.5 },
  );

  // 3. Notched Oak Wharf Bollard with Mooring Wrap (18x26)
  const c04_bollard = craftSprite(
    18,
    26,
    b => {
      b.rect(6, 5, 6, 17, RAMPS.wood[2]);
      b.vline(6, 5, 17, RAMPS.wood[4]);
      b.rect(5, 4, 8, 3, RAMPS.iron[2]);
      b.hline(5, 4, 8, RAMPS.steel[4]);
      for (const ry of [12, 15, 18]) {
        b.hline(5, ry, 8, RAMPS.cream[3]);
        b.hline(5, ry + 1, 8, RAMPS.cream[1]);
      }
    },
    { cx: 9, cy: 23, rx: 6, ry: 2 },
  );

  // 4. Timber Wharf Storm Lantern Post (22x38)
  const c04_lamp = craftSprite(
    22,
    38,
    b => {
      b.rect(9, 13, 4, 21, RAMPS.wood[2]);
      b.vline(9, 13, 21, RAMPS.wood[4]);
      b.hline(7, 11, 8, RAMPS.iron[2]);
      b.rect(7, 6, 8, 6, RAMPS.ember[3]);
      b.rect(9, 7, 4, 4, RAMPS.ember[4]);
      b.rect(6, 4, 10, 2, RAMPS.iron[2]);
    },
    { cx: 11, cy: 34, rx: 6, ry: 2 },
  );

  // 5. Maritime Yardarm Signal Mast & Pennant (30x40)
  const c04_signal = craftSprite(
    30,
    40,
    b => {
      b.rect(13, 4, 3, 33, RAMPS.wood[2]);
      b.vline(13, 4, 33, RAMPS.wood[4]);
      b.hline(4, 10, 22, RAMPS.timber[3]);
      b.line(6, 11, 13, 21, RAMPS.cream[2]); // halyard
      // Crimson-and-cream harbor signal pennant
      b.rect(17, 11, 10, 8, RAMPS.cloth[2]);
      b.hline(17, 11, 10, RAMPS.cloth[4]);
      b.rect(19, 13, 5, 3, RAMPS.cream[4]);
    },
    { cx: 15, cy: 37, rx: 7, ry: 2 },
  );

  // 6. Mossy Stone Culvert Tide Flap Gate (26x28)
  const c04_tide_gate = craftSprite(
    26,
    28,
    b => {
      b.rect(3, 4, 20, 21, RAMPS.stone[2]);
      b.hline(3, 4, 20, RAMPS.stone[4]);
      b.rect(6, 7, 14, 15, RAMPS.iron[1]);
      for (let x = 8; x < 19; x += 3) b.vline(x, 7, 15, RAMPS.steel[3]);
      b.rect(6, 18, 14, 4, RAMPS.moss[2]);
      b.rect(9, 2, 8, 3, RAMPS.brass[3]);
    },
    { cx: 13, cy: 25, rx: 10, ry: 2 },
  );

  // 7. Weathered Notice Board with Pinned Torn Parchment (24x28)
  const c04_torn_notice = craftSprite(
    24,
    28,
    b => {
      b.rect(10, 18, 4, 7, RAMPS.wood[1]);
      b.rect(3, 4, 18, 16, RAMPS.wood[2]);
      b.hline(3, 4, 18, RAMPS.wood[4]);
      b.rect(5, 6, 14, 11, RAMPS.cream[3]);
      b.rect(14, 14, 5, 4, RAMPS.wood[1]); // torn missing corner
      for (let y = 8; y <= 14; y += 2) b.hline(7, y, 8, RAMPS.stone[1]);
      b.p(6, 7, RAMPS.cloth[3]); // red wax pin
    },
    { cx: 12, cy: 25, rx: 8, ry: 2 },
  );

  // 8. Storm-Shattered Pier Timber & Splinter Pile (36x22)
  const c04_splinter_pile = craftSprite(
    36,
    22,
    b => {
      b.line(4, 16, 26, 10, RAMPS.wood[1], 3);
      b.line(8, 11, 31, 16, RAMPS.timber[2], 3);
      b.line(12, 16, 22, 6, RAMPS.timber[3], 2);
      b.rect(18, 13, 3, 2, RAMPS.moss[2]); // wet seaweed
      b.p(28, 14, RAMPS.steel[4]); // bent spike
    },
    { cx: 18, cy: 18, rx: 15, ry: 2.5 },
  );

  // 9. Snapped Oak Dock Piling Stub (24x34)
  const c04_broken_post = craftSprite(
    24,
    34,
    b => {
      b.rect(9, 10, 6, 20, RAMPS.wood[2]);
      b.vline(9, 10, 20, RAMPS.wood[4]);
      // Jagged split wood top splinters
      b.vline(10, 6, 4, RAMPS.timber[3]);
      b.vline(12, 4, 6, RAMPS.timber[4]);
      b.vline(14, 8, 2, RAMPS.wood[2]);
      // Algae stain + frayed dangling rope
      b.rect(9, 25, 6, 4, RAMPS.moss[1]);
      b.hline(8, 18, 8, RAMPS.cream[3]);
      b.vline(16, 19, 6, RAMPS.cream[2]);
    },
    { cx: 12, cy: 30, rx: 7, ry: 2.5 },
  );

  // 10. Chamfered Diamond Hazard Warning Signpost (24x30)
  const c04_warning = craftSprite(
    24,
    30,
    b => {
      b.rect(10, 16, 4, 11, RAMPS.wood[1]);
      b.vline(10, 16, 11, RAMPS.wood[3]);
      for (let dy = -6; dy <= 6; dy++) {
        const hw = 6 - Math.abs(dy);
        for (let dx = -hw; dx <= hw; dx++) {
          b.p(12 + dx, 10 + dy, dy < -2 ? RAMPS.brass[4] : Math.abs(dx) === hw ? RAMPS.brass[1] : RAMPS.brass[3]);
        }
      }
      b.rect(11, 6, 2, 5, RAMPS.iron[0]);
      b.rect(11, 12, 2, 2, RAMPS.iron[0]);
    },
    { cx: 12, cy: 27, rx: 6, ry: 2 },
  );

  // 11. Perched Coastal Crow (26x18)
  const c04_crow = craftSprite(
    26,
    18,
    b => {
      b.matrix(
        5,
        3,
        [
          '.......bbbbb....',
          '......bSSSSsb...',
          '..bb..bSSwSSbbb.',
          '.bbbbbbSSSSSsss.',
          'bSSbbbbSSSsbb...',
          '.bbbbbSSSSs.....',
          '...bbbssss......',
          '.....b...b......',
          '....bb..bb......',
        ],
        { b: RAMPS.coal[0], S: RAMPS.coal[2], s: RAMPS.slate[2], w: RAMPS.cream[4] },
      );
    },
    { cx: 13, cy: 14, rx: 6, ry: 2 },
  );

  // 12. Algae-Draped Drainage Sluice Stone (26x20)
  const c04_algae_sluice = craftSprite(
    26,
    20,
    b => {
      b.rect(3, 5, 20, 11, RAMPS.stone[2]);
      b.hline(3, 5, 20, RAMPS.stone[4]);
      b.rect(5, 8, 16, 5, RAMPS.water[2]);
      for (let x = 6; x < 20; x += 3) b.rect(x, 10, 2, 6, RAMPS.moss[2 + ((x / 3) | 0) % 2]);
    },
    { cx: 13, cy: 16, rx: 10, ry: 2 },
  );

  // 13. Coastal Sea-Tern (26x18)
  const c04_tern = craftSprite(
    26,
    18,
    b => {
      b.matrix(
        4,
        3,
        [
          '........kkkk....',
          '.......kWWWWk...',
          '.......kWWkWooo.',
          '..gggggWWWWWWo..',
          '.gSSSSWWWWWW....',
          '..ggggWWWWW.....',
          '.....r...r......',
          '....rr..rr......',
        ],
        { k: RAMPS.coal[0], W: '#f4f0e8', g: RAMPS.slate[3], S: RAMPS.slate[4], o: RAMPS.ember[3], r: RAMPS.cloth[3] },
      );
    },
    { cx: 13, cy: 14, rx: 6, ry: 2 },
  );

  // 14. Wicker Basket of Seabird Feathers (22x18)
  const c04_feather_basket = craftSprite(
    22,
    18,
    b => {
      // Soft white-and-slate quills poking out of basket top
      b.line(7, 8, 5, 3, '#f2eee6', 2);
      b.line(11, 8, 11, 2, '#d8e0e4', 2);
      b.line(15, 8, 17, 4, '#f2eee6', 2);
      // Woven wicker basket body
      b.rect(3, 8, 16, 7, RAMPS.sawdust[2]);
      b.hline(3, 8, 16, RAMPS.sawdust[4]);
      for (let y = 10; y < 15; y += 2) for (let x = 4; x < 18; x += 3) b.p(x + (y % 4 ? 0 : 1), y, RAMPS.wood[1]);
    },
    { cx: 11, cy: 15, rx: 8, ry: 2 },
  );

  // 15. Coastal Reed Windbreak Screen (36x28)
  const c04_reed_screen = craftSprite(
    36,
    28,
    b => {
      b.rect(4, 4, 3, 21, RAMPS.wood[1]);
      b.rect(29, 4, 3, 21, RAMPS.wood[1]);
      for (let x = 7; x < 29; x += 2) {
        const h = 16 + ((hash2(x, 1, 7) * 5) | 0);
        b.vline(x, 22 - h, h, x % 4 === 1 ? RAMPS.sawdust[2] : RAMPS.moss[3]);
      }
      b.hline(4, 8, 28, RAMPS.wood[3]);
      b.hline(4, 18, 28, RAMPS.wood[2]);
    },
    { cx: 18, cy: 25, rx: 14, ry: 2.5 },
  );

  // 16. Timber A-Frame Fish Drying Rack (30x24)
  const fish_drying_rack = craftSprite(
    30,
    24,
    b => {
      b.rect(3, 4, 3, 17, RAMPS.wood[2]);
      b.rect(24, 4, 3, 17, RAMPS.wood[2]);
      b.rect(3, 5, 24, 2, RAMPS.timber[4]);
      for (let x = 8; x < 23; x += 4) {
        b.p(x + 1, 7, RAMPS.cream[3]); // string
        b.rect(x, 9, 3, 8, RAMPS.slate[3]); // silvery fish body
        b.vline(x + 1, 10, 6, RAMPS.water[4]);
        b.p(x + 1, 17, RAMPS.slate[4]); // tail fin
      }
    },
    { cx: 15, cy: 21, rx: 12, ry: 2.5 },
  );

  // 17. Crisp 2.5D Coiled Nautical Hemp Rope Pile (20x16 — clear layered loops!)
  const rope_coil = craftSprite(
    20,
    16,
    b => {
      // Bottom coil tier
      b.ellipse(9, 10, 7, 3.5, (nx, ny) => (Math.hypot(nx, ny) > 0.72 ? (ny < 0 ? RAMPS.sawdust[3] : RAMPS.sawdust[1]) : RAMPS.wood[0]));
      // Middle coil tier
      b.ellipse(9, 8, 5.5, 2.8, (nx, ny) => (Math.hypot(nx, ny) > 0.65 ? (ny < 0 ? RAMPS.cream[4] : RAMPS.sawdust[2]) : RAMPS.wood[0]));
      // Top loop tier
      b.ellipse(9, 6, 3.5, 1.8, (nx, ny) => (Math.hypot(nx, ny) > 0.45 ? (ny < 0 ? RAMPS.cream[4] : RAMPS.cream[2]) : RAMPS.wood[0]));
      // Loose trailing hemp tail
      b.line(14, 11, 18, 12, RAMPS.sawdust[3], 2);
      b.p(18, 13, RAMPS.cream[4]);
    },
    { cx: 10, cy: 13, rx: 7, ry: 2 },
  );

  return {
    c04_quay_sign,
    c04_rope_pulley,
    c04_bollard,
    c04_lamp,
    c04_signal,
    c04_tide_gate,
    c04_torn_notice,
    c04_splinter_pile,
    c04_broken_post,
    c04_warning,
    c04_crow,
    c04_algae_sluice,
    c04_tern,
    c04_feather_basket,
    c04_reed_screen,
    fish_drying_rack,
    rope_coil,
  };
}

export function drawWaterfrontDeckTile(g: CanvasRenderingContext2D, x: number, y: number, poiId: string, edgeMask: number): void {
  drawDeckTileCanvas(g, x, y, { id: poiId, open: true, overWater: true, edges: edgeMask });
}