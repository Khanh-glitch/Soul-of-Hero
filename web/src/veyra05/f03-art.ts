/**
 * F03 INDUSTRIAL & INFRASTRUCTURE PIXEL ART (29 sprites + 5 material ground painters).
 *
 * Completely redesigned from scratch using Soul of Hero's 2.5D top-down oblique
 * projection, unified `#140c14` outline, NW global lighting, hue-shifted material
 * ramps, cylindrical/domed Bayer shading, and authentic mechanical engineering.
 */
import { type Sprite, mk } from '../game/art';
import { hash2 } from '../game/core';
import {
  PxBuf,
  RAMPS,
  craftSprite,
  ditherTone,
  drawCylH,
  drawCylV,
  drawOrganicHeap,
  drawWheel,
} from './pixel-craft';
import { drawDeckTileCanvas } from './surface-art';

export function makeF03Sprites(_factory: typeof mk): Record<string, Sprite> {
  // 1. Hydroelectric Francis Scroll Turbine & Copper Dynamo (44x40)
  const f03_turbine = craftSprite(
    44,
    40,
    b => {
      // Dressed stone plinth base
      b.rect(5, 29, 34, 7, RAMPS.stone[1]);
      b.hline(5, 29, 34, RAMPS.stone[3]);
      b.hline(5, 35, 34, RAMPS.stone[0]);
      for (let x = 9; x < 37; x += 6) b.rect(x, 31, 2, 2, RAMPS.iron[4]);
      // Submerged penstock flange entering from left
      drawCylH(b, 2, 22, 12, 8, RAMPS.steel, { flanges: [4, 11] });
      // Cast-iron spiral scroll volute casing
      b.ellipse(24, 24, 14, 9, (nx, ny, x, y) => {
        const d = Math.hypot(nx, ny);
        if (d > 0.85 && ny > 0.2) return RAMPS.iron[0];
        return ditherTone(RAMPS.iron, 0.58 - nx * 0.32 - ny * 0.28, x, y, 0.1);
      });
      // Vertical copper-teal dynamo stator perched atop volute
      drawCylV(b, 16, 7, 16, 17, RAMPS.copper, { hoops: [12, 19], seamX: 0.72 });
      // Brass exciter cap & governor dome
      drawCylV(b, 20, 3, 8, 5, RAMPS.brass, {});
      b.p(23, 4, RAMPS.brass[4]);
      // Side discharge manifold & gauge
      drawCylH(b, 32, 21, 9, 5, RAMPS.brass, { flanges: [39] });
    },
    { cx: 22, cy: 36, rx: 18, ry: 3 },
  );

  // 2. Overshot Timber Mill Waterwheel & Flume Cascade (46x46)
  const f03_waterwheel = craftSprite(
    46,
    46,
    b => {
      // Tailrace churning water pool at base
      b.ellipse(23, 39, 17, 4, (nx, ny, x, y) => {
        const r = hash2(x, y, 12);
        return r > 0.78 ? RAMPS.water[4] : ditherTone(RAMPS.water, 0.45 - ny * 0.25, x, y, 0.12);
      });
      // Stone bearing pier on right
      b.rect(32, 22, 8, 17, RAMPS.stone[1]);
      b.rect(32, 22, 8, 4, RAMPS.stone[3]);
      b.hline(32, 22, 8, RAMPS.stone[4]);
      // Overhead timber headrace flume feeding wheel from left
      b.rect(2, 5, 22, 5, RAMPS.wood[1]);
      b.hline(2, 5, 22, RAMPS.wood[4]);
      b.rect(2, 6, 20, 2, RAMPS.water[3]);
      // Large 3/4 oak waterwheel with 8 spokes & 12 buckets
      drawWheel(b, 21, 23, 13, 13, 8, RAMPS.timber, RAMPS.iron, { buckets: 12, angleOff: 0.2 });
      // Timber A-frame foreground support & iron journal box
      b.line(15, 39, 21, 23, RAMPS.wood[2], 2);
      b.line(27, 39, 21, 23, RAMPS.wood[1], 2);
      b.rect(19, 21, 4, 4, RAMPS.iron[3]);
      b.p(20, 22, RAMPS.brass[4]);
      // Cascading water ribbons pouring from flume into upper buckets & splash foam
      for (let y = 7; y < 22; y += 2) {
        b.p(18 + (y % 3), y, y % 4 === 1 ? RAMPS.water[4] : RAMPS.water[3]);
        b.p(15 + (y % 2), y + 4, RAMPS.water[3]);
      }
      for (const [sx, sy] of [[12, 37], [16, 38], [22, 39], [28, 38], [19, 36]]) {
        b.rect(sx, sy, 2, 1, RAMPS.water[4]);
      }
    },
    { cx: 23, cy: 40, rx: 18, ry: 4 },
  );

  // 3. Geared Rack-and-Pinion Dam Sluice Gate (32x36)
  const f03_steel_gate = craftSprite(
    32,
    36,
    b => {
      // Cut stone wing abutments
      b.rect(2, 13, 5, 20, RAMPS.stone[2]);
      b.hline(2, 13, 5, RAMPS.stone[4]);
      b.rect(25, 13, 5, 20, RAMPS.stone[1]);
      b.hline(25, 13, 5, RAMPS.stone[3]);
      // Ribbed steel sluice gate leaf
      b.rect(7, 15, 18, 17, RAMPS.steel[1]);
      for (let x = 9; x < 24; x += 4) b.vline(x, 15, 17, RAMPS.steel[3]);
      for (let y = 18; y <= 28; y += 5) b.hline(7, y, 18, RAMPS.iron[0]);
      // Wet moss/water stain at gate base
      b.rect(7, 29, 18, 3, RAMPS.copper[1]);
      b.hline(8, 30, 14, RAMPS.water[3]);
      // Overhead channel-iron crosshead gantry beam
      b.rect(3, 10, 26, 4, RAMPS.iron[2]);
      b.hline(3, 10, 26, RAMPS.iron[4]);
      // Vertical toothed rack stem + pinion bevel housing + spoked handwheel
      b.rect(15, 4, 2, 12, RAMPS.steel[3]);
      for (let y = 5; y < 14; y += 2) b.p(15, y, RAMPS.iron[0]);
      b.rect(12, 7, 8, 5, RAMPS.brass[2]);
      drawWheel(b, 16, 5, 5, 3, 4, RAMPS.rust, RAMPS.brass, {});
    },
    { cx: 16, cy: 33, rx: 14, ry: 2.5 },
  );

  // 4. Industrial Flanged Pipe Rack Bundle (48x28)
  const f03_pipe_bundle = craftSprite(
    48,
    28,
    b => {
      // Two oak-and-iron pipe sleepers underneath
      for (const sx of [10, 34]) {
        b.rect(sx, 5, 4, 19, RAMPS.wood[1]);
        b.vline(sx, 5, 19, RAMPS.wood[3]);
      }
      // Three parallel cylindrical pipes in staggered depth
      drawCylH(b, 2, 4, 44, 5, RAMPS.copper, { flanges: [14, 30], endCapLeft: true, endCapRight: true });
      drawCylH(b, 2, 11, 44, 6, RAMPS.steel, { flanges: [9, 24, 38], endCapLeft: true, endCapRight: true });
      drawCylH(b, 2, 19, 44, 5, RAMPS.rust, { flanges: [18, 33], endCapLeft: true, endCapRight: true });
      // Brass pressure bleed valve on middle pipe
      b.rect(23, 9, 3, 2, RAMPS.brass[3]);
      b.p(24, 8, RAMPS.brass[4]);
    },
    { cx: 24, cy: 25, rx: 22, ry: 2.5 },
  );

  // 5. Ruptured & Corroded Abandoned Pipe (40x24)
  const f03_rust_pipe = craftSprite(
    40,
    24,
    b => {
      // Mineral/rust sludge puddle leaking from fracture
      b.ellipse(14, 18, 9, 3, (nx, ny, x, y) => ditherTone(RAMPS.turbid, 0.4 - ny * 0.2, x, y, 0.14));
      // Broken stone saddle
      b.rect(25, 14, 7, 6, RAMPS.stone[1]);
      b.hline(25, 14, 7, RAMPS.stone[3]);
      // Corroded iron horizontal pipe ending in jagged break
      drawCylH(b, 14, 11, 22, 6, RAMPS.rust, { flanges: [28], endCapRight: true });
      // Vertical upturned fractured riser elbow
      drawCylV(b, 30, 3, 7, 11, RAMPS.rust, { hoops: [6] });
      // Jagged broken left pipe mouth + moss creep
      b.p(13, 12, RAMPS.iron[0]);
      b.p(12, 14, RAMPS.rust[2]);
      b.p(13, 16, RAMPS.iron[0]);
      b.rect(20, 11, 3, 2, RAMPS.moss[2]);
      b.p(21, 10, RAMPS.moss[3]);
    },
    { cx: 21, cy: 20, rx: 16, ry: 2.5 },
  );

  // 6. Flanged Cast-Iron Gate Valve Assembly (26x34)
  const f03_valve = craftSprite(
    26,
    34,
    b => {
      // Pipe line at base
      drawCylH(b, 3, 22, 20, 6, RAMPS.steel, { flanges: [5, 19], endCapLeft: true, endCapRight: true });
      // Bolted valve bonnet body
      drawCylV(b, 9, 13, 8, 12, RAMPS.iron, { hoops: [17] });
      // Rising brass threaded stem
      b.rect(12, 7, 2, 7, RAMPS.brass[3]);
      b.p(12, 9, RAMPS.brass[1]);
      b.p(12, 11, RAMPS.brass[1]);
      // Crimson spoked cast-iron handwheel
      drawWheel(b, 13, 6, 8, 4, 6, RAMPS.cloth, RAMPS.brass, {});
    },
    { cx: 13, cy: 29, rx: 10, ry: 2.5 },
  );

  // 7. Hydraulic / Steam Gauge Pedestal Panel (26x32)
  const f03_gauge_panel = craftSprite(
    26,
    32,
    b => {
      // Flanged pedestal foot & post
      b.rect(8, 25, 10, 4, RAMPS.iron[1]);
      b.hline(8, 25, 10, RAMPS.iron[3]);
      b.rect(11, 19, 4, 7, RAMPS.iron[2]);
      // Copper capillary tubes up left side
      b.vline(7, 15, 11, RAMPS.copper[3]);
      b.vline(18, 15, 11, RAMPS.brass[2]);
      // Sloped steel instrument cabinet
      b.rect(4, 5, 18, 15, RAMPS.steel[2]);
      b.rect(4, 4, 18, 3, RAMPS.steel[4]);
      b.rect(5, 8, 16, 10, RAMPS.iron[0]);
      // Twin round cream-dial pressure gauges with brass bezels and needles
      for (const gx of [9, 16]) {
        b.ellipse(gx, 12, 3, 3, RAMPS.brass[3]);
        b.ellipse(gx, 12, 2, 2, RAMPS.cream[4]);
        b.p(gx, 12, RAMPS.cloth[2]);
        b.p(gx + (gx === 9 ? 1 : -1), 11, RAMPS.cloth[3]);
      }
      // Status toggle levers at bottom of panel
      b.rect(7, 16, 3, 2, RAMPS.cloth[3]);
      b.rect(15, 16, 3, 2, RAMPS.moss[3]);
    },
    { cx: 13, cy: 29, rx: 9, ry: 2.5 },
  );

  // 8. Felled Log Cradle Bunk (56x32)
  const f03_log_cradle = craftSprite(
    56,
    32,
    b => {
      // Heavy notched oak sleeper skids on ground
      for (const sx of [9, 41]) {
        b.rect(sx, 22, 6, 6, RAMPS.wood[1]);
        b.hline(sx, 22, 6, RAMPS.wood[3]);
      }
      // Bottom row: 3 bark-clad felled logs with pale growth-ring ends
      for (let i = 0; i < 3; i++) {
        drawCylH(b, 4 + i * 16, 17, 15, 8, RAMPS.wood, { endCapRight: true, ringEnd: true });
      }
      // Upper cradled logs
      drawCylH(b, 10, 10, 17, 8, RAMPS.timber, { endCapRight: true, ringEnd: true });
      drawCylH(b, 28, 10, 17, 8, RAMPS.wood, { endCapRight: true, ringEnd: true });
      // Top crown log + iron retaining chain
      drawCylH(b, 19, 4, 17, 7, RAMPS.timber, { endCapRight: true, ringEnd: true });
      b.vline(14, 10, 16, RAMPS.iron[3]);
      b.vline(40, 10, 16, RAMPS.iron[3]);
    },
    { cx: 28, cy: 28, rx: 24, ry: 3 },
  );

  // 9. Stickered Air-Drying Sawn Lumber Stack (50x34)
  const f03_timber_pile = craftSprite(
    50,
    34,
    b => {
      // Base sleepers
      b.rect(5, 28, 40, 2, RAMPS.wood[0]);
      // 3 staggered courses of sawn planks separated by dark air-drying sticker gaps
      for (let c = 0; c < 3; c++) {
        const y = 22 - c * 6;
        const inset = c * 2;
        const w = 42 - c * 4;
        // Front plank ends showing distinct individual boards
        b.rect(4 + inset, y, w, 4, RAMPS.timber[2]);
        b.hline(4 + inset, y, w, RAMPS.timber[4]);
        for (let px = 4 + inset + 5; px < 4 + inset + w - 2; px += 6) {
          b.vline(px, y, 4, RAMPS.wood[0]);
          b.p(px + 2, y + 2, RAMPS.sawdust[3]); // growth heart
        }
        // Dark sticker air-gap line
        b.hline(5 + inset, y + 4, w - 2, RAMPS.wood[0]);
        for (let sx = 7 + inset; sx < 4 + inset + w - 4; sx += 11) {
          b.rect(sx, y + 4, 2, 2, RAMPS.timber[1]); // sticker spacer
        }
      }
      // Sloped corrugated tin rain-cap on top
      b.rect(6, 5, 38, 5, RAMPS.steel[2]);
      b.hline(6, 5, 38, RAMPS.steel[4]);
      for (let x = 9; x < 42; x += 4) b.vline(x, 6, 4, RAMPS.steel[1]);
    },
    { cx: 25, cy: 30, rx: 22, ry: 3 },
  );

  // 10. Carriage / Gang Reciprocating Sawmill Frame (58x46)
  const f03_sawframe = craftSprite(
    58,
    46,
    b => {
      // Twin iron log-carriage track rails running horizontally
      b.hline(2, 36, 54, RAMPS.steel[3]);
      b.hline(2, 37, 54, RAMPS.iron[0]);
      b.hline(2, 31, 54, RAMPS.steel[2]);
      // Wheeled timber carriage bed & half-sawn cedar log moving through
      b.rect(5, 29, 26, 6, RAMPS.wood[2]);
      b.hline(5, 29, 26, RAMPS.wood[4]);
      for (const wx of [9, 18, 27]) drawWheel(b, wx, 36, 2, 2, 4, RAMPS.iron, RAMPS.steel);
      drawCylH(b, 8, 22, 22, 7, RAMPS.timber, { endCapRight: true, ringEnd: true });
      // Heavy mortised oak & iron gantry portal straddling the track
      b.rect(24, 6, 5, 33, RAMPS.wood[1]);
      b.vline(25, 6, 33, RAMPS.wood[3]);
      b.rect(43, 6, 5, 33, RAMPS.wood[1]);
      b.vline(44, 6, 33, RAMPS.wood[3]);
      b.rect(22, 4, 28, 5, RAMPS.iron[2]);
      b.hline(22, 4, 28, RAMPS.iron[4]);
      // Gleaming vertical reciprocating saw blade with serrated teeth
      b.rect(35, 9, 3, 24, RAMPS.steel[4]);
      b.vline(37, 9, 24, RAMPS.steel[1]);
      for (let y = 11; y < 32; y += 2) b.p(34, y, RAMPS.steel[4]); // teeth
      // Overhead drive flywheel & leather belt on right post
      drawWheel(b, 48, 12, 5, 5, 4, RAMPS.rust, RAMPS.brass, {});
      b.line(47, 17, 47, 30, RAMPS.wood[0]);
      // Golden sawdust spray at blade kerf
      for (const [sx, sy] of [[31, 33], [33, 35], [37, 34], [39, 36], [35, 37], [30, 36]]) {
        b.p(sx, sy, RAMPS.sawdust[3]);
      }
    },
    { cx: 29, cy: 40, rx: 25, ry: 4 },
  );

  // 11. Sawdust Cone & Wooden Scoop (36x24)
  const f03_sawdust = craftSprite(
    36,
    24,
    b => {
      drawOrganicHeap(b, 17, 19, 13, 12, RAMPS.sawdust, 303, { col: RAMPS.timber[2], chance: 0.14, hi: RAMPS.sawdust[4] });
      // Propped wooden grain/sawdust scoop shovel on right flank
      b.line(22, 16, 30, 6, RAMPS.wood[3]);
      b.rect(20, 15, 4, 3, RAMPS.steel[3]);
    },
    { cx: 18, cy: 20, rx: 14, ry: 3 },
  );

  // 12. Conveyor Chain & Haulage Rail Track (58x28)
  const f03_chain_rail = craftSprite(
    58,
    28,
    b => {
      // Timber trestle sleepers
      for (let x = 4; x < 54; x += 8) {
        b.rect(x, 14, 3, 10, RAMPS.wood[1]);
        b.vline(x, 14, 10, RAMPS.wood[3]);
      }
      // Twin steel channel guide rails
      b.rect(2, 10, 52, 7, RAMPS.iron[1]);
      b.hline(2, 10, 52, RAMPS.steel[4]);
      b.hline(2, 16, 52, RAMPS.steel[3]);
      // Heavy linked haulage chain & spiked drag lugs down the trough
      b.hline(4, 13, 48, RAMPS.iron[0]);
      for (let x = 5; x < 51; x += 4) {
        b.rect(x, 12, 2, 3, RAMPS.rust[3]);
        b.p(x, 12, RAMPS.steel[4]);
      }
      // Tail sprocket drive drum on right
      drawWheel(b, 51, 13, 4, 4, 4, RAMPS.rust, RAMPS.brass, {});
    },
    { cx: 29, cy: 24, rx: 26, ry: 2.5 },
  );

  // 13. Sloped Timber & Steel Ore Loading Chute Ramp (50x32)
  const f03_ore_ramp = craftSprite(
    50,
    32,
    b => {
      // Timber cribwork trestle legs supporting sloped chute from upper-left to lower-right
      b.rect(6, 12, 4, 16, RAMPS.wood[1]);
      b.rect(18, 16, 4, 12, RAMPS.wood[1]);
      b.rect(31, 20, 4, 8, RAMPS.wood[1]);
      // Angled steel-plated chute floor + sideboards
      for (let i = 0; i < 36; i++) {
        const x = 5 + i;
        const y = 7 + Math.round(i * 0.42);
        b.rect(x, y, 2, 7, RAMPS.iron[2]);
        b.p(x, y, RAMPS.steel[4]); // top sideboard rail
        b.p(x, y + 6, RAMPS.wood[2]); // outer timber lip
        // Ore pebbles sliding down chute
        if (i % 5 === 1) b.rect(x, y + 2, 2, 2, RAMPS.ore[3]);
      }
      // Spilled ore mound at chute discharge mouth
      drawOrganicHeap(b, 42, 28, 6, 5, RAMPS.ore, 411, { col: RAMPS.stone[3], chance: 0.2 });
    },
    { cx: 25, cy: 28, rx: 22, ry: 3 },
  );

  // 14. Stratified Quarry Tailings / Waste Rock Heap (48x30)
  const f03_spoil_heap = craftSprite(
    48,
    30,
    b => {
      drawOrganicHeap(b, 23, 25, 19, 17, RAMPS.stone, 515, { col: RAMPS.slate[2], chance: 0.25, hi: RAMPS.stone[4] });
      // Secondary smaller rock shoulder on left
      drawOrganicHeap(b, 10, 25, 7, 8, RAMPS.slate, 521, { col: RAMPS.stone[3], chance: 0.2 });
    },
    { cx: 24, cy: 26, rx: 21, ry: 3 },
  );

  // 15. Exposed Mineral Ore Vein Outcrop (40x28)
  const f03_ore_seam = craftSprite(
    40,
    28,
    b => {
      // Multi-boulder stepped craggy rock shelf (distinct from cone spoil heaps)
      b.ellipse(15, 18, 10, 7, (nx, ny, x, y) => ditherTone(RAMPS.slate, 0.56 - nx * 0.3 - ny * 0.35, x, y, 0.1));
      b.ellipse(25, 16, 10, 8, (nx, ny, x, y) => ditherTone(RAMPS.slate, 0.6 - nx * 0.35 - ny * 0.35, x, y, 0.1));
      b.ellipse(19, 13, 7, 5, (nx, ny, x, y) => ditherTone(RAMPS.slate, 0.66 - nx * 0.3 - ny * 0.35, x, y, 0.08));
      // Fracture cleavage step & branching metallic copper/iron ore veins
      b.line(9, 19, 18, 13, RAMPS.slate[0]);
      b.line(11, 18, 18, 12, RAMPS.ore[3], 2);
      b.p(15, 14, RAMPS.gold[4]);
      b.line(22, 20, 30, 12, RAMPS.ore[2], 2);
      b.p(25, 16, RAMPS.gold[4]);
      b.p(28, 13, RAMPS.ore[4]);
      // Miner's iron pickaxe wedged into top fissure
      b.line(21, 9, 27, 4, RAMPS.wood[3]);
      b.line(24, 3, 30, 6, RAMPS.steel[4]);
    },
    { cx: 20, cy: 24, rx: 16, ry: 3 },
  );

  // 16. Obsidian Volcanic Glass Shard Heap (40x30)
  const f03_glass_spoil = craftSprite(
    40,
    30,
    b => {
      // Dark volcanic ash mound base
      drawOrganicHeap(b, 20, 25, 15, 6, RAMPS.basalt, 701);
      // Angular tilted faceted volcanic glass crystal blades leaning outward
      const shards: [number, number, number, number, number][] = [
        [15, 22, 7, 11, 3],
        [18, 22, 17, 4, 4],
        [23, 22, 26, 6, 4],
        [26, 23, 34, 13, 3],
      ];
      for (const [bx, by, tx, ty, w] of shards) {
        const steps = Math.max(1, Math.abs(by - ty));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const cx = Math.round(tx + (bx - tx) * t);
          const y = Math.round(ty + (by - ty) * t);
          const half = Math.round(t * w);
          for (let dx = -half; dx <= half; dx++) {
            b.p(cx + dx, y, dx < 0 ? RAMPS.obsidian[3] : dx === 0 ? RAMPS.obsidian[2] : RAMPS.obsidian[1]);
          }
          if (half > 0) b.p(cx - half, y, RAMPS.obsidian[4]);
        }
        b.p(tx, ty, '#ffffff');
      }
    },
    { cx: 20, cy: 26, rx: 16, ry: 3 },
  );

  // 17. Heavy Blake Jaw Crusher with Flywheel & Feed Hopper (54x52)
  const f03_crusher = craftSprite(
    54,
    52,
    b => {
      // Heavy steel & stone mounting frame
      b.rect(11, 20, 32, 24, RAMPS.iron[1]);
      b.rect(13, 21, 28, 21, RAMPS.iron[2]);
      b.hline(11, 20, 32, RAMPS.iron[4]);
      b.rect(11, 41, 7, 5, RAMPS.stone[2]);
      b.rect(36, 41, 7, 5, RAMPS.stone[2]);
      b.rect(18, 36, 18, 8, RAMPS.steel[1]);
      // Crushed stone gravel discharging onto apron below
      drawOrganicHeap(b, 27, 47, 9, 5, RAMPS.stone, 809);
      // Flared feed hopper on top with raw boulders queued inside
      for (let py = 0; py < 12; py++) {
        const spread = Math.round((11 - py) * 0.6);
        b.hline(12 - spread, 8 + py, 30 + spread * 2, py < 2 ? RAMPS.steel[4] : RAMPS.steel[2]);
      }
      b.rect(13, 9, 28, 6, RAMPS.iron[0]);
      for (let x = 15; x < 39; x += 3) b.vline(x, 10, 5, RAMPS.steel[3]);
      for (const [rx, ry] of [[18, 8], [24, 7], [30, 8]]) {
        b.ellipse(rx, ry, 3, 2, (nx, ny) => (ny < 0 ? RAMPS.stone[4] : RAMPS.stone[2]));
      }
      // Massive spoked cast-iron flywheel + diagonal drive belt
      b.line(10, 29, 4, 41, RAMPS.wood[0]);
      drawWheel(b, 10, 29, 8, 9, 6, RAMPS.rust, RAMPS.brass, { angleOff: 0.3 });
      b.rect(42, 24, 5, 10, RAMPS.steel[2]);
      b.rect(43, 26, 3, 3, RAMPS.brass[3]);
    },
    { cx: 27, cy: 47, rx: 21, ry: 3.5 },
  );

  // 18. Inclined Vibrating Rock Grizzly Screen (44x34)
  const f03_screen = craftSprite(
    44,
    34,
    b => {
      // Steel frame legs & 4 coil suspension springs
      for (const lx of [7, 33]) {
        b.rect(lx, 18, 4, 12, RAMPS.iron[1]);
        for (let sy = 15; sy <= 18; sy += 2) b.hline(lx, sy, 4, RAMPS.brass[3]);
      }
      // Tilted screen shaker box
      b.rect(5, 7, 34, 14, RAMPS.iron[2]);
      b.hline(5, 7, 34, RAMPS.steel[4]);
      b.rect(7, 9, 30, 10, RAMPS.iron[0]);
      // Tensioned grizzly wire-mesh bars
      for (let x = 9; x < 36; x += 3) b.vline(x, 9, 10, RAMPS.steel[3]);
      for (let y = 11; y < 18; y += 3) b.hline(7, y, 30, RAMPS.steel[2]);
      // Sorted pebbles sitting atop mesh & fine sand below
      for (const [rx, ry] of [[11, 11], [15, 13], [22, 10], [29, 14]]) b.rect(rx, ry, 2, 2, RAMPS.stone[4]);
      drawOrganicHeap(b, 22, 30, 9, 4, RAMPS.stone, 902);
    },
    { cx: 22, cy: 30, rx: 18, ry: 3 },
  );

  // 19. Heavy Stiff-Leg Quarry Jib Crane (60x72)
  const f03_crane = craftSprite(
    60,
    72,
    b => {
      // Stone turntable ring base
      b.ellipse(16, 62, 11, 5, (nx, ny) => (ny < -0.2 ? RAMPS.stone[3] : RAMPS.stone[1]));
      b.rect(10, 56, 12, 6, RAMPS.iron[2]);
      // Winch drum & operator crank behind mast
      drawCylH(b, 5, 51, 9, 5, RAMPS.rust, { flanges: [5, 13] });
      // Cross-braced vertical steel/timber mast
      b.rect(13, 14, 2, 45, RAMPS.rust[3]);
      b.rect(19, 14, 2, 45, RAMPS.rust[2]);
      for (let y = 16; y < 56; y += 7) {
        b.hline(14, y, 6, RAMPS.iron[3]);
        b.line(14, y, 19, y + 6, RAMPS.rust[4]);
      }
      // Counterweight stone box at mast rear
      b.rect(4, 15, 9, 7, RAMPS.stone[2]);
      b.hline(4, 15, 9, RAMPS.stone[4]);
      // Angled steel lattice jib boom reaching upper-right
      b.line(15, 16, 51, 7, RAMPS.brass[3], 2);
      b.line(17, 23, 51, 9, RAMPS.rust[2], 1);
      for (let k = 0; k < 5; k++) {
        const bx = 21 + k * 6, by = 15 - k * 2;
        b.line(bx, by, bx + 4, by + 5, RAMPS.brass[2]);
      }
      // Steel hoist cable & hanging block lifting cut stone block
      b.vline(50, 9, 32, RAMPS.steel[4]);
      b.rect(48, 40, 5, 5, RAMPS.iron[3]); // pulley sheave
      b.line(50, 45, 46, 49, RAMPS.steel[3]);
      b.line(50, 45, 54, 49, RAMPS.steel[3]);
      // Suspended cut stone block
      b.rect(44, 49, 12, 9, RAMPS.stone[2]);
      b.rect(44, 49, 12, 3, RAMPS.stone[4]);
    },
    { cx: 17, cy: 64, rx: 14, ry: 4 },
  );

  // 20. Domed Brick Beehive Charcoal Kiln (50x54)
  const f03_kiln_vat = craftSprite(
    50,
    54,
    b => {
      // Stone circular footing skirt
      b.ellipse(25, 44, 18, 6, (nx, ny) => (ny < 0 ? RAMPS.stone[3] : RAMPS.stone[1]));
      // Domed red-brick masonry beehive shell
      for (let py = 0; py < 32; py++) {
        const frac = py / 31; // 0 crown .. 1 base
        const rx = 7 + Math.sin(frac * Math.PI * 0.52) * 11;
        for (let dx = -Math.round(rx); dx <= Math.round(rx); dx++) {
          const nx = dx / Math.max(1, rx);
          const lum = 0.56 - nx * 0.35 - (frac - 0.3) * 0.25;
          const gx = 25 + dx, gy = 13 + py;
          const isMortar = py % 4 === 3 || ((gx + (py >> 2) * 3) % 6 === 0 && py % 4 < 3);
          b.p(gx, gy, isMortar ? RAMPS.brick[0] : ditherTone(RAMPS.brick, lum, gx, gy, 0.1));
        }
      }
      // Twin wrought-iron tension bands wrapping dome
      for (const by of [23, 35]) {
        const w = by === 23 ? 28 : 34;
        const x0 = 25 - (w >> 1);
        b.hline(x0, by, w, RAMPS.iron[2]);
        b.hline(x0, by + 1, w, RAMPS.iron[0]);
      }
      // Brick crown chimney vent & smoke wisp
      drawCylV(b, 20, 6, 10, 9, RAMPS.brick, { hoops: [8] });
      b.ellipse(25, 6, 4, 1.5, RAMPS.iron[0]);
      // Arched firebox doorway at front glowing with warm embers
      b.rect(20, 35, 10, 10, RAMPS.stone[2]);
      b.ellipse(25, 36, 4, 3, RAMPS.stone[3]);
      b.rect(22, 37, 6, 8, RAMPS.ember[0]);
      b.rect(23, 40, 4, 5, RAMPS.ember[2]);
      b.rect(24, 42, 2, 3, RAMPS.ember[4]);
      // Side draft ports
      b.rect(12, 41, 3, 2, RAMPS.ember[1]);
      b.rect(35, 41, 3, 2, RAMPS.ember[1]);
    },
    { cx: 25, cy: 46, rx: 19, ry: 4 },
  );

  // 21. Stacked Turf-and-Charcoal Mound Rick (40x30)
  const f03_charcoal_rick = (() => {
    const b = new PxBuf(40, 30);
    drawOrganicHeap(b, 20, 25, 16, 15, RAMPS.coal, 1101, { col: RAMPS.ember[2], chance: 0.04, hi: RAMPS.ember[3] });
    for (const [lx, ly] of [[7, 22], [11, 24], [28, 24], [31, 22]]) {
      b.rect(lx, ly, 3, 2, RAMPS.wood[1]);
      b.p(lx, ly, RAMPS.wood[3]);
    }
    b.outline();
    b.shadowEllipse(20, 26, 17, 3, 0.34);
    // Translucent smoke wisps post-outline (no black rim around smoke)
    b.blend(19, 7, 210, 208, 200, 0.55);
    b.blend(20, 5, 225, 222, 215, 0.45);
    b.blend(21, 3, 235, 235, 230, 0.32);
    return b.toCanvas();
  })();

  // 22. Tubular Copper-Iron Vapor Condenser Tank (56x48)
  const f03_condenser = craftSprite(
    56,
    48,
    b => {
      for (const px of [11, 37]) {
        b.rect(px, 32, 8, 10, RAMPS.stone[1]);
        b.hline(px, 32, 8, RAMPS.stone[3]);
      }
      drawCylH(b, 7, 17, 42, 18, RAMPS.iron, { flanges: [14, 28, 41], endCapLeft: true, endCapRight: true });
      drawCylV(b, 14, 7, 10, 11, RAMPS.copper, { hoops: [10] });
      for (let i = 0; i < 3; i++) drawCylH(b, 27, 9 + i * 3, 17, 2, RAMPS.brass, {});
      b.vline(43, 9, 9, RAMPS.brass[2]);
      b.rect(21, 22, 4, 6, RAMPS.water[3]);
      b.rect(19, 40, 14, 3, RAMPS.sulfur[2]);
      b.hline(20, 40, 10, RAMPS.sulfur[4]);
    },
    { cx: 28, cy: 43, rx: 23, ry: 3.5 },
  );

  // 23. Tapered Brick & Iron-Banded Smokestack (34x80)
  const f03_chimney = (() => {
    const b = new PxBuf(34, 80);
    b.rect(6, 58, 22, 16, RAMPS.stone[2]);
    b.hline(6, 58, 22, RAMPS.stone[4]);
    b.rect(13, 64, 8, 10, RAMPS.iron[0]);
    b.hline(14, 64, 6, RAMPS.iron[3]);
    drawCylV(b, 8, 13, 18, 47, RAMPS.brick, { taperTop: 3, hoops: [23, 36, 49] });
    b.rect(9, 10, 16, 4, RAMPS.iron[2]);
    b.hline(9, 10, 16, RAMPS.iron[4]);
    b.ellipse(17, 10, 6, 2, RAMPS.coal[0]);
    b.outline();
    b.shadowEllipse(17, 74, 13, 3.5, 0.34);
    // Soft translucent rising smoke plume post-outline
    for (const [sx, sy, sr, a] of [[17, 6, 3, 0.52], [19, 3, 3.5, 0.38], [22, 1, 2.5, 0.22]]) {
      for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) {
        if (xx * xx + yy * yy <= sr * sr) b.blend(sx + xx, sy + yy, 200, 200, 206, a);
      }
    }
    return b.toCanvas();
  })();

  // 24. Flanged Steam Exhaust Vent Stack with Rain Cowl (30x52)
  const f03_vent_pipe = (() => {
    const b = new PxBuf(30, 52);
    b.rect(8, 41, 14, 6, RAMPS.iron[1]);
    b.line(8, 41, 11, 33, RAMPS.steel[3]);
    b.line(21, 41, 18, 33, RAMPS.steel[2]);
    drawCylV(b, 10, 15, 10, 27, RAMPS.steel, { hoops: [22, 33] });
    for (let y = 0; y < 5; y++) b.hline(14 - y * 2, 7 + y, 2 + y * 4, y < 2 ? RAMPS.steel[4] : RAMPS.steel[2]);
    b.outline();
    b.shadowEllipse(15, 47, 10, 2.5, 0.34);
    for (const [sx, sy, sr, a] of [[18, 5, 2.5, 0.55], [21, 3, 2, 0.36]]) {
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
        if (xx * xx + yy * yy <= sr * sr) b.blend(sx + xx, sy + yy, 232, 242, 250, a);
      }
    }
    return b.toCanvas();
  })();

  // 25. Stone-Curbed Molten Slag Quench Pool (46x30)
  const f03_slag_pool = craftSprite(
    46,
    30,
    b => {
      b.ellipse(23, 16, 20, 10, (nx, ny, x, y) => ditherTone(RAMPS.basalt, 0.56 - nx * 0.2 - ny * 0.3, x, y, 0.08));
      // Dark cooling slag crust plates separated by branching incandescent magma veins
      b.ellipse(23, 16, 16, 7, (nx, ny, x, y) => {
        const dx = nx * 1.4, dy = ny;
        const veinA = Math.abs(dy * 7 + Math.sin(x * 0.35) * 1.8) < 0.9;
        const veinB = Math.abs(dx * 5 - dy * 4 + Math.cos(y * 0.5) * 1.4) < 0.85;
        const hotCore = Math.hypot(nx + 0.1, ny) < 0.38;
        if (hotCore && (veinA || veinB)) return RAMPS.ember[4];
        if (veinA || veinB) return RAMPS.ember[3];
        if (Math.abs(dy * 7 + Math.sin(x * 0.35) * 1.8) < 1.8 || hash2(x, y, 22) > 0.92) return RAMPS.ember[1];
        return hash2(x >> 1, y >> 1, 29) > 0.55 ? RAMPS.coal[2] : RAMPS.coal[1];
      });
    },
    { cx: 23, cy: 25, rx: 20, ry: 3 },
  );

  // 26. Cylindrical Ribbed Grain Silo with Caged Ladder, Auger & Chute (50x78)
  const f03_silo = craftSprite(
    50,
    78,
    b => {
      b.rect(10, 62, 28, 10, RAMPS.stone[2]);
      b.hline(10, 62, 28, RAMPS.stone[4]);
      b.rect(19, 64, 10, 8, RAMPS.iron[1]);
      b.line(29, 67, 38, 72, RAMPS.steel[3], 2);
      drawOrganicHeap(b, 41, 73, 5, 4, RAMPS.sawdust, 1401);
      // Diagonal grain elevator auger tube rising on right flank into top cupola
      b.line(42, 69, 32, 9, RAMPS.steel[3], 2);
      b.line(43, 69, 33, 9, RAMPS.steel[1], 1);
      drawCylV(b, 10, 16, 28, 47, RAMPS.steel, { hoops: [24, 34, 44, 54], seamX: 0.65 });
      for (let py = 0; py < 12; py++) {
        const hw = 3 + Math.round(py * 1.1);
        for (let dx = -hw; dx <= hw; dx++) {
          const lum = 0.65 - (dx / Math.max(1, hw)) * 0.35;
          b.p(24 + dx, 6 + py, ditherTone(RAMPS.steel, lum, 24 + dx, 6 + py, 0.08));
        }
      }
      b.rect(21, 3, 6, 4, RAMPS.brass[3]);
      b.vline(7, 17, 53, RAMPS.iron[3]);
      b.vline(10, 17, 53, RAMPS.iron[3]);
      for (let y = 19; y < 70; y += 3) b.hline(7, y, 4, RAMPS.steel[4]);
    },
    { cx: 25, cy: 73, rx: 18, ry: 4 },
  );

  // 27. Open Settling & Sand-Filter Basin Tank (56x42)
  const f03_filter_tank = craftSprite(
    56,
    42,
    b => {
      b.rect(4, 10, 48, 26, RAMPS.stone[1]);
      b.rect(5, 8, 46, 24, RAMPS.stone[3]);
      b.rect(7, 11, 19, 17, RAMPS.turbid[2]);
      b.hline(7, 11, 19, RAMPS.turbid[0]);
      for (let x = 9; x < 24; x += 4) b.hline(x, 14 + (x % 3), 3, RAMPS.turbid[3]);
      b.rect(26, 10, 4, 19, RAMPS.stone[4]);
      b.rect(26, 14, 4, 7, RAMPS.water[4]);
      b.rect(30, 11, 19, 17, RAMPS.water[2]);
      b.hline(30, 11, 19, RAMPS.water[0]);
      for (let x = 32; x < 47; x += 5) b.hline(x, 15 + (x % 4), 4, RAMPS.water[4]);
      b.rect(8, 28, 40, 4, RAMPS.steel[2]);
      for (let x = 10; x < 47; x += 3) b.vline(x, 28, 4, RAMPS.iron[0]);
      drawCylH(b, 48, 20, 6, 4, RAMPS.brass, { endCapRight: true });
    },
    { cx: 28, cy: 36, rx: 24, ry: 3 },
  );

  // 28. Geothermal Steam Wellhead & Thermal Expansion Manifold (62x40)
  const f03_geo_manifold = (() => {
    const b = new PxBuf(62, 40);
    b.ellipse(31, 30, 26, 6, (nx, ny, x, y) => ditherTone(RAMPS.basalt, 0.45 - ny * 0.25, x, y, 0.1));
    drawCylV(b, 27, 10, 8, 21, RAMPS.steel, { hoops: [15, 22, 27] });
    drawCylH(b, 6, 17, 21, 6, RAMPS.copper, { flanges: [11, 22], endCapLeft: true });
    drawCylH(b, 35, 17, 21, 6, RAMPS.copper, { flanges: [39, 50], endCapRight: true });
    drawCylV(b, 19, 6, 5, 12, RAMPS.brass, {});
    drawCylV(b, 38, 6, 5, 12, RAMPS.brass, {});
    drawCylH(b, 19, 5, 24, 4, RAMPS.brass, { flanges: [30] });
    drawWheel(b, 12, 13, 4, 3, 4, RAMPS.cloth, RAMPS.brass);
    drawWheel(b, 49, 13, 4, 3, 4, RAMPS.cloth, RAMPS.brass);
    b.outline();
    b.shadowEllipse(31, 34, 25, 3, 0.34);
    for (const [sx, sy, sr, a] of [[31, 4, 2.5, 0.55], [33, 2, 2, 0.35]]) {
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
        if (xx * xx + yy * yy <= sr * sr) b.blend(sx + xx, sy + yy, 234, 244, 252, a);
      }
    }
    return b.toCanvas();
  })();

  // 29. Cast-Iron Industrial Signal Lamp Post (22x38)
  const f03_signal_lamp = craftSprite(
    22,
    38,
    b => {
      // Fluted stone/iron plinth
      b.rect(7, 29, 8, 5, RAMPS.stone[1]);
      b.hline(7, 29, 8, RAMPS.stone[3]);
      // Tapered cast-iron post + cantilever bracket
      b.rect(9, 10, 4, 20, RAMPS.iron[1]);
      b.vline(10, 10, 20, RAMPS.iron[3]);
      b.hline(7, 8, 10, RAMPS.iron[3]);
      // Caged glass warning lantern with warm amber flame core
      b.rect(6, 3, 10, 2, RAMPS.copper[2]); // copper cap
      b.rect(7, 5, 8, 6, RAMPS.ember[3]);
      b.rect(9, 6, 4, 4, RAMPS.ember[4]);
      b.vline(7, 5, 6, RAMPS.iron[0]); // cage bars
      b.vline(14, 5, 6, RAMPS.iron[0]);
    },
    { cx: 11, cy: 34, rx: 6, ry: 2.5 },
  );

  return {
    f03_turbine,
    f03_waterwheel,
    f03_steel_gate,
    f03_pipe_bundle,
    f03_rust_pipe,
    f03_valve,
    f03_gauge_panel,
    f03_log_cradle,
    f03_timber_pile,
    f03_sawframe,
    f03_sawdust,
    f03_chain_rail,
    f03_ore_ramp,
    f03_spoil_heap,
    f03_ore_seam,
    f03_glass_spoil,
    f03_crusher,
    f03_screen,
    f03_crane,
    f03_kiln_vat,
    f03_charcoal_rick,
    f03_condenser,
    f03_chimney,
    f03_vent_pipe,
    f03_slag_pool,
    f03_silo,
    f03_filter_tank,
    f03_geo_manifold,
    f03_signal_lamp,
  };
}

/** Material-specific seamless world-space 16px terrain painter for F03 POIs. */
export function drawF03DeckTile(g: CanvasRenderingContext2D, x: number, y: number, id: string, edges: number): void {
  drawDeckTileCanvas(g, x, y, { id, open: true, edges });
}