<script>
// ===== DEMON SPIRIT CORE — VFX design demo v2 (test build only) =====
// Fixes vs v1:
//  1. NO screen-wide / transition effects anywhere; impacts stay small and LOCAL.
//  2. Sustained beam ends with a plain fade (no collapse combo).
//  3. Teleport is a fast minimal blink-out -> blink-in (movement, not a ceremony).
//  4. All spawns anchored to the character: ground = feet at (x,y); body uses small
//     explicit lift (player center) instead of the big default hover lift.
(function () {
  function boot() {
    if (!window.__pfx || !window.__soh || !window.__soh.run || !window.__PFX244_MANIFEST__) { setTimeout(boot, 200); return; }
    var pfx = window.__pfx;
    pfx.injectManifest(window.__PFX244_MANIFEST__.effects);
    if (pfx.setNativeScale) pfx.setNativeScale(true); // native 1:1 render for evaluation
    var log = null;
    function say(t) { if (log) log.textContent = t; }
    function S(id, o) { pfx.spawn(id, o); }
    // character anchor: player is 16px tall -> feet at (x,y), center at (x, y-8)
    function anchor() { var p = window.__soh.run.player; return { feet: { x: p.x, y: p.y }, mid: { x: p.x, y: p.y - 8 } }; }
    function beam(x0, y0, x1, y1, o) {
      var len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
      o = Object.assign({ x: x0, y: y0, family: 'body', lift: 8, angle: a, stretch: Math.max(0.3, len / 240) }, o || {});
      S('arcane/arcane-beam', o);
    }
    // Q — BASIC: 3-hit palm combo at melee range. Local small bursts only.
    function basic() {
      var A = anchor(), F = A.feet;
      say('Q · BASIC — 3-hit palm combo: wind-up…');
      S('arcane/spell-charge', { x: A.mid.x, y: A.mid.y, family: 'body', lift: 8, loop: true, maxAgeMs: 380, scale: 0.8 });
      var offs = [[96, -10], [114, 12], [104, -22]];
      for (var i = 0; i < 3; i++) {
        var T = { x: F.x + offs[i][0], y: F.y + offs[i][1] }, d = 380 + i * 150;
        var a = Math.atan2(T.y - A.mid.y, T.x - A.mid.x);
        S('melee/claw-swipe', { x: A.mid.x, y: A.mid.y, family: 'body', lift: 8, angle: a, scale: 0.7, maxAgeMs: 190, delayMs: d });
        S('arcane/mana-burst', { x: T.x, y: T.y, family: 'ground', scale: 0.42, delayMs: d + 60 });
      }
      say('Q · BASIC — 3 đòn chưởng liên tiếp, nổ gọn tại điểm trúng');
    }
    // E — REFINED: channeled beam, even ticks, plain fade-out at the end.
    function refined() {
      var A = anchor(), F = A.feet;
      var T = { x: F.x + 170, y: F.y - 4 };
      say('E · REFINED — Spirit Beam: wind-up…');
      S('arcane/spell-charge', { x: A.mid.x, y: A.mid.y, family: 'body', lift: 8, loop: true, maxAgeMs: 500, scale: 0.75 });
      beam(A.mid.x, A.mid.y, T.x, T.y, { delayMs: 500, scale: 0.8, loop: true, maxAgeMs: 1100 });
      for (var i = 0; i < 4; i++) {
        var d = 600 + i * 260;
        S('arcane/mana-burst', { x: T.x, y: T.y, family: 'ground', scale: 0.38, delayMs: d });
      }
      S('arcane/mana-burst', { x: T.x, y: T.y, family: 'ground', scale: 0.3, delayMs: 1650 }); // plain fade tick, no collapse
      say('E · REFINED — beam kênh đều 1.1s, tick nhỏ, kết thúc mờ dần');
    }
    // R — SIGNATURE: fast minimal transit. blink-out -> blink-in, nothing else big.
    function signature() {
      var A = anchor(), F = A.feet;
      var T = { x: F.x + 240, y: F.y - 30 };
      say('R · SIGNATURE — Spirit Transit: blink…');
      S('arcane/blink-out', { x: A.mid.x, y: A.mid.y, family: 'body', lift: 8, scale: 0.9 });
      S('arcane/blink-in', { x: T.x, y: T.y - 8, family: 'body', lift: 8, scale: 0.9, delayMs: 420 });
      S('arcane/mana-burst', { x: T.x, y: T.y, family: 'ground', scale: 0.32, delayMs: 460 });
      say('R · SIGNATURE — dịch chuyển nhanh: blink-out → blink-in');
    }
    function run(fn) { pfx.clear(); fn(); }
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(18,12,24,.93);border:1px solid #6b5a2a;border-radius:8px;padding:8px 10px;font:12px/1.5 monospace;color:#e8dcff;text-align:center';
    panel.innerHTML = '<b style="color:#d9a8ff">DEMON SPIRIT CORE — VFX demo v2</b> · full-res 100% (native 1:1)<br>' +
      '<button data-m="basic">Q Basic · 3-hit palm</button> ' +
      '<button data-m="refined">E Refined · Spirit Beam</button> ' +
      '<button data-m="signature">R Signature · Transit</button>' +
      '<div id="__demoLog" style="color:#ffd98a;min-height:14px"></div>';
    document.body.appendChild(panel);
    log = panel.querySelector('#__demoLog');
    panel.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { run(b.dataset.m === 'basic' ? basic : b.dataset.m === 'refined' ? refined : signature); };
    });
    window.addEventListener('keydown', function (ev) {
      if (ev.code === 'KeyQ') run(basic);
      else if (ev.code === 'KeyE') run(refined);
      else if (ev.code === 'KeyR') run(signature);
    });
    say('Nhấn Q / E / R (hoặc click nút) để xem 3 mode — v2 đã neo đúng vào nhân vật');
  }
  boot();
})();
</script>
