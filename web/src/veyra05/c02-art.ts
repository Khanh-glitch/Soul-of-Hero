/**
 * C02 INDUSTRIAL HARBOR PIXEL ART (Ironholm Harbor, Emberport, Sandgate).
 * 10 industrial waterfront props + `gear_rack` + seamless rail/gantry/ashwork ground painter.
 */
import { type Sprite, mk } from '../game/art';
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

export function makeIndustrialHarborSprites(_factory: typeof mk): Record<string, Sprite> {
  // 1. Ore Tipple Headframe Tower (68x64)
  const c02_ore_tipple = craftSprite(
    68,
    64,
    b => {
      // Heavy stone pier footings
      b.rect(7, 50, 12, 8, RAMPS.stone[1]);
      b.hline(7, 50, 12, RAMPS.stone[3]);
      b.rect(49, 50, 12, 8, RAMPS.stone[1]);
      b.hline(49, 50, 12, RAMPS.stone[3]);
      // Batter timber & steel headframe legs with X-bracing
      b.line(12, 52, 18, 12, RAMPS.wood[2], 3);
      b.line(55, 52, 48, 12, RAMPS.wood[1], 3);
      b.line(16, 36, 51, 20, RAMPS.steel[2]);
      b.line(51, 36, 16, 20, RAMPS.steel[1]);
      // Upper rotary railcar dumper gallery & corrugated hood
      b.rect(14, 10, 40, 11, RAMPS.steel[2]);
      b.rect(13, 6, 42, 5, RAMPS.rust[3]);
      b.hline(13, 6, 42, RAMPS.rust[4]);
      b.rect(18, 13, 32, 6, RAMPS.iron[0]); // dumper throat
      // Angled steel ore discharge chute funnel spilling into lower ore mound
      for (let i = 0; i < 14; i++) {
        b.hline(25 + Math.round(i * 0.35), 21 + i, 18 - Math.round(i * 0.4), i % 3 === 0 ? RAMPS.steel[3] : RAMPS.iron[2]);
      }
      drawOrganicHeap(b, 35, 57, 15, 11, RAMPS.ore, 2101, { col: RAMPS.stone[3], chance: 0.16 });
      // Access ladder on left leg
      b.vline(10, 14, 42, RAMPS.iron[3]);
      for (let y = 16; y < 54; y += 4) b.hline(10, y, 3, RAMPS.steel[4]);
    },
    { cx: 34, cy: 58, rx: 28, ry: 4 },
  );

  // 2. Heavy Steel-Ribbed Ore Rail Wagon on Track (58x38)
  const c02_rail_wagon = craftSprite(
    58,
    38,
    b => {
      // Twin rail track ties & steel rail beneath wheels
      for (let x = 4; x < 54; x += 6) b.rect(x, 31, 3, 3, RAMPS.wood[1]);
      b.hline(2, 32, 54, RAMPS.steel[4]);
      // Spoked iron rail bogie wheels & couplings
      drawWheel(b, 13, 29, 4, 4, 4, RAMPS.iron, RAMPS.steel);
      drawWheel(b, 44, 29, 4, 4, 4, RAMPS.iron, RAMPS.steel);
      b.rect(1, 24, 4, 2, RAMPS.steel[3]);
      b.rect(53, 24, 4, 2, RAMPS.steel[3]);
      // Heaped ironstone ore cargo mound inside hopper top
      drawOrganicHeap(b, 29, 15, 21, 9, RAMPS.ore, 2204, { col: RAMPS.stone[3], chance: 0.18, hi: RAMPS.gold[4] });
      // Riveted rust-iron gondola body with angled side ribs
      b.rect(5, 14, 48, 12, RAMPS.rust[2]);
      b.hline(5, 14, 48, RAMPS.rust[4]);
      b.hline(5, 25, 48, RAMPS.iron[0]);
      for (let x = 8; x < 50; x += 8) {
        b.rect(x, 15, 2, 10, RAMPS.iron[2]);
        b.p(x, 16, RAMPS.steel[4]);
        b.p(x, 23, RAMPS.steel[4]);
      }
    },
    { cx: 29, cy: 34, rx: 26, ry: 3 },
  );

  // 3. Travelling Port Chain Gantry Crane (76x76)
  const c02_chain_gantry = craftSprite(
    76,
    76,
    b => {
      // Twin bogie bases & heavy riveted steel A-frame legs
      for (const lx of [8, 56]) {
        b.rect(lx, 63, 12, 6, RAMPS.iron[1]);
        drawWheel(b, lx + 3, 69, 2, 2, 4, RAMPS.iron, RAMPS.steel);
        drawWheel(b, lx + 9, 69, 2, 2, 4, RAMPS.iron, RAMPS.steel);
        b.rect(lx + 3, 15, 6, 49, RAMPS.steel[2]);
        b.vline(lx + 3, 15, 49, RAMPS.steel[4]);
        b.vline(lx + 8, 15, 49, RAMPS.iron[0]);
        for (let y = 18; y < 60; y += 7) b.line(lx + 3, y, lx + 8, y + 5, RAMPS.rust[3]);
      }
      // Top cross-truss bridge girder + operator cab on left
      b.rect(5, 7, 66, 9, RAMPS.rust[2]);
      b.hline(5, 7, 66, RAMPS.brass[3]);
      b.hline(5, 15, 66, RAMPS.iron[0]);
      for (let x = 8; x < 64; x += 8) b.line(x, 8, x + 6, 14, RAMPS.steel[3]);
      b.rect(14, 16, 11, 9, RAMPS.copper[2]); // operator control cab
      b.rect(16, 18, 7, 4, RAMPS.water[4]);
      // Overhead trolley + twin taut hoist chains + heavy ore crate sling
      b.rect(34, 15, 10, 5, RAMPS.iron[3]);
      for (let y = 20; y < 48; y += 2) {
        b.p(37, y, RAMPS.steel[4]);
        b.p(40, y, RAMPS.steel[4]);
        b.p(37, y + 1, RAMPS.iron[1]);
        b.p(40, y + 1, RAMPS.iron[1]);
      }
      b.rect(35, 46, 8, 4, RAMPS.brass[3]); // spreader bar
      b.rect(30, 50, 18, 13, RAMPS.timber[2]);
      b.hline(30, 50, 18, RAMPS.timber[4]);
      b.line(31, 51, 46, 61, RAMPS.wood[1]);
    },
    { cx: 38, cy: 70, rx: 32, ry: 4 },
  );

  // 4. Massive Smelter Blast-Furnace Smokestack (40x88)
  const c02_industrial_chimney = (() => {
    const b = new PxBuf(40, 88);
    // Heavy stone & iron-buttressed plinth
    b.rect(6, 64, 28, 17, RAMPS.stone[2]);
    b.hline(6, 64, 28, RAMPS.stone[4]);
    b.rect(15, 70, 10, 11, RAMPS.ember[0]);
    b.rect(17, 74, 6, 6, RAMPS.ember[2]);
    b.rect(19, 76, 2, 4, RAMPS.ember[4]);
    // Tapered riveted iron/brick furnace stack
    drawCylV(b, 9, 13, 22, 53, RAMPS.brick, { taperTop: 4, hoops: [23, 35, 47, 58] });
    // Flared cast-iron crown collar
    b.rect(11, 10, 18, 4, RAMPS.iron[2]);
    b.hline(11, 10, 18, RAMPS.steel[4]);
    b.ellipse(20, 10, 7, 2, RAMPS.coal[0]);
    b.outline();
    b.shadowEllipse(20, 82, 15, 3.5, 0.34);
    for (const [sx, sy, sr, a] of [[20, 7, 3, 0.52], [23, 4, 3.5, 0.36], [26, 2, 2.5, 0.22]]) {
      for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) {
        if (xx * xx + yy * yy <= sr * sr) b.blend(sx + xx, sy + yy, 180, 184, 192, a);
      }
    }
    return b.toCanvas();
  })();

  // 5. Crisp Warren-Truss Overhead Steel Bridge Span (76x36 — zero AA blur!)
  const c02_steel_truss = craftSprite(
    76,
    36,
    b => {
      // Bottom deck I-beam & top compression chord
      b.rect(2, 6, 72, 4, RAMPS.steel[2]);
      b.hline(2, 6, 72, RAMPS.steel[4]);
      b.rect(2, 25, 72, 5, RAMPS.iron[2]);
      b.hline(2, 25, 72, RAMPS.steel[3]);
      // Crisp pixel-plotted Warren diagonal lattice struts + vertical gussets
      for (let x = 4; x <= 62; x += 11) {
        b.rect(x, 9, 2, 17, RAMPS.iron[1]);
        b.line(x + 1, 10, x + 11, 25, RAMPS.steel[3], 2);
        b.line(x + 11, 10, x + 1, 25, RAMPS.steel[2], 1);
        // Gusset plate with rivet
        b.rect(x, 8, 4, 3, RAMPS.rust[3]);
        b.p(x + 1, 9, RAMPS.steel[4]);
      }
      b.rect(68, 9, 3, 17, RAMPS.iron[2]);
    },
    { cx: 38, cy: 32, rx: 35, ry: 2.5 },
  );

  // 6. Three-Bay Timber & Iron Ore Storage Bins (58x42)
  const c02_ore_bins = craftSprite(
    58,
    42,
    b => {
      // Heavy timber frame & sloped roof backplate
      b.rect(4, 7, 50, 29, RAMPS.wood[1]);
      b.hline(4, 7, 50, RAMPS.wood[4]);
      for (let i = 0; i < 3; i++) {
        const bx = 7 + i * 16;
        // Distinct cargo in each bay: iron ore, coal, limestone
        const ramp = i === 0 ? RAMPS.ore : i === 1 ? RAMPS.coal : RAMPS.stone;
        drawOrganicHeap(b, bx + 6, 23, 6, 8, ramp, 2600 + i);
        // Hopper chute front apron & iron lever gate
        b.rect(bx, 22, 13, 12, RAMPS.iron[2]);
        b.hline(bx, 22, 13, RAMPS.steel[4]);
        b.rect(bx + 3, 27, 7, 5, RAMPS.rust[2]);
        b.rect(bx + 11, 24, 2, 5, RAMPS.brass[3]); // chute handle
      }
    },
    { cx: 29, cy: 37, rx: 25, ry: 3 },
  );

  // 7. Industrial Port Warning Beacon Lamp (28x42)
  const c02_warning_lamp = craftSprite(
    28,
    42,
    b => {
      b.rect(8, 34, 12, 5, RAMPS.stone[1]);
      b.hline(8, 34, 12, RAMPS.stone[3]);
      // Steel lattice post & ladder rungs
      b.rect(12, 14, 4, 21, RAMPS.iron[2]);
      b.vline(12, 14, 21, RAMPS.steel[3]);
      for (let y = 18; y < 34; y += 4) b.hline(10, y, 4, RAMPS.iron[3]);
      // Wide copper hood & glowing amber Fresnel warning cage
      b.rect(6, 4, 16, 4, RAMPS.rust[3]);
      b.hline(6, 4, 16, RAMPS.rust[4]);
      b.rect(9, 8, 10, 7, RAMPS.ember[3]);
      b.rect(11, 9, 6, 5, RAMPS.ember[4]);
      b.vline(9, 8, 7, RAMPS.iron[0]);
      b.vline(18, 8, 7, RAMPS.iron[0]);
    },
    { cx: 14, cy: 39, rx: 8, ry: 2.5 },
  );

  // 8. Cast-Iron Floor Flue & Ember Heat Grate (46x28)
  const c02_heat_grate = craftSprite(
    46,
    28,
    b => {
      // Heavy stone/iron curb frame
      b.rect(3, 5, 40, 19, RAMPS.iron[2]);
      b.hline(3, 5, 40, RAMPS.steel[4]);
      b.hline(3, 23, 40, RAMPS.iron[0]);
      // Glowing molten coal bed beneath cast-iron grates
      b.rect(6, 8, 34, 13, RAMPS.ember[0]);
      b.rect(9, 10, 28, 9, RAMPS.ember[2]);
      b.rect(14, 12, 18, 5, RAMPS.ember[4]);
      // Thick cast-iron grate bars spanning the pit
      for (let x = 7; x < 39; x += 5) {
        b.rect(x, 8, 2, 13, RAMPS.iron[1]);
        b.p(x, 8, RAMPS.steel[4]);
      }
      b.hline(6, 14, 34, RAMPS.iron[2]);
    },
    { cx: 23, cy: 25, rx: 20, ry: 2.5 },
  );

  // 9. Monumental Estuary Tidal Sluice Lock Gate (68x56)
  const c02_tide_gate = craftSprite(
    68,
    56,
    b => {
      // Water pool & white discharge foam at gate sill
      b.rect(12, 42, 44, 9, RAMPS.water[1]);
      for (let x = 14; x < 54; x += 4) b.hline(x, 45 + (x % 3), 3, RAMPS.water[4]);
      // Twin dressed-granite lock piers
      for (const px of [5, 53]) {
        b.rect(px, 12, 10, 39, RAMPS.stone[2]);
        b.hline(px, 12, 10, RAMPS.stone[4]);
        for (let y = 20; y < 50; y += 8) b.hline(px, y, 10, RAMPS.stone[0]);
      }
      // Riveted iron sluice gate leaves with cross ribs & green algae collar
      b.rect(15, 18, 38, 26, RAMPS.steel[1]);
      for (let x = 19; x < 52; x += 6) b.rect(x, 18, 2, 26, RAMPS.steel[3]);
      b.hline(15, 29, 38, RAMPS.iron[0]);
      b.rect(15, 40, 38, 4, RAMPS.copper[1]);
      // Overhead steel lifting bridge & twin handwheel gears
      b.rect(10, 7, 48, 6, RAMPS.iron[2]);
      b.hline(10, 7, 48, RAMPS.brass[3]);
      drawWheel(b, 24, 6, 4, 4, 4, RAMPS.rust, RAMPS.brass);
      drawWheel(b, 44, 6, 4, 4, 4, RAMPS.rust, RAMPS.brass);
    },
    { cx: 34, cy: 52, rx: 28, ry: 3.5 },
  );

  // 10. Heavy Sluice Counterweight Tower & Ballast Block (50x62)
  const c02_counterweight = craftSprite(
    50,
    62,
    b => {
      // Stone bumper pad
      b.rect(11, 51, 28, 6, RAMPS.stone[1]);
      b.hline(11, 51, 28, RAMPS.stone[3]);
      // Twin vertical steel channel guide towers
      b.rect(7, 10, 6, 45, RAMPS.iron[2]);
      b.vline(7, 10, 45, RAMPS.steel[4]);
      b.rect(37, 10, 6, 45, RAMPS.iron[2]);
      b.vline(37, 10, 45, RAMPS.steel[4]);
      // Top crosshead girder & twin cast-iron cable sheaves
      b.rect(5, 7, 40, 5, RAMPS.rust[3]);
      b.hline(5, 7, 40, RAMPS.brass[3]);
      drawWheel(b, 17, 7, 4, 4, 4, RAMPS.iron, RAMPS.brass);
      drawWheel(b, 33, 7, 4, 4, 4, RAMPS.iron, RAMPS.brass);
      // Taut twin steel hoist chains
      for (let y = 11; y < 27; y += 2) {
        b.p(17, y, RAMPS.steel[4]);
        b.p(33, y, RAMPS.steel[4]);
      }
      // Massive concrete-and-iron-banded ballast counterweight suspended mid-travel
      b.rect(14, 26, 22, 18, RAMPS.stone[2]);
      b.hline(14, 26, 22, RAMPS.stone[4]);
      b.rect(14, 30, 22, 2, RAMPS.iron[1]);
      b.rect(14, 39, 22, 2, RAMPS.iron[1]);
      b.rect(23, 23, 4, 3, RAMPS.brass[3]);
    },
    { cx: 25, cy: 57, rx: 19, ry: 3 },
  );

  // 11. Wall/Stand Workshop Gear & Tool Rack (22x22 — referenced in c02.ts!)
  const gear_rack = craftSprite(
    22,
    22,
    b => {
      b.rect(3, 3, 2, 16, RAMPS.wood[1]);
      b.rect(17, 3, 2, 16, RAMPS.wood[1]);
      b.rect(2, 4, 18, 3, RAMPS.wood[3]);
      b.rect(2, 12, 18, 2, RAMPS.wood[2]);
      // Hanging wrench, spare bevel gear, and oil can
      b.rect(5, 6, 2, 9, RAMPS.steel[3]);
      b.p(6, 6, RAMPS.steel[4]);
      drawWheel(b, 11, 10, 3, 3, 4, RAMPS.brass, RAMPS.iron);
      b.rect(14, 9, 3, 4, RAMPS.copper[3]);
    },
    { cx: 11, cy: 19, rx: 8, ry: 2 },
  );

  return {
    c02_ore_tipple,
    c02_rail_wagon,
    c02_chain_gantry,
    c02_industrial_chimney,
    c02_steel_truss,
    c02_ore_bins,
    c02_warning_lamp,
    c02_heat_grate,
    c02_tide_gate,
    c02_counterweight,
    gear_rack,
  };
}

export function drawIndustrialHarborTile(g: CanvasRenderingContext2D, x: number, y: number, id: string, edges: number): void {
  drawDeckTileCanvas(g, x, y, { id, open: true, edges });
}