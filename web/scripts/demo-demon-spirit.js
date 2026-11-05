<script>
// ===== DEMON SPIRIT CORE — VFX design demo (test build only) =====
// 3 modes of the spirit core, each a layered VFX sequence:
//   Q Basic    — Spirit Ray:  wind-up -> 3 chained rays -> impacts
//   E Refined  — Spirit Beam: wind-up -> channeled beam -> tick bursts -> collapse
//   R Signature— Spirit Transit: blink-out -> target telegraph -> portal -> blink-in
(function () {
  function boot() {
    if (!window.__pfx || !window.__soh || !window.__soh.run || !window.__PFX244_MANIFEST__) { setTimeout(boot, 200); return; }
    var pfx = window.__pfx;
    pfx.injectManifest(window.__PFX244_MANIFEST__.effects);
    if (pfx.setNativeScale) pfx.setNativeScale(true); // native 1:1 render for evaluation
    var log = null;
    function say(t) { if (log) log.textContent = t; }
    function S(id, o) { pfx.spawn(id, o); }
    function beam(x0, y0, x1, y1, o) {
      var len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
      o = Object.assign({ x: x0, y: y0, family: 'hover', angle: a, stretch: Math.max(0.3, len / 240) }, o || {});
      S('arcane/arcane-beam', o);
    }
    function basic(P) {
      say('Q · BASIC — Spirit Ray: wind-up…');
      S('arcane/spell-charge', { x: P.x, y: P.y, family: 'body', loop: true, maxAgeMs: 420, scale: 0.9 });
      var pts = [];
      for (var i = 0; i < 3; i++) pts.push({ x: P.x + 150 + i * 46, y: P.y + (i % 2 ? -34 : 34) });
      var from = P;
      for (var j = 0; j < 3; j++) {
        (function (j, from, to) {
          var d = 420 + j * 170;
          beam(from.x, from.y, to.x, to.y, { delayMs: d, scale: 0.55, maxAgeMs: 240, loop: false });
          S('arcane/mana-burst', { x: to.x, y: to.y, family: 'ground', scale: 0.65, delayMs: d + 140 });
          S('impacts/impact-frame', { x: to.x, y: to.y, family: 'ground', scale: 0.5, delayMs: d + 180 });
        })(j, from, pts[j]);
        from = pts[j];
      }
      say('Q · BASIC — Spirit Ray: 3 chained rays + impacts');
    }
    function refined(P) {
      var T = { x: P.x + 230, y: P.y };
      say('E · REFINED — Spirit Beam: wind-up…');
      S('arcane/rune-circle', { x: P.x, y: P.y, family: 'ground', loop: true, maxAgeMs: 650, scale: 0.9 });
      S('arcane/spell-charge', { x: P.x, y: P.y, family: 'body', loop: true, maxAgeMs: 650, scale: 0.9 });
      beam(P.x, P.y, T.x, T.y, { delayMs: 650, scale: 0.9, loop: true, maxAgeMs: 1200 });
      for (var i = 0; i < 4; i++) {
        var d = 750 + i * 260;
        S('arcane/mana-burst', { x: T.x, y: T.y, family: 'ground', scale: 0.6, delayMs: d });
        S('impacts/impact-frame', { x: T.x, y: T.y, family: 'ground', scale: 0.45, delayMs: d + 40 });
      }
      S('arcane/blink-out', { x: T.x, y: T.y, family: 'ground', scale: 0.7, delayMs: 1900 });
      S('shadow/grasping-hands', { x: T.x, y: T.y, family: 'ground', scale: 0.9, delayMs: 1950 });
      S('shadow/hex-sigil', { x: T.x, y: T.y, family: 'ground', scale: 0.85, delayMs: 2050 });
      say('E · REFINED — channeled beam 1.2s, tick bursts, collapse');
    }
    function signature(P) {
      var T = { x: P.x + 260, y: P.y - 40 };
      say('R · SIGNATURE — Spirit Transit: depart…');
      S('arcane/blink-out', { x: P.x, y: P.y, family: 'body', scale: 1.1 });
      S('arcane/rune-circle', { x: T.x, y: T.y, family: 'ground', loop: true, maxAgeMs: 800, delayMs: 250, scale: 0.9 });
      S('arcane/portal', { x: T.x, y: T.y, family: 'ground', maxAgeMs: 850, delayMs: 450, scale: 0.8 });
      S('arcane/blink-in', { x: T.x, y: T.y, family: 'body', scale: 1.1, delayMs: 1050 });
      S('arcane/mana-burst', { x: T.x, y: T.y, family: 'ground', scale: 0.7, delayMs: 1100 });
      S('arcane/magic-circle-cast', { x: T.x, y: T.y, family: 'ground', scale: 0.7, delayMs: 1150 });
      S('shadow/hex-sigil', { x: T.x, y: T.y, family: 'ground', scale: 0.85, delayMs: 1250 });
      say('R · SIGNATURE — blink-out → telegraph → portal → blink-in');
    }
    function run(fn) {
      pfx.clear();
      var P = { x: window.__soh.run.player.x, y: window.__soh.run.player.y };
      fn(P);
    }
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(18,12,24,.93);border:1px solid #6b5a2a;border-radius:8px;padding:8px 10px;font:12px/1.5 monospace;color:#e8dcff;text-align:center';
    panel.innerHTML = '<b style="color:#d9a8ff">DEMON SPIRIT CORE — VFX demo</b> · ảnh full-res 100% (native 1:1)<br>' +
      '<button data-m="basic" style="margin:2px">Q Basic · Spirit Ray</button>' +
      '<button data-m="refined" style="margin:2px">E Refined · Spirit Beam</button>' +
      '<button data-m="signature" style="margin:2px">R Signature · Transit</button>' +
      '<div id="__demoLog" style="color:#ffd98a;min-height:14px"></div>';
    document.body.appendChild(panel);
    log = panel.querySelector('#__demoLog');
    panel.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { run(b.dataset.m === 'basic' ? basic : b.dataset.m === 'refined' ? refined : signature); };
    });
    say('Nhấn Q / E / R để xem 3 mode của Demon core');
  }
  boot();
})();
</script>
