// Build web/releases/soh-avfx20-compare.html — a single self-contained file that
// inlines BOTH the creator-approved reference master (donor e41ae670) and the
// current in-game build, with matched-timeline sync controls. Works over file://.
import { readFileSync, writeFileSync } from 'fs';

const ref = readFileSync('releases/reference-arcana20-visual-master.html', 'utf-8');
const game = readFileSync('dist/index.html', 'utf-8');

const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

const page = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>AVFX #20 — so sánh 1:1 bản gốc vs game</title>
<style>
body{margin:0;background:#0a0f16;color:#e9f2fa;font-family:system-ui}
.bar{padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:#101c29;border-bottom:1px solid #283a4b}
button{background:#1b2f42;color:#cfe6f5;border:1px solid #33506b;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px}
button:hover{background:#244058}
.cols{display:flex;height:calc(100vh - 46px)}
.col{flex:1;display:flex;flex-direction:column;border-right:1px solid #283a4b}
.col h3{margin:0;padding:6px 10px;font-size:13px;background:#142437}
.col iframe{flex:1;border:0;width:100%}
#st{font-size:11px;color:#9badc1;padding:2px 12px}
</style></head><body>
<div class="bar">
  <b>#20 Reality Ripper — 1:1</b>
  <span id="st">đang khởi động…</span>
  <span>Timeline:</span>
  <button data-t="0.6">0.6</button><button data-t="1.3">1.3</button><button data-t="2.7">2.7</button>
  <button data-t="4.5">4.5</button><button data-t="6.6">6.6</button><button data-t="7.8">7.8</button>
  <button data-t="9.5">9.5</button><button data-t="9.85">9.85</button>
  <button id="play">▶ play cả hai</button>
</div>
<div class="cols">
  <div class="col"><h3>TRÁI: BẢN GỐC được duyệt (Visual Master, donor e41ae670, cast 20)</h3><iframe id="ref"></iframe></div>
  <div class="col"><h3>PHẢI: game Soul of Hero (Web build, FX Lab F4 → #20 Restored A+C)</h3><iframe id="game"></iframe></div>
</div>
<script>
const REF = ${JSON.stringify(esc(ref))};
const GAME = ${JSON.stringify(esc(game))};
document.getElementById('ref').srcdoc = REF;
document.getElementById('game').srcdoc = GAME;
const st = (m) => { document.getElementById('st').textContent = m; };
let t0 = 0, playing = false, raf = 0;
const refW = () => document.getElementById('ref').contentWindow;
const gameW = () => document.getElementById('game').contentWindow;
function seekBoth(t) {
  try { const r = refW(); if (r && typeof r.setPhase === 'function') r.setPhase(Math.min(1, t / 10.4)); } catch (e) {}
  try { const g = gameW(); if (g && g.__d20qa) g.__d20qa.seek(t); } catch (e) {}
  st('t = ' + t.toFixed(2) + 's');
}
document.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { playing = false; seekBoth(parseFloat(b.dataset.t)); });
document.getElementById('play').onclick = () => {
  playing = !playing;
  if (playing) { t0 = performance.now(); const step = (n) => { if (!playing) return; const t = (n - t0) / 1000; if (t > 10.4) { playing = false; return; } seekBoth(t); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
};
// auto-drive the game iframe into a run + FX Lab #20
(async () => {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const g = gameW(); if (!g || !g.document) continue;
      const d = g.document;
      const txt = (el) => (el && el.textContent || '').trim();
      const click = (label) => { const el = [...d.querySelectorAll('button')].find(b => txt(b).includes(label)); if (el && !el.disabled) { el.click(); return true; } return false; };
      if (click('New run')) { await new Promise(r => setTimeout(r, 500)); click('Meadow Bay'); await new Promise(r => setTimeout(r, 300)); click('Begin the 14 days'); }
      await new Promise(r => setTimeout(r, 2500));
      if (g.__d20qa) { g.__d20qa.play(); st('sẵn sàng — chọn mốc thời gian ở trên (game: F4 nếu panel chưa mở)'); return; }
    } catch (e) {}
  }
  st('game iframe chưa vào được run — mở F4 trong game rồi dùng nút #20 ▶ (QA) và các mốc thời gian như nhau ở hai bên');
})();
</script>
</body></html>`;

writeFileSync('releases/soh-avfx20-compare.html', page);
console.log('wrote releases/soh-avfx20-compare.html', (page.length / 1e6).toFixed(1) + 'MB');
