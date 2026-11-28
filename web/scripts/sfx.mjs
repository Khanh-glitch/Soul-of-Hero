#!/usr/bin/env node
// ============================================================================
// SFX hand-over tool.  Run from web/:   node scripts/sfx.mjs <command>
//
//   table                 write the slot table (docs/sfx/BANG_SLOT_SFX.md and slots.csv)
//   folders               create public/sfx/<group>/ and an empty index.json
//   sort <folder>         read a delivered folder and PROPOSE a slot for every file
//                         (writes <folder>/_soh-plan.tsv; copies nothing)
//   apply <plan.tsv>      copy the files of a reviewed plan into public/sfx under their slot names
//   index                 scan public/sfx, check the names, write public/sfx/index.json
//   status                what is filled, what is borrowed, what is still synthesized or silent
//
// The slot catalogue is src/game/sfx/slots.ts; this script reads it directly.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(WEB, 'public', 'sfx');
const DOCS = path.resolve(WEB, '..', 'docs', 'sfx');
const cat = await import(pathToFileURL(path.join(WEB, 'src/game/sfx/slots.ts')).href);
const { SFX_SLOTS, SFX_SLOT, SFX_GROUPS, SFX_EXTENSIONS, sfxFileName, slotOfFile } = cat;
const EXT = new Set(SFX_EXTENSIONS.map(e => '.' + e));

const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]) : [];
const posix = p => p.split(path.sep).join('/');
const audioIn = dir => walk(dir).filter(f => EXT.has(path.extname(f).toLowerCase())).sort();

function filled() {
  const slots = {}; const strangers = [];
  for (const f of audioIn(PUB)) {
    const rel = posix(path.relative(PUB, f)); const id = slotOfFile(rel);
    if (!id || !SFX_SLOT[id] || rel !== `${SFX_SLOT[id].group}/${path.basename(f)}`) { strangers.push(rel); continue; }
    (slots[id] ||= []).push(rel);
  }
  return { slots, strangers };
}
function standIn(id, slots) {
  let cur = id;
  for (let hop = 0; cur && hop < 5; hop++) { if (slots[cur]?.length) return cur === id ? 'file' : `mượn ${cur}`; cur = SFX_SLOT[cur]?.borrow; }
  cur = id;
  for (let hop = 0; cur && hop < 5; hop++) { const s = SFX_SLOT[cur]; if (!s) break; if (s.synth) return 'tiếng tổng hợp'; cur = s.borrow; }
  return 'im lặng';
}
/** Length in seconds of a PCM .wav, or null (other formats cannot be measured without a decoder). */
function wavSeconds(file) {
  try {
    const b = fs.readFileSync(file); if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
    let o = 12, rate = 0;
    while (o + 8 <= b.length) {
      const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
      if (id === 'fmt ') rate = b.readUInt32LE(o + 16);          // byte rate
      if (id === 'data') return rate ? Math.min(size, b.length - o - 8) / rate : null;
      o += 8 + size + (size & 1);
    }
  } catch { /* unreadable: not measured */ }
  return null;
}
/** Longest length a slot expects, in seconds, read from its `len` text ("200–400 ms", "2–3.5 s", "vòng 6–12 s"). */
function maxSeconds(slot) {
  let best = 0;
  const text = slot.len.replace(/,/g, '.');
  const nums = [...text.matchAll(/([\d.]+)/g)].map(x => +x[1]); const unit = /ms/.test(text) ? 0.001 : 1;
  for (const n of nums) best = Math.max(best, n * unit);
  return best || null;
}

const PRIO = { 1: 'P1 cần trước', 2: 'P2 nên có', 3: 'P3 thêm cho đẹp' };
const MODE = { shot: 'một lần', loop: 'vòng lặp', bed: 'nền' };
const GROUPS = Object.keys(SFX_GROUPS);

const cmd = process.argv[2]; const arg = process.argv[3];
if (cmd === 'table') {
  const { slots } = filled();
  fs.mkdirSync(DOCS, { recursive: true });
  const total = SFX_SLOTS.reduce((n, s) => n + s.n, 0);
  const byP = [1, 2, 3].map(p => SFX_SLOTS.filter(s => s.prio === p));
  let md = `# Bảng slot SFX — Soul of Hero (bản web)\n\n`;
  md += `Bảng này do \`node scripts/sfx.mjs table\` sinh ra từ \`web/src/game/sfx/slots.ts\`. Sửa slot thì sửa ở file đó rồi chạy lại lệnh.\n\n`;
  md += `- Tổng: **${SFX_SLOTS.length} slot**, đủ bản thì cần **${total} file**.\n`;
  md += byP.map((l, i) => `- ${PRIO[i + 1]}: ${l.length} slot, ${l.reduce((n, s) => n + s.n, 0)} file.`).join('\n') + '\n';
  md += `- Tên file: \`<nhóm>/<tên slot>__NN.<đuôi>\`, NN bắt đầu từ 01, đuôi ${SFX_EXTENSIONS.join(' / ')}. Ví dụ \`${sfxFileName(SFX_SLOTS[0].id, 1, 'ogg')}\`.\n`;
  md += `- Cột "Hiện nay": **file** = đã có file; **mượn X** = đang dùng file của slot X; **tiếng tổng hợp** = máy tự phát tiếng tạm; **im lặng** = chưa có gì.\n\n`;
  for (const g of GROUPS) {
    const rows = SFX_SLOTS.filter(s => s.group === g); if (!rows.length) continue;
    md += `## ${SFX_GROUPS[g].title} (\`${g}\`) — ${rows.length} slot\n\n| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |\n|---|---|---|---|---|---|---|---|\n`;
    for (const s of rows) md += `| \`${s.id}\` | P${s.prio} | ${MODE[s.mode]} | ${s.n} | ${s.len} | ${s.when} | ${s.sound} | ${standIn(s.id, slots)} |\n`;
    md += '\n';
  }
  fs.writeFileSync(path.join(DOCS, 'BANG_SLOT_SFX.md'), md);
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ['slot,nhom,uu_tien,kieu,so_ban,do_dai,khi_nao,nghe_ra_sao,tu_khoa,ten_file_mau,hien_nay']
    .concat(SFX_SLOTS.map(s => [s.id, s.group, s.prio, s.mode, s.n, s.len, s.when, s.sound, s.kw.join(' '), sfxFileName(s.id, 1, 'ogg'), standIn(s.id, slots)].map(q).join(',')));
  fs.writeFileSync(path.join(DOCS, 'slots.csv'), '\ufeff' + csv.join('\n') + '\n');
  console.log(`wrote ${path.relative(process.cwd(), path.join(DOCS, 'BANG_SLOT_SFX.md'))} and slots.csv: ${SFX_SLOTS.length} slots, ${total} files wanted`);
} else if (cmd === 'folders') {
  for (const g of GROUPS) { fs.mkdirSync(path.join(PUB, g), { recursive: true }); const keep = path.join(PUB, g, '.gitkeep'); if (!fs.existsSync(keep)) fs.writeFileSync(keep, ''); }
  if (!fs.existsSync(path.join(PUB, 'index.json'))) fs.writeFileSync(path.join(PUB, 'index.json'), JSON.stringify({ version: 1, slots: {} }) + '\n');
  console.log(`public/sfx ready: ${GROUPS.length} group folders`);
} else if (cmd === 'sort') {
  if (!arg || !fs.existsSync(arg)) { console.error('usage: node scripts/sfx.mjs sort <delivered folder>'); process.exit(2); }
  const words = p => posix(p).replace(/\.[a-z0-9]+$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1);
  const stem = w => w.replace(/(ing|es|s)$/, '');
  const { slots: have } = filled(); const next = {}; const rows = []; let sure = 0, unsure = 0, none = 0;
  for (const f of audioIn(arg)) {
    const rel = posix(path.relative(arg, f)); const named = slotOfFile(path.basename(f));
    let id = named && SFX_SLOT[named] ? named : '', score = id ? 99 : 0, second = 0, why = id ? 'tên file đã đúng slot' : '';
    if (!id) {
      const w = new Set(words(rel).flatMap(x => [x, stem(x)]));
      const scored = SFX_SLOTS.map(s => {
        const hits = s.kw.filter(k => w.has(k) || w.has(stem(k)));
        const parts = s.id.split('.').filter(k => w.has(k) || w.has(stem(k)));
        return { s, score: hits.length + parts.length * 0.75 + (w.has(s.group) ? 0.25 : 0), hits: [...new Set([...hits, ...parts])] };
      }).sort((a, b) => b.score - a.score || a.s.prio - b.s.prio);
      if (scored[0].score >= 1) { id = scored[0].s.id; score = scored[0].score; second = scored[1]?.score ?? 0; why = `khớp: ${scored[0].hits.join(' ')}` + (scored[1]?.score >= score - 0.5 ? ` · gần bằng: ${scored[1].s.id}` : ''); }
    }
    const certain = score >= 99 || (score >= 2 && score - second >= 1);
    if (!id) none++; else if (certain) sure++; else unsure++;
    let target = '';
    if (id) { const used = (have[id]?.length ?? 0) + (next[id] ?? 0); next[id] = (next[id] ?? 0) + 1; target = sfxFileName(id, used + 1, path.extname(f).slice(1).toLowerCase()); }
    const secs = wavSeconds(f);
    rows.push([!id ? 'BO' : certain ? 'OK' : 'XEM', rel, id, target, secs === null ? '' : secs.toFixed(2), why].join('\t'));
  }
  const plan = path.join(arg, '_soh-plan.tsv');
  fs.writeFileSync(plan, ['# trang_thai\tfile_goc\tslot\tfile_dich\tgiay\tly_do', '# OK = chắc; XEM = cần người xem lại; BO = chưa tìm được slot. Sửa cột slot hoặc file_dich rồi chạy: node scripts/sfx.mjs apply <file này>', ...rows].join('\n') + '\n');
  const empty = SFX_SLOTS.filter(s => !(have[s.id]?.length) && !next[s.id]);
  console.log(`${rows.length} audio files: ${sure} sure, ${unsure} to review, ${none} without a slot`);
  console.log(`slots that would still be empty: ${empty.length} of ${SFX_SLOTS.length} (P1: ${empty.filter(s => s.prio === 1).length})`);
  console.log(`plan written: ${plan}`);
} else if (cmd === 'apply') {
  if (!arg || !fs.existsSync(arg)) { console.error('usage: node scripts/sfx.mjs apply <plan.tsv>'); process.exit(2); }
  const root = path.dirname(arg); let copied = 0, skipped = 0;
  for (const line of fs.readFileSync(arg, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [state, src, id, target] = line.split('\t');
    if (state === 'BO' || !id || !target) { skipped++; continue; }
    if (!SFX_SLOT[id] || slotOfFile(target) !== id || !target.startsWith(SFX_SLOT[id].group + '/')) { console.error(`bad line, not copied: ${line}`); skipped++; continue; }
    const from = path.join(root, src), to = path.join(PUB, target);
    if (!fs.existsSync(from)) { console.error(`missing source: ${src}`); skipped++; continue; }
    if (fs.existsSync(to)) { console.error(`exists, not overwritten: ${target}`); skipped++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); copied++;
  }
  console.log(`copied ${copied}, skipped ${skipped}. Now run: node scripts/sfx.mjs index`);
} else if (cmd === 'index' || cmd === 'status') {
  const { slots, strangers } = filled();
  const notes = [];
  for (const [id, files] of Object.entries(slots)) {
    const s = SFX_SLOT[id]; const max = maxSeconds(s);
    for (const rel of files) {
      const abs = path.join(PUB, rel); const size = fs.statSync(abs).size; const secs = wavSeconds(abs);
      if (s.mode === 'shot' && size > 1_500_000) notes.push(`${rel}: ${(size / 1e6).toFixed(1)} MB is heavy for a one-shot`);
      if (s.mode !== 'shot' && /\.(mp3|m4a)$/i.test(rel)) notes.push(`${rel}: mp3/m4a leave a gap at the loop point; ogg or wav loops cleanly`);
      if (secs !== null && max && s.mode === 'shot' && secs > max * 2.5) notes.push(`${rel}: ${secs.toFixed(1)} s, the slot expects about ${s.len}`);
    }
  }
  if (cmd === 'index') {
    fs.mkdirSync(PUB, { recursive: true });
    // a per-file loudness trim set by hand ({ "f": "...", "g": 0.8 }) survives a re-index
    const gains = {};
    try { for (const list of Object.values(JSON.parse(fs.readFileSync(path.join(PUB, 'index.json'), 'utf8')).slots ?? {})) for (const v of list) if (v && typeof v === 'object' && typeof v.g === 'number') gains[v.f] = v.g; } catch { /* no index yet */ }
    // b = size in bytes: the game plans its loading and shows its budget from it
    const ids = Object.keys(slots).sort();
    const line = id => ` ${JSON.stringify(id)}: [${slots[id].sort().map(f => JSON.stringify({ f, ...(f in gains ? { g: gains[f] } : {}), b: fs.statSync(path.join(PUB, f)).size })).join(', ')}]`;
    fs.writeFileSync(path.join(PUB, 'index.json'), `{"version": 1, "slots": {\n${ids.map(line).join(',\n')}\n}}\n`);
  }
  const n = Object.values(slots).reduce((a, l) => a + l.length, 0);
  console.log(`${cmd === 'index' ? 'index.json written: ' : ''}${Object.keys(slots).length} of ${SFX_SLOTS.length} slots have files (${n} files)`);
  for (const p of [1, 2, 3]) {
    const all = SFX_SLOTS.filter(s => s.prio === p); const st = all.map(s => standIn(s.id, slots));
    console.log(`  P${p}: ${st.filter(x => x === 'file').length} file, ${st.filter(x => x.startsWith('mượn')).length} borrowed, ${st.filter(x => x === 'tiếng tổng hợp').length} synthesized, ${st.filter(x => x === 'im lặng').length} silent  (of ${all.length})`);
  }
  if (cmd === 'status') for (const g of GROUPS) {
    const all = SFX_SLOTS.filter(s => s.group === g); const got = all.filter(s => slots[s.id]?.length);
    console.log(`  ${g.padEnd(8)} ${String(got.length).padStart(3)}/${String(all.length).padEnd(3)} ${all.filter(s => !slots[s.id]?.length && s.prio === 1).map(s => s.id).slice(0, 6).join(' ')}`);
  }
  if (strangers.length) { console.log(`files in public/sfx that match no slot name (ignored by the game): ${strangers.length}`); for (const f of strangers.slice(0, 30)) console.log('  ' + f); }
  if (notes.length) { console.log(`notes: ${notes.length}`); for (const t of notes.slice(0, 40)) console.log('  ' + t); }
} else if (cmd === 'dump') {
  // The slot facts the audio build (scripts/sfx-build/make.py) needs, as JSON on stdout.
  const out = {};
  for (const s of SFX_SLOTS) out[s.id] = { group: s.group, mode: s.mode, len: s.len, vol: s.vol, prio: s.prio, n: s.n, spatial: s.spatial, borrow: s.borrow ?? null, synth: s.synth ?? null };
  process.stdout.write(JSON.stringify(out));
} else {
  console.log('usage: node scripts/sfx.mjs table | folders | sort <folder> | apply <plan.tsv> | index | status | dump');
  process.exit(cmd ? 2 : 0);
}
