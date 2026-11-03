// Build web/releases/soh-avfx20-compare.html — self-contained playable comparison:
//   LEFT  = original C source (visual lead) from the vendored Visual Master
//   RIGHT = in-game Web build, toggle between "Current Web (A-style warp only)"
//           and "Restored A+C candidate"
// Labels are corrected per Control Tower 6599588234: the Visual Master displays
// the SELECTED C source (8s wrapper UI over the native 10.4s cast; phase is
// normalized, so displayed clock ≠ native seconds); it is NOT a certified A+C fusion.
import { readFileSync, writeFileSync } from 'fs';

const ref = readFileSync('releases/reference-arcana20-visual-master.html', 'utf-8');
const game = readFileSync('dist/index.html', 'utf-8');
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

const page = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>AVFX #20 — so sánh C gốc vs A+C candidate</title>
<style>
body{margin:0;background:#0a0f16;color:#e9f2fa;font-family:system-ui}
.bar{padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:#101c29;border-bottom:1px solid #283a4b}
button{background:#1b2f42;color:#cfe6f5;border:1px solid #33506b;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px}
button.on{background:#3d2b57;border-color:#9a6bd0}
button:hover{background:#244058}
.cols{display:flex;height:calc(100vh - 78px)}
.col{flex:1;display:flex;flex-direction:column;border-right:1px solid #283a4b}
.col h3{margin:0;padding:6px 10px;font-size:13px;background:#142437}
.col iframe{flex:1;border:0;width:100%}
.note{font-size:11px;color:#9badc1;padding:4px 12px;background:#0d1622;border-top:1px solid #283a4b}
#st{font-size:11px;color:#ffd9a0}
</style></head><body>
<div class="bar">
  <b>#20 Reality Ripper — so sánh</b>
  <span>Timeline (phase chuẩn hóa 0–10.4s native):</span>
  <button data-t="0.6">0.6</button><button data-t="1.3">1.3</button><button data-t="2.7">2.7</button>
  <button data-t="4.5">4.5</button><button data-t="6.6">6.6</button><button data-t="7.8">7.8</button>
  <button data-t="9.5">9.5</button><button data-t="9.85">9.85</button>
  <button id="play">▶ play đồng bộ</button>
  <span id="st"></span>
</div>
<div class="bar">
  <span>Game mode:</span>
  <button id="m-current">Current Web (warp A-style only)</button>
  <button id="m-restored" class="on">Restored A+C candidate</button>
</div>
<div class="cols">
  <div class="col"><h3>TRÁI: C gốc — visual lead được chọn (Visual Master cast 20, C SOURCE MASTER · EXACT PIXELS; UI hiển thị wrapper 8s, phase chuẩn hóa — KHÔNG phải bản A+C hoàn chỉnh)</h3><iframe id="ref"></iframe></div>
  <div class="col"><h3>PHẢI: game Soul of Hero thật (Web build, FX Lab F4 → #20)</h3><iframe id="game"></iframe></div>
</div>
<div class="note">Lưu ý: tham chiếu bên trái là nguồn C được chọn (A chỉ là đóng góp môi trường theo vote, không có trong reference renderer). Both sides scrub by normalized phase of the native 10.4s cast — displayed 8s clock on the left is the wrapper UI, not native seconds.</div>
<script>
const REF = ${JSON.stringify(esc(ref))};
const GAME = ${JSON.stringify(esc(game))};
document.getElementById('ref').srcdoc = REF;
document.getElementById('game').srcdoc = GAME;
const st = (m) => { document.getElementById('st').textContent = m; };
let playing = false, t0 = 0;
const refW = () => document.getElementById('ref').contentWindow;
const gameW = () => document.getElementById('game').contentWindow;
function seekBoth(t) {
  try { const r = refW(); if (r && typeof r.setPhase === 'function') r.setPhase(Math.min(1, t / 10.4)); } catch (e) {}
  try { const g = gameW(); if (g && g.__d20qa) g.__d20qa.seek(t); } catch (e) {}
  st('phase = ' + (t / 10.4).toFixed(3) + '  (native t = ' + t.toFixed(2) + 's / 10.4s)');
}
document.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { playing = false; seekBoth(parseFloat(b.dataset.t)); });
document.getElementById('play').onclick = () => {
  playing = !playing;
  if (playing) { t0 = performance.now(); const step = (n) => { if (!playing) return; const t = (n - t0) / 1000; if (t > 10.4) { playing = false; return; } seekBoth(t); requestAnimationFrame(step); }; requestAnimationFrame(step); }
};
function setMode(m) {
  document.getElementById('m-current').classList.toggle('on', m === 'current');
  document.getElementById('m-restored').classList.toggle('on', m === 'restored');
  try { const g = gameW(); if (g && g.__d20qa) g.__d20qa.client.mode = m; } catch (e) {}
}
document.getElementById('m-current').onclick = () => setMode('current');
document.getElementById('m-restored').onclick = () => setMode('restored');
(async () => {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const g = gameW(); if (!g || !g.document) continue;
      const d = g.document;
      const click = (label) => { const el = [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes(label)); if (el && !el.disabled) { el.click(); return true; } return false; };
      if (click('New run')) { await new Promise(r => setTimeout(r, 500)); click('Meadow Bay'); await new Promise(r => setTimeout(r, 300)); click('Begin the 14 days'); }
      await new Promise(r => setTimeout(r, 2500));
      if (g.__d20qa) { g.__d20qa.client.mode = 'restored'; g.__d20qa.play(); st('sẵn sàng — scrub mốc thời gian hoặc play đồng bộ; đổi mode bằng nút bên trên'); return; }
    } catch (e) {}
  }
  st('nếu game chưa vào run: mở F4 trong game, bấm #20 ▶ (QA) rồi dùng các nút mốc thời gian như nhau ở hai bên');
})();
</script>
</body></html>`;

writeFileSync('releases/soh-avfx20-compare.html', page);
console.log('wrote releases/soh-avfx20-compare.html', (page.length / 1e6).toFixed(1) + 'MB');
