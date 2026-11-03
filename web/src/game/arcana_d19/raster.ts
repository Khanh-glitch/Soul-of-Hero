/** D19 source-primitive raster, ported from AVFX handoff d8d62ec
 *  (prototypes/arcana20_web_review/src/arcana_d/raster.ts).
 *  ADAPTATION for the unified compositor: instead of owning a second WebGL2
 *  canvas/context, the raster renders into a target FBO of the ONE presenter
 *  context. Command order, batches and shaders are unchanged from source. */
import { batches as B, glSource as G } from './vendor.js';
import type { DCommand } from './commands';

export const D19_SRC_W = 480, D19_SRC_H = 270;

export class DRaster {
  private gl: WebGL2RenderingContext;
  private sprites: any; private ribbons: any; private polys: any;
  needsRestore = false;
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initialize();
  }
  private initialize() {
    const gl = this.gl;
    const sprite = new G.Program(gl, B.SPRITE_VS, B.SPRITE_FS);
    const ribbon = new G.Program(gl, B.RIBBON_VS, B.RIBBON_FS);
    const poly = new G.Program(gl, B.POLY_VS, B.POLY_FS);
    this.sprites = new B.SpriteBatch(gl, sprite);
    this.ribbons = new B.RibbonBatch(gl, ribbon);
    this.polys = new B.PolyBatch(gl, poly);
  }
  restore() { this.initialize(); this.needsRestore = false; }
  /** Render the source commands into `target` (an FBO of the presenter). */
  render(commands: DCommand[], rendererTime: number, target: { fbo: WebGLFramebuffer | null; w: number; h: number }, batch: 'none' | 'sprites' | 'all' = 'none') {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('WebGL context lost');
    if (this.needsRestore) this.restore();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    B.setBlend(gl, 'add');
    let current: 'sprite' | 'line' | 'poly' | null = null, draws = 0;
    const selected = () => current === 'sprite' ? this.sprites : current === 'line' ? this.ribbons : this.polys;
    const flush = () => { if (current) { const x = selected(); x.draw([target.w, target.h], [0, 0], rendererTime); x.reset(); draws++; current = null; } };
    for (const c of commands) {
      if (c.kind === 'bend') continue;
      if (current !== c.kind) flush();
      if (current) { const x = selected(), need = c.kind === 'sprite' ? 1 : c.kind === 'line' ? c.points.length + 3 : 4, limit = c.kind === 'sprite' ? x.cap : c.kind === 'line' ? x.data.length / x.stride : x.cap * 4; if (x.count + need > limit) flush(); }
      if (!current) current = c.kind;
      if (c.kind === 'sprite') { const o = c.opt; this.sprites.push(Math.round(c.x), Math.round(c.y), Math.round(c.size), Math.round(c.size), o.rot ?? 0, o.seed ?? (c.x * .173 + c.y * .31), c.shape, o.hard ?? .9, c.color[0], c.color[1], c.color[2], c.color[3], o.glow ?? .3, o.edge ?? 0, 0, o.flags ?? 0); }
      else if (c.kind === 'line') this.ribbons.push(c.points, c.width, c.color, c.opt);
      else this.polys.pushQuad(c.points, c.color, c.opt);
      if (batch === 'none' || (batch === 'sprites' && c.kind !== 'sprite')) flush();
    }
    flush();
    return { draws };
  }
}
