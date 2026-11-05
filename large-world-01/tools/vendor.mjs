#!/usr/bin/env node
/** Records exact source custody for the large-world pilot. Run from repo root. */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execSync } from 'node:child_process';
const ROOT = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PILOT = path.join(ROOT, 'large-world-01');
const sha = (b, a = 'sha256') => crypto.createHash(a).update(b).digest('hex');
const MAP = 'f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1';
const GP = 'e11a9b4471a0832cd6d039b5510725b10ee0275c';
const recs = [];
function walk(dir, rel = '') { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules','dist','.git','qa-shots'].includes(e.name)) continue; const p = path.join(dir, e.name), r = path.join(rel, e.name); if (e.isDirectory()) walk(p, r); else { const b = fs.readFileSync(p); recs.push({ file: r.replace(/\\/g,'/'), bytes: b.length, sha1: sha(b,'sha1'), sha256: sha(b) }); } } }
walk(path.join(PILOT, 'map-data'));
const out = {
  schema: 'soh.lw01.source_provenance.v1', generatedAt: new Date().toISOString(),
  mapHead: MAP, gameplayHead: GP,
  mapAuthority: 'veyra-world-master/CURRENT_WORLD_MASTER.json (WMP-04R1, v4/r1/manifest.r1.json)',
  gameplaySource: `git archive ${GP} web`,
  policy: 'Verbatim source custody. No retired WMP-04 / WMP-03-standalone / raw GOLD runtime substitution. GOLD polygons are AUTHORING GEOMETRY, sampled at tile centres; candidate rasters never mint Gameplay permission.',
  files: recs, fileCount: recs.length, totalBytes: recs.reduce((a,b)=>a+b.bytes,0),
  legacyWebFiles: (function(){let n=0;const w=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory())w(path.join(d,e.name));else n++;}};w(path.join(PILOT,'web-legacy'));return n;})(),
};
fs.writeFileSync(path.join(PILOT,'SOURCE_PROVENANCE.json'), JSON.stringify(out,null,2)+'\n');
console.log(`LW01_VENDOR_OK files=${recs.length} bytes=${out.totalBytes} legacyFiles=${out.legacyWebFiles} map=${MAP.slice(0,12)} gp=${GP.slice(0,12)}`);
