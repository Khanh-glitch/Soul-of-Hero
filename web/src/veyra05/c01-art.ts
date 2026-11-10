/**
 * C01 URBAN HARBOR PIXEL ART (Gulfhead, Westmouth, Saltwick).
 * 10 bespoke 2.5D civic/maritime sprites + seamless harbor cobble, timber pier, and salt-terrace painter.
 */
import { type Sprite, mk } from '../game/art';
import {
  RAMPS,
  craftSprite,
  ditherTone,
  drawCylH,
  drawCylV,
  drawOrganicHeap,
  drawWheel,
} from './pixel-craft';
import { drawDeckTileCanvas } from './surface-art';

export function makeUrbanHarborSprites(_factory: typeof mk): Record<string, Sprite> {
  // 1. Municipal Heraldic Banner Standard (26x54)
  const c01_city_banner = craftSprite(
    26,
    54,
    b => {
      b.rect(8, 46, 10, 5, RAMPS.stone[2]);
      b.hline(8, 46, 10, RAMPS.stone[4]);
      // Polished bronze/iron standard pole & crossbar
      b.rect(11, 5, 3, 42, RAMPS.iron[2]);
      b.vline(11, 5, 42, RAMPS.steel[3]);
      b.rect(5, 7, 17, 2, RAMPS.brass[3]);
      b.rect(11, 2, 3, 3, RAMPS.brass[4]); // finial spear
      // Crimson-and-gold swallowtail tapestry with ripple folds & real notched tails
      b.rect(8, 9, 13, 22, RAMPS.cloth[2]);
      b.rect(8, 31, 5, 4, RAMPS.cloth[2]);
      b.rect(16, 31, 5, 4, RAMPS.cloth[2]);
      b.vline(8, 9, 26, RAMPS.cloth[3]);
      b.vline(19, 9, 26, RAMPS.cloth[1]);
      b.hline(8, 11, 13, RAMPS.gold[3]);
      b.hline(8, 30, 5, RAMPS.gold[3]);
      b.hline(16, 30, 5, RAMPS.gold[3]);
      b.rect(12, 17, 5, 6, RAMPS.gold[3]);
      b.p(14, 19, RAMPS.cream[4]);
    },
    { cx: 13, cy: 50, rx: 7, ry: 2.5 },
  );

  // 2. Dressed-Stone Harbor Archway Gate (58x48)
  const c01_arched_gate = craftSprite(
    58,
    48,
    b => {
      // Ashlar stone gate piers
      for (const px of [4, 42]) {
        b.rect(px, 10, 12, 33, RAMPS.stone[2]);
        b.hline(px, 10, 12, RAMPS.stone[4]);
        for (let y = 17; y < 42; y += 7) b.hline(px, y, 12, RAMPS.stone[0]);
      }
      // Curved stone voussoir arch & crenellated lintel
      b.rect(8, 5, 42, 12, RAMPS.stone[2]);
      b.hline(8, 5, 42, RAMPS.stone[4]);
      // Arch spandrels & carved gold crest keystone
      for (let x = 16; x < 42; x++) {
        const dx = (x - 29) / 13;
        const archY = Math.round(17 + Math.sqrt(Math.max(0, 1 - dx * dx)) * -4);
        b.vline(x, 12, archY - 11, RAMPS.stone[1]);
      }
      b.rect(26, 6, 6, 7, RAMPS.gold[3]);
      b.hline(26, 6, 6, RAMPS.gold[4]);
      // Warm iron-banded oak gate leaves swung open inside piers
      b.rect(16, 20, 4, 22, RAMPS.wood[2]);
      b.rect(38, 20, 4, 22, RAMPS.wood[1]);
      // Twin warm sconce lanterns on piers
      b.rect(12, 22, 3, 4, RAMPS.ember[3]);
      b.rect(43, 22, 3, 4, RAMPS.ember[3]);
    },
    { cx: 29, cy: 43, rx: 25, ry: 3.5 },
  );

  // 3. Striped Awning Harbor Market Stall (64x38)
  const c01_canopy_market = craftSprite(
    64,
    38,
    b => {
      // Timber counter & posts
      b.rect(6, 16, 4, 18, RAMPS.wood[1]);
      b.rect(54, 16, 4, 18, RAMPS.wood[1]);
      b.rect(8, 24, 48, 8, RAMPS.timber[2]);
      b.hline(8, 24, 48, RAMPS.timber[4]);
      // Displayed harbor wares: silvery fish basket, spice sacks, brass scale
      b.ellipse(17, 22, 5, 3, RAMPS.water[4]);
      b.rect(28, 20, 7, 5, RAMPS.cream[3]);
      b.rect(37, 20, 7, 5, RAMPS.sawdust[2]);
      b.rect(48, 19, 4, 5, RAMPS.brass[3]);
      // Sloped striped crimson-and-cream canvas canopy awning
      for (let py = 0; py < 14; py++) {
        const x0 = 6 - Math.floor(py * 0.25);
        const w = 52 + Math.floor(py * 0.5);
        for (let px = 0; px < w; px++) {
          const stripe = Math.floor((px + 2) / 6) % 2;
          const ramp = stripe ? RAMPS.cloth : RAMPS.cream;
          const lum = py < 3 ? 0.88 : py > 11 ? 0.3 : 0.62 - py * 0.02;
          b.p(x0 + px, 5 + py, ditherTone(ramp, lum, x0 + px, 5 + py, 0.06));
        }
      }
      // Scalloped awning valence edge
      for (let x = 4; x < 60; x += 4) b.rect(x, 19, 3, 2, ((x / 4) | 0) % 2 ? RAMPS.cloth[2] : RAMPS.cream[3]);
    },
    { cx: 32, cy: 34, rx: 27, ry: 3 },
  );

  // 4. Quayside Jib Cargo Davit Hook (42x58)
  const c01_cargo_hook = craftSprite(
    42,
    58,
    b => {
      b.rect(6, 49, 12, 5, RAMPS.stone[1]);
      b.hline(6, 49, 12, RAMPS.stone[3]);
      // Heavy iron-banded timber quay post & knee brace
      b.rect(8, 12, 6, 38, RAMPS.wood[2]);
      b.vline(8, 12, 38, RAMPS.wood[4]);
      b.rect(8, 20, 6, 2, RAMPS.iron[2]);
      b.rect(8, 38, 6, 2, RAMPS.iron[2]);
      b.line(14, 24, 24, 14, RAMPS.wood[3], 2);
      // Horizontal jib boom + pulley sheave
      b.rect(7, 10, 29, 4, RAMPS.timber[2]);
      b.hline(7, 10, 29, RAMPS.timber[4]);
      drawWheel(b, 33, 15, 3, 3, 4, RAMPS.iron, RAMPS.brass);
      // Taut hoist rope + iron cargo hook + suspended strapped crate
      b.vline(33, 18, 16, RAMPS.cream[3]);
      b.rect(31, 33, 4, 4, RAMPS.iron[3]);
      b.rect(25, 37, 14, 11, RAMPS.timber[2]);
      b.hline(25, 37, 14, RAMPS.timber[4]);
      b.line(26, 38, 38, 47, RAMPS.wood[1]);
    },
    { cx: 21, cy: 53, rx: 16, ry: 3 },
  );

  // 5. Ornate Wrought-Iron Harbor Quay Lamp (26x42)
  const c01_quay_lamp = craftSprite(
    26,
    42,
    b => {
      b.rect(8, 34, 10, 5, RAMPS.stone[2]);
      b.hline(8, 34, 10, RAMPS.stone[4]);
      // Fluted wrought-iron post & decorative scroll arm
      b.rect(11, 18, 4, 17, RAMPS.iron[1]);
      b.vline(12, 18, 17, RAMPS.steel[3]);
      b.rect(8, 17, 10, 2, RAMPS.iron[3]);
      // Hexagonal glass harbor lantern with warm golden flame
      b.rect(8, 8, 10, 9, RAMPS.ember[3]);
      b.rect(10, 9, 6, 7, RAMPS.ember[4]);
      b.vline(8, 8, 9, RAMPS.iron[0]);
      b.vline(17, 8, 9, RAMPS.iron[0]);
      b.rect(7, 6, 12, 3, RAMPS.iron[2]);
      b.rect(11, 3, 4, 3, RAMPS.brass[3]);
    },
    { cx: 13, cy: 39, rx: 7, ry: 2.5 },
  );

  // 6. Cast-Iron Mooring Bollard with Coiled Rope (24x30)
  const c01_mooring = craftSprite(
    24,
    30,
    b => {
      b.rect(6, 22, 12, 4, RAMPS.iron[1]);
      b.hline(6, 22, 12, RAMPS.steel[3]);
      drawCylV(b, 8, 7, 8, 16, RAMPS.iron, { hoops: [10] });
      b.ellipse(12, 7, 6, 2.5, (nx, ny) => (ny < 0 ? RAMPS.steel[4] : RAMPS.iron[2]));
      // Thick twisted hemp hawser wrapped 3 turns around bollard waist
      for (const ry of [14, 17, 20]) {
        b.hline(7, ry, 10, RAMPS.cream[3]);
        b.hline(7, ry + 1, 10, RAMPS.cream[1]);
      }
    },
    { cx: 12, cy: 26, rx: 8, ry: 2.5 },
  );

  // 7. Two-Wheeled Harbor Rope Handcart (44x30)
  const c01_rope_cart = craftSprite(
    44,
    30,
    b => {
      // Wooden push shafts on left
      b.line(3, 18, 14, 15, RAMPS.wood[3], 2);
      // Cart bed filled with coiled rope & canvas parcel
      b.rect(11, 10, 26, 11, RAMPS.wood[2]);
      b.hline(11, 10, 26, RAMPS.wood[4]);
      b.ellipse(20, 9, 6, 3, RAMPS.cream[3]);
      b.ring(20, 9, 4, 2, RAMPS.cream[1]);
      b.rect(27, 7, 8, 5, RAMPS.cloth[2]);
      // Twin large spoked wooden cart wheels
      drawWheel(b, 18, 22, 5, 5, 6, RAMPS.timber, RAMPS.iron);
      drawWheel(b, 33, 22, 5, 5, 6, RAMPS.timber, RAMPS.iron);
    },
    { cx: 24, cy: 26, rx: 17, ry: 3 },
  );

  // 8. Timber-Walled Solar Salt Evaporation Pan (50x32 — NO white mattress!)
  const c01_white_salt_pan = craftSprite(
    50,
    32,
    b => {
      // Weathered oak pan curb wall
      b.rect(3, 7, 44, 20, RAMPS.wood[1]);
      b.hline(3, 7, 44, RAMPS.wood[3]);
      // Shallow brine pan basin inside
      b.rect(6, 10, 38, 13, RAMPS.water[2]);
      b.hline(6, 10, 38, RAMPS.water[0]);
      // Sparkling raked white salt crystal pyramids on right half
      drawOrganicHeap(b, 33, 22, 9, 7, RAMPS.salt, 3102, { col: '#ffffff', chance: 0.25 });
      b.hline(8, 19, 16, RAMPS.salt[4]); // crusted rim
      // Wooden salt rake lying across left edge
      b.line(8, 13, 22, 18, RAMPS.timber[3]);
      b.rect(20, 15, 3, 6, RAMPS.timber[4]);
    },
    { cx: 25, cy: 27, rx: 22, ry: 3 },
  );

  // 9. Copper & Oak Brine Siphon Standpipe (38x38)
  const c01_brine_pipe = craftSprite(
    38,
    38,
    b => {
      b.rect(5, 28, 14, 6, RAMPS.stone[1]);
      b.hline(5, 28, 14, RAMPS.stone[3]);
      // Vertical copper siphon riser + gooseneck horizontal bridge + catch trough
      drawCylV(b, 9, 8, 6, 22, RAMPS.copper, { hoops: [16, 23] });
      drawCylH(b, 10, 7, 19, 5, RAMPS.copper, { flanges: [16, 25] });
      drawCylV(b, 25, 9, 5, 11, RAMPS.copper, {});
      // Wooden brine catch vat underneath spout
      b.rect(20, 22, 14, 11, RAMPS.wood[2]);
      b.rect(22, 23, 10, 4, RAMPS.water[3]);
      b.hline(20, 22, 14, RAMPS.wood[4]);
    },
    { cx: 19, cy: 33, rx: 15, ry: 3 },
  );

  // 10. 2.5D Pitched Harbor Attic Gable Dormer (52x34)
  const c01_roof_dormer = craftSprite(
    52,
    34,
    b => {
      // Stone/plaster side cheek & front dormer wall
      b.rect(8, 13, 36, 17, RAMPS.cream[2]);
      b.rect(10, 14, 32, 15, RAMPS.cream[3]);
      // Pitched terracotta/slate dormer gable roof with bargeboards
      for (let py = 0; py < 10; py++) {
        const hw = 6 + py * 2;
        b.hline(26 - hw, 4 + py, hw * 2, py < 2 ? RAMPS.brick[4] : py % 3 === 0 ? RAMPS.brick[1] : RAMPS.brick[2]);
      }
      b.hline(5, 14, 42, RAMPS.wood[1]);
      // Mullioned casement glass window + wooden sill
      b.rect(17, 17, 18, 9, RAMPS.water[2]);
      b.rect(19, 18, 6, 3, RAMPS.water[4]);
      b.vline(25, 17, 9, RAMPS.wood[1]);
      b.hline(17, 21, 18, RAMPS.wood[1]);
      b.rect(15, 26, 22, 2, RAMPS.stone[3]);
    },
    { cx: 26, cy: 30, rx: 21, ry: 2.5 },
  );

  return {
    c01_city_banner,
    c01_arched_gate,
    c01_canopy_market,
    c01_cargo_hook,
    c01_quay_lamp,
    c01_mooring,
    c01_rope_cart,
    c01_white_salt_pan,
    c01_brine_pipe,
    c01_roof_dormer,
  };
}

export function drawUrbanHarborDeckTile(g: CanvasRenderingContext2D, x: number, y: number, id: string, edges: number): void {
  drawDeckTileCanvas(g, x, y, { id, open: true, edges });
}