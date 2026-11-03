// Build web/releases/soh-avfx20-compare.html — self-contained playable comparison:
//   LEFT  = original C source (visual lead), vendored Visual Master cast #20
//   RIGHT = in-game Web build (#20 Current Web / Restored A+C candidate)
// Cross-file file:// iframes are opaque origins, so parent<->child control goes
// through postMessage (works cross-origin): reference gets {cmd:'select'/'phase'},
// game gets {cmd:'avfx20-boot'/'avfx20-seek'/'avfx20-mode'}.
// Labels corrected per CT 6599588234/6599933733: C SOURCE MASTER (8s wrapper UI
// over native 10.4s; phase normalized) vs A+C candidate — not two finished fusions.
import { readFileSync, writeFileSync } from 'fs';

const ref = readFileSync('releases/reference-arcana20-visual-master.html').toString('base64');
const game = readFileSync('dist/index.html').toString('base64');

const page = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>AVFX #20 — so sánh C gốc vs A+C candidate</title>
<style>
body{margin:0;background:#0a0f16;color:#e9f2fa;font-family:system-ui}
.bar{padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:#101c29;border-bottom:1px solid #283a4b}
button{background:#1b2f42;color:#cfe6f5;border:1px solid #33506b;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px}
button.on{background:#3d2b57;border-color:#9a6bd0}
button:hover{background:#244058}
.cols{display:flex;height:calc(100vh - 118px)}
.col{flex:1;display:flex;flex-direction:column;border-right:1px solid #283a4b}
.col h3{margin:0;padding:6px 10px;font-size:13px;background:#142437}
.col iframe{flex:1;border:0;width:100%}
.note{font-size:11px;color:#9badc1;padding:4px 12px;background:#0d1622;border-top:1px solid #283a4b}
#st{font-size:11px;color:#ffd9a0}
</style></head><body>
<div class="bar">
  <b>#20 Reality Ripper — so sánh</b>
  <span>Phase chuẩn hóa (native 10.4s):</span>
  <button data-t="0.6">0.6</button><button data-t="1.3">1.3</button><button data-t="2.7">2.7</button>
  <button data-t="4.5">4.5</button><button data-t="6.6">6.6</button><button data-t="7.8">7.8</button>
  <button data-t="9.5">9.5</button><button data-t="9.85">9.85</button>
  <button id="play">▶ play đồng bộ</button>
  <span id="st">đang khởi động…</span>
</div>
<div class="bar">
  <span>Game mode:</span>
  <button id="m-current">Current Web (warp A-style only)</button>
  <button id="m-restored" class="on">Restored A+C candidate</button>
</div>
<div class="cols">
  <div class="col"><h3>TRÁI: C gốc — visual lead (Visual Master cast #20, C SOURCE MASTER · EXACT PIXELS; đồng hồ 8s là wrapper, phase chuẩn hóa — KHÔNG phải bản A+C hoàn chỉnh)</h3><iframe id="ref"></iframe></div>
  <div class="col"><h3>PHẢI: game Soul of Hero thật (Web build → tự vào run và chơi #20 Restored A+C)</h3><iframe id="game"></iframe></div>
</div>
<div class="note">Bên trái là nguồn C được chọn (A chỉ là đóng góp môi trường theo vote). Cả hai bên scrub theo phase chuẩn hóa của cast native 10.4s.</div>
<script>
document.getElementById('ref').srcdoc = atob(${JSON.stringify(ref)});
document.getElementById('game').srcdoc = atob(${JSON.stringify(game)});
const st = (m) => { document.getElementById('st').textContent = m; };
let playing = false, t0 = 0, refCast = '';
const refEl = document.getElementById('ref'), gameEl = document.getElementById('game');
const post = (el, msg) => { try { el.contentWindow.postMessage(msg, '*'); } catch (e) {} };
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.cmd === 'cast') { refCast = d.name; st('reference pane = cast #' + d.index + ' "' + d.name + '" (C source master) · game pane = #20 Restored A+C'); }
});
function seekBoth(t) {
  post(refEl, { cmd: 'phase', p: Math.min(1, t / 10.4) });
  post(gameEl, { cmd: 'avfx20-seek', t });
  st((refCast ? 'ref: #' + refCast + ' · ' : '') + 'phase = ' + (t / 10.4).toFixed(3) + ' (native t = ' + t.toFixed(2) + 's / 10.4s)');
}
document.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { playing = false; seekBoth(parseFloat(b.dataset.t)); });
document.getElementById('play').onclick = () => {
  playing = !playing;
  if (playing) { t0 = performance.now(); const step = (n) => { if (!playing) return; const t = (n - t0) / 1000; if (t > 10.4) { playing = false; return; } seekBoth(t); requestAnimationFrame(step); }; requestAnimationFrame(step); }
};
function setMode(m) {
  document.getElementById('m-current').classList.toggle('on', m === 'current');
  document.getElementById('m-restored').classList.toggle('on', m === 'restored');
  post(gameEl, { cmd: 'avfx20-mode', m });
}
document.getElementById('m-current').onclick = () => setMode('current');
document.getElementById('m-restored').onclick = () => setMode('restored');
// boot: force reference cast #20, boot game into a run playing #20 restored
(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    post(refEl, { cmd: 'select', i: 19 }); // META[19] = index 20 Reality Ripper
    post(refEl, { cmd: 'phase', p: 0 });
    post(gameEl, { cmd: 'avfx20-boot' });
    if (refCast) break;
  }
  st('sẵn sàng — ref: ' + (refCast || 'cast #20') + ' · game: #20 Restored A+C. Dùng nút mốc thời gian hoặc play đồng bộ.');
})();
</script>
</body></html>`;

writeFileSync('releases/soh-avfx20-compare.html', page);
console.log('wrote releases/soh-avfx20-compare.html', (page.length / 1e6).toFixed(1) + 'MB');
