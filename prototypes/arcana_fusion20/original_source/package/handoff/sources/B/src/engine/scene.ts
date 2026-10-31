import { Renderer, W, H } from './renderer';
import { Effect } from './fx';
import { hash } from './math';

export function makeRenderer() {
  const r = new Renderer();
  r.anchors = [
    { x: 262, y: 104 }, { x: 318, y: 62 }, { x: 330, y: 160 }, { x: 196, y: 52 }, { x: 214, y: 176 }, { x: 150, y: 84 },
  ];
  return r;
}

/** Render one complete frame of `fx` at local time t into RGBA bytes. */
export function renderFrame(r: Renderer, fx: Effect | null, state: any, t: number, wall: number, out: Uint8ClampedArray) {
  r.begin();
  r.time = wall;
  const casting = fx ? Math.max(0, 1 - Math.abs(t - 0.3) * 1.5) : 0;
  r.drawActors(wall, casting);
  // drifting idle dust motes
  for (let k = 0; k < 24; k++) {
    const x = (hash(k) * W + wall * (3 + hash(k + 1) * 5)) % W;
    const y = (hash(k + 2) * H + Math.sin(wall * 0.5 + k) * 6 + H) % H;
    r.plot(Math.floor(x), Math.floor(y), 0.12, 0.13, 0.18, 0, 1);
  }
  if (fx && t >= 0) fx.render(r, Math.min(t, fx.duration), state);
  r.lighting();
  if (fx && fx.post && t >= 0) {
    r.setTarget(r.main);
    r.tx = r.ty = 0; r.ts = 1; r.clip = null;
    fx.post(r, Math.min(t, fx.duration), state);
  }
  r.setTarget(r.main);
  r.finalize(out);
}
