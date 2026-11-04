// Builds web/releases/SOH-ARCANA20-VISUAL-TEST.html from dist/index.html.
// Test artifact only — the shipped game code (dist) is not modified; the boot
// shim below is injected before <title> and:
//  v2 fix: instead of guessing save validity up front (a shallow version check
//    let stale v3 copies through and the game still fail-closed to
//    "Save recovery required"), the shim now watches for the recovery screen
//    that the game itself renders. Only when the game has rejected every save
//    copy does it clear soh.state.* / soh.quarantine.* + IDB "soul-of-hero"
//    (once per tab, via a URL hash marker) and reload. A valid v3 save is
//    therefore never touched.
//  Then it auto-starts a new run (Meadow Bay) and opens the FX Lab (F9) with
//    the ARCANA20 dropdown listing all 20 skills for visual testing.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');

const SHIM = `<script>
    // ===== SOH ARCANA20 VISUAL TEST build — boot shim v2 (test artifact only;
    // the shipped game code is untouched). =====
    (function () {
      // 1) Recovery watcher: only act after the GAME itself fail-closed to the
      //    "Save recovery required" screen (i.e. every save copy on this origin
      //    was rejected). Then clear stale copies once per tab and reload.
      //    A valid save is never touched because we never clear unless the game
      //    already rejected all copies.
      try {
        var ALREADY = /vistest-cleared/.test(location.hash);
        function clearStaleSaves(done) {
          try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && (k.indexOf('soh.state.') === 0 || k.indexOf('soh.quarantine.') === 0)) localStorage.removeItem(k); } } catch (e) {}
          try {
            var rq = indexedDB.deleteDatabase('soul-of-hero');
            var fin = (function () { var f = false; return function () { if (!f) { f = true; done(); } }; })();
            rq.onsuccess = fin; rq.onerror = fin; rq.onblocked = fin;
            setTimeout(fin, 1500);
          } catch (e) { done(); }
        }
        if (!ALREADY) {
          var obs = new MutationObserver(function () {
            try {
              var h = document.querySelector('h1');
              if (h && h.textContent && h.textContent.indexOf('Save recovery required') >= 0) {
                obs.disconnect();
                clearStaleSaves(function () { location.hash = 'vistest-cleared'; location.reload(); });
              }
            } catch (e) {}
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
        }
      } catch (e) {}
      // 2) Auto-start a new run (Meadow Bay) and open the FX Lab (F9).
      function clickText(t) {
        var els = document.querySelectorAll('button');
        for (var i = 0; i < els.length; i++) if (els[i].textContent.indexOf(t) >= 0) { els[i].click(); return true; }
        return false;
      }
      var step = 0;
      var iv = setInterval(function () {
        try {
          if (step === 0 && clickText('New run')) step = 1;
          else if (step === 1 && clickText('Meadow Bay')) step = 2;
          else if (step === 2 && clickText('Begin the 14 days')) step = 3;
          else if (step === 3 && window.__soh && window.__soh.run && window.__arcanaLab) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F9', bubbles: true }));
            clearInterval(iv);
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;background:rgba(18,12,24,.93);color:#ffe27a;border:1px solid #6b5a2a;border-radius:8px;padding:8px 12px;font:12px/1.6 monospace;max-width:360px;pointer-events:none';
            d.innerHTML = 'BẢN TEST 20 CHIÊU (file test, không phải bản chính)<br>• Tự dọn save cũ nếu game báo "Save recovery required" rồi tự reload (chỉ khi game từ chối mọi bản save; save hợp lệ không bị đụng)<br>• F9: mở/đóng FX Lab · chọn chiêu ở dropdown "ARCANA20 lab" để cast lên world thật<br>• @climax / ▶lead / C-study / fusion? và thanh scrub + open/peak/out để xem các pha<br>• H: thu gọn lab để chụp màn hình sạch.';
            document.body.appendChild(d);
          }
        } catch (e) {}
      }, 600);
    })();
    </script>
    `;

const dist = readFileSync(join(web, 'dist/index.html'), 'utf8');
if (!dist.includes('<title>')) throw new Error('dist/index.html has no <title> to anchor the shim');
if (dist.includes('VISUAL TEST build')) throw new Error('shim already injected — rebuild from a clean dist');
const out = dist.replace('<title>', SHIM + '<title>');
const target = join(web, 'releases/SOH-ARCANA20-VISUAL-TEST.html');
writeFileSync(target, out);
const sha = createHash('sha256').update(out).digest('hex');
console.log('wrote', target);
console.log('sha256', sha);
