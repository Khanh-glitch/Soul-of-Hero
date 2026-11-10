<script>
// ===== SOH VFX LAB — full 244-effect design lab (test build only) =====
// Stage: real game world with the player + 2 draggable enemy markers.
// Panel: pick effect, tune scale/offset/angle/stretch/lift/delay/duration/loop/family,
// cast at player/enemy/mouse, build multi-step combos on a timeline, export combo JSON.
// NOTE: this lab file embeds the pack at reduced quality for light weight — the exported
// combo JSON references effect ids only, so in the real game you load the SAME ids from
// the full-res batches (web/releases/pixelfx244-batches) and they render sharp 100%.
(function () {
  function boot() {
    if (!window.__pfx || !window.__soh || !window.__soh.run || !window.__PFX244_MANIFEST__) { setTimeout(boot, 200); return; }
    var pfx = window.__pfx;
    pfx.injectManifest(window.__PFX244_MANIFEST__.effects);
    var $ = function (s, r) { return (r || document).querySelector(s); };
    function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
    var BTN = 'background:#241a30;color:#e8dcff;border:1px solid #6b5a2a;border-radius:4px;padding:2px 7px;font:11px monospace;cursor:pointer';
    var INP = 'background:#160f20;color:#ffe27a;border:1px solid #6b5a2a;border-radius:4px;font:11px monospace;padding:1px 4px;width:58px';

    // ---- world <-> screen helpers ----
    function cvs() { return document.querySelector('canvas'); }
    function cam() { var r = window.__soh.run; return r.cam || r.camera || { x: r.player.x - 320, y: r.player.y - 180 }; }
    function w2s(x, y) { var c = cvs(), r = c.getBoundingClientRect(), k = r.width / 640, m = cam(); return { x: r.left + (x - m.x) * k, y: r.top + (y - m.y) * k }; }
    function s2w(sx, sy) { var c = cvs(), r = c.getBoundingClientRect(), k = r.width / 640, m = cam(); return { x: (sx - r.left) / k + m.x, y: (sy - r.top) / k + m.y }; }

    // ---- enemy markers (draggable) ----
    var enemies = [
      { name: 'Enemy A', x: 0, y: 0, div: null, color: '#ff6a5e' },
      { name: 'Enemy B', x: 0, y: 0, div: null, color: '#5ec8ff' },
    ];
    function placeEnemies() {
      var p = window.__soh.run.player;
      enemies[0].x = p.x + 90; enemies[0].y = p.y - 10;
      enemies[1].x = p.x + 140; enemies[1].y = p.y + 40;
      enemies.forEach(function (e) {
        if (!e.div) {
          e.div = el('div', 'position:fixed;z-index:99990;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid ' + e.color + ';border-radius:50%;cursor:grab;display:flex;align-items:center;justify-content:center;font:10px monospace;background:rgba(0,0,0,.45);color:#fff;pointer-events:auto', '🧟');
          e.div.title = e.name + ' — kéo để đổi vị trí';
          var drag = false, ox = 0, oy = 0;
          e.div.addEventListener('pointerdown', function (ev) { drag = true; ox = ev.clientX; oy = ev.clientY; e.div.setPointerCapture(ev.pointerId); });
          e.div.addEventListener('pointermove', function (ev) { if (!drag) return; var w = s2w(ev.clientX, ev.clientY); e.x += (ev.clientX - ox) / (cvs().getBoundingClientRect().width / 640); e.y += (ev.clientY - oy) / (cvs().getBoundingClientRect().width / 640); ox = ev.clientX; oy = ev.clientY; syncEnemy(e); });
          e.div.addEventListener('pointerup', function () { drag = false; });
          document.body.appendChild(e.div);
        }
        syncEnemy(e);
      });
    }
    function syncEnemy(e) { var s = w2s(e.x, e.y); e.div.style.left = s.x + 'px'; e.div.style.top = s.y + 'px'; }
    setInterval(function () { enemies.forEach(syncEnemy); }, 250);

    // ---- state ----
    var sel = null;               // selected effect id
    var anchor = 'player';        // player | enemyA | enemyB | mouse
    var mouseW = { x: 0, y: 0 };
    var combo = [];               // [{id, delay, params}]
    var comboCursor = 0;          // ms, where next added step lands
    var S = {
      scale: 1, offX: 0, offY: -8, angle: 0, stretch: 1, lift: 0,
      delay: 0, dur: 0, loop: false, family: 'ground',
    };

    function anchorPos() {
      var p = window.__soh.run.player;
      if (anchor === 'player') return { x: p.x, y: p.y };
      if (anchor === 'enemyA') return enemies[0];
      if (anchor === 'enemyB') return enemies[1];
      return mouseW;
    }
    function castNow(id, over) {
      var a = anchorPos();
      var o = Object.assign({
        x: a.x + (S.offX || 0), y: a.y + (S.offY || 0),
        family: S.family, scale: S.scale, angle: (S.angle || 0) * Math.PI / 180,
        stretch: S.stretch, lift: S.lift, loop: S.loop,
      }, over || {});
      if (S.delay) o.delayMs = S.delay;
      if (S.dur) o.maxAgeMs = S.dur;
      pfx.spawn(id, o);
    }

    // ---- panel ----
    var panel = el('div', 'position:fixed;top:8px;right:8px;z-index:99999;width:308px;max-height:92vh;overflow:auto;background:rgba(16,10,24,.95);border:1px solid #6b5a2a;border-radius:8px;padding:8px;font:11px/1.45 monospace;color:#e8dcff');
    panel.innerHTML =
      '<b style="color:#ffd98a">SOH VFX LAB</b> · 244 hiệu ứng · ảnh đang ở chất lượng lab (nhẹ); khi đưa vào game dùng batch full-res để nét 100%<br>' +
      '<input id="q" placeholder="tìm hiệu ứng… (vd fire, ice, arcane)" style="' + INP + ';width:100%;box-sizing:border-box;margin:4px 0">' +
      '<select id="cat" style="' + INP + '"></select>' +
      '<div id="list" style="max-height:130px;overflow:auto;border:1px solid #3a2f4a;margin:4px 0;padding:2px"></div>' +
      '<div style="border-top:1px solid #3a2f4a;padding-top:4px">' +
      'anchor: <select id="anchor" style="' + INP + '"><option value="player">🧍 player</option><option value="enemyA">🧟 enemy A</option><option value="enemyB">🧟 enemy B</option><option value="mouse">🖱 chuột</option></select> ' +
      'family: <select id="family" style="' + INP + '"><option>ground</option><option>hover</option><option>body</option><option>screen</option><option>proj</option></select><br>' +
      row('scale', 'scale', 0.1, 3, 0.05, S.scale) + row('offset X', 'offX', -200, 200, 1, S.offX) + row('offset Y', 'offY', -200, 200, 1, S.offY) +
      row('angle°', 'angle', -180, 180, 1, S.angle) + row('stretch', 'stretch', 0.2, 4, 0.05, S.stretch) + row('lift', 'lift', 0, 120, 1, S.lift) +
      row('delay ms', 'delay', 0, 5000, 50, S.delay) + row('duration ms (0=vô hạn)', 'dur', 0, 8000, 100, S.dur) +
      '<label><input type="checkbox" id="loop"> loop</label> ' +
      '<label><input type="checkbox" id="native"> native 1:1 (đúng chất lượng game)</label><br>' +
      '<button id="cast" style="' + BTN + '">▶ Cast</button> ' +
      '<button id="add" style="' + BTN + '">＋ vào combo @<span id="cur">0</span>ms</button> ' +
      '<button id="playc" style="' + BTN + '">▶ play combo</button> ' +
      '<button id="exp" style="' + BTN + '">⬇ export JSON</button> ' +
      '<button id="clr" style="' + BTN + '">clear</button> ' +
      '<button id="pse" style="' + BTN + '">⏸</button> ' +
      '<button id="fr" style="' + BTN + '">+frame</button><br>' +
      '<div id="combo" style="margin-top:4px"></div>' +
      '<div style="color:#9a8ab0;margin-top:4px">kéo 🧟 để đổi bia · rê chuột lên world là anchor chuột · H ẩn/hiện FxLab cũ</div>';
    document.body.appendChild(panel);
    function row(label, key, min, max, step, val) {
      return '<div>' + label + ' <input type="range" id="r_' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" style="width:110px;vertical-align:middle"> <input id="n_' + key + '" value="' + val + '" style="' + INP + ';width:52px"></div>';
    }
    // re-bind row inputs (innerHTML above created them)
    ['scale','offX','offY','angle','stretch','lift','delay','dur'].forEach(function (k) {
      var r = $('#r_' + k, panel), n = $('#n_' + k, panel);
      r.oninput = function () { S[k] = +r.value; n.value = r.value; };
      n.oninput = function () { S[k] = +n.value; r.value = n.value; };
    });
    $('#loop', panel).onchange = function (e) { S.loop = e.target.checked; };
    $('#native', panel).onchange = function (e) { if (pfx.setNativeScale) pfx.setNativeScale(e.target.checked); };
    $('#anchor', panel).onchange = function (e) { anchor = e.target.value; };
    $('#family', panel).onchange = function (e) { S.family = e.target.value; };
    cvs().addEventListener('pointermove', function (ev) { mouseW = s2w(ev.clientX, ev.clientY); });

    // catalog list
    var cats = {};
    window.__PFX244_MANIFEST__.effects.forEach(function (e) { var c = e.id.split('/')[0]; (cats[c] = cats[c] || []).push(e.id); });
    var catSel = $('#cat', panel);
    var PILOT20 = ['ice/ice-lance','arcane/arcane-orb','shadow/black-hole','fire/fireball','nature/quake','lightning/chain-lightning','ice/frost-nova','moves/ice-lance-throw','impacts/impact-frame','arcane/spell-charge','explosions/small-explosion'];
    catSel.appendChild(el('option', '', '★ arcana20 pilot (' + PILOT20.length + ')'));
    Object.keys(cats).sort().forEach(function (c) { catSel.appendChild(el('option', '', c + ' (' + cats[c].length + ')')); });
    function renderList() {
      var q = ($('#q', panel).value || '').toLowerCase();
      var c = catSel.value.split(' ')[0];
      var ids = (c === '★' ? PILOT20 : (cats[c] || [])).filter(function (id) { return !q || id.includes(q); });
      var list = $('#list', panel); list.innerHTML = '';
      ids.slice(0, 60).forEach(function (id) {
        var b = el('div', 'padding:1px 4px;cursor:pointer;border-radius:3px;' + (sel === id ? 'background:#4a3a6a' : ''), id);
        b.onclick = function () { sel = id; renderList(); };
        list.appendChild(b);
      });
      if (ids.length > 60) list.appendChild(el('div', 'color:#9a8ab0', '… ' + (ids.length - 60) + ' nữa, gõ search để lọc'));
    }
    $('#q', panel).oninput = renderList;
    catSel.onchange = renderList;
    renderList();

    // actions
    $('#cast', panel).onclick = function () { if (sel) castNow(sel); };
    $('#add', panel).onclick = function () {
      if (!sel) return;
      combo.push({ id: sel, at: comboCursor, p: Object.assign({}, S) });
      comboCursor += 250;
      $('#cur', panel).textContent = comboCursor;
      renderCombo();
    };
    $('#playc', panel).onclick = function () {
      pfx.clear();
      combo.forEach(function (c) { castNow(c.id, { delayMs: c.at, scale: c.p.scale, angle: c.p.angle * Math.PI / 180, stretch: c.p.stretch, lift: c.p.lift, loop: c.p.loop, family: c.p.family, maxAgeMs: c.p.dur || undefined, x: anchorPos().x + c.p.offX, y: anchorPos().y + c.p.offY }); });
    };
    $('#exp', panel).onclick = function () {
      var data = { note: 'VFX combo for SOH — load these ids from the full-res batches (web/releases/pixelfx244-batches) in the real game so art stays 100% sharp', steps: combo.map(function (c) { return { id: c.id, atMs: c.at, family: c.p.family, scale: c.p.scale, offX: c.p.offX, offY: c.p.offY, angleDeg: c.p.angle, stretch: c.p.stretch, lift: c.p.lift, durationMs: c.p.dur || null, loop: c.p.loop, anchor: anchor }; }) };
      var txt = JSON.stringify(data, null, 1);
      navigator.clipboard && navigator.clipboard.writeText(txt);
      var a = el('a'); a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(txt); a.download = 'soh-vfx-combo.json'; a.click();
      $('#combo', panel).appendChild(el('div', 'color:#8fe38f', '⬇ đã export ' + combo.length + ' bước (cũng đã copy vào clipboard)'));
    };
    $('#clr', panel).onclick = function () { pfx.clear(); };
    $('#pse', panel).onclick = function (e) { var p = !pfx.isPaused(); pfx.setPaused(p); e.target.textContent = p ? '▶' : '⏸'; };
    $('#fr', panel).onclick = function () { pfx.scrub(160); };
    function renderCombo() {
      var box = $('#combo', panel); box.innerHTML = '<b style="color:#d9a8ff">combo (' + combo.length + '):</b>';
      combo.forEach(function (c, i) {
        var d = el('div', 'padding:1px 2px;border-bottom:1px dotted #3a2f4a', '@' + c.at + 'ms ' + c.id + ' · scale ' + c.p.scale + ' · off(' + c.p.offX + ',' + c.p.offY + ') · ' + c.p.family + (c.p.loop ? ' · loop' : '') + ' <span style="color:#ff8a8a;cursor:pointer" data-i="' + i + '">✕</span>');
        d.querySelector('span').onclick = function () { combo.splice(i, 1); renderCombo(); };
        box.appendChild(d);
      });
    }
    placeEnemies();
    setTimeout(placeEnemies, 1500);
    window.__vfxlab = { cast: castNow, combo: combo, spawn: pfx.spawn };
    console.log('[vfxlab] ready: 244 effects, anchors player/enemyA/enemyB/mouse');
  }
  boot();
})();
</script>
