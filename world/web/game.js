/* Veyra walk test — plain canvas, no engine.
   Loads the compiled world PNG + collision RLE and lets you walk the gold map. */
(() => {
  const VIEW_W = 640, VIEW_H = 360;          // logical native viewport
  const TILE = 16;
  const view = document.getElementById('view');
  const mini = document.getElementById('minimap');
  const vctx = view.getContext('2d');
  const mctx = mini.getContext('2d');
  vctx.imageSmoothingEnabled = false;
  mctx.imageSmoothingEnabled = false;

  const state = {
    world: null, meta: null, hero: null, solid: null,
    p: { x: 0, y: 0, dir: 'down', frame: 0, moving: false },
    keys: new Set(), speed: 96, run: 1.9, t: 0, showMap: true, fps: 0,
  };

  // ---------- loading -----------------------------------------------------
  async function boot() {
    const [meta, world, hero] = await Promise.all([
      fetch('../assets/world_meta.json').then(r => r.json()),
      loadImage('../assets/world.png'),
      loadImage('../assets/hero_walk.png'),
    ]);
    state.meta = meta; state.world = world; state.hero = hero;

    const [W, H] = meta.scale.tiles;
    state.solid = new Uint8Array(W * H);
    meta.collision.rows.forEach((runs, y) => {
      for (const [start, len, val] of runs) {
        if (val) state.solid.fill(1, y * W + start, y * W + start + len);
      }
    });

    state.cellpx = TILE * meta.scale.tiles_per_gold_cell;   // one gold cell in pixels
    const spawn = meta.spawns[0].at;
    placePlayer(spawn[0] * meta.scale.px_per_gold_unit, spawn[1] * meta.scale.px_per_gold_unit);
    document.getElementById('loading').remove();
    requestAnimationFrame(loop);
  }

  const loadImage = src => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });

  // ---------- collision ---------------------------------------------------
  function walkable(px, py) {
    const { tiles } = state.meta.scale;
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= tiles[0] || ty >= tiles[1]) return false;
    return state.solid[ty * tiles[0] + tx] === 0;
  }

  function canStand(px, py) {
    // feet box: 12 wide, 8 tall (the D051 body is 13x22 with the foot at cell y=44)
    const hw = 6, hh = 4;
    return walkable(px - hw, py - hh) && walkable(px + hw - 1, py - hh) &&
           walkable(px - hw, py + hh - 1) && walkable(px + hw - 1, py + hh - 1) &&
           walkable(px, py);
  }

  function placePlayer(x, y) {
    const { pixels } = state.meta.scale;
    x = Math.max(40, Math.min(pixels[0] - 40, x));
    y = Math.max(40, Math.min(pixels[1] - 40, y));
    if (!canStand(x, y)) {
      for (let r = 8; r < 600; r += 8) {
        let done = false;
        for (const [dx, dy] of [[0, -r], [r, 0], [0, r], [-r, 0], [r, -r], [-r, -r], [r, r], [-r, r]]) {
          if (canStand(x + dx, y + dy)) { x += dx; y += dy; done = true; break; }
        }
        if (done) break;
      }
    }
    state.p.x = x; state.p.y = y;
  }

  // ---------- input -------------------------------------------------------
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    state.keys.add(k);
    if (k === 'm') state.showMap = !state.showMap;
    if ('1234'.includes(k)) {
      const s = state.meta.spawns[+k - 1];
      if (s) placePlayer(s.at[0] * state.meta.scale.px_per_gold_unit,
                         s.at[1] * state.meta.scale.px_per_gold_unit);
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => state.keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => state.keys.clear());

  // ---------- loop --------------------------------------------------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    state.t += dt;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    const k = state.keys;
    let dx = 0, dy = 0;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    if (k.has('w') || k.has('arrowup')) dy -= 1;
    if (k.has('s') || k.has('arrowdown')) dy += 1;
    const run = k.has('shift') ? state.run : 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const sp = state.speed * run * dt;
      const nx = state.p.x + (dx / len) * sp;
      const ny = state.p.y + (dy / len) * sp;
      if (canStand(nx, state.p.y)) state.p.x = nx;
      if (canStand(state.p.x, ny)) state.p.y = ny;
      state.p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left')
                                                : (dy > 0 ? 'down' : 'up');
      state.p.moving = true;
      state.p.frame = Math.floor(state.t * 10 * run) % 6;
    } else {
      state.p.moving = false;
      state.p.frame = 0;
    }
  }

  function draw() {
    const { p } = state;
    const { pixels } = state.meta.scale;
    let cx = Math.round(p.x - VIEW_W / 2), cy = Math.round(p.y - VIEW_H / 2);
    cx = Math.max(0, Math.min(pixels[0] - VIEW_W, cx));
    cy = Math.max(0, Math.min(pixels[1] - VIEW_H, cy));

    vctx.clearRect(0, 0, VIEW_W, VIEW_H);
    vctx.drawImage(state.world, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    // hero: 64x64 cell, body bbox (25,22)-(38,44), foot at y=44
    const row = { down: 0, left: 1, right: 2, up: 3 }[p.dir] * 64;
    const col = p.frame * 64;
    const footX = Math.round(p.x - cx), footY = Math.round(p.y - cy);
    vctx.drawImage(state.hero, col, row, 64, 64, footX - 32, footY - 44, 64, 64);

    // nearest POI label
    let best = null, bestD = 260;
    for (const poi of state.meta.pois) {
      const px = poi.cell[0] * state.cellpx, py = poi.cell[1] * state.cellpx;
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < bestD) { bestD = d; best = poi; }
    }
    if (best) {
      const bx = best.cell[0] * state.cellpx - cx, by = best.cell[1] * state.cellpx - cy;
      vctx.font = '8px ui-monospace, monospace';
      vctx.fillStyle = 'rgba(10,12,16,.72)';
      const label = `${best.name} · ${best.arche}`;
      const w = vctx.measureText(label).width + 8;
      vctx.fillRect(bx - w / 2, by - 26, w, 12);
      vctx.fillStyle = '#ffd479';
      vctx.fillText(label, bx - w / 2 + 4, by - 17);
    }

    if (state.showMap) {
      const mw = mini.width, mh = mini.height;
      const sx2 = mw / pixels[0], sy2 = mh / pixels[1];
      mctx.clearRect(0, 0, mw, mh);
      mctx.drawImage(state.world, 0, 0, pixels[0], pixels[1], 0, 0, mw, mh);
      mctx.fillStyle = '#ff4d4d';
      mctx.fillRect(p.x * sx2 - 2, p.y * sy2 - 2, 4, 4);
      mctx.strokeStyle = 'rgba(255,255,255,.5)';
      mctx.strokeRect(cx * sx2, cy * sy2, VIEW_W * sx2, VIEW_H * sy2);
      mini.style.display = 'block';
    } else mini.style.display = 'none';

    document.getElementById('pos').textContent =
      `tile ${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)} · ${Math.round(p.x)},${Math.round(p.y)} px`;
  }

  if (typeof window !== 'undefined') window.__veyra = state;
  boot().catch(err => {
    document.getElementById('loading').textContent = 'failed to load: ' + err;
    console.error(err);
  });
})();
