// Node reference stub for src/game/display.ts (original file imports PixiJS and
// uses the DOM for presentation only). The simulation and raster path never
// reaches this module. Buffers match Display.build(rW=1200, rH=680, k=2).
import { Layer } from './pixel';
export class Display {
  scene: { L: Layer; d: Uint32Array };
  glowF: { L: Layer; d: Uint32Array };
  constructor() {
    const W = 1200, H = 680, k = 2;
    const sd = new Uint32Array(W * H), gd = new Uint32Array(W * H);
    this.scene = { L: new Layer(sd, W, H, k), d: sd };
    this.glowF = { L: new Layer(gd, W, H, k), d: gd };
  }
  present(..._a: unknown[]) {}
  destroy() {}
  async init(..._a: unknown[]) {}
}
